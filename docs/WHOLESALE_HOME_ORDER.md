# Wholesale homepage product ordering

Implemented locally on 2026-10-12. No migration or production deployment is included.

## Rules

- Only viewers with role `si`, status `active` and region `HCM` or `TINH` receive the new homepage presentation.
- Repeat two products from the `CHẬU TRỒNG CÂY` category tree, then one ordinary product from `CÂY CẢNH ĐỦ LOẠI`. Exhausted groups are skipped.
- Other product groups follow; descendants of `CÂY THÀNH PHẨM TRỒNG SẴN` and `CÂY THÀNH PHẨM SALE` come last. Classification uses category ancestry, not words in a product name. Existing rank/pins remain in order within each group.
- Dedicated finished-plant sections move to the end of the main homepage section list for these viewers. Original admin section ordering remains for other accounts. Category IDs are resolved from the category tree when available.
- Featured, offers, new, bestsellers, low-stock products and custom homepage product sections retain their original eligibility filters.
- If a section has only finished products, it still shows those products. No arbitrary pots are injected, no badges are edited, and no database writes are performed.

## Implementation

`frontend/lib/homeWholesaleOrder.ts` is the pure policy used by the frontend and backend. `/api/shop/products?homeOrder=wholesale` applies it after eligibility/ranking and before pagination in all three listing branches. It is an optional presentation parameter over already accessible products, not an authorization mechanism. Requests without it retain their original order. The Redis listing key includes the presentation profile.

Homepage sections keep their existing public server-rendered lists. `useWholesaleHomeProducts` requests a session list only for qualifying viewers, retaining the section's query. TanStack Query uses the existing `shop/si` scope plus account ID, status and region, and campaign data for offers. Login/logout already clears this scope. Failed/loading requests fall back to reordering the supplied list. Public HTML is not customized by account, which avoids relying on the production Nginx page cache for private presentation.

The offers list is ordered on the server after campaign membership is determined. Its existing low-count bestseller fallback is merged/deduplicated and then ordered before the final display limit. Other account types keep the existing campaign merging behavior.

## Validation

- 44 focused tests passed, including all listing branches before pagination, category ancestry, HCM/TINH eligibility, login/logout, session query separation, deal fallback, campaign refresh, retail order, section order and existing pins/deal filters.
- Backend and frontend TypeScript checks passed.
- Local homepage HTTP smoke returned 200 with featured content and no module-resolution or Next error fallback; the client/server section boundary compiled successfully.
- Local real-data API smoke: new-products list returned `BTT500`, `LTTKD`, `LHVT48`, `VVL8x15`, `NVL8x17`, `TLHVMN48`, matching pot/pot/plant/pot/pot/plant.
- Real featured-list data currently contains six finished plants and no pots; assigning the featured badge to eligible pots is needed for them to appear in that section.
- No authenticated production browser interaction was available for visual verification. No customer account was modified or impersonated.
- Repository line check reports five existing oversized files outside this change.
