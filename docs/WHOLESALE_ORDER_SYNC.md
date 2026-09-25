# Wholesale order synchronization

## Deployment configuration

- `SHOP_SI_ORDER_SYNC_ENABLED=1` enables the durable order worker. Leave unset during local testing against the production database. The admin screen explicitly displays when sending is disabled.
- `KV_GROUP_ID_SI_HCM` / `KV_GROUP_ID_SI_TINH` identify wholesale groups. On **alohanguyen** (via `GET /customers/group`): **HCM = 13004**, **TỈNH = 12731**. Many list responses still only expose the string field `groups` (`KHÁCH SỈ - HCM` / `KHÁCH SỈ - TỈNH`) — `customerGroupDetails` is often empty on `/customers` — so the worker also matches those names. Missing/ambiguous membership blocks sending; the worker never changes KV groups.
- Wholesale orders keep a **price snapshot** (`priceMode: si`, line `priceKind: si`). The worker posts that snapshot to KiotViet with `customerId`; it does not re-price from today's catalog and will not send retail lines.
- New wholesale orders persist `kvPushStatus: queued` on the same document as the order. Deploy API and worker configuration together: leaving sending disabled intentionally leaves orders waiting.
- Customer creation remains governed by the existing separate provisioning flag. This change does not auto-create customers.

## Operations

Admin → wholesale customers (`/admin/si`) now includes an order synchronization panel. Only active managers can link a customer, queue a reviewed order or reconcile an uncertain result. Every mutation rechecks current data server-side.

Customer linking checks exact normalized phone, one matching customer, retailer and wholesale region. It prevents reassignment to a different existing customer. A unique customer-link claim and the account revision protect concurrent linking. Failed claims remain for manual review rather than being reassigned automatically. This endpoint never changes KV customer groups.

Queued orders retain the customer's accepted price snapshot. Old orders without recorded policy consent require a manager to record confirmed consent and its evidence. Price changes, orders older than 24 hours or expired holds require the existing proposal workflow; they are not silently renewed or repriced.

After remote customer verification, an atomic claim changes the order to `sending`. All uncertain outcomes after this point become `unknown`, including missing official code or database failure after remote success. An expired `sending` lease also becomes `unknown`. Never reset such records to `queued` manually.

Locate the remote order using the full `ALOHA:<Mongo order ID>` marker at the start of its description. Enter its KV ID in the reconciliation panel. The server performs GET only and checks the marker, customer and retailer before storing the official KV code. If no conclusive match exists, leave it for investigation: absence from a search is not proof that POST failed. Automatic replay of uncertain POSTs is deliberately unavailable.

Pre-POST lookup outages retry with bounded exponential delay and jitter (five failed preparations maximum). Simultaneous workers share a document lease. Editing/canceling uses a separate lease that excludes worker claims. Unknown/sending orders block edits until reconciliation. The legacy KV retry endpoint and bulk test purge cannot bypass this path for managed wholesale orders.

The internal `code`/`id` remain unchanged. `kvOrderCode` supplies the official customer-facing code after synchronization; both references resolve through existing order lookup. Stock holds, links and payment references continue using the stable original code. A numeric KV ID is not treated as an official code.

## Customer display

Order totals use `total`, never `totalPayment` as a fallback for display. Existing legacy QR/payment calculations are unchanged. Pending payment methods no longer display COD. An order awaiting synchronization shows a waiting message and tells the buyer not to place it again. Shipping not yet quoted is identified separately.

## Verification and rollout

Run `node tests/wholesale-sync.test.cjs` and the existing checkout/cart regression suites. Tests stub all external calls; they do not create real orders. Validate linking and one order with a dedicated KV test customer before enabling production sending. Check both official KV code and marker, then confirm old WEB URL still resolves. Monitor `/admin/si` for customer review, unknown and needs-review states.

The account linked in this session is not in either wholesale KV group according to the prior live read. It must be reconciled by the shop before this worker will send its orders. No live order was sent as part of implementing this feature.
