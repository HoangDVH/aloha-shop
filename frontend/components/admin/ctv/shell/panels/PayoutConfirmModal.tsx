"use client";

import React, { useState } from "react";
import { Modal, Button, Tag } from "antd";
import {
  Landmark,
  Copy,
  Check,
  ShieldCheck,
  AlertCircle,
  Phone,
  User,
  CreditCard,
} from "lucide-react";
import { formatPeriodLabel, formatVnd } from "../../shared/format";
import { toast } from "@/components/admin/toast";

export type PayoutConfirmModalProps = {
  open: boolean;
  line: any | null;
  period: string;
  billRevision: number;
  onConfirm: (payload: {
    ctvCode: string;
    expectedRevision: number;
    expectedAmount: number;
  }) => void;
  onClose: () => void;
  loading?: boolean;
};

export function PayoutConfirmModal({
  open,
  line,
  period,
  billRevision,
  onConfirm,
  onClose,
  loading = false,
}: PayoutConfirmModalProps) {
  const [copiedStk, setCopiedStk] = useState(false);
  const [copiedAmount, setCopiedAmount] = useState(false);

  if (!line) return null;

  const ctvCode = String(line.ctvCode || "").trim();
  const ctvName = String(line.ctvName || "").trim();
  const phone = String(line.phone || "").trim();
  const netAmount = Number(line.net || 0);
  const debtOffset = Number(line.debtOffset || 0);
  const grossAmount =
    line.gross != null
      ? Number(line.gross)
      : line.commission != null
      ? Number(line.commission)
      : netAmount + debtOffset;

  const bank = line.payoutBank;
  const hasBank = Boolean(bank && (bank.accountNumber || bank.bankName));

  const handleCopyStk = () => {
    if (!bank?.accountNumber) return;
    navigator.clipboard.writeText(bank.accountNumber);
    setCopiedStk(true);
    toast.success("Đã sao chép số tài khoản!");
    setTimeout(() => setCopiedStk(false), 2000);
  };

  const handleCopyAmount = () => {
    navigator.clipboard.writeText(String(netAmount));
    setCopiedAmount(true);
    toast.success("Đã sao chép số tiền thực chi!");
    setTimeout(() => setCopiedAmount(false), 2000);
  };

  const handleConfirm = () => {
    onConfirm({
      ctvCode,
      expectedRevision: Number(billRevision || 0),
      expectedAmount: netAmount,
    });
  };

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      centered
      width={520}
      destroyOnHidden
      className="payout-confirm-modal"
      styles={{
        content: {
          padding: 0,
          borderRadius: "16px",
          overflow: "hidden",
        },
      }}
    >
      {/* 1. Header */}
      <div className="bg-gradient-to-r from-[#2D5A27] to-[#1e3e1a] text-white px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center shrink-0 border border-white/20">
            <Landmark className="w-5 h-5 text-white" />
          </div>
          <div className="min-w-0">
            <h3 className="text-base font-bold text-white tracking-tight m-0">
              Xác nhận chi trả hoa hồng
            </h3>
            <p className="text-[12px] text-emerald-100/90 m-0 mt-0.5">
              Kỳ đối soát:{" "}
              <strong className="text-white">
                {formatPeriodLabel(period)}
              </strong>{" "}
              ({period})
            </p>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-4">
        {/* 2. Thẻ thông tin người thụ hưởng & Tài khoản ngân hàng */}
        <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3.5 space-y-2.5">
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
            <span className="flex items-center gap-1.5 uppercase tracking-wider text-[11px]">
              <User className="w-3.5 h-3.5 text-slate-400" />
              Người nhận thanh toán
            </span>
            <Tag color="green" className="!m-0 text-[11px] font-semibold">
              CTV Aloha
            </Tag>
          </div>

          <div className="flex items-baseline justify-between gap-2">
            <div className="font-bold text-base text-[#1a2e1a]">
              {ctvName || ctvCode}
              {ctvName && ctvName !== ctvCode ? (
                <span className="ml-1.5 text-xs font-medium text-slate-500">
                  ({ctvCode})
                </span>
              ) : null}
            </div>
            {phone ? (
              <div className="flex items-center gap-1 text-xs text-slate-600 bg-white px-2 py-0.5 rounded border border-slate-200">
                <Phone className="w-3 h-3 text-slate-400" />
                <span>{phone}</span>
              </div>
            ) : null}
          </div>

          {/* Chi tiết tài khoản ngân hàng */}
          <div className="pt-2 border-t border-slate-200/70">
            {hasBank ? (
              <div className="bg-white rounded-lg p-2.5 border border-slate-200 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-[11px] font-semibold text-emerald-700 flex items-center gap-1">
                    <CreditCard className="w-3 h-3" />
                    {bank.bankName || "Ngân hàng"}
                  </div>
                  <div className="text-sm font-bold text-slate-800 tracking-wide mt-0.5">
                    {bank.accountNumber}
                  </div>
                  {bank.accountName ? (
                    <div className="text-[11px] text-slate-500 uppercase">
                      {bank.accountName}
                    </div>
                  ) : null}
                </div>
                <Button
                  size="small"
                  type="text"
                  onClick={handleCopyStk}
                  className="!flex items-center gap-1 text-xs text-slate-600 hover:text-emerald-700"
                >
                  {copiedStk ? (
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                  <span>{copiedStk ? "Đã chép" : "Copy STK"}</span>
                </Button>
              </div>
            ) : (
              <div className="bg-amber-50/70 border border-amber-200/80 rounded-lg p-2.5 text-xs text-amber-800 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold">Chưa có STK ngân hàng</div>
                  <div className="text-[11px] text-amber-700 mt-0.5">
                    CTV chưa cập nhật thông tin tài khoản trên hệ thống. Vui lòng
                    chuyển khoản theo thỏa thuận hoặc chi tiền mặt.
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 3. Bảng kê quyết toán số tiền (Breakdown Card chuẩn Fintech) */}
        <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-xs">
          <div className="bg-slate-100/70 px-4 py-2 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-600">
            Bảng kê quyết toán kỳ này
          </div>
          <div className="p-4 space-y-2.5 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-slate-600">1. Tổng hoa hồng được duyệt</span>
              <span className="font-semibold text-slate-800">
                +{formatVnd(grossAmount)}
              </span>
            </div>

            {debtOffset > 0 ? (
              <div className="space-y-1">
                <div className="flex items-center justify-between text-rose-600">
                  <span className="font-medium flex items-center gap-1">
                    2. Cấn trừ nợ hoàn hàng
                  </span>
                  <span className="font-semibold">
                    −{formatVnd(debtOffset)}
                  </span>
                </div>
                {line.adjustmentEntries && line.adjustmentEntries.length > 0 ? (
                  <div className="text-[11px] text-rose-500 pl-4 border-l-2 border-rose-200">
                    {line.adjustmentEntries.map((e: any, idx: number) => (
                      <div key={idx}>
                        {e.orderCode}: {e.reason || "Thu hồi nợ cấn trừ"}
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="flex items-center justify-between text-slate-400 text-xs">
                <span>2. Cấn trừ nợ hoàn hàng</span>
                <span>0 đ</span>
              </div>
            )}

            <div className="border-t border-dashed border-slate-200 pt-2.5 mt-2 flex items-baseline justify-between">
              <div>
                <div className="font-bold text-slate-900 text-sm">
                  3. Số tiền thực chi (Net)
                </div>
                <div className="text-[11px] text-slate-500">
                  Số tiền thực tế chuyển cho CTV
                </div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-black text-[#2D5A27] tracking-tight flex items-center justify-end gap-1.5">
                  <span>{formatVnd(netAmount)}</span>
                  {netAmount > 0 ? (
                    <button
                      type="button"
                      onClick={handleCopyAmount}
                      title="Sao chép số tiền"
                      className="text-slate-400 hover:text-emerald-700 transition-colors p-1"
                    >
                      {copiedAmount ? (
                        <Check className="w-4 h-4 text-emerald-600" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 4. Ghi chú an toàn & Pháp lý (Guardrail) */}
        <div className="bg-emerald-50/60 border border-emerald-100 rounded-lg p-2.5 text-xs text-emerald-900 flex items-start gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
          <div className="leading-relaxed">
            Hành động này sẽ cập nhật các đơn hàng sang trạng thái{" "}
            <strong>Đã chi trả</strong>
            {debtOffset > 0 ? (
              <>
                {" "}
                và cấn trừ dứt điểm khoản nợ{" "}
                <strong>{formatVnd(debtOffset)}</strong> trong sổ cái
              </>
            ) : null}
            .
          </div>
        </div>

        {/* 5. Footer CTA buttons */}
        <div className="flex items-center justify-end gap-2 pt-2">
          <Button onClick={onClose} disabled={loading} size="middle">
            Để sau
          </Button>
          <Button
            type="primary"
            onClick={handleConfirm}
            loading={loading}
            size="middle"
            className="!bg-[#2D5A27] hover:!bg-[#23471f] font-semibold !px-5"
          >
            {netAmount > 0
              ? `Xác nhận chi ${formatVnd(netAmount)}`
              : "Xác nhận bù trừ nợ"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
