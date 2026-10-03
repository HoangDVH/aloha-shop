type ReviewDetail = {
  productCode: string;
  quantity: number;
  availableQty?: number;
  preOrder?: boolean;
};

/** Ghi chú đơn đặt hàng KV cho đơn chờ xác nhận ảnh. */
export function reviewOrderKvDescription(details: ReviewDetail[], extra: string): string {
  const over = details.filter(
    (d) =>
      d.preOrder ||
      (d.availableQty != null && d.quantity > Math.max(0, Number(d.availableQty) || 0))
  );
  const overText = over.length
    ? "Vượt tồn: " +
      over
        .map(
          (d) =>
            `${d.productCode} đặt ${d.quantity}/có ${Math.max(0, Number(d.availableQty) || 0)}`
        )
        .join("; ")
    : "";
  const policy =
    "Khách đã đồng ý kiểm hàng và xác nhận ảnh trước khi đóng gói. Sau khi khách xác nhận ảnh: thanh toán trước toàn bộ đơn hoặc đặt cọc tối thiểu bằng phí ship.";
  return [policy, overText, extra].filter(Boolean).join(" | ").slice(0, 500);
}
