"use client";
import { Modal } from "antd";
import { useEffect, useState } from "react";
import { BackorderNotice } from "../BackorderNotice";
import { formatVnd } from "@/lib/api";

export function PreOrderCodConfirmModal({ open, total, lines = [], onAgree, onClose, submitting = false }: {
  open: boolean; total: number; productNames?: string[];
  lines?: Array<{ ma: string; ten: string; ton?: number; qty: number; dvt?: string }>;
  onAgree: () => void; onClose: () => void; submitting?: boolean;
}) {
  const [accepted, setAccepted] = useState(false);
  useEffect(() => { if (open) setAccepted(false); }, [open]);
  const pending = lines.filter(l => l.ton != null && l.qty > l.ton);
  const first = pending[0];
  return <Modal open={open} title="Xác nhận yêu cầu đặt trước" onCancel={onClose}
    footer={null} closable={!submitting} maskClosable={!submitting} keyboard={!submitting} centered>
    <div className="space-y-4">
      {first && <BackorderNotice available={first.ton!} requested={first.qty} unit={first.dvt} />}
      {pending.map(l => <div key={l.ma} className="flex justify-between gap-3 border-b border-slate-100 pb-2 text-sm">
        <span>{l.ten}</span><span className="shrink-0">Đặt {l.qty} · Cần bổ sung {l.qty - Math.max(0, l.ton!)}</span>
      </div>)}
      <p>Tiền hàng dự kiến: <strong>{formatVnd(total)}</strong></p>
      <label className="flex items-start gap-3 rounded-xl bg-slate-50 p-3 text-sm">
        <input type="checkbox" checked={accepted} onChange={e => setAccepted(e.target.checked)} className="mt-1 h-4 w-4 accent-[var(--aloha-green)]" />
        Tôi đồng ý chờ Aloha kiểm tra và liên hệ xác nhận trước khi thanh toán hoặc đặt cọc.
      </label>
      <button disabled={!accepted || submitting} onClick={onAgree} className="min-h-12 w-full rounded-xl bg-[var(--aloha-green)] px-4 font-bold text-white disabled:cursor-not-allowed disabled:opacity-40">
        {submitting ? "Đang gửi…" : "Gửi đơn đặt trước"}
      </button>
      <button disabled={submitting} onClick={onClose} className="min-h-11 w-full font-semibold text-slate-600">Quay lại</button>
    </div>
  </Modal>;
}
