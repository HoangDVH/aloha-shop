# QA — Ghim theo nhãn + Mới theo ngày (không field DB mới)

## Nguyên tắc
- Pass/Fail từng ID; Fail → sửa → chạy lại.
- Chỉ đụng `webPin` / `webBadge` / (fixture QA).

## Case

| ID | Steps | Expected |
|----|-------|----------|
| A | Hai SP cùng `ban_chay_sap_het`; A pin=1; gán B pin=1 | A.webPin=0; B.webPin=1 |
| B | SP nhãn `moi` pin=1 + SP bán chạy pin=1 | Cả hai giữ; list bán chạy chỉ slot của nhãn bán chạy |
| C | Pin 1 và 4 cùng nhãn + filler | Thứ tự 1, filler, filler, 4 |
| E | Xóa nhãn | webBadge=""; webPin=0 |
| F | sort không scope / scope rỗng | Không xếp theo pin cross-badge |
| N | sort=moi | Theo createdAt desc |
| P | Áp mặc định | Không set webBadge=moi |
| S5 | TPXRMN pin1 + CBHPMM pin4 | Slot tuyệt đối trong scope bán chạy |

## Chạy tự động
```bash
node scripts/qa-merch-pin-badge-unit.cjs
node scripts/qa-merch-pin-badge-db.cjs
```

## UI checklist (tay)
- [ ] «Chưa gắn» thay «Tự động»
- [ ] Ghim disabled khi chưa nhãn
- [ ] Toast nhả ghim khi trùng số
- [ ] Lọc 1 nhãn → list theo pin
- [ ] Trang chủ mục mới không cần badge moi
