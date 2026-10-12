# CBCTPT first navigation audit — 2026-10-12

Reported flow: first visit to production, desktop, click a product card. Later visits are normal. Whether the URL changes on the first click is unknown.

## Evidence

- Production runs `next start -p 3002`, not the development server. The development compilation explanation does not establish the production cause.
- Public product page HTTP requests measured 60–156 ms total; resolve requests measured 43–159 ms. Product API first request was 398 ms. See `artifacts/pdp-first-load/production-timings.json` and its reproduction script.
- All 18 JavaScript assets referenced by the tested product HTML returned 200. Cold asset downloads measured 99–725 ms. These are HTTP measurements, not browser rendering or interaction measurements.
- On the same `?_rsc=cache-audit` URL, partial prefetch returned 11,669 characters, full RSC returned 44,535 and HTML returned 130,018. Nginx returned separate MISS responses and then a HIT for the repeated prefetch, respecting Next's Vary headers in this probe. No HTML/Flight cache collision was reproduced.
- `/etc/nginx/sites-enabled/aloha-shop` enables a 10-second cache in `location /` and ignores `Cache-Control Expires`. The page response includes `private, no-cache, no-store`. Cache policy needs a separate review for session-dependent responses; this audit did not establish it as the first-click cause or access any customer's authenticated response.
- ProductCard's click handler set a spinner and cleared it after 3 seconds regardless of whether navigation completed. The global capture listener ignores default-prevented clicks; Next Link prevents native navigation while starting client routing. Thus the global listener is not a reliable signal for those links. No evidence shows that either handler cancels the product navigation itself.

## Local correction

ProductCard now renders ProductLinkPending inside both image and title Links. The component uses Next 15's `useLinkStatus` to follow the actual Link transition. It has no expiry timer or separate navigation handlers. Native links, modifier clicks and add-to-cart behavior remain delegated to their existing handlers. No force-prefetch of every card or additional resolve request is introduced.

Reference: https://nextjs.org/docs/15/app/api-reference/functions/use-link-status

## Validation and limits

- Backend and frontend TypeScript checks passed on the final source.
- 14 targeted tests passed: product-link-pending, product-card-wholesale-campaign and afterNavigationClick.
- `git diff --check` passed. Repository line check reports five oversized files outside this change; ProductCard is shorter and the new component is 23 lines.
- Available computer-use surfaces are empty, so the reported desktop interaction could not be reproduced in a real browser here. Hook tests do not substitute for an end-to-end browser trace.
- No production code, configuration, database or process was changed. This fixes misleading pending feedback locally; the cause of the reported delay/second-click requirement remains unconfirmed. A browser Network/Performance trace of the affected first click is still needed to distinguish hydration, client routing and delayed requests.
