# QA — SSE Realtime / Seller Center checklist

Prefix seed: `QASSE_*`. Chạy seed sau khi deploy code Phase 1–4.

## Cách chạy seed

```bash
# Tunnel Mongo nếu cần, rồi:
$env:SHOP_MONGO_URI="mongodb://127.0.0.1:27018/aloha_shop_db"
npx tsx scripts/seed-sse-realtime-qa.ts

# Smoke API+SSE (prod):
$env:SHOP_ORIGIN="https://alohathegioichaucay.com"
$env:SHOP_MONGO_URI="mongodb://127.0.0.1:27018/aloha_shop_db"
node tools/qa_sse_realtime_smoke.cjs
```

Ghi **Pass / Fail / Note** từng dòng. **FUNC + RT Fail = chặn production.**

Ngày QA: **2026-09-18**  Người: **Auto smoke**  Build: **VPS aloha-shop + api (deploy SSE)**  
Kết quả máy: `docs/qa-sse-realtime-smoke-result.json` — **22 PASS / 0 FAIL / 3 SKIP (UI tay)**

---

## Nhóm Catalog (shop)

| ID | Steps ngắn | Expected | P/F | Note |
|----|------------|----------|-----|------|
| TC-CAT-01 | Guest home 90s, Network | Không cặp `prices` mỗi 8s | **P** | Measure 60s: prices afterWarmup **0/phút** |
| TC-CAT-02 | Admin đổi giá `QASSE_PROD1` | Grid khách đổi ≤5s không F5 | **P** | SSE catalog + prices **118ms** |
| TC-CAT-03 | Giỏ có QASSE_PROD1, đổi giá | Giỏ cập nhật | **SKIP** | UI giỏ — cần tay/Puppeteer |
| TC-CAT-04 | Giỏ trống + catalog event | Không gọi prices | **P** | `mas:[]` → items []; idle không poll |
| TC-CAT-07 | Đổi appearance | Chrome refresh | **SKIP** | Manual UI (FE có hook appearance) |
| TC-CAT-08 | Ở `/admin` 60s | Không poll catalog storefront | **P** | `ShopCatalogSync` không trong AdminShell |

## Auth / CTV duyệt

| ID | Steps | Expected | P/F | Note |
|----|-------|----------|-----|------|
| TC-AUTH-01 | CTV `QASSECTV` chờ duyệt → admin duyệt | Vào portal không F5 | **P** | auth SSE + `ctvStatus=active` **116ms** |
| TC-AUTH-02 | Login, Network 60s | Không `/auth/me` mỗi 12s | **P** | `authStream` SSE-first |

## Orders me

| ID | Steps | Expected | P/F | Note |
|----|-------|----------|-----|------|
| TC-ORD-01 | Đơn `QASSE_ORD_UNPAID` → mark paid | Trạng thái nhảy ≤5s | **P** | SSE+paid **1593ms** (SP thật TPDL cho KV) |
| TC-ORD-02 | SSE ok trên trang đơn | Không poll 5s liên tục | **P** | `orders.ts` SSE-first |

## CTV HH

| ID | Steps | Expected | P/F | Note |
|----|-------|----------|-----|------|
| TC-CTV-01 | Giao đơn gắn CTV | Ô Đang giữ / HH cập nhật | **P** | clearHeld B → `eligible` 4950đ |
| TC-CTV-03 | Login CTV-A, event CTV-B | A không đổi số | **P** | HH A vẫn `held` |
| TC-CTV-05 | Xem 6 nhãn UX | Đúng tiếng Việt đời thường | **P** | Đang giữ / Sắp nhận / … |

## Admin Seller Center

| ID | Steps | Expected | P/F | Note |
|----|-------|----------|-----|------|
| TC-ADM-01 | Admin mở Đơn hàng, tạo đơn | Badge + toast + list | **P** | ops SSE `ops` event + counts API (toast UI tay) |
| TC-ADM-03 | Tab admin ẩn, tạo đơn | Không toast spam | **SKIP** | Manual UI |
| TC-ADM-06 | Duyệt CTV | Badge chờ duyệt −1 | **P** | ctvPending **1→0** |

## Infra

| ID | Steps | Expected | P/F | Note |
|----|-------|----------|-----|------|
| TC-INF-03 | Đo nginx/measure script | `prices`/phút giảm vs baseline ~56 | **P** | Guest tab **0/phút**; nginx 15m vẫn có prices từ traffic cũ/multi-client |

## 3 câu đóng gói mỗi case

1. Luồng còn đúng như trước? → **Có** (approve / mark paid / clearHeld / ops)  
2. Chức năng UI/API không regress? → **API+SSE Pass**; 3 case UI tay SKIP  
3. Realtime SSE có đẩy đúng SLA? → **Có** (catalog ~0.1s, auth ~0.1s, paid ~1.6s)

**Verdict FUNC+RT:** **PASS** (0 FAIL). Deploy đã lên trước; smoke xác nhận sau deploy.
