# Backup giá khuyến mãi web (webKm)

Ngày: 2026-09-15
Mục đích: lưu code feature giá KM trước khi rollback về trước plan.

## Khôi phục sau này
1. Copy các file trong thư mục này về đúng path trong repo.
2. Rebuild frontend + restart `aloha-shop-api` / `aloha-shop`.
3. Field Mongo (không xóa khi rollback): `webKm`, `giaWebLichSu` trên `aloha_products`.

## File đã backup
- backend/shopCatalog/webKm.ts
- backend/shopAppearance/productsAdmin.ts
- backend/shopCatalog/register.ts
- backend/shopOrders/orderRouteShared.ts
- frontend/components/ProductPrice.tsx
- frontend/components/ProductCard.tsx
- frontend/components/ProductDetailView.tsx
- frontend/components/SearchResultLink.tsx
- frontend/components/admin/website/products/ShopWebProductsAdmin.tsx
- frontend/components/admin/website/products/ProductWebKmEditor.tsx
- frontend/components/admin/website/products/WebKmBulkBar.tsx
- frontend/components/checkout/CheckoutLineItems.tsx
- frontend/app/(storefront)/gio-hang/page.tsx
- frontend/lib/api.ts
- frontend/lib/cart.ts
- frontend/lib/cartPriceRefresh.ts
- frontend/lib/livePrices.ts
- frontend/lib/webKmForm.ts
- tools/_deploy_web_km.cjs
- tools/_deploy_history_table.cjs
- tools/_deploy_webkm_selfcancel_fix.cjs
- tools/_deploy_parseNhom_fix.cjs


## Ghi chú
- Rollback chỉ gỡ code KM; giữ các thay đổi không liên quan (HD lookup, CTV, ...).
- `productsAdmin` trong backup gồm cả search exact-SKU + API webKm.
