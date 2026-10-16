# Checkout and authentication fixes — 2026-10-16

## Production inspection (read-only)

VPS source revision: `d22a15b`. No production files, indexes, orders or services were changed during this inspection.

| Finding | Observed production state |
| --- | --- |
| Shop/staff login trusts leftmost X-Forwarded-For | Present in both route modules. Nginx appends the connection IP, so a client-supplied prefix is unsafe. |
| Wholesale history lookup inside global checkout lock | Present: authentication → serializeShopCheckout → createShopOrder → checkWholesalePurchase. |
| Redemption indexes absent | Not present as an operational defect: listIndexes confirmed orderCode/status, status/expiresAt and all three buyer identity indexes already exist. Source declarations were incomplete. |
| Promotion review request lacks authentication | Present: route accepts accountId and buyerPhone from the request body without an auth guard. |

## Implementation

- Express trusts loopback proxies by default, matching the inspected Nginx → 127.0.0.1:3001 topology. `TRUST_PROXY_CIDRS` optionally supplies a comma-separated allowlist; an empty value disables proxy trust. Legacy boolean `TRUST_PROXY=1` no longer enables raw header parsing. Both login routes use the same resolved IP helper. Staff login uses the existing atomic Redis limiter instead of count-then-insert.
- Authenticated, rate-limited checkout preflight resolves wholesale history before acquiring the global lock. A five-second total deadline includes credential reads, token acquisition and invoice pagination, with cancellation propagated to HTTP requests. Timeout/error returns `unknown`, which never grants a returning-customer exemption.
- A server-only response-local snapshot binds history to account ID, KiotViet customer/retailer and region. Checkout reloads account, current prices, stock and policy under the existing lock; a changed identity requires retry. Client-supplied history is ignored. Stock/promotion mutation serialization remains intact.
- Review requests require the existing active-shop authentication guard and a scoped order-ownership query. Account identity comes from the session; phone comes from the owned order. Zod bounds input. A shared atomic limiter supplements the existing rolling 24-hour quota, including concurrent submissions.
- Startup index declarations now include every existing production index needed by these checkout/review query shapes. All operations are additive/idempotent. No TTL index deletes redemption history. The separate customer-usage collection already queries deterministic `_id` values and needs no redundant index.

## Validation

- 10 new regression tests: proxy-chain spoofing, concurrent quota, deadline/cancellation, server-only snapshots, parallel checkout preflight, policy evaluation without external lookup under lock, anonymous/invalid/foreign-order requests, verified review identity, query indexes and concurrent review quota.
- 35 existing wholesale-policy and anti-abuse tests passed.
- Backend TypeScript check passed; changed modules pass the file-length check.
- These are local tests with controlled dependencies, not a production load test. The existing Redis limiter falls back to per-process memory during an outage; multi-instance rate enforcement requires healthy shared Redis. No deployment was performed.

## Rollout verification

Deploy the reviewed backend changes together. Confirm proxy topology before changing `TRUST_PROXY_CIDRS`; never use broad public-network trust. Startup creates missing indexes using the established index initializer. Verify healthy Redis, unauthenticated review returns 401, a foreign order returns 404, and customer IP remains stable when a supplied X-Forwarded-For prefix changes. Confirm a slow KiotViet history lookup does not occupy the checkout lock. Use test accounts/orders for mutation checks.

References: [Express trusted proxies](https://expressjs.com/en/guide/behind-proxies/), [OWASP authorization](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html), [MongoDB compound index guidance](https://www.mongodb.com/docs/manual/tutorial/equality-sort-range-guideline/).
