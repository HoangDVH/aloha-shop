# CTV / Hoa hồng — từ điển thuộc tính API

Tài liệu đi kèm OpenAPI [`openapi-ctv.yaml`](./openapi-ctv.yaml) và Swagger UI `/api/shop/docs` (manager).

## Enum nghiệp vụ

### `CtvStatus`

| Giá trị | Ý nghĩa | Dùng để |
|---------|---------|---------|
| `cho_duyet` | CTV vừa đăng ký, chưa được phép affiliate | Filter list; chặn portal HH |
| `active` | Đã duyệt | Tạo HH khi giao; portal `/ctv/me` |
| `khoa` | Khóa / ban | Không tạo HH mới; vẫn xem lịch sử |

### `CommissionStatus`

| Giá trị | Ý nghĩa | Dùng để |
|---------|---------|---------|
| `held` | Đang giữ sau giao (trong cửa sổ đổi trả) | Tab chờ; chưa vào kỳ |
| `eligible` | Hết hold, đủ điều kiện chi | Đưa vào bill khi chốt kỳ |
| `billed` | Đã vào kỳ `locked` | Excel / chờ mark-paid |
| `paid_out` | Đã chi | Lịch sử thanh toán |
| `cancelled` | Hủy (hoàn/hủy đơn trước chi) | Tab hủy |
| `flagged` | Nghi ngờ gian | Fraud + không auto-eligible |

### KV `invoiceDelivery.status` (ảnh hưởng HH gián tiếp)

| Status | Ý nghĩa | Shop | HH |
|--------|---------|------|-----|
| 2 | Đang giao | `dang_giao` | Chưa |
| 3 | Giao OK | `hoan_thanh` | Tạo `held` |
| 5,6 | Hoàn / hủy vận đơn | `huy` | void / clawback |
| 1,4,7–12 | Chờ / đang hoàn… | không đổi | chờ 5/6 |

## Account / payoutBank

| Thuộc tính | Kiểu | Ý nghĩa | Dùng để |
|------------|------|---------|---------|
| `ctvCode` | string | Mã CTV chuẩn hóa | Join HH, click, bill, Excel |
| `ctvStatus` | enum | Trạng thái CTV | Duyệt / khóa / filter |
| `commissionRate` | number\|null | % HH riêng CTV | Override rate mặc định shop |
| `ctvBalanceDebt` | number | Nợ clawback | Cảnh báo trước chi; cột Excel |
| `payoutBank.bankBin` | string | Mã BIN ngân hàng | Định danh NH khi chuyển khoản |
| `payoutBank.bankName` | string | Tên NH | Hiển thị / Excel |
| `payoutBank.accountNumber` | string | Số TK | Chi tiền; mask trên list admin |
| `payoutBank.accountName` | string | Chủ TK | Khớp tên khi chuyển |
| `payoutBank.updatedAt` | ISO string | Lúc CTV cập nhật STK | Audit nhẹ |

## Commission line

| Thuộc tính | Kiểu | Ý nghĩa | Dùng để |
|------------|------|---------|---------|
| `orderCode` | string | Mã đơn shop | Join đơn / UI |
| `ma` | string | Mã SP | Dòng HH theo SKU |
| `ctvCode` | string | CTV hưởng | Group bill |
| `lineTotal` | number | GMV dòng | KPI doanh thu CTV |
| `rate` / `rateSource` | number / enum | % và nguồn (ctv_sp\|sp\|shop\|zero) | Giải thích số HH |
| `amount` | number | Tiền HH | Bill / Excel net |
| `status` | CommissionStatus | Vòng đời | Filter tab |
| `fraudFlags` | string[] | Cờ gian | Tag / fraud |
| `deliveredAt` / `eligibleAt` | ISO | Mốc giao / hết hold | Clear held |
| `billingPeriod` / `billId` | string | Kỳ đối soát | Panel kỳ tháng |

## Bill

| Thuộc tính | Kiểu | Ý nghĩa | Dùng để |
|------------|------|---------|---------|
| `period` | `YYYY-MM` | Kỳ AMS | Khóa / export |
| `status` | `locked`\|`paid` | Trạng thái kỳ | Nút UI |
| `ctvLines[]` | object | Net theo CTV | Excel ChiHH |
| `totals.*` | number | Tổng HH / đơn / CTV | KPI kỳ |
| `lockedBy` / `paidBy` | string | Ai thao tác | Audit |
| `exportedAt` / `exportedBy` | string | Lần xuất Excel | Truy vết |

## Overview response

| Thuộc tính | Ý nghĩa | Dùng để |
|------------|---------|---------|
| `ctvTotal` / `ctvActive` | Tổng / đang hoạt động | KPI card |
| `clicksInPeriod` | Click trong kỳ | Funnel |
| `ordersInPeriod` / `gmvInPeriod` | Đơn / GMV CTV | KPI |
| `payableAmount` | HH held+eligible+billed | Phải trả |
| `topCtv[]` | Top theo GMV | Bảng ranking (không tier giả) |
