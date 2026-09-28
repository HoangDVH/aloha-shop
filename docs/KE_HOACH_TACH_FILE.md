# Kế hoạch tách file lớn (> 800 dòng) — aloha-shop-standalone

> Tài liệu dành cho người thực hiện. Đọc hết mục 1–3 trước khi động vào code.
> Số dòng trong tài liệu đo ngày 28/09/2026 trên nhánh `main` — có thể lệch vài dòng nếu file đã được sửa sau đó; luôn tìm theo **tên hàm / đường dẫn route**, không tìm theo số dòng.

---

## 1. Mục tiêu và nguyên tắc vàng

**Mục tiêu:** chia các file quá dài thành nhiều file nhỏ (~300–500 dòng, 1 trách nhiệm) để dễ đọc, dễ review, ít conflict — **không thay đổi bất kỳ hành vi nào** (API trả về y hệt, giao diện y hệt, dữ liệu không bị đụng).

**6 nguyên tắc bắt buộc (cách Google / Meta / Shopify làm "pure refactor"):**

1. **Chỉ di chuyển code, không sửa logic.** Cắt nguyên khối → dán sang file mới → thêm `import`/`export`. Không đổi tên biến, không "tiện tay" tối ưu, không sửa bug trong cùng PR. Thấy bug → ghi lại, sửa ở PR riêng sau.
2. **Giữ nguyên "mặt tiền" (public API) của file cũ.** File cũ vẫn tồn tại, vẫn export đúng các tên cũ (`registerShopApi`, `loadRevenueRankMap`, `CategoryMobileNav`, `CtvAdminShell` default…). Nhờ vậy **không phải sửa bất kỳ file nào đang import nó**.
3. **Giữ nguyên thứ tự đăng ký route / middleware.** Express khớp theo thứ tự khai báo. File tổng phải gọi các module con **đúng thứ tự như code gốc từ trên xuống**.
4. **State dùng chung chỉ có 1 bản.** Biến cấp module (cache `Map`, `inflightProducers`, listener SSE…) phải nằm trong **đúng 1 file**, các file khác import nó. Không copy.
5. **1 file lớn = 1 nhánh = 1 PR**, commit nhỏ theo từng bước. Có lỗi → `git revert` đúng PR đó.
6. **Không đụng database.** Không migration, không script ghi dữ liệu. Vì vậy rủi ro mất dữ liệu = 0; rủi ro duy nhất là lỗi code → được chặn bởi mục 2.

**Cảnh báo quan trọng:** push/merge vào `main` sẽ **tự deploy production** (xem `docs/CI_CD_VPS.md`). Chỉ merge khi đã qua toàn bộ checklist ở mục 3.

---

## 2. Chuẩn bị chung (làm 1 lần, trước Giai đoạn 1)

### 2.1. Dọn trạng thái git & công cụ bảo vệ

- Commit hoặc stash các thay đổi đang dở (hiện có `frontend/components/CategoryNavMenu.tsx`, `frontend/components/SiteChrome.tsx` chưa commit).
- Không commit `frontend/.next/` (file build); nếu đang bị git theo dõi thì chạy `git rm -r --cached frontend/.next` và đảm bảo `.gitignore` đã có `frontend/.next/` và `node_modules/` (Rủi ro 29).
- Tạo file `.gitattributes` ở thư mục gốc với nội dung `* text=auto eol=lf` để chuẩn hóa xuống dòng LF trên Windows, tránh diff toàn bộ file do lỗi CRLF/LF và hỏng encoding tiếng Việt UTF-8 (Rủi ro 24).
- Tạo file `.git-blame-ignore-revs` sẵn sàng để lưu hash các commit chuyển code thuần túy, giúp lệnh `git blame` vẫn bảo tồn được lịch sử tác giả gốc (Rủi ro 26).
- Đo baseline import vòng (circular imports) cho backend bằng công cụ `madge` (Rủi ro 1):
  ```bash
  npx madge --circular --extensions ts backend/ > docs/refactor/madge-baseline.txt
  ```
- Tạo nhánh gốc cho đợt refactor: `git checkout -b refactor/split-files main`. Mỗi file lớn tách nhánh con từ đây, ví dụ `refactor/split-catalog-register`.

### 2.2. Thêm kiểm tra kiểu cho backend

Backend chạy bằng `tsx` nên **không kiểm tra kiểu** — lỗi import sai chỉ lộ ra lúc chạy. Thêm:

`tsconfig.backend.json` (ở thư mục gốc):

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": false,
    "noEmit": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "resolveJsonModule": true
  },
  "include": ["backend/**/*.ts"],
  "exclude": ["backend/**/*.test.ts"]
}
```

`package.json` (gốc) thêm script:

```json
"typecheck:api": "tsc -p tsconfig.backend.json",
"typecheck:web": "npm run lint --prefix frontend",
"typecheck": "npm run typecheck:api && npm run typecheck:web"
```

Chạy `npm run typecheck` trên `main` **trước khi tách**. Nếu `main` đã có lỗi sẵn → lưu danh sách lỗi vào `docs/refactor/typecheck-baseline.txt`; tiêu chí sau khi tách là **không phát sinh lỗi mới** so với baseline.

### 2.3. Script so sánh danh sách route (bắt buộc cho Giai đoạn 1)

Tạo `scripts/refactor/dump-routes.ts`. Script dùng một `app` giả để ghi lại mọi lệnh `app.get/post/...` theo đúng thứ tự, không mở cổng, không kết nối DB:

```ts
import { registerShopApi } from "../../backend/shopCatalog/register.js";
import { registerShopCtvMeRoutes } from "../../backend/shopOrders/ctvMeRoutes.js";
import { registerShopArticlesRoutes } from "../../backend/shopArticles/register.js";
import { registerShopCommissionAdminRoutes } from "../../backend/shopOrders/commissionAdminRoutes.js";

const calls: string[] = [];
const METHODS = ["get", "post", "put", "patch", "delete", "use", "options", "all"];
const app: any = new Proxy({}, {
  get: (_t, prop: string) => (...args: unknown[]) => {
    if (!METHODS.includes(prop)) return;
    const p = args[0];
    const path = typeof p === "string" ? p : Array.isArray(p) ? p.join("|") : "(middleware)";
    calls.push(`${prop.toUpperCase().padEnd(7)} ${path}  [handlers=${args.length - 1}]`);
  },
});
const noDb: any = async () => { throw new Error("no db in route dump"); };

registerShopApi(app, noDb, noDb, noDb);
registerShopCtvMeRoutes(app, noDb, noDb);
registerShopArticlesRoutes(app, noDb, noDb);
registerShopCommissionAdminRoutes(app, noDb, noDb);

console.log(calls.join("\n"));
```

Cách dùng:

```bash
npx tsx scripts/refactor/dump-routes.ts > docs/refactor/routes-before.txt   # trên main
# ... tách file ...
npx tsx scripts/refactor/dump-routes.ts > /tmp/routes-after.txt
git diff --no-index docs/refactor/routes-before.txt /tmp/routes-after.txt   # PHẢI rỗng
```

> Khi tách thêm module có hàm `register...` mới, script **không cần sửa** vì file tổng vẫn gọi chúng bên trong.

### 2.4. Script chụp kết quả API (characterization test)

Tạo `scripts/refactor/api-snapshot.cjs`: gọi danh sách URL, bỏ các field thay đổi theo thời gian, ghi JSON ra thư mục.

```js
// node scripts/refactor/api-snapshot.cjs <BASE_URL> <OUT_DIR>
// Env tuỳ chọn: ADMIN_COOKIE, CTV_COOKIE (copy từ trình duyệt đã đăng nhập)
const fs = require("fs"); const path = require("path");
const [base, out] = process.argv.slice(2);

if (!base || !out) {
  console.error("Usage: node scripts/refactor/api-snapshot.cjs <BASE_URL> <OUT_DIR>");
  process.exit(1);
}

// RỦI RO 36: Tuyệt đối không chạy snapshot vào domain production tránh bẩn dữ liệu thật
if (/alohasg\.com|alohachaucay\.com/i.test(base)) {
  console.error("LỖI BẢO MẬT: Tuyệt đối không chạy script snapshot vào domain production!");
  process.exit(1);
}

const PUBLIC = [
  "/api/shop/health",
  "/api/shop/categories",
  "/api/shop/category-tree",
  "/api/shop/products?limit=24",
  "/api/shop/products?limit=24&page=2",
  "/api/shop/products?badge=noi_bat&limit=48",
  "/api/shop/products?badge=moi&limit=48",
  "/api/shop/products?home=1&limit=24",
  "/api/shop/products?q=kim%20tien&limit=24",
  "/api/shop/products?categoryId=694736&limit=48",
  "/api/shop/products?sort=price_asc&limit=24",
  "/api/shop/facets?q=kim%20tien",
  "/api/shop/facets?all=1",
  "/api/shop/products/KN3GT30",
  "/api/shop/products/KN3GT30/variants",
  "/api/shop/products/HPBTS",
  "/api/shop/resolve?slug=kn3gt30",
  "/api/shop/articles",
  "/api/shop/articles/categories",
  "/api/shop/sitemap-data",
];

const ADMIN = [
  "/api/shop/admin/ctv/settings",
  "/api/shop/admin/ctv/product-rates?limit=50",
  "/api/shop/admin/ctv/product-rates-stats",
  "/api/shop/admin/ctv/overrides",
  "/api/shop/admin/ctv/commissions?limit=50",
  "/api/shop/admin/ctv/stats",
  "/api/shop/admin/ctv/bills",
  "/api/shop/admin/ctv/fraud",
  "/api/shop/admin/ctv/overview",
];

const CTV = [
  "/api/shop/ctv/me/stats", "/api/shop/ctv/me/overview", "/api/shop/ctv/me/commissions",
  "/api/shop/ctv/me/bills", "/api/shop/ctv/me/conversions", "/api/shop/ctv/me/rate",
  "/api/shop/ctv/me/payout-bank",
];

// RỦI RO 9: Case lỗi - đảm bảo status HTTP và response lỗi giữ nguyên
const ERROR_CASES = [
  "/api/shop/products/KHONG_TON_TAI",
  "/api/shop/products?page=-1",
  "/api/shop/admin/ctv/bills/abc/export.xlsx",
];

// RỦI RO 38: Case không quyền - gọi route nội bộ không kèm cookie phải trả 401/403
const UNAUTH_CASES = [
  "/api/shop/admin/ctv/settings",
  "/api/shop/admin/ctv/overview",
  "/api/shop/ctv/me/overview",
];

const VOLATILE = /^(at|now|ts|generatedAt|serverTime|elapsedMs|tookMs|cachedAt)$/;
const scrub = (v) => Array.isArray(v) ? v.map(scrub)
  : v && typeof v === "object" ? Object.fromEntries(Object.entries(v).filter(([k]) => !VOLATILE.test(k)).map(([k, x]) => [k, scrub(x)]))
  : v;
(async () => {
  fs.mkdirSync(out, { recursive: true });
  const groups = [
    [PUBLIC, ""],
    [ADMIN, process.env.ADMIN_COOKIE || ""],
    [CTV, process.env.CTV_COOKIE || ""],
    [ERROR_CASES, ""],
    [UNAUTH_CASES, ""],
  ];
  for (const [urls, cookie] of groups) for (const u of urls) {
    const r = await fetch(base + u, { headers: cookie ? { cookie } : {} });
    let body; try { body = scrub(await r.json()); } catch { body = "(non-json)"; }
    const file = path.join(out, u.replace(/[^a-z0-9]+/gi, "_") + ".json");
    fs.writeFileSync(file, JSON.stringify({ status: r.status, body }, null, 2));
  }
  console.log("done", out);
})();
```

So sánh: `git diff --no-index snap-before snap-after` → **phải rỗng** (trừ khi dữ liệu thật thay đổi giữa 2 lần chụp — vì vậy xem 2.5).

### 2.5. Môi trường so sánh (không đụng production)

Để 2 lần chụp có cùng dữ liệu, chạy **cả bản cũ lẫn bản mới trên cùng 1 bản sao DB, trên máy local**:

1. Lấy bản sao DB: `mongodump --db aloha_shop_db --db aloha_thumua` trên VPS (hoặc dùng bản trong `/var/backups/aloha-mongo`), tải về, `mongorestore` vào Mongo local.
2. Tắt các worker có ghi dữ liệu khi chạy local (poller tồn KV, video reconcile…) bằng biến môi trường tương ứng, hoặc chấp nhận chạy — vì chỉ là DB local.
3. Chạy `main` ở cổng 3001 → chụp `snap-before`. Dừng. Checkout nhánh refactor → chạy lại cổng 3001 → chụp `snap-after`. So sánh.

> Không trỏ local vào DB production để test — một số route GET có ghi cache/đếm lượt.

### 2.6. Chặn file phình lại (tuỳ chọn, khuyến nghị)

Sau khi xong cả 3 giai đoạn: thêm ESLint rule `max-lines: ["warn", { max: 800, skipBlankLines: true, skipComments: true }]` cho `backend/**` và `frontend/**`.

---

## 3. Quy trình chuẩn cho MỖI file (checklist)

Làm lần lượt, mỗi bước 1 commit:

1. `git checkout -b refactor/split-<ten-file> refactor/split-files`
2. Trên code gốc: chạy `dump-routes` (nếu là backend) + `api-snapshot` → lưu "before".
3. Tạo thư mục/module mới, **chuyển helper thuần trước** (hàm không phụ thuộc state: format, parse, slug…). Commit.
4. Chuyển từng nhóm route / component con. Mỗi nhóm 1 commit. Sau mỗi commit chạy `npm run typecheck` (TC-12).
5. File gốc chỉ còn: import + hàm tổng gọi các module con **đúng thứ tự** + `export` các tên cũ.
6. Chạy lại `dump-routes` → diff rỗng (TC-05).
7. Chạy lại `api-snapshot` → diff rỗng (TC-06, TC-08, TC-09, TC-38).
8. **Kiểm tra import vòng:** chạy `npx madge --circular --extensions ts backend/` → không có vòng mới so với baseline (TC-01).
9. **Kiểm tra state dùng chung:** chạy `rg -n "new Map<|syncBus\.on\(" backend/` → đảm bảo không bị nhân đôi instance cache hay listener (TC-04).
10. `npm run build --prefix frontend` thành công; so sánh kích thước First Load JS của từng route không tăng quá 2 KB (TC-13, TC-20).
11. **Kiểm tra kết nối SSE (nếu có):** mở/đóng tab 20 lần, kiểm tra `syncBus.listenerCount` không bị rò rỉ (TC-07).
12. Test tay theo "Checklist kiểm thử tay" của file đó (mục 4–7) và toàn bộ các test case bắt buộc trong mục 12.5.
13. Mở PR: mô tả "pure move, không đổi hành vi", đính kèm output diff rỗng của bước 6–7. Người review kiểm tra bằng `git diff -M --color-moved=dimmed-zebra` (code chỉ di chuyển sẽ hiện màu mờ; chỉ các dòng import/export mới là thay đổi thật) (TC-27, TC-28).
14. Merge vào `main` **ngoài giờ cao điểm** → CI tự deploy → gọi ngay `POST /api/shop/cache/clear` để dọn cache cũ (TC-33); theo dõi `pm2 logs aloha-shop-api` và `pm2 logs aloha-shop` 15 phút đầu và liên tục trong 24h; mở web thử các trang chính (TC-32, TC-35).
15. Lỗi → `git revert <merge-commit>` + push (CI deploy lại bản cũ) (TC-34).

**Quy ước import backend:** dự án dùng ESM — import file TypeScript nội bộ phải ghi đuôi **`.js`** (ví dụ `import { x } from "./helpers/cache.js";`), giống các import hiện có trong `backend/shop_standalone_server.ts` (TC-02).

**Quy ước import frontend:** dùng alias `@/` như code hiện tại (`@/components/...`) (TC-14). Component có hook/state phải giữ `"use client"` ở đầu **mỗi** file con nếu file gốc có (TC-15).

---

## 4. GIAI ĐOẠN 0 — Dọn code không dùng (làm trước, rủi ro rất thấp)

| File | Lý do | Cách làm |
|---|---|---|
| `backend/utils/scanProductQr.ts` (1.972) | Không file nào import; là code trình duyệt (camera/canvas) nằm nhầm trong backend | Xoá |
| `backend/utils/printPriceLabels.ts` (1.096) | Chỉ được import bởi các file cùng nhóm không dùng | Xoá |
| `backend/utils/printBarcodeLabels.ts` (1.078) | Như trên | Xoá |
| `backend/utils/printReceipt80mm.ts` | Như trên | Xoá |
| `backups/` (23 file, có `register.ts` 1.852 dòng) | Bản backup bị commit; lịch sử git đã là backup | `git rm -r backups/` |

Trước khi xoá, xác nhận lại không ai dùng:

```bash
rg -n "scanProductQr|printPriceLabels|printBarcodeLabels|printReceipt80mm" --glob '!node_modules' --glob '!.next'
```

Chỉ được thấy chính các file đó. Sau khi xoá: `npm run typecheck` + `npm run build --prefix frontend` + khởi động API không lỗi.

`ShopCtvAffiliateAdminLegacy.tsx` (1.588): **chưa xoá** — vẫn được `CtvAdminShell.tsx` import (dòng ~40). Hỏi chủ sản phẩm tab "legacy" còn dùng không. Nếu không → xoá import + file ở PR riêng. Nếu còn → tách ở Giai đoạn 3.

- **Rủi ro áp dụng (tham chiếu Mục 11):** A10 (code "không dùng" nhưng vẫn bị gọi động qua string/cron/repo khác).
- **Test case bắt buộc (tham chiếu Mục 12):** TC-10, TC-12, TC-13, SMK.

---

## 5. GIAI ĐOẠN 1 — Backend (ưu tiên cao nhất)

Thứ tự làm: **5.1 → 5.2 → 5.3** (từ file ít phụ thuộc ra ngoài nhất đến file nhiều nhất). Ước lượng: 1,5–2 ngày/file kể cả kiểm thử.

### 5.1. `backend/shopOrders/commissionAdminRoutes.ts` (2.193 dòng)

**Ai dùng:** chỉ `backend/shop_standalone_server.ts` dòng ~229: `registerShopCommissionAdminRoutes(app, getOpsDb, getDb)`.

**Cấu trúc đích:**

```
backend/shopOrders/commissionAdmin/
  shared.ts            // gate (requireAuth/requireActive/requireManager), vietLooseRegexSource, type GetDb, hằng số dùng chung
  settings.ts          // GET/PATCH /api/shop/admin/ctv/settings
  productRates.ts      // POST product-rates, POST product-rates/bulk, GET product-rates-stats, GET product-rates
  overrides.ts         // GET/PUT/DELETE /api/shop/admin/ctv/overrides
  commissions.ts       // GET /api/shop/admin/ctv/commissions
  commissions.query.ts // phần dựng filter/aggregate của route commissions (tách để route < 150 dòng)
  stats.ts             // GET /api/shop/admin/ctv/stats
  bills.ts             // GET bills, POST bills/lock, POST bills/:period/mark-paid
  fraud.ts             // GET fraud, POST commissions/clear-flag, confirm-fraud, clear-soft-flags, POST fraud/review, POST fraud/:id/review
  affiliateDetail.ts   // GET /api/shop/admin/ctv/affiliates/:ctvCode, POST /api/shop/admin/ctv/:ctvCode/ban
  overview.ts          // GET /api/shop/admin/ctv/overview
  billsExport.ts       // GET /api/shop/admin/ctv/bills/:period/export.xlsx
backend/shopOrders/commissionAdminRoutes.ts   // GIỮ LẠI: chỉ còn hàm tổng
```

**Bảng chuyển code (theo thứ tự trong file gốc — file tổng phải gọi đúng thứ tự này):**

| # | Dòng gốc (≈) | Nội dung | Sang file | Hàm đăng ký mới |
|---|---|---|---|---|
| 0 | 1–83 | import, `vietLooseRegexSource`, khai báo `gate` | `shared.ts` | — |
| 1 | 84–106 | settings GET/PATCH | `settings.ts` | `registerSettings(app, ctx)` |
| 2 | 107–435 | product-rates (4 route) | `productRates.ts` | `registerProductRates(app, ctx)` |
| 3 | 436–510 | overrides | `overrides.ts` | `registerOverrides(app, ctx)` |
| 4 | 511–940 | commissions | `commissions.ts` (+ `commissions.query.ts`) | `registerCommissions(app, ctx)` |
| 5 | 941–988 | stats | `stats.ts` | `registerStats(app, ctx)` |
| 6 | 989–1102 | bills, lock, mark-paid | `bills.ts` | `registerBills(app, ctx)` |
| 7 | 1103–1334 | fraud + 5 route POST | `fraud.ts` | `registerFraud(app, ctx)` |
| 8 | 1335–1789 | affiliates/:ctvCode + ban | `affiliateDetail.ts` | `registerAffiliateDetail(app, ctx)` |
| 9 | 1790–2078 | overview | `overview.ts` | `registerOverview(app, ctx)` |
| 10 | 2079–hết | export.xlsx | `billsExport.ts` | `registerBillsExport(app, ctx)` |

`ctx` = object chứa những gì các route đang dùng từ closure của hàm gốc, ví dụ:

```ts
export type CommissionAdminCtx = {
  getOpsDb: GetDb;
  getDb: GetDb;
  gate: RequestHandler[];
  // + biến khác mà hàm gốc khai báo trước khi đăng ký route (đọc kỹ dòng 71–83)
};
```

File tổng sau khi tách:

```ts
export function registerShopCommissionAdminRoutes(app: Express, getOpsDb: GetDb, getDb: GetDb) {
  const ctx = buildCommissionAdminCtx(getOpsDb, getDb);
  registerSettings(app, ctx);
  registerProductRates(app, ctx);
  registerOverrides(app, ctx);
  registerCommissions(app, ctx);
  registerStats(app, ctx);
  registerBills(app, ctx);
  registerFraud(app, ctx);
  registerAffiliateDetail(app, ctx);
  registerOverview(app, ctx);
  registerBillsExport(app, ctx);
}
```

**Điểm dễ sai:**
- `POST /api/shop/admin/ctv/bills/lock` phải đăng ký **trước** `POST /api/shop/admin/ctv/:ctvCode/ban` (giữ nguyên thứ tự như bảng trên là đúng).
- `GET /api/shop/admin/ctv/bills/:period/export.xlsx` và `GET /api/shop/admin/ctv/bills` khác path nên không xung đột, nhưng vẫn giữ thứ tự.
- Nếu 2 route dùng chung 1 hàm helper khai báo **bên trong** `registerShopCommissionAdminRoutes` → chuyển helper đó vào `shared.ts` (hoặc vào `ctx`), không copy 2 nơi.

**Kiểm thử tay:** trang admin CTV → tab Tổng quan, Hoa hồng (lọc theo kỳ, theo CTV), Cấu hình hoa hồng (sửa 1 % rồi hoàn lại), Chống gian lận (xem danh sách), Danh sách CTV → mở chi tiết 1 CTV, xuất Excel 1 kỳ.

- **Rủi ro áp dụng (tham chiếu Mục 11):** A1 (import vòng), A2 (thiếu đuôi `.js`), A5 (thứ tự route), A6 (mất closure `ctx`/`gate`), A9 (xử lý lỗi `try/catch`), G38 (mất middleware bảo vệ `gate`), G39 (N+1 queries).
- **Test case bắt buộc (tham chiếu Mục 12):** TC-01, TC-02, TC-04, TC-05, TC-06, TC-08, TC-09, TC-12, TC-38, TC-39, SMK, REG-CTV-ADMIN.

---

### 5.2. `backend/shopOrders/ctvMeRoutes.ts` (1.322 dòng)

**Ai dùng:** `backend/shop_standalone_server.ts` dòng ~222: `registerShopCtvMeRoutes(app, getDb, getOpsDb)`.

**Cấu trúc đích:**

```
backend/shopOrders/ctvMe/
  shared.ts                 // auth middleware, requireActiveCtv, summarizeCtvCommissionStatus, type
  stats.route.ts            // GET /api/shop/ctv/me/stats
  overview.route.ts         // GET /api/shop/ctv/me/overview (chỉ parse request + trả response)
  overview.service.ts       // phần tính toán của overview (≈ 350 dòng)
  commissions.route.ts      // GET /api/shop/ctv/me/commissions
  bills.route.ts            // GET /api/shop/ctv/me/bills
  conversions.route.ts      // GET /api/shop/ctv/me/conversions
  conversions.service.ts    // phần tính toán của conversions (≈ 300 dòng)
  stream.route.ts           // GET /api/shop/ctv/me/stream (SSE)
  profile.route.ts          // GET /api/shop/ctv/me/rate, GET/PUT /api/shop/ctv/me/payout-bank
backend/shopOrders/ctvMeRoutes.ts   // GIỮ LẠI: hàm tổng
```

| Dòng gốc (≈) | Nội dung | Sang |
|---|---|---|
| 1–136 | import, `summarizeCtvCommissionStatus`, phần đầu hàm tổng (auth, helper) | `shared.ts` |
| 137–268 | `/me/stats` | `stats.route.ts` |
| 269–666 | `/me/overview` | `overview.route.ts` + `overview.service.ts` |
| 667–806 | `/me/commissions` | `commissions.route.ts` |
| 807–841 | `/me/bills` | `bills.route.ts` |
| 842–1191 | `/me/conversions` | `conversions.route.ts` + `conversions.service.ts` |
| 1192–1246 | `/me/stream` | `stream.route.ts` |
| 1247–hết | `/me/rate`, `/me/payout-bank` GET/PUT | `profile.route.ts` |

**Cách tách service an toàn:** trong handler gốc, phần giữa `try {` và `res.json(...)` thường là: đọc `req` → truy vấn DB → tính toán → trả object. Chuyển **phần truy vấn + tính toán** thành hàm `async function buildCtvOverview(db, opsDb, ctx, query): Promise<ResultType>`; handler chỉ còn gọi hàm và `res.json(result)`. Giữ nguyên mọi `res.status(...)` sớm (trả lỗi) trong handler.

**Điểm dễ sai:** route SSE `/me/stream` giữ kết nối lâu — phải giữ nguyên phần `req.on("close")`/huỷ interval/huỷ listener, không được bỏ sót khi chuyển file (nếu sót sẽ rò rỉ bộ nhớ).

**Kiểm thử tay:** đăng nhập tài khoản CTV test → trang CTV của tôi: tổng quan, hoa hồng, kỳ thanh toán, chuyển đổi, sửa tài khoản ngân hàng rồi hoàn lại; để trang mở 2 phút xem realtime vẫn cập nhật (SSE).

- **Rủi ro áp dụng (tham chiếu Mục 11):** A1 (import vòng), A2 (thiếu đuôi `.js`), A6 (closure `opsDb`), A7 (rò rỉ SSE listener `/me/stream`), A8 (thiếu `await`), A9 (xử lý lỗi), G37 (bí mật tài khoản ngân hàng), G38 (mất auth), G39 (N+1 query overview/conversions).
- **Test case bắt buộc (tham chiếu Mục 12):** TC-01, TC-02, TC-06, TC-07, TC-08, TC-09, TC-12, TC-37, TC-38, TC-39, SMK, REG-CTV-ME.

---

### 5.3. `backend/shopCatalog/register.ts` (2.094 dòng) — file quan trọng nhất (toàn bộ API catalog shop)

**Ai dùng:**
- `backend/shop_standalone_server.ts` dòng ~210: `registerShopApi(app, getDb, getDb, getCatalogSourceDb)`
- `backend/shopAppearance/productsAdmin.ts` dòng ~27: `import { loadRevenueRankMap } from "../shopCatalog/register.js"` → **phải tiếp tục export `loadRevenueRankMap` từ `register.ts`** (re-export).

**Cấu trúc đích:**

```
backend/shopCatalog/
  catalog/
    text.ts              // slugify, viLooseRegex, regexEscapeLiteral, pathKey, normalizeMa
    categoryFilters.ts   // buildCategorySubtreeFilter, parseNhomQuery, parseCategoryIdQuery,
                         // resolveCategoryIdsForRootIds, resolveCategoryIdsForPaths, mergeCategoryFilters, buildHomeScopeFilter
    categoryTree.ts      // kvNodeToShopNav, loadCategoryImageMap, attachLeafImages, buildShopKvCategoryTree
    publicProduct.ts     // publicImages, hasPublicImage, filterRequirePublicImage, publicTon, categorySlug,
                         // deriveNhomPath, deriveNhom, productSlug, shopPath, toPublicProduct, sortPublicItems,
                         // productCreatedMs, dedupeListItems, shopFilterBase, parseMaFromProductSlug, findByProductSlug
    priceContext.ts      // mapDocsToPublicWithPriceBooks, enrichListDisplayTons, requestShopBuyerEmail, filterZeroPriceUnlessTestBuyer
    cache.ts             // cachedJson + Map inflightProducers (STATE DÙNG CHUNG — chỉ ở đây)
    ctv.ts               // normalizeCtvCode, isValidCtvCode, hashIpFvn1a32
    bestsellers.ts       // loadRevenueRankMap (+ hằng BESTSELLER_DAYS)
    cors.ts              // setCors
  routes/
    meta.routes.ts        // GET /api/shop/health, /categories, /category-tree
    products.routes.ts    // GET /api/shop/products (danh sách) + POST /api/shop/products/prices
    facets.routes.ts      // GET /api/shop/facets
    productDetail.routes.ts // GET /products/:ma/variants, GET /products/:ma, GET /resolve
    ctvClick.routes.ts    // POST /api/shop/ctv/click
    stream.routes.ts      // GET /api/shop/catalog/stream (SSE, syncBus.on/off + setInterval ping)
    cacheAdmin.routes.ts  // POST /api/shop/cache/clear
  register.ts            // GIỮ LẠI: registerShopApi + re-export loadRevenueRankMap
```

**Bảng chuyển code:**

| Dòng gốc (≈) | Nội dung | Sang |
|---|---|---|
| 92–135, 241–249, 817–822 | slugify, viLooseRegex, regexEscapeLiteral, pathKey, normalizeMa | `catalog/text.ts` |
| 136–273, 416–459 | lọc danh mục, home scope | `catalog/categoryFilters.ts` |
| 274–415 | cây danh mục + ảnh | `catalog/categoryTree.ts` |
| 460–507, 741–761 | price book, tồn hiển thị, email buyer test | `catalog/priceContext.ts` |
| 508–740, 1033–1106 | chuyển doc → sản phẩm public, sort, dedupe, slug | `catalog/publicProduct.ts` |
| 762–816 | `cachedJson` + `inflightProducers` | `catalog/cache.ts` |
| 823–851 | CTV code, hash IP | `catalog/ctv.ts` |
| 852–1011 | `loadRevenueRankMap` | `catalog/bestsellers.ts` |
| 1012–1032 | `setCors` | `catalog/cors.ts` |
| 1108–1121 | đầu `registerShopApi`: `app.use([...], catalogPriceContext(...))` + `app.options("/api/shop/*")` | **giữ trong `register.ts`, đứng đầu** |
| 1122–1180 | health, categories, category-tree | `routes/meta.routes.ts` |
| 1181–1617 | products list + prices | `routes/products.routes.ts` (nếu > 500 dòng, chuyển phần dựng filter Mongo sang `catalog/productQuery.ts`) |
| 1618–1740 | facets | `routes/facets.routes.ts` |
| 1741–1925 | variants, :ma, resolve | `routes/productDetail.routes.ts` |
| 1926–1986 | ctv click | `routes/ctvClick.routes.ts` |
| 1987–2062 | catalog stream (SSE) | `routes/stream.routes.ts` |
| 2063–hết | cache clear | `routes/cacheAdmin.routes.ts` |

`register.ts` sau khi tách:

```ts
export { loadRevenueRankMap } from "./catalog/bestsellers.js";

export function registerShopApi(app: Express, getDb: GetDb, getShopDb?: GetDb, _getCatalogSourceDb?: GetDb) {
  const catalogDb = getShopDb || getDb;
  app.use(["/api/shop/products", "/api/shop/facets", "/api/shop/resolve"], catalogPriceContext(catalogDb));
  app.options("/api/shop/*", (req, res) => { setCors(req, res); res.status(204).end(); });
  const ctx = { getDb, catalogDb };
  registerMetaRoutes(app, ctx);
  registerProductListRoutes(app, ctx);     // GET /products rồi POST /products/prices — đúng thứ tự gốc
  registerFacetRoutes(app, ctx);
  registerProductDetailRoutes(app, ctx);   // /products/:ma/variants TRƯỚC /products/:ma
  registerCtvClickRoutes(app, ctx);
  registerCatalogStreamRoutes(app, ctx);
  registerCacheAdminRoutes(app, ctx);
}
```

**Điểm dễ sai (đọc kỹ):**
- `app.use(...)` và `app.options(...)` phải chạy **trước mọi route** như code gốc.
- `GET /api/shop/products/:ma/variants` phải đăng ký **trước** `GET /api/shop/products/:ma`.
- `inflightProducers` (Map chống gọi trùng) chỉ được khai báo **một lần** trong `catalog/cache.ts`. Nếu vô tình khai báo ở 2 file → cache vẫn chạy nhưng mất tác dụng chống trùng, tải DB tăng — `api-snapshot` **không bắt được** lỗi này, người review phải kiểm tra bằng mắt: `rg -n "inflightProducers" backend/`.
- Route stream: giữ nguyên `syncBus.on("change", ...)`, `setInterval` ping và phần `syncBus.off` + `clearInterval` khi client ngắt.
- `loadRevenueRankMap` được gọi ở 3 nơi (trong `buildHomeScopeFilter`, trong route products, và từ `productsAdmin.ts`) → tất cả import từ `catalog/bestsellers.ts`; `register.ts` re-export cho `productsAdmin.ts`.

**Kiểm thử tay:** trang chủ (các khối nổi bật / mới / sắp hết), trang danh mục + bộ lọc (giá, tồn, thuộc tính, đơn vị), tìm kiếm có dấu/không dấu, trang chi tiết SP có biến thể (KN3GT30), link CTV `?ref=` (click được ghi), sửa giá 1 SP ở admin → web tự cập nhật (SSE), nút xoá cache.

- **Rủi ro áp dụng (tham chiếu Mục 11):** A1 (import vòng `productsAdmin`), A2 (thiếu đuôi `.js`), A3 (biến môi trường `TTL_SEC`), A4 (nhân đôi `inflightProducers`), A5 (thứ tự route `/variants` trước `/:ma`), A7 (SSE memory leak `/stream`), A8 (mất `await`), A9 (xử lý lỗi), G38 (mất CORS hoặc filter), G39 (tải DB bestsellers).
- **Test case bắt buộc (tham chiếu Mục 12):** TC-01, TC-02, TC-03, TC-04, TC-05, TC-06, TC-07, TC-08, TC-09, TC-12, TC-38, TC-39, SMK, REG-CAT.

---

### 5.4. Tiêu chí hoàn thành Giai đoạn 1

- [ ] 3 PR đã merge, mỗi PR có diff `dump-routes` rỗng + diff `api-snapshot` rỗng.
- [ ] `npm run typecheck` không phát sinh lỗi mới so với baseline.
- [ ] Không file nào trong `backend/shopOrders/commissionAdmin/`, `backend/shopOrders/ctvMe/`, `backend/shopCatalog/catalog|routes/` vượt 500 dòng.
- [ ] Production chạy 24h không có lỗi mới trong `pm2 logs aloha-shop-api`.

---

## 6. GIAI ĐOẠN 2 — Frontend (các file ảnh hưởng người dùng nhiều)

Ước lượng: 1–1,5 ngày/file. Không có `api-snapshot` cho giao diện → dựa vào `tsc`, `next build` và **checklist test tay + so ảnh chụp màn hình trước/sau** (chụp cùng trang, cùng kích thước desktop 1440px và mobile 390px).

**Quy tắc riêng cho React:**
- State (`useState`, `useEffect`) **ở nguyên component cha** trong lần tách đầu. Component con nhận dữ liệu qua props và gọi callback của cha. Không chuyển state xuống con trong cùng PR (dễ đổi hành vi).
- Giữ nguyên `className`, thứ tự phần tử, `key` trong danh sách.
- File con có dùng hook/sự kiện → thêm `"use client"` ở dòng đầu.
- Tên export cũ giữ nguyên (default hay named như cũ).

### 6.1. `frontend/components/admin/ctv/CtvAdminShell.tsx` (2.832 dòng)

**Ai dùng:** 7 trang `frontend/app/admin/ctv/**/page.tsx` (`import CtvAdminShell from "@/components/admin/ctv/CtvAdminShell"`) và `ShopCtvAffiliateAdmin.tsx` (re-export default). → **Giữ file `CtvAdminShell.tsx` với `export default`.**

**Cấu trúc đích:**

```
frontend/components/admin/ctv/shell/
  routing.ts                 // subFromPath, detailCodeFromPath, type CtvAdminSub
  format.ts                  // changeTag, shortMoney, dayLabel, expandDailySeries, niceAxisMax, statusTag
  widgets/KpiCard.tsx
  widgets/DailySpark.tsx     // biểu đồ (≈ 260 dòng)
  widgets/ConversionCard.tsx
  panels/OverviewPanel.tsx
  panels/OrdersPanel.tsx
  panels/CommissionsHub.tsx
  panels/CommissionConfigHub.tsx
  panels/PeriodCtvLinesDrawer.tsx
  panels/CommissionLinesTable.tsx
  panels/FraudSettingsCard.tsx
  panels/FraudPanel.tsx
frontend/components/admin/ctv/CtvAdminShell.tsx   // GIỮ: khung tab + điều hướng (≈ 150 dòng)
```

| Dòng gốc (≈) | Nội dung | Sang |
|---|---|---|
| 104–123 | `subFromPath`, `detailCodeFromPath` | `shell/routing.ts` |
| 124–142, 172–232, 1130–1142 | `changeTag`, `shortMoney`, `dayLabel`, `expandDailySeries`, `niceAxisMax`, `statusTag` | `shell/format.ts` (`changeTag`/`statusTag` trả JSX → đặt tên file `format.tsx`) |
| 143–171 | `KpiCard` | `widgets/KpiCard.tsx` |
| 233–492 | `DailySpark` | `widgets/DailySpark.tsx` |
| 493–610 | `ConversionCard` | `widgets/ConversionCard.tsx` |
| 611–705 | `CtvAdminShell` (default) | giữ ở file gốc |
| 706–954 | `OverviewPanel` | `panels/OverviewPanel.tsx` |
| 955–1129 | `OrdersPanel` | `panels/OrdersPanel.tsx` |
| 1143–1572 | `CommissionsHub` | `panels/CommissionsHub.tsx` |
| 1573–1608 | `CommissionConfigHub` | `panels/CommissionConfigHub.tsx` |
| 1609–1965 | `PeriodCtvLinesDrawer` | `panels/PeriodCtvLinesDrawer.tsx` |
| 1966–2430 | `CommissionLinesTable` | `panels/CommissionLinesTable.tsx` |
| 2431–2524 | `FraudSettingsCard` | `panels/FraudSettingsCard.tsx` |
| 2525–hết | `FraudPanel` | `panels/FraudPanel.tsx` |

Các import đầu file gốc (dòng 1–103: antd, icons, `ShopAccountsAdmin`, `ShopCtvAffiliateAdminLegacy`, type…) → mỗi file con chỉ import đúng những gì nó dùng. Chạy `tsc` sẽ báo thiếu/thừa.

**Tuỳ chọn sau khi xong (PR riêng):** dùng `next/dynamic` cho từng panel để trang admin CTV tải nhanh hơn.

**Kiểm thử tay:** đi qua đủ 7 URL admin CTV: `/admin/ctv`, `/admin/ctv/don-hang`, `/admin/ctv/hoa-hong`, `/admin/ctv/cau-hinh-hoa-hong`, `/admin/ctv/chong-gian`, `/admin/ctv/danh-sach`, `/admin/ctv/danh-sach/<mã CTV>`; mở drawer chi tiết kỳ, lọc bảng hoa hồng, đổi khoảng ngày biểu đồ.

- **Rủi ro áp dụng (tham chiếu Mục 11):** B13 (re-export type), C15 (thiếu `"use client"`), C16 (component khai báo lồng/remount mất focus), C17 (thay đổi key/thứ tự state), C18 (closure cũ ở callback), C19 (request thừa do gom hook), C20 (bundle phình).
- **Test case bắt buộc (tham chiếu Mục 12):** TC-13, TC-15, TC-16, TC-17, TC-18, TC-19, TC-20, SMK, REG-CTV-ADMIN.

### 6.2. `frontend/components/CategoryNavMenu.tsx` (949 dòng)

**Ai dùng:** `SiteChrome.tsx` (`CategoryMobileNav`), `CategoryMegaMenu.tsx` (nhiều named export). → `CategoryNavMenu.tsx` giữ lại, **re-export đủ mọi tên đang export**: `foldKey`, `navBarLabel`, `navBarIcon`, `nameMatchesAny`, `CategoryNavBar`, `toTitleCaseVi`, `CategoryMobileNav`.

**Trước khi làm:** file này đang có thay đổi chưa commit — commit xong mới tách.

```
frontend/components/category-nav/
  icons.tsx          // IconPot, IconVase, IconSproutBox (48–141)
  navLabels.ts(x)    // nodeSubs, normKey, foldKey, lookupNav, navBarLabel, navBarIcon, nameMatchesAny,
                     // findNavMergeGroup, toTitleCaseVi, mobileCatLabel (+ các map nhãn/icon)
  navSlots.ts        // injectNodesAfter, buildUiFlyoutRoot, buildNavSlots, orderMobileRoots
  DesktopNav.tsx     // FlyoutRow, MultiColumnFlyout, NavItemButton, MergedGroupNavItem, CategoryNavBar (184–636)
  MobileNav.tsx      // mobileTileSrc, mobileTileHasImage, MobileCatTile, CategoryMobileNav (662–hết)
frontend/components/CategoryNavMenu.tsx   // chỉ còn re-export
```

**Kiểm thử tay:** desktop — rê chuột từng mục menu, flyout nhiều cột hiện đúng, mục gộp nhóm; mobile — lưới ô danh mục có ảnh, bấm vào đúng trang.

- **Rủi ro áp dụng (tham chiếu Mục 11):** B13 (re-export type), C15 (`"use client"`), C16 (remount), C19 (request thừa), C20 (bundle phình), C21 (lỗi hydration format text/icon), E25 (conflict do file đang sửa).
- **Test case bắt buộc (tham chiếu Mục 12):** TC-13, TC-15, TC-16, TC-19, TC-20, TC-21, SMK, REG-CAT.

### 6.3. `frontend/components/CatalogLayout.tsx` (1.065 dòng)

**Ai dùng:** `app/(storefront)/page.tsx`, `app/(storefront)/tim/page.tsx`, `app/(storefront)/danh-muc/[slug]/page.tsx` → giữ `export function CatalogLayout`.

```
frontend/components/catalog/
  draft.ts                 // type DraftState, draftFromUrl (56–66) + các hàm thuần đọc/ghi URL
  useCatalogFilters.ts     // (bước 2, PR riêng) gom state + effect đồng bộ URL ↔ bộ lọc
  CatalogToolbar.tsx       // khối "Toolbar: Lọc + L1/L2/L3 · Sort" (≈ 744–1006)
  CatalogSortBar.tsx       // khối "Sort" (≈ 823–…)
  CatalogFilterModal.tsx   // khối "Modal lọc — desktop + mobile" (≈ 1007–hết)
frontend/components/CatalogLayout.tsx   // state + ghép các khối
```

**Làm 2 bước:** (1) chỉ tách JSX thành component con nhận props — state vẫn ở `CatalogLayout`; (2) PR sau mới gom state vào hook `useCatalogFilters`.

**Kiểm thử tay:** trang chủ, `/tim?q=...`, `/danh-muc/<slug>`: bật/tắt từng bộ lọc, đổi sort, phân trang, bấm Back/Forward của trình duyệt (URL và bộ lọc phải khớp), mở modal lọc trên mobile.

- **Rủi ro áp dụng (tham chiếu Mục 11):** B13 (re-export type), C15 (`"use client"`), C16 (remount mất focus ô lọc giá), C17 (state danh sách lọc), C18 (callback state cũ), C19 (request thừa / fetch lặp khi sync URL), C20 (bundle phình), C21 (lỗi hydration).
- **Test case bắt buộc (tham chiếu Mục 12):** TC-13, TC-15, TC-16, TC-17, TC-18, TC-19, TC-20, TC-21, SMK, REG-CAT.

### 6.4. `frontend/components/admin/website/appearance/ShopAppearanceEditor.tsx` (1.423 dòng)

**Ai dùng:** `WebsiteBanHangShell.tsx` → giữ `export function ShopAppearanceEditor`.

```
frontend/components/admin/website/appearance/
  editorUtils.ts           // newId, emptyPopup, pad2, splitLocalFromIso, combineLocalToIso, formatScheduleVi (84–142)
  EditorHeader.tsx         // <header> thanh trên: lưu nháp, hẹn giờ, lịch sử, thiết bị (≈ 540–728)
  panels/BrandPanel.tsx    // side === "brand" (≈ 745–1051)
  panels/HomePanel.tsx     // side === "home"  (≈ 1052–1347)
  panels/MenuPanel.tsx     // side === "menu"  (≈ 1348–1360)
  panels/FooterPanel.tsx   // side === "footer" (≈ 1361–…)
  EditorPreview.tsx        // iframe "Shop preview" (≈ 1414–hết)
ShopAppearanceEditor.tsx   // giữ 15 useState + các hàm xử lý, render ghép các khối
```

Props gợi ý cho panel: `{ draft, setDraft, selectedId, setSelectedId, cats, ... }` — truyền đúng những gì JSX đó đang dùng.

**Kiểm thử tay:** mở editor, sửa 1 khối trang chủ (không lưu), đổi desktop/mobile, mở hẹn giờ và lịch sử, xem preview cập nhật; sửa thương hiệu/menu/footer rồi **huỷ**, không bấm xuất bản trên production.

- **Rủi ro áp dụng (tham chiếu Mục 11):** B13 (re-export type), C15 (`"use client"`), C16 (remount mất focus khi gõ text khối), C17 (đổi thứ tự/key khối kéo thả), C18 (callback closure cũ), C19 (sync preview fetch thừa), C20 (bundle phình).
- **Test case bắt buộc (tham chiếu Mục 12):** TC-13, TC-15, TC-16, TC-17, TC-18, TC-19, TC-20, REG-WEB-ADMIN.

### 6.5. `frontend/components/admin/website/articles/ShopArticlesAdmin.tsx` (1.287 dòng)

**Ai dùng:** `WebsiteBanHangShell.tsx` → giữ `export function ShopArticlesAdmin`.

```
frontend/components/admin/website/articles/
  articleUtils.ts          // slugifyVi, toLocalInput, fromLocalInput, emptyForm, bodyHtmlForPreview (79–159)
  ArticleSaveBar.tsx       // thanh Lưu cố định (≈ 511–573)
  form/BasicInfoSection.tsx   // Tiêu đề, Đường dẫn, Danh mục (≈ 574–651)
  form/CoverSection.tsx       // Ảnh bìa (≈ 652–708)
  form/VideoSection.tsx       // Video (≈ 709–780)
  form/SummaryContentSection.tsx // Tóm tắt + Nội dung (≈ 781–811)
  form/ProductsPublishSection.tsx // SP + xuất bản (≈ 812–1132)
  ArticlePreview.tsx       // khối xem trước (≈ 1133–hết)
ShopArticlesAdmin.tsx      // giữ 19 useState + danh sách bài + ghép form
```

**Kiểm thử tay:** tạo bài nháp test (đặt tên "TEST-REFACTOR"), điền đủ các ô, xem preview, lưu, mở lại, xoá bài test.

- **Rủi ro áp dụng (tham chiếu Mục 11):** B13 (re-export type), C15 (`"use client"`), C16 (remount mất focus khi gõ bài viết), C17 (state danh sách bài viết), C18 (callback closure cũ), C19 (request thừa), C20 (bundle phình).
- **Test case bắt buộc (tham chiếu Mục 12):** TC-13, TC-15, TC-16, TC-17, TC-18, TC-19, TC-20, REG-WEB-ADMIN.

### 6.6. `frontend/app/globals.css` (2.138 dòng)

**Nguyên tắc sống còn:** CSS phụ thuộc thứ tự — file sau đè file trước. Tách theo **khối liền nhau từ trên xuống**, `globals.css` import lại **đúng thứ tự**, không sắp xếp lại, không gộp selector.

```
frontend/app/styles/
  00-base.css            // dòng 1–54 (tailwind directives, biến, search dropdown)
  10-buttons.css         // 55–111 (nút chính/phụ/outline/ghost, sticky bottom bars)
  20-mobile-tabbar.css   // 112–185
  30-article.css         // 186–496 (card bài, editorial, nội dung bài, video, link, hashtag, nhãn đậm)
  40-loading.css         // 497–667
  50-pdp-card.css        // 668–760 (gallery PDP, card SP)
  60-hero.css            // 761–1538 (hero full-bleed, hero nền kem)
  70-banner.css          // 1539–1827
  80-home-sections.css   // 1828–2124 (tiêu đề section, flash sale, sắp hết, lưới 3 cột, banner CTV)
  90-mobile-fixes.css    // 2125–hết (chống zoom iOS…)
frontend/app/globals.css // chỉ còn các dòng @import theo thứ tự trên
```

Lưu ý:
- Nếu dòng 1 có `@tailwind base; @tailwind components; @tailwind utilities;` hoặc `@import "tailwindcss"` → **giữ trong `globals.css`**, đặt trước các `@import` khác theo yêu cầu của Tailwind/PostCSS; kiểm tra `postcss.config` có `postcss-import` chưa (Next.js hỗ trợ `@import` file CSS cục bộ trong global CSS).
- Mở file bằng UTF-8 khi cắt/dán để không hỏng chú thích tiếng Việt.
- Kiểm chứng: sau `next build`, so kích thước + nội dung file CSS đầu ra trong `.next/static/css/` giữa trước và sau (nên giống hệt hoặc chỉ khác thứ tự chú thích).

**Kiểm thử tay:** so ảnh chụp màn hình trước/sau: trang chủ (hero, banner, flash sale, sắp hết), trang danh mục, chi tiết SP, bài viết, giỏ hàng/checkout (sticky bar), mobile tab bar.

- **Rủi ro áp dụng (tham chiếu Mục 11):** D22 (đổi thứ tự cascade), D23 (vị trí `@import` và Tailwind), D24 (hỏng encoding tiếng Việt/CRLF).
- **Test case bắt buộc (tham chiếu Mục 12):** TC-22, TC-23, TC-24, SMK, REG-UI.

### 6.7. Tiêu chí hoàn thành Giai đoạn 2

- [ ] 6 PR merge, mỗi PR có `tsc` + `next build` xanh và bộ ảnh chụp trước/sau không khác biệt.
- [ ] Không file con nào > 500 dòng.
- [ ] Production 24h không có lỗi mới trong `pm2 logs aloha-shop` và console trình duyệt ở các trang chính.

---

## 7. GIAI ĐOẠN 3 — Các file còn lại (gần ngưỡng, làm khi có thời gian)

Áp dụng đúng quy trình mục 3.

| File | Dòng | Cách tách | Test case bắt buộc (Mục 12) |
|---|---|---|---|
| `frontend/components/admin/ctv/ShopCtvAffiliateAdminLegacy.tsx` | 1.588 | Nếu vẫn dùng: tách theo component có sẵn → `legacy/HomNay.tsx` (233–311), `SettingsPanel.tsx` (312–411), `DatPhanTram.tsx` (412–1211, lớn nhất — tách tiếp bảng/ô nhập), `CtvDacBiet.tsx` (1212–1353), `KyThang.tsx` (1354–1524), `CanhBao.tsx` (1525–hết), `api.ts` (`api`, `formatVnd`, `currentPeriod`). Nếu không dùng: xoá. | TC-13, 15, 16, 17, 18, 19, 20, SMK, REG-CTV-ADMIN |
| `frontend/components/admin/ctv/ShopAccountsAdmin.tsx` | 947 | `accountsApi.ts` (`api`, `fmtDate`), `AccountChips.tsx` (`Chip`, `ctvStatusChip`), tách bảng danh sách và modal hồ sơ/xoá thành component con; state giữ ở cha. | TC-13, 15, 16, 17, 18, 19, 20, SMK, REG-CTV-ADMIN |
| `frontend/app/(storefront)/don-hang/[code]/page.tsx` | 946 | `components/order-status/orderHero.ts` (`waitingStaff`, `heroFor`), `CopyOrderCode.tsx`, `OrderSuccessView.tsx` (khối "Trang thành công" ≈ 373–…), `OrderTimeline`/`OrderItems` nếu có khối rõ ràng. `page.tsx` giữ fetch + state. | TC-13, 15, 16, 21, SMK, REG-ORDER |
| `frontend/components/ctv-recruit/CtvRecruitLanding.tsx` | 844 | `CtvRecruitForm.tsx` (107–658, đã là hàm riêng — tách thẳng), các section `RecruitHero`, `RecruitWhy`, `RecruitSteps`, `RecruitTerms` (682–hết). | TC-13, 15, 16, 21, SMK |
| `backend/shopVariantGroup.ts` | 873 | Được `register.ts` và `stockApply.ts` import → giữ file làm re-export. Tách: `variant/keys.ts` (normKey…variantGroupKey, isRetailDvt), `variant/queryFilters.ts` (parseAttrQuery, parseDvtQuery, canonicalizeDvt, mongo*Filter, compact*Facets), `variant/ton.ts` (rawDocTon, isComboOrFormulaProduct, parseFormulaComponents, sumFamilyTon, resolveShopDisplayTon), `variant/siblings.ts` (findAttrSiblings, findUnitPairDocs, buildAxesAndModels, toVariantModel), `variant/canonical.ts` (scoreCanonical, dedupeCanonicalPublic). Kiểm chứng bằng `api-snapshot` (products, facets, variants). | TC-01, 02, 05, 08, 12, SMK, REG-CAT |
| `backend/shopArticles/register.ts` | 840 | `articles/public.routes.ts` (GET articles, categories, sitemap-data, :slug — 225–421), `articles/admin.routes.ts` (các route admin 422–hết), `articles/helpers.ts` (1–216). Kiểm chứng bằng `dump-routes` + `api-snapshot`. | TC-01, 02, 05, 06, 08, 09, 12, 38, SMK, REG-WEB-ADMIN |
| `tools/qa_ctv_matrix.cjs` | 991 | Script QA, không chạy trên production — **không tách**. | Không áp dụng |

Tiêu chí hoàn thành: như 5.4 / 6.7 cho từng file.

---

## 8. Deploy và quay lui

- Mỗi PR merge riêng, cách nhau ít nhất nửa ngày để kịp phát hiện lỗi.
- Sau khi CI deploy: kiểm tra `pm2 status` (aloha-shop-api, aloha-shop online), `curl http://127.0.0.1:3001/api/shop/health`, mở web các trang trong checklist.
- Quay lui: `git revert -m 1 <merge-commit>` → push `main` → CI deploy bản cũ. Không cần khôi phục DB (không có thay đổi dữ liệu).

---

## 9. Phân công và ước lượng

| Giai đoạn | Việc | Ước lượng |
|---|---|---|
| Chuẩn bị (mục 2) | typecheck, dump-routes, api-snapshot, DB local | 1 ngày |
| 0 | Xoá code không dùng + `backups/` | 0,5 ngày |
| 1 | 3 file backend | 4–6 ngày |
| 2 | 6 file frontend | 6–8 ngày |
| 3 | 6 file còn lại | 4–5 ngày |

Có thể làm song song Giai đoạn 1 và 2 bởi 2 người khác nhau (không đụng file của nhau), nhưng **merge tuần tự**.

---

## 10. Việc KHÔNG làm trong đợt này

- Không đổi tên route, không đổi format JSON trả về, không đổi tên field DB.
- Không nâng cấp thư viện (Next, React, Express, antd…).
- Không sửa bug phát hiện được — ghi vào danh sách và làm PR riêng sau.
- Không đổi giao diện / CSS giá trị.

---

## 11. Các trường hợp thường gặp khi tách file (42 rủi ro và cách phòng tránh)

Mỗi trường hợp gồm bốn ý: **Chuyện gì xảy ra**, **Chỗ nào trong repo dễ gặp**, **Cách phòng**, **Cách phát hiện**.

### A. Lỗi lúc chạy ở backend (Node/Express, ESM)

1. **Import vòng (circular import) làm biến bị `undefined` hoặc lỗi TDZ.** Tách một file thành nhiều file dễ tạo ra vòng A → B → A. Với ESM, module nào được nạp trước sẽ thấy export của module kia chưa khởi tạo.
   - Chỗ dễ gặp: [backend/shopAppearance/productsAdmin.ts](backend/shopAppearance/productsAdmin.ts) import `loadRevenueRankMap` từ `shopCatalog/register.ts`. Nếu file con mới trong `shopCatalog/catalog/` lại import ngược sang `productsAdmin` (ví dụ lấy `hienThiWebFilterClause`), vòng sẽ hình thành.
   - Phòng: file helper con chỉ được import "xuống" (helper thuần, `shopVariantGroup`), không import ngược lên file route.
   - Phát hiện: `npx madge --circular --extensions ts backend/`, chạy trước khi tách để lấy baseline và sau khi tách để đảm bảo không có vòng mới.
2. **Thiếu đuôi `.js` trong import ESM.** `tsx` lúc dev có thể vẫn chạy, nhưng production/Node thì báo `ERR_MODULE_NOT_FOUND`. Phòng: theo quy ước trong [backend/shop_standalone_server.ts](backend/shop_standalone_server.ts). Phát hiện: `typecheck:api` với `moduleResolution: NodeNext`.
3. **Đọc biến môi trường ở cấp module rồi đổi thứ tự nạp.** Ví dụ `TTL_SEC = Number(process.env.SHOP_CATALOG_TTL_SEC || 300)` ở [backend/shopCatalog/register.ts](backend/shopCatalog/register.ts) dòng 72. Nếu hằng số chuyển sang module được nạp trước khi dotenv chạy, giá trị sẽ rơi về mặc định mà không có lỗi nào. Phòng: chuyển hằng số nguyên trạng, không đổi thứ tự import trong file server. Phát hiện: in log giá trị hằng số khi khởi động, so trước và sau.
4. **State cấp module bị nhân đôi.** Ví dụ `inflightProducers` (dòng 760), các cache `Map`, listener `syncBus`. App vẫn chạy nhưng mất tác dụng chống gọi trùng, khiến tải DB tăng; snapshot API không bắt được. Phòng: khai báo đúng một nơi. Phát hiện: `rg -n "new Map<" backend/shopCatalog backend/shopOrders` và review bằng mắt.
5. **Đổi thứ tự route hoặc middleware.** Các cặp phải giữ thứ tự: `app.use(catalogPriceContext)` và `app.options` phải đứng đầu; `/products/:ma/variants` trước `/products/:ma`; `/admin/ctv/bills/lock` trước `/admin/ctv/:ctvCode/ban`. Phát hiện: diff của `dump-routes` phải rỗng.
6. **Mất closure khi tách handler ra khỏi hàm `register...`.** Handler gốc dùng biến khai báo trong hàm tổng (`gate`, `auth`, `catalogDb`, `getOpsDb`). Sau khi tách, biến đó bị `undefined` hoặc trỏ nhầm DB (shop DB và ops DB). Phòng: gom vào `ctx`, và đặt kiểu cho `ctx` để `tsc` bắt lỗi thiếu. Phát hiện: `typecheck:api`, và snapshot các route admin/CTV.
7. **Rò rỉ bộ nhớ ở route SSE.** Khi chuyển file mà bỏ sót `req.on("close")`, `clearInterval` hoặc `syncBus.off` ở `/api/shop/catalog/stream` hay `/api/shop/ctv/me/stream`, mỗi lần client ngắt kết nối sẽ để lại listener. Phòng: chuyển nguyên khối handler. Phát hiện: mở rồi đóng tab khoảng 20 lần, theo dõi `syncBus.listenerCount("change")` và RAM trong `pm2 monit`.
8. **Mất `await` hoặc `return` khi tách service.** Hàm service trả về Promise nhưng handler quên `await`, dẫn tới `res.json({})` rỗng, hoặc lỗi thành unhandled rejection. Phát hiện: snapshot API (body khác), log pm2.
9. **Thay đổi hành vi xử lý lỗi.** Khối `try/catch` bao quanh handler bị tách mất, hoặc `res.status(4xx)` trả sớm bị chuyển vào service. Hậu quả: lỗi 500 thay vì 400, hoặc gửi response hai lần (`ERR_HTTP_HEADERS_SENT`). Phòng: giữ mọi `res.*` trong handler. Phát hiện: snapshot có cả case lỗi (ví dụ `/api/shop/products/KHONG_TON_TAI`).
10. **Code thừa đã bị đánh giá là "không dùng" nhưng vẫn được gọi động** qua `import()` với chuỗi ghép, qua script cron hoặc từ repo khác. Chỗ dễ gặp: 4 file `backend/utils/print*.ts` và `scanProductQr.ts`. Phòng: `rg` toàn repo, kiểm tra thêm `scripts/`, `tools/` và app vận hành trên VPS (`/root/aloha_thumua_webapp`). Phát hiện: build, khởi động, và log 24h.

### B. TypeScript và build

11. **Type hoặc interface không được export khi tách**, khiến file con phải khai báo lại type. Về lâu dài hai bản type lệch nhau. Phòng: đưa type dùng chung vào `types.ts` của module.
12. **Baseline `tsc` đã có lỗi sẵn** trên `main`, nên không phân biệt được lỗi mới với lỗi cũ. Phòng: lưu `typecheck-baseline.txt`, so theo số lượng và nội dung.
13. **`isolatedModules` / re-export type.** `export { SomeType } from` bị lỗi khi build bằng Next/SWC; cần `export type { ... }`. Phát hiện: `next build`.
14. **Lệch alias đường dẫn.** Frontend dùng `@/`, nhưng file con lại dùng đường dẫn tương đối lẫn lộn, gây trùng module trong bundle. Phòng: thống nhất `@/`.

### C. React / Next.js (frontend)

15. **Thiếu `"use client"` ở file con** có hook hoặc sự kiện. Cả 5 file lớn ở giai đoạn 2 đều có `"use client"` ở dòng 1. Nếu file con không có nhưng lại được một Server Component import, Next sẽ báo lỗi build hoặc hydration. Phòng: file con dùng hook thì thêm `"use client"`.
16. **Component khai báo bên trong component khác** được chuyển ra ngoài (hoặc ngược lại), làm đổi danh tính component. Hậu quả: con bị remount, mất state ô nhập hoặc focus sau mỗi lần render. Phòng: giữ nguyên cấp khai báo như file gốc (hiện các panel trong `CtvAdminShell.tsx` là hàm cấp module, nên an toàn).
17. **Thay đổi `key` hoặc thứ tự phần tử** khi tách JSX, làm hỏng state danh sách (bảng hoa hồng, danh sách khối trang chủ). Phòng: không sửa JSX, chỉ bọc lại.
18. **Closure cũ (stale state) khi truyền callback qua props.** Hàm `setX((cur) => ...)` được đổi thành `setX(value)` lúc tách. Phòng: truyền nguyên hàm của cha, không viết lại.
19. **`useEffect` chạy hai lần hoặc mất dependency** vì hook bị gom sai. Chỉ làm việc gom hook ở bước 2 (PR riêng) như kế hoạch đã ghi. Phát hiện: tab Network, số request trước và sau khi tách phải bằng nhau.
20. **Bundle phình hoặc mất tree-shaking** vì file tổng dùng `export *`, kéo cả antd/icons vào trang không cần. Phát hiện: so kích thước bundle trong output `next build` (First Load JS) trước và sau.
21. **Lỗi hydration** do render khác nhau giữa server và client (ví dụ định dạng ngày theo múi giờ trong `format.ts`). Phòng: không đổi hàm format. Phát hiện: console trình duyệt ở trang storefront.

### D. CSS

22. **Đổi thứ tự cascade** khi tách `globals.css`: style sau không còn đè style trước, giao diện lệch âm thầm. Phòng: tách theo khối liền nhau, import đúng thứ tự. Phát hiện: so file CSS đầu ra trong `.next/static/css`, cùng ảnh chụp màn hình.
23. **Vị trí `@import` và Tailwind.** `@import` phải đứng trước các rule khác; nếu PostCSS xử lý sai thì cả file bị bỏ. Phát hiện: `next build` và mở trang.
24. **Hỏng encoding tiếng Việt (UTF-8 / BOM, CRLF)** khi cắt dán trên Windows. Repo hiện không có `.gitattributes`, nên diff có thể hiện toàn bộ file thay đổi vì khác xuống dòng. Phòng: thêm `.gitattributes` (`* text=auto eol=lf`) ở PR chuẩn bị, và đặt editor lưu UTF-8 không BOM.

### E. Git, review và quy trình nhóm

25. **Conflict với người đang sửa cùng file** (điển hình ở công ty lớn). Phòng: thông báo "đóng băng" file trong lúc tách, và merge PR đang mở trước khi bắt đầu. `CategoryNavMenu.tsx` và `SiteChrome.tsx` đang có thay đổi chưa commit.
26. **Mất lịch sử `git blame`.** Phòng: commit "chuyển nguyên văn" tách riêng khỏi commit sửa import; tạo `.git-blame-ignore-revs` chứa hash các commit chuyển code; người dùng blame với `-C -C`.
27. **PR quá lớn nên review không kỹ** ("LGTM" cho 2.000 dòng). Phòng: một PR mỗi file, commit theo từng nhóm; review bằng `git diff -M --color-moved=dimmed-zebra`.
28. **Lẫn sửa bug vào refactor**, khiến không biết lỗi phát sinh từ đâu. Phòng: quy tắc "chỉ chuyển code", bug ghi vào danh sách riêng.
29. **File `.next/` và `node_modules/` đang bị git theo dõi**, gây conflict hàng loạt khi rebase hoặc merge (đã xảy ra ở đợt deploy trước). Phòng: PR chuẩn bị bỏ theo dõi (`git rm -r --cached`, thêm vào `.gitignore`) trước khi tách.
30. **Merge nhiều PR refactor cùng lúc**, lỗi chồng lên nhau và khó revert. Phòng: merge tuần tự, cách nhau ít nhất nửa ngày.

### F. Deploy và vận hành

31. **Merge vào `main` là tự deploy production** ([docs/CI_CD_VPS.md](docs/CI_CD_VPS.md)), và shop chưa có staging. Phòng: mọi kiểm chứng chạy ở local trên bản sao DB; merge ngoài giờ cao điểm.
32. **Build trên VPS khác local** (phiên bản Node, cache `.next`, biến môi trường thiếu trong file mới). Phòng: ghi rõ phiên bản Node; theo dõi log CI deploy. Phát hiện: `pm2 status`, `curl /api/shop/health`.
33. **Cache cũ sau deploy** (Redis cache catalog, CDN, trình duyệt giữ chunk JS cũ nên gặp lỗi `ChunkLoadError`). Phòng: sau deploy gọi `POST /api/shop/cache/clear`; frontend xử lý tải lại khi gặp `ChunkLoadError`.
34. **Revert không sạch** vì PR sau phụ thuộc file mới của PR trước. Phòng: revert theo thứ tự ngược; mỗi PR phải tự đứng được.
35. **Lỗi chỉ xuất hiện với dữ liệu thật hoặc lưu lượng thật**, snapshot local không đủ. Phòng: theo dõi 24h sau mỗi PR (log lỗi, thời gian phản hồi `/api/shop/products`, RAM).

### G. Dữ liệu, bảo mật, hiệu năng

36. **Snapshot API chạy nhầm vào DB production**, và các route GET có ghi (đếm click CTV, cache) làm bẩn dữ liệu. Phòng: chỉ chạy trên Mongo local đã restore; script từ chối chạy nếu `BASE_URL` là domain production.
37. **Lộ bí mật khi tạo file mới**: copy `.env`, cookie admin hoặc CTV dùng cho snapshot bị commit. Phòng: đọc cookie từ biến môi trường, thêm `docs/refactor/snap-*` vào `.gitignore`, không commit kết quả snapshot có dữ liệu cá nhân (tài khoản ngân hàng CTV ở `/ctv/me/payout-bank`).
38. **Mất middleware bảo vệ** (`gate`, `requireAuth`, `requireManager`, CORS `setCors`) khi tách route, làm route admin lộ ra công khai. Phòng: kiểm tra số handler của từng route trong `dump-routes` (script in `handlers=N`); snapshot gọi route admin **không có cookie** phải trả 401/403 như trước.
39. **Hiệu năng giảm vì N+1 query** do service mới gọi DB trong vòng lặp thay vì truy vấn một lần như code gốc. Phòng: không viết lại truy vấn. Phát hiện: so thời gian phản hồi snapshot trước và sau.

### H. Con người và tổ chức

40. **Tách nửa chừng rồi bỏ dở**, repo tồn tại cả cấu trúc cũ lẫn mới. Phòng: mỗi file phải hoàn tất trong một PR; có danh sách theo dõi tiến độ.
41. **Người khác không biết cấu trúc mới**, lại thêm code vào file tổng làm nó phình lại. Phòng: thêm ESLint `max-lines` và một đoạn README ngắn trong từng thư mục mới.
42. **Không có người chịu trách nhiệm theo dõi sau deploy.** Phòng: mỗi PR ghi rõ người trực trong 24h.

---

## 12. Bộ test case QA/QC toàn diện

### 12.1. Quy trình test (theo cách các công ty lớn tổ chức QA)

- **Vai trò:**
  - **Dev:** chạy các test tự động (TC loại "Tự động") trước khi mở PR, dán kết quả vào PR.
  - **QA/Tester:** chạy test tay, smoke và regression trên bản build local của nhánh (dùng DB bản sao), ghi kết quả vào báo cáo test.
  - **QC/Reviewer:** kiểm tra PR đủ bằng chứng (diff rỗng, ảnh chụp, báo cáo test) rồi mới duyệt.
  - **Người trực:** chạy nhóm "Giám sát" sau deploy.
- **Điều kiện bắt đầu test (entry):** nhánh build được (`npm run typecheck`, `next build` xanh); DB local đã restore từ bản sao mới nhất; đã có bộ snapshot và ảnh chụp "trước" trên `main`.
- **Điều kiện kết thúc (exit):** 100% test P0 đạt; P1 đạt hoặc có ngoại lệ được chủ sản phẩm chấp nhận bằng văn bản; không còn bug mức Nghiêm trọng hoặc Cao đang mở.
- **Mức ưu tiên test:**
  - **P0:** chặn merge nếu fail.
  - **P1:** phải sửa trước khi deploy.
  - **P2:** ghi nhận, sửa sau.
- **Mức độ bug:**
  - **Nghiêm trọng:** mất tiền, sai hoa hồng, lộ dữ liệu, sập trang.
  - **Cao:** chức năng chính sai.
  - **Trung bình:** lệch giao diện, chậm.
  - **Thấp:** chữ, căn lề.
- **Mã test case:** `TC-xx` ứng với rủi ro số xx ở mục 11. `SMK-xx` là smoke test, `REG-<nhóm>-xx` là regression.
- **Môi trường:** Windows (dev), Chrome desktop 1440px, Chrome mobile giả lập 390px (iPhone 12), Safari iOS thật nếu có cho nhóm CSS. Tài khoản test gồm: admin quản lý, CTV test đang hoạt động, khách chưa đăng nhập.

### 12.2. Test case theo từng rủi ro

Mỗi test case ghi: **Ưu tiên**, **Loại** (Tự động / Tay / Giám sát), **Điều kiện trước**, **Các bước**, **Kết quả mong đợi**.

#### Nhóm A. Backend lúc chạy

- **TC-01 Import vòng.** P0, Tự động.
  - Trước: đã lưu `madge-baseline.txt` từ `main`.
  - Bước: chạy `npx madge --circular --extensions ts backend/ > madge-after.txt`, rồi diff với baseline.
  - Mong đợi: không có vòng mới; server khởi động không có `ReferenceError` hay `Cannot access ... before initialization`.
- **TC-02 Đuôi `.js` trong import.** P0, Tự động.
  - Bước: `npm run typecheck:api`; khởi động bằng `node --import tsx backend/shop_standalone_server.ts` (giống production).
  - Mong đợi: không có `ERR_MODULE_NOT_FOUND`; `GET /api/shop/health` trả 200.
- **TC-03 Biến môi trường cấp module.** P1, Tay.
  - Trước: `.env` local đặt `SHOP_CATALOG_TTL_SEC=123`.
  - Bước: thêm log tạm in `TTL_SEC` khi khởi động (không commit), chạy bản trước và bản sau.
  - Mong đợi: cả hai in ra 123.
- **TC-04 State cấp module không nhân đôi.** P0, Tự động + review.
  - Bước: `rg -n "inflightProducers\s*=|new Map<|syncBus\.on\(" backend/`, so số lượng với `main`. Sau đó gửi 20 request song song `GET /api/shop/products?limit=24` khi cache trống (bắn bằng `npx autocannon -c 20 -a 20`), đếm query Mongo bằng profiler (`db.setProfilingLevel(2)`).
  - Mong đợi: số khai báo không đổi; số query `aloha_products` cho 20 request đồng thời bằng bản trước (xấp xỉ 1 lượt, không phải 20).
- **TC-05 Thứ tự route/middleware.** P0, Tự động.
  - Bước: `npx tsx scripts/refactor/dump-routes.ts`, diff với `routes-before.txt`.
  - Mong đợi: diff rỗng, kể cả cột `handlers=N`.
  - Kiểm tay bổ sung: `GET /api/shop/products/KN3GT30/variants` trả danh sách biến thể, không bị nhầm thành chi tiết sản phẩm; `POST /api/shop/admin/ctv/bills/lock` không rơi vào route `/:ctvCode/ban`.
- **TC-06 Closure và DB đúng.** P0, Tự động.
  - Bước: chạy `api-snapshot` cho toàn bộ route admin CTV và CTV của tôi (có cookie).
  - Mong đợi: diff rỗng. Riêng `/api/shop/admin/ctv/overview` và `/api/shop/ctv/me/overview` phải có số liệu (không phải 0 hay rỗng do đọc nhầm shop DB và ops DB).
- **TC-07 SSE không rò rỉ.** P0, Tay + Giám sát.
  - Bước:
    1. Mở trang chủ, xác nhận có kết nối `GET /api/shop/catalog/stream` (tab Network, EventStream).
    2. Đóng rồi mở tab 20 lần.
    3. Gọi endpoint debug tạm, hoặc log `syncBus.listenerCount("change")`.
    4. Sửa giá một sản phẩm ở admin.
  - Mong đợi: listener quay về mức ban đầu (chênh không quá 1); trang đang mở cập nhật giá trong 5 giây; làm lại tương tự với `/api/shop/ctv/me/stream` bằng tài khoản CTV.
- **TC-08 Thiếu `await`/`return`.** P0, Tự động.
  - Bước: `api-snapshot`; lọc log pm2 local tìm `UnhandledPromiseRejection`.
  - Mong đợi: body giống hệt; không có unhandled rejection.
- **TC-09 Xử lý lỗi giữ nguyên.** P0, Tự động.
  - Bước: thêm vào snapshot các URL lỗi:
    - `/api/shop/products/KHONG_TON_TAI`
    - `/api/shop/products?page=-1`
    - `POST /api/shop/products/prices` với body rỗng
    - `PUT /api/shop/ctv/me/payout-bank` với body sai định dạng
    - `/api/shop/admin/ctv/bills/abc/export.xlsx`
  - Mong đợi: mã HTTP và body lỗi giống hệt bản trước; log không có `ERR_HTTP_HEADERS_SENT`.
- **TC-10 Code "không dùng" thật sự không dùng.** P0, Tự động + Tay.
  - Bước: `rg` toàn repo, cả `scripts/` và `tools/`; trên VPS `grep -rn "scanProductQr\|printPriceLabels\|printBarcodeLabels\|printReceipt80mm" /root/aloha_thumua_webapp /root/aloha-shop --include=*.ts --include=*.cjs --include=*.js` (bỏ `node_modules`); `next build`; khởi động API.
  - Mong đợi: không có tham chiếu; build và khởi động xanh; 24h sau deploy không có lỗi thiếu module.

#### Nhóm B. TypeScript và build

- **TC-11 Type không bị khai báo trùng.** P2, Review. Bước: `rg -n "^(export )?(type|interface) " <thư mục mới>`, tìm tên trùng. Mong đợi: mỗi type chỉ khai báo một nơi.
- **TC-12 Không phát sinh lỗi tsc mới.** P0, Tự động. Bước: `npm run typecheck 2> after.txt`, so với `typecheck-baseline.txt`. Mong đợi: số lỗi nhỏ hơn hoặc bằng baseline, không có lỗi mới.
- **TC-13 Re-export type.** P0, Tự động. Bước: `npm run build --prefix frontend`. Mong đợi: không có lỗi `isolatedModules` hay `re-exporting a type`.
- **TC-14 Alias thống nhất.** P2, Review. Bước: `rg -n "from \"\.\./\.\./" frontend/components/<thư mục mới>`. Mong đợi: dùng `@/` cho import ngoài thư mục module.

#### Nhóm C. React / Next.js

- **TC-15 `"use client"`.** P0, Tự động + Tay. Bước: `next build`; mở từng trang dùng component đã tách. Mong đợi: build xanh; console không có lỗi `useState only works in Client Components` hay hydration.
- **TC-16 Không remount, không mất focus.** P1, Tay.
  - Bước: ở `ShopArticlesAdmin` gõ liên tục 30 ký tự vào ô tiêu đề; ở `ShopAppearanceEditor` gõ vào ô chữ của một khối; ở `CatalogLayout` gõ vào ô giá của modal lọc.
  - Mong đợi: con trỏ không nhảy, không mất ký tự, không mất focus.
- **TC-17 Danh sách giữ state.** P1, Tay.
  - Bước: ở admin CTV, bảng hoa hồng, chọn hàng hoặc mở rộng một dòng rồi đổi trang và quay lại; ở editor giao diện, kéo đổi thứ tự khối trang chủ (không xuất bản).
  - Mong đợi: hành vi giống hệt bản trước (quay video màn hình trước/sau để so).
- **TC-18 Callback không dùng state cũ.** P1, Tay. Bước: bấm nhanh 5 lần nút chọn/bỏ chọn khối ở editor (`setSelectedId((cur) => ...)`), hoặc tăng/giảm bộ lọc liên tục. Mong đợi: trạng thái cuối đúng với số lần bấm.
- **TC-19 Không phát sinh request thừa.** P1, Tay. Bước: mở tab Network, tải lại mỗi trang (trang chủ, `/tim?q=kim tien`, `/danh-muc/<slug>`, `/admin/ctv`, website bán hàng), đếm số request API. Mong đợi: số request và thứ tự bằng bản trước.
- **TC-20 Bundle không phình.** P1, Tự động. Bước: lưu output bảng "First Load JS" của `next build` trước và sau. Mong đợi: mỗi route tăng không quá 2 KB; route storefront không tăng.
- **TC-21 Không lỗi hydration.** P0, Tay. Bước: mở trang chủ, danh mục, chi tiết sản phẩm, `/don-hang/<mã>`, `/tuyen-ctv` với cache tắt; xem console. Mong đợi: không có cảnh báo `Hydration failed` hay `Text content does not match`.

#### Nhóm D. CSS

- **TC-22 Cascade giữ nguyên.** P0, Tự động + Tay.
  - Bước: so file CSS trong `.next/static/css/` (sau khi bỏ chú thích và khoảng trắng) trước và sau; chụp ảnh 10 trang ở 1440px và 390px, so bằng công cụ so ảnh (Playwright `toHaveScreenshot` hoặc so tay chồng lớp).
  - Mong đợi: nội dung CSS tương đương; ảnh khác biệt 0% (ngưỡng tối đa 0,1% do font render).
- **TC-23 `@import` hoạt động.** P0, Tay. Bước: `next build` rồi `next start`; mở trang chủ; tắt JS. Mong đợi: toàn bộ style có mặt (hero, nút, tab bar mobile).
- **TC-24 Encoding.** P1, Tự động. Bước: `git diff --stat` xem có file bị đổi toàn bộ dòng không; mở chú thích tiếng Việt trong CSS và TSX đã tách. Mong đợi: chỉ các dòng chuyển có trong diff; tiếng Việt hiển thị đúng.

#### Nhóm E. Git và quy trình

- **TC-25 Không conflict với việc đang làm.** P1, Tay. Bước: trước khi bắt đầu, `git status` sạch, không có PR mở chạm file đích. Mong đợi: đạt; nếu không đạt thì hoãn.
- **TC-26 Blame còn dùng được.** P2, Tay. Bước: `git blame -C -C <file mới>` trên vài dòng. Mong đợi: hiện tác giả và commit gốc, không phải commit refactor.
- **TC-27 PR đủ nhỏ để review.** P1, Review. Mong đợi: mỗi PR một file lớn; `git diff -M --color-moved` cho thấy trên 95% dòng là "moved".
- **TC-28 Không lẫn sửa logic.** P0, Review. Bước: reviewer xem các dòng không phải "moved". Mong đợi: chỉ có import, export, khai báo `ctx`, chữ ký hàm đăng ký.
- **TC-29 Không có file build trong PR.** P0, Tự động. Bước: `git diff --name-only main... | rg "^(frontend/\.next|node_modules)/"`. Mong đợi: rỗng.
- **TC-30 Merge tuần tự.** P1, Tay. Mong đợi: lịch merge ghi rõ ngày giờ, mỗi PR cách nhau ít nhất nửa ngày.

#### Nhóm F. Deploy và vận hành (Giám sát)

- **TC-31 Không deploy khi chưa đủ bằng chứng.** P0, Review. Mong đợi: PR có đủ output TC-05, TC-06, TC-12, TC-20, TC-22 và báo cáo test mới được merge.
- **TC-32 Build production thành công.** P0, Giám sát. Bước: xem log job CI; trên VPS chạy `pm2 status`, `curl -s localhost:3001/api/shop/health`, `curl -sI https://<domain>/`. Mong đợi: job xanh; 2 app online, restart không tăng bất thường; health 200.
- **TC-33 Không lỗi cache cũ.** P1, Giám sát. Bước: sau deploy gọi `POST /api/shop/cache/clear`; mở web bằng một tab đã mở từ trước khi deploy rồi chuyển trang. Mong đợi: không có `ChunkLoadError`; nếu có thì trang tự tải lại.
- **TC-34 Revert được.** P1, Tay (diễn tập trên nhánh). Bước: trên nhánh thử, `git revert -m 1 <merge>` rồi build. Mong đợi: build xanh, snapshot về đúng bản trước.
- **TC-35 Ổn định 24h.** P0, Giám sát.
  - Bước: sau 1h và 24h, xem số dòng lỗi trong `pm2 logs aloha-shop-api --err --lines 500`, RAM trong `pm2 monit`, thời gian phản hồi `GET /api/shop/products?limit=24` (đo 10 lần bằng `curl -w "%{time_total}"`).
  - Mong đợi: không có lỗi mới; RAM không tăng liên tục; thời gian phản hồi lệch không quá 10% so với trước deploy.

#### Nhóm G. Dữ liệu, bảo mật, hiệu năng

- **TC-36 Snapshot không chạm production.** P0, Tự động. Bước: chạy `api-snapshot.cjs https://<domain-production> out`. Mong đợi: script dừng ngay với thông báo từ chối.
- **TC-37 Không lộ bí mật.** P0, Tự động. Bước: `git diff main... | rg -i "cookie|token|secret|password|mongodb://|stk|soTaiKhoan"`; kiểm tra `docs/refactor/snap-*` có trong `.gitignore`. Mong đợi: không có dữ liệu nhạy cảm trong diff.
- **TC-38 Không mất middleware bảo vệ.** P0, Tự động.
  - Bước: gọi toàn bộ URL nhóm ADMIN và CTV trong snapshot **không có cookie**, và bằng cookie của khách thường (không phải quản lý).
  - Mong đợi: mã trả về (401/403) giống hệt bản trước; route công khai vẫn có header CORS (`Access-Control-Allow-Origin`) giống trước.
- **TC-39 Không giảm hiệu năng.** P1, Tự động. Bước: đo thời gian 3 lần mỗi URL trong snapshot trước và sau (script ghi `time_total`); bật profiler Mongo đếm số query mỗi request cho `/api/shop/admin/ctv/overview`, `/api/shop/ctv/me/overview`, `/api/shop/products`. Mong đợi: số query bằng nhau; thời gian lệch không quá 10%.

#### Nhóm H. Con người

- **TC-40 Không tách dở dang.** P1, Review. Mong đợi: sau khi merge, file gốc chỉ còn file tổng; không còn code trùng giữa file gốc và file mới (`rg` tên hàm chỉ ra một định nghĩa).
- **TC-41 Có hướng dẫn cấu trúc mới.** P2, Review. Mong đợi: mỗi thư mục mới có README 5–10 dòng; ESLint `max-lines` cảnh báo khi vượt 800.
- **TC-42 Có người trực.** P1, Review. Mong đợi: PR ghi tên người trực 24h và kênh báo lỗi.

### 12.3. Smoke test (chạy sau mỗi lần build và mỗi lần deploy, khoảng 10 phút)

- **SMK-01:** `GET /api/shop/health` trả 200.
- **SMK-02:** trang chủ tải xong, có sản phẩm, có khối nổi bật và khối mới.
- **SMK-03:** tìm "kim tien" ra kết quả; mở một sản phẩm.
- **SMK-04:** thêm vào giỏ, mở giỏ, tới trang checkout. Không đặt đơn thật trên production.
- **SMK-05:** đăng nhập admin, mở `/admin/ctv` và trang website bán hàng.
- **SMK-06:** đăng nhập CTV test, mở trang CTV của tôi.
- **SMK-07:** trang `/tuyen-ctv` và `/don-hang/<mã đơn test>` hiển thị.

### 12.4. Regression theo nhóm chức năng (chạy đầy đủ trước khi merge PR liên quan)

- **REG-CAT (catalog, cho `register.ts`, `shopVariantGroup.ts`, `CatalogLayout`, `CategoryNavMenu`):**
  1. Lọc theo danh mục cấp 1, 2, 3.
  2. Lọc giá min/max, còn hàng, thuộc tính, đơn vị.
  3. Sort theo từng kiểu.
  4. Phân trang, và nút Back/Forward giữ bộ lọc.
  5. Tìm có dấu và không dấu.
  6. Sản phẩm có biến thể (KN3GT30) đổi biến thể.
  7. Sản phẩm combo.
  8. Sản phẩm đã ẩn (HPBTH) không hiện.
  9. Nhãn nổi bật/mới có đúng số lượng (noi_bat 8, moi 16 tại thời điểm 27/09).
  10. Menu desktop flyout, lưới danh mục mobile.
- **REG-CTV-ADMIN (cho `commissionAdminRoutes.ts`, `CtvAdminShell`, `ShopAccountsAdmin`, Legacy):**
  1. Tổng quan và biểu đồ theo khoảng ngày.
  2. Danh sách đơn.
  3. Hoa hồng: lọc kỳ/CTV, mở drawer kỳ.
  4. Cấu hình hoa hồng: sửa rồi hoàn lại một mức % trên DB local.
  5. Chống gian lận: xem, gỡ cờ trên DB local.
  6. Danh sách CTV, chi tiết CTV, khoá rồi mở khoá trên DB local.
  7. Chốt kỳ và đánh dấu đã trả trên DB local.
  8. Xuất Excel, so tổng tiền trong file với bản trước.
- **REG-CTV-ME (cho `ctvMeRoutes.ts`):**
  1. Tổng quan, hoa hồng, kỳ thanh toán, chuyển đổi của CTV test; so số liệu với bản trước.
  2. Đổi tài khoản ngân hàng rồi hoàn lại (DB local).
  3. Realtime: tạo đơn test có mã CTV trên DB local, trang CTV cập nhật.
- **REG-WEB-ADMIN (cho `ShopAppearanceEditor`, `ShopArticlesAdmin`, `shopArticles/register.ts`):**
  1. Sửa khối trang chủ, thương hiệu, menu, footer; preview desktop/mobile; lưu nháp; hẹn giờ (DB local).
  2. Tạo, sửa, xoá bài viết test.
  3. Trang bài viết công khai và sitemap-data.
- **REG-UI (cho `globals.css`):** so ảnh 10 trang × 2 kích thước màn hình, kèm trạng thái hover nút và thẻ sản phẩm, sticky bar ở giỏ/checkout, tab bar mobile, loading toàn trang.
- **REG-ORDER (cho `don-hang/[code]/page.tsx`):** đơn chờ thanh toán, đã thanh toán, đang giao, huỷ (dùng đơn có sẵn trên DB local); nút sao chép mã đơn.

### 12.5. Ma trận test bắt buộc theo file

- `commissionAdminRoutes.ts`: TC-01, 02, 04, 05, 06, 08, 09, 12, 38, 39, SMK, REG-CTV-ADMIN.
- `ctvMeRoutes.ts`: TC-01, 02, 06, 07, 08, 09, 12, 37, 38, 39, SMK, REG-CTV-ME.
- `shopCatalog/register.ts`: TC-01, 02, 03, 04, 05, 06, 07, 08, 09, 12, 38, 39, SMK, REG-CAT.
- `CtvAdminShell.tsx`: TC-13, 15, 16, 17, 18, 19, 20, SMK, REG-CTV-ADMIN.
- `CategoryNavMenu.tsx`, `CatalogLayout.tsx`: TC-13, 15, 16, 19, 20, 21, SMK, REG-CAT.
- `ShopAppearanceEditor.tsx`, `ShopArticlesAdmin.tsx`: TC-13, 15, 16, 17, 18, 19, 20, REG-WEB-ADMIN.
- `globals.css`: TC-22, 23, 24, SMK, REG-UI.
- Giai đoạn 0 (xoá code): TC-10, 12, 13, SMK.
- Mọi PR: TC-25 đến TC-37, TC-40 đến TC-42.

### 12.6. Mẫu báo cáo bug và báo cáo test

- **Mẫu bug:** mã bug, test case liên quan, môi trường (nhánh, commit, trình duyệt, kích thước màn hình), các bước tái hiện, kết quả thực tế, kết quả mong đợi, ảnh/video, mức độ, mức ưu tiên, người nhận.
- **Mẫu báo cáo test mỗi PR:** tên PR, commit, người test, ngày; số test đạt/không đạt/bỏ qua theo P0/P1/P2; danh sách bug đang mở; kết luận "Đạt để merge" hoặc "Chưa đạt"; chữ ký QA và QC.
- Lưu báo cáo tại `docs/refactor/test-reports/<ten-file>-<ngay>.md` (không kèm dữ liệu cá nhân).

