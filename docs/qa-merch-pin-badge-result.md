# QA result — merch pin / badge / moi-by-date

Date: 2026-09-19

## Automated

| Suite | Passed | Failed |
|-------|--------|--------|
| `qa-merch-pin-badge-unit.cjs` | 4 (C,B,F,N) | 0 |
| `qa-merch-pin-badge-db.cjs` | 4 (A,B-db,E,P) | 0 |
| API S5 `sort=ban_chay&maxTon=8` | Pass — slot4=CBHPMM pin4; slot1=TPXRMN pin1 | 0 |
| API N `sort=moi` | Pass — không có BKHDV; top≈TPDL | 0 |

## Notes
- Không thêm field Mongo mới.
- Fixture `__QA_PIN_*` đã xóa sau DB test.
- UI checklist: xác nhận tay trên admin (Chưa gắn, disable ghim, toast).
