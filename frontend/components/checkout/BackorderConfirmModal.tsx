"use client";

import { Modal } from "antd";
import { formatVnd } from "@/lib/api";

export type PolicyConfirmLine = {
  ma: string;
  ten: string;
  qty: number;
  dvt?: string;
};

/**
 * Xác nhận trước khi đặt — áp dụng mọi đơn.
 * Đồng ý mới tạo đơn web và đẩy đơn đặt hàng KiotViet.
 */
export function PreOrderCodConfirmModal({
  open,
  total,
  lines = [],
  onAgree,
  onClose,
  submitting = false,
  error = "",
}: {
  open: boolean;
  total: number;
  lines?: PolicyConfirmLine[];
  onAgree: () => void;
  onClose: () => void;
  submitting?: boolean;
  error?: string;
}) {
  return (
    <Modal
      open={open}
      title="Xác nhận đặt hàng"
      onCancel={onClose}
      footer={null}
      closable={!submitting}
      maskClosable={!submitting}
      keyboard={!submitting}
      centered
    >
      <div className="space-y-4">
        {lines.length ? (
          <ul className="max-h-40 space-y-1.5 overflow-auto rounded-xl bg-slate-50 px-3 py-2.5 text-sm">
            {lines.map((line) => (
              <li key={line.ma} className="flex items-start justify-between gap-3">
                <span className="min-w-0 text-[var(--aloha-ink)]">{line.ten}</span>
                <span className="shrink-0 tabular-nums text-slate-600">
                  × {line.qty}
                  {line.dvt ? ` ${line.dvt}` : ""}
                </span>
              </li>
            ))}
          </ul>
        ) : null}

        <p className="text-sm text-slate-700">
          Tổng tiền ước tính:{" "}
          <strong className="text-[var(--aloha-price)]">{formatVnd(total)}</strong>
        </p>

        <p className="text-sm leading-relaxed text-slate-700">
          Aloha sẽ kiểm tra sản phẩm và gửi hình ảnh cho bạn xác nhận trước khi đóng gói.
          Sau khi bạn xác nhận ảnh, Aloha gửi hướng dẫn thanh toán trước toàn bộ đơn, hoặc
          đặt cọc tối thiểu bằng phí ship. Bạn có đồng ý chính sách này và tiếp tục đặt hàng không?
        </p>

        {error ? (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        ) : null}

        <div className="flex flex-col gap-2 sm:flex-row-reverse">
          <button
            type="button"
            disabled={submitting}
            onClick={onAgree}
            className="min-h-12 flex-1 rounded-xl bg-[var(--aloha-green)] px-4 font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            {submitting ? "Đang gửi…" : "Đồng ý"}
          </button>
          <button
            type="button"
            disabled={submitting}
            onClick={onClose}
            className="min-h-12 flex-1 rounded-xl border border-[var(--aloha-line)] font-bold text-slate-600 disabled:opacity-50"
          >
            Hủy
          </button>
        </div>
      </div>
    </Modal>
  );
}
