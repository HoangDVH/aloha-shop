# KiotViet product-code rename repair — 2026-10-12

## Confirmed live identities and repaired data

The KiotViet product-by-ID endpoint was queried for all six groups before applying any repair. These current codes were verified:

| KV ID | Current code | Retired code |
| --- | --- | --- |
| 43855340 | TKTTTS24 | SP000055 |
| 43703802 | TLHBS | TLHT30 |
| 43703803 | TTLHBS | TTLH30 |
| 43675569 | VLST35 | CVLS |
| 43675570 | TVLS35 | TCVLS35 |
| 43825262 | CBGCMM | CBQTPN |

The six old rows remain in Mongo, with their original codes/IDs/history data. They are archived with `mergedInto`, `isActive=false`, `hienThiWeb=false` and reconciliation timestamps. Current rows retain aliases in `kvCodeAliases`. Stock and prices were not summed across duplicates. Order documents were not modified. The repair refuses to proceed if there are active old-code stock holds, ID/code collisions or ambiguous live responses.

Pre-repair BSON-type-preserving backup: `artifacts/kv-identity-repair/before-1791785731184.ejson`. A copy is on the VPS in `/root/aloha-identity-backup/`.

## Code changes

- `kvProductIdentity.ts` identifies products by positive KV ID, handles numeric/string IDs, preserves CMS fields and retires duplicate rows. Verified delta responses can rename a single existing physical document instead of requiring a new record. Re-running completed reconciliation does not rewrite rows.
- The stock poller reconciles identities before matching current codes or planning active/deleted changes. Archived aliases are excluded from its normal updates.
- The existing ops-copy tool also matches stable IDs, retains aliases when changing a code and refuses to resurrect an upstream retired-code copy. CMS videos and rename-time existing images/descriptions are preserved.
- Storefront filters exclude archived rows. Old product API codes and old slugs resolve an active canonical product through indexed aliases. Alias lookup retains active/visible/sale/image filters.
- Product pages redirect to the canonical path, retaining query parameters such as `ctv`. Streaming page responses may be HTTP 200 containing Next's permanent-redirect instruction and a zero-delay redirect meta tag; nonstreaming handling uses 308. The production response was verified to preserve the CTV parameter.

## Deployment and verification

This repair was deployed to production. A staging copy of the production repository was used to build and typecheck only this change; unrelated local changes were not deployed. Existing static assets were retained to support open browser tabs. API and web were restarted; catalog cache was invalidated. The production source files and previous `.next` build are backed up in `/root/aloha-identity-backup/`.

- 36 focused tests passed, including nine identity/alias tests plus existing catalog pin and pagination regressions.
- Backend/frontend TypeScript passed locally; backend typecheck and optimized Next production build passed on the VPS staging copy.
- Production search for Kim Thủy Tùng returned TKTTTS24 once and no SP000055. KTTTS, a different KV ID/unit, remains a separate product.
- `/api/shop/products/SP000055` returned 200 and canonical code TKTTTS24.
- The old product URL emitted a redirect to TKTTTS24 while retaining `ctv=TESTCODE`.
- Production homepage returned 200. A fresh database audit found zero unarchived duplicate KV-ID groups.
- Repository line check still flags five existing oversized files outside this change.

The deployment is a targeted manual patch; include these source changes in version control before a subsequent clean deployment so the identity handling is retained. Reverting data should use the EJSON backup by original `_id`, not delete canonical rows or alter historical orders.
