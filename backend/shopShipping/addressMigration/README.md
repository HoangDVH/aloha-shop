# Address migration snapshot

Source: https://tinhthanhpho.com/api-docs (HVN Group), version 2026.10.8, generated 2026-10-06.
License: CC BY 4.0, https://creativecommons.org/licenses/by/4.0/.
`snapshot.json` is a transformed, compact extract; attribution and original-file hashes are included in its metadata.
The publisher cites the National Statistics Office, administrative restructuring resolutions and map data.
Official reference: https://danhmuchanhchinh.nso.gov.vn/Doi_Chieu_Moi.aspx.
The An Phu Dong and Lai Thieu mappings were cross-checked against clauses 36 and 84 of Resolution 1685/NQ-UBTVQH15:
https://xaydungchinhsach.chinhphu.vn/toan-van-nghi-quyet-so-1685-nq-ubtvqh15-sap-xep-cac-dvhc-cap-xa-cua-thanh-pho-ho-chi-minh-nam-2025-119250616211341304.htm.

## Refresh

Download the public JSON datasets `provinces-legacy`, `districts-legacy`, `wards-legacy`, `provinces`, `wards`, and
`ward-merge-history` from https://tinhthanhpho.com/data/ into a local directory. No customer data is transmitted.
Run `node tools/build-address-migration.mjs <directory>` and review the source version, hashes, and changed mappings.
Run `npm run test:quick -- kv-address` before publishing. Runtime conversion uses the checked-in snapshot, never a third-party API.

## Rules

Only one whole-unit destination is automatic. Partial, unknown or ambiguous mappings retain the legacy delivery copy
and add a review warning on the KiotViet order and in the shop admin. The shop's original address and GHN IDs stay unchanged.
Only KiotViet's own province location ID is used; statistical ward codes are audit references, never KiotViet ward IDs.
The new address is retained on the shop order as `kvDeliveryAddress` for review and traceability.
