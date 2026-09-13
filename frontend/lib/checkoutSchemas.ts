import { z } from "zod";

export const checkoutAgreeSchema = z.object({
  agree: z.boolean().refine((v) => v === true, {
    message: "Vui lòng đồng ý Điều kiện giao dịch chung",
  }),
  customerNote: z.string().trim().max(255).optional(),
});

export const checkoutReceiverSchema = z.object({
  customerName: z.string().trim().min(1, "Nhập tên người nhận"),
  customerPhone: z
    .string()
    .trim()
    .min(8, "Số điện thoại không hợp lệ")
    .max(20, "Số điện thoại không hợp lệ"),
});

export const checkoutShipAddressSchema = checkoutReceiverSchema.extend({
  province: z.string().trim().min(1, "Chọn tỉnh/thành"),
  ward: z.string().trim().min(1, "Chọn phường/xã"),
  shippingAddress: z.string().trim().min(1, "Nhập địa chỉ nhận hàng"),
  district: z.string().trim().optional(),
});
