# Wholesale order synchronization

## Deployment configuration

- `SHOP_SI_ORDER_SYNC_ENABLED=1` enables the durable order worker. Leave unset during local testing against the production database. The admin screen explicitly displays when sending is disabled.
- `KV_GROUP_ID_SI_HCM` / `KV_GROUP_ID_SI_TINH` identify wholesale groups. On **alohanguyen** (via the prior `GET /customers/group` audit): **HCM = 13004**, **TỈNH = 12731**. List responses may expose the string field `groups` instead of `customerGroupDetails`; both forms are matched. Verified accounts require matching groups. Pending profiles may send review orders before group verification, with a clear staff note. Existing KV customer groups are never overwritten by this flow.
- Wholesale orders keep a **price snapshot** (`priceMode: si`, line `priceKind: si`). The worker posts that snapshot to KiotViet with `customerId`; it does not re-price from today's catalog and will not send retail lines.
- New wholesale orders persist `kvPushStatus: queued` on the same document as the order. Deploy API and worker configuration together: leaving sending disabled intentionally leaves orders waiting.
- `SHOP_SI_KV_PROVISION_ENABLED=1` allows the order worker to create/link a missing customer before dispatch. With the flag disabled and no customer link, the order remains `awaiting_customer_link`. Pending registrations are provisioned on demand when a valid order needs a link; registration itself does not trigger immediate creation.

## Operations

Admin → wholesale customers (`/admin/si`) now includes an order synchronization panel. Only active managers can link a customer, queue a reviewed order or reconcile an uncertain result. Every mutation rechecks current data server-side.

Customer linking checks exact normalized phone, one matching customer, retailer and wholesale region. It prevents reassignment to a different existing customer. A unique customer-link claim and the account revision protect concurrent linking. Failed claims remain for manual review rather than being reassigned automatically. This endpoint never changes KV customer groups.

Queued orders retain the customer's accepted price snapshot. Old orders without recorded policy consent require a manager to record confirmed consent and its evidence. Price changes, orders older than 24 hours or expired holds require the existing proposal workflow; they are not silently renewed or repriced.

After exact-phone customer validation (and matching groups for verified accounts), an atomic claim changes the order to `sending`. All uncertain outcomes after this point become `unknown`, including missing official code or database failure after remote success. An expired `sending` lease also becomes `unknown`. Never reset such records to `queued` manually.

## New customers awaiting verification

The order worker validates account, consent, regional policy, accepted prices and expiry before provisioning. A single exact-phone KV match may be linked for a pending profile without changing that customer's groups; multiple matches require review. If no match exists, provisioning creates one marked customer, with the server-selected region's configured group and a pending-verification comment. The group is provisional until staff verification. Existing customer-creation leases, pre-POST markers and unknown-result reconciliation remain in force.

The order description includes `Khách sỉ mới — chờ xác minh thông tin/nhóm sỉ`, requested region, WEB code and ALOHA marker. It is a KiotViet order with `totalPayment: 0`, not an invoice or a payment confirmation. Admin verification is not changed by customer/order synchronization. Account changes during preparation stop dispatch for review.

Existing `awaiting_customer_link` orders are already selected by the worker and can proceed after this code is deployed with both flags enabled, provided they still satisfy policy/expiry checks. No direct requeue, manual customer ID patch or repeated customer checkout is necessary. Ambiguous/unknown or expired orders retain their review paths.

Locate the remote order using the full `ALOHA:<Mongo order ID>` marker at the start of its description. Enter its KV ID in the reconciliation panel. The server performs GET only and checks the marker, customer and retailer before storing the official KV code. If no conclusive match exists, leave it for investigation: absence from a search is not proof that POST failed. Automatic replay of uncertain POSTs is deliberately unavailable.

Pre-POST lookup outages retry with bounded exponential delay and jitter (five failed preparations maximum). Simultaneous workers share a document lease. Editing/canceling uses a separate lease that excludes worker claims. Unknown/sending orders block edits until reconciliation. The legacy KV retry endpoint and bulk test purge cannot bypass this path for managed wholesale orders.

The internal `code`/`id` remain unchanged. `kvOrderCode` supplies the official customer-facing code after synchronization; both references resolve through existing order lookup. Stock holds, links and payment references continue using the stable original code. A numeric KV ID is not treated as an official code.

## Customer display

Order totals use `total`, never `totalPayment` as a fallback for display. Existing legacy QR/payment calculations are unchanged. Pending payment methods no longer display COD. An order awaiting synchronization shows a waiting message and tells the buyer not to place it again. Shipping not yet quoted is identified separately.

## Verification and rollout

Run `node tests/wholesale-sync.test.cjs` and the existing checkout/cart regression suites. Tests stub all external calls; they do not create real orders. Validate linking and one order with a dedicated KV test customer before enabling production sending. Check both official KV code and marker, then confirm old WEB URL still resolves. Monitor `/admin/si` for customer review, unknown and needs-review states.

Automated tests use mocked KiotViet calls. On 2026-10-16, after the user requested resolution of the two waiting orders, local customer provisioning and order sync were enabled and the local API reloaded. A successful customer-create response wrapped in `data` required an unwrapping fix. The existing marked customer was reconciled without repeating its create. `WEB-261016-T0M0` synchronized as `DH008780` (2,030,000 VND), and `WEB-261016-67B1` as `DH008781` (2,145,000 VND). Direct KiotViet GETs returned HTTP 200, status 1, `totalPayment: 0`, the expected order markers and pending-verification notes. Runtime `.env` remains ignored by Git; this operation did not push/deploy the code to production.
