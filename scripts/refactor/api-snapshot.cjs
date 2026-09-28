// node scripts/refactor/api-snapshot.cjs <BASE_URL> <OUT_DIR>
// Env tuỳ chọn: ADMIN_COOKIE, CTV_COOKIE (copy từ trình duyệt đã đăng nhập)
const fs = require("fs");
const path = require("path");
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
  "/api/shop/ctv/me/stats",
  "/api/shop/ctv/me/overview",
  "/api/shop/ctv/me/commissions",
  "/api/shop/ctv/me/bills",
  "/api/shop/ctv/me/conversions",
  "/api/shop/ctv/me/rate",
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
const scrub = (v) =>
  Array.isArray(v)
    ? v.map(scrub)
    : v && typeof v === "object"
    ? Object.fromEntries(
        Object.entries(v)
          .filter(([k]) => !VOLATILE.test(k))
          .map(([k, x]) => [k, scrub(x)])
      )
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
  for (const [urls, cookie] of groups) {
    for (const u of urls) {
      try {
        const r = await fetch(base + u, { headers: cookie ? { cookie } : {} });
        let body;
        try {
          body = scrub(await r.json());
        } catch {
          body = "(non-json)";
        }
        const file = path.join(out, u.replace(/[^a-z0-9]+/gi, "_") + ".json");
        fs.writeFileSync(file, JSON.stringify({ status: r.status, body }, null, 2));
      } catch (err) {
        console.error(`Error fetching ${u}:`, err.message);
      }
    }
  }
  console.log("done", out);
})();
