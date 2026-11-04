"use client";

import React, { useMemo, useState } from "react";
import { Modal, Button, Tag, Input } from "antd";
import {
  Landmark,
  Copy,
  Check,
  ShieldCheck,
  AlertCircle,
  Phone,
  User,
  CreditCard,
  QrCode,
  Download,
  ExternalLink,
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
    bankRef?: string;
    note?: string;
  }) => void;
  onClose: () => void;
  loading?: boolean;
};

/**
 * Bản đồ nhận diện ngân hàng phổ biến tại Việt Nam -> BIN Napas chuẩn 6 chữ số.
 * Giúp img.vietqr.io luôn sinh đúng mã chuẩn NAPAS 247.
 */
function resolveBankBinOrCode(bankBin?: string, bankName?: string): string {
  if (bankBin && /^\d{6}$/.test(String(bankBin).trim())) {
    return String(bankBin).trim();
  }
  const raw = String(bankName || bankBin || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();

  const map: Record<string, string> = {
    vietcombank: "970436",
    vcb: "970436",
    techcombank: "970407",
    tcb: "970407",
    mbbank: "970422",
    mb: "970422",
    vietinbank: "970415",
    icb: "970415",
    bidv: "970418",
    agribank: "970405",
    vba: "970405",
    vpbank: "970432",
    vpb: "970432",
    tpbank: "970423",
    tpb: "970423",
    acb: "970416",
    sacombank: "970403",
    stb: "970403",
    hdbank: "970437",
    hdb: "970437",
    vib: "970441",
    shb: "970443",
    eximbank: "970431",
    eib: "970431",
    msb: "970426",
    ocb: "970448",
    timo: "963388",
    cake: "546034",
    seabank: "970440",
    lpbank: "970449",
    pvcombank: "970412",
    bacabank: "970409",
    abbank: "970425",
    ncb: "970419",
    baovietbank: "970438",
    saigonbank: "970400",
    coopbank: "970446",
    kienlongbank: "970452",
    namabank: "970428",
    pgbank: "970430",
    vietabank: "970427",
    gpbank: "970408",
    oceanbank: "970414",
    wooribank: "970457",
    shinhanbank: "970424",
    bvbank: "970454",
  };

  for (const [key, code] of Object.entries(map)) {
    if (raw.includes(key)) return code;
  }
  return raw.replace(/[^a-z0-9]/g, "") || "vietcombank";
}

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
  const [copiedContent, setCopiedContent] = useState(false);
  const [bankRef, setBankRef] = useState("");
  const [showQrZoom, setShowQrZoom] = useState(false);

  // Reset form khi mở dòng khác
  React.useEffect(() => {
    if (open) {
      setBankRef("");
      setShowQrZoom(false);
    }
  }, [open, line?.ctvCode]);

  const ctvCode = String(line?.ctvCode || "").trim();
  const ctvName = String(line?.ctvName || "").trim();
  const phone = String(line?.phone || "").trim();
  const netAmount = Number(line?.net || 0);
  const debtOffset = Number(line?.debtOffset || 0);
  const grossAmount =
    line?.gross != null
      ? Number(line.gross)
      : line?.commission != null
      ? Number(line.commission)
      : netAmount + debtOffset;

  const bank = line?.payoutBank;
  const hasBank = Boolean(bank && (bank.accountNumber || bank.bankName));

  // Cú pháp nội dung chuyển khoản chuẩn doanh nghiệp: ALOHA HH [MA_CTV] [PERIOD]
  const cleanCode = ctvCode.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  const cleanPeriod = String(period || "").replace(/[^0-9]/g, "");
  const transferContent = `ALOHA HH ${cleanCode} ${cleanPeriod}`.slice(0, 25);

  // Sinh link ảnh VietQR chuẩn Napas 247
  const vietQrUrl = useMemo(() => {
    if (!hasBank || netAmount <= 0) return null;
    const binOrCode = resolveBankBinOrCode(bank?.bankBin, bank?.bankName);
    const accNum = String(bank?.accountNumber || "").trim();
    const accName = encodeURIComponent(
      String(bank?.accountName || ctvName || "").trim()
    );
    const addInfo = encodeURIComponent(transferContent);
    return `https://img.vietqr.io/image/${binOrCode}-${accNum}-compact2.png?amount=${netAmount}&addInfo=${addInfo}&accountName=${accName}`;
  }, [hasBank, netAmount, bank, ctvName, transferContent]);

  if (!line) return null;

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
    toast.success("Đã sao chép số tiền!");
    setTimeout(() => setCopiedAmount(false), 2000);
  };

  const handleCopyContent = () => {
    navigator.clipboard.writeText(transferContent);
    setCopiedContent(true);
    toast.success("Đã sao chép nội dung chuyển khoản!");
    setTimeout(() => setCopiedContent(false), 2000);
  };

  const handleDownloadQr = () => {
    if (!vietQrUrl) return;
    const a = document.createElement("a");
    a.href = vietQrUrl;
    a.target = "_blank";
    a.download = `VietQR_${cleanCode}_${cleanPeriod}.png`;
    a.click();
  };

  const handleConfirm = () => {
    onConfirm({
      ctvCode,
      expectedRevision: Number(billRevision || 0),
      expectedAmount: netAmount,
      bankRef: bankRef.trim() || undefined,
    });
  };

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      centered
      width={620}
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
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center shrink-0 border border-white/20">
              <Landmark className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
              <h3 className="text-base font-bold text-white tracking-tight m-0">
                Xác nhận & Chuyển tiền hoa hồng
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
          <Tag
            color="success"
            className="!m-0 text-[11px] font-semibold bg-emerald-800/80 border-emerald-400/40 text-emerald-100"
          >
            Đã chốt sổ
          </Tag>
        </div>
      </div>

      <div className="p-6 space-y-4 max-h-[82vh] overflow-y-auto">
        {/* 2. KHỐI QUÉT MÃ VIETQR ĐỘNG (CHUẨN CÁC DOANH NGHIỆP LỚN) */}
        {hasBank && netAmount > 0 && vietQrUrl ? (
          <div className="bg-gradient-to-br from-emerald-50/60 to-slate-50 border border-emerald-200/80 rounded-2xl p-4 shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-emerald-600 text-white flex items-center justify-center shadow-xs">
                  <QrCode className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                    Mã VietQR Chuyển Khoản Nhanh
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Napas 247 · Quét bằng mọi App Ngân hàng
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  size="small"
                  type="text"
                  onClick={handleDownloadQr}
                  className="!text-xs !text-slate-600 hover:!text-emerald-700 !flex items-center gap-1"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Tải ảnh QR</span>
                </Button>
                <Button
                  size="small"
                  type="text"
                  onClick={() => setShowQrZoom(!showQrZoom)}
                  className="!text-xs !text-slate-600 hover:!text-emerald-700"
                >
                  {showQrZoom ? "Thu nhỏ" : "Phóng to"}
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-center">
              {/* Ảnh VietQR */}
              <div className="sm:col-span-5 flex flex-col items-center justify-center bg-white p-2.5 rounded-xl border border-slate-200/80 shadow-xs">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={vietQrUrl}
                  alt={`VietQR ${cleanCode}`}
                  className={`w-full max-w-[210px] object-contain rounded-lg transition-all duration-200 ${
                    showQrZoom ? "max-w-[320px] scale-105" : ""
                  }`}
                  loading="eager"
                />
                <div className="mt-1.5 text-[10px] text-slate-400 font-medium">
                  Tự động điền STK & Số tiền
                </div>
              </div>

              {/* Thông tin đối chiếu tài khoản */}
              <div className="sm:col-span-7 space-y-2 text-xs">
                {/* Ngân hàng */}
                <div className="bg-white p-2.5 rounded-xl border border-slate-200/80 space-y-1.5">
                  <div className="flex items-center justify-between text-slate-500 text-[11px]">
                    <span className="flex items-center gap-1">
                      <CreditCard className="w-3.5 h-3.5 text-emerald-600" />
                      Ngân hàng thụ hưởng:
                    </span>
                    <strong className="text-slate-800">
                      {bank.bankName || "Ngân hàng"}
                    </strong>
                  </div>

                  {/* STK */}
                  <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                    <span className="text-slate-500">Số tài khoản:</span>
                    <div className="flex items-center gap-1.5 font-bold text-slate-900 font-mono text-[13px]">
                      <span>{bank.accountNumber}</span>
                      <button
                        type="button"
                        onClick={handleCopyStk}
                        title="Sao chép STK"
                        className="text-slate-400 hover:text-emerald-700 p-0.5"
                      >
                        {copiedStk ? (
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Tên chủ TK */}
                  <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                    <span className="text-slate-500">Chủ tài khoản:</span>
                    <span className="font-semibold text-slate-800 uppercase">
                      {bank.accountName || ctvName}
                    </span>
                  </div>

                  {/* Nội dung chuyển khoản chuẩn */}
                  <div className="flex items-center justify-between pt-1 border-t border-slate-100 bg-emerald-50/50 -mx-2.5 -mb-2.5 p-2 rounded-b-xl border-emerald-100">
                    <div>
                      <span className="text-emerald-800 font-medium text-[11px] block">
                        Nội dung chuyển khoản:
                      </span>
                      <span className="font-mono font-bold text-emerald-950 text-xs">
                        {transferContent}
                      </span>
                    </div>
                    <Button
                      size="small"
                      type="text"
                      onClick={handleCopyContent}
                      className="!text-[11px] !text-emerald-700 hover:!text-emerald-900 !h-7 !px-2"
                    >
                      {copiedContent ? "Đã chép" : "Copy"}
                    </Button>
                  </div>
                </div>

                <div className="text-[11px] text-slate-500 bg-white/60 p-2 rounded-lg border border-slate-200/60 leading-relaxed">
                  📱 Mở App ngân hàng quét mã QR trên để chuyển đúng <strong>{formatVnd(netAmount)}</strong> với lời nhắn chuẩn.
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Trường hợp CTV chưa cập nhật ngân hàng */
          <div className="bg-amber-50/80 border border-amber-200 rounded-xl p-4 text-xs text-amber-900 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <div className="font-bold text-sm text-amber-950">
                CTV chưa cập nhật tài khoản ngân hàng
              </div>
              <div className="mt-1 leading-relaxed text-amber-800">
                Cộng tác viên <strong>{ctvName || ctvCode}</strong> chưa liên
                kết số tài khoản trên hệ thống. Kế toán/Giám đốc vui lòng liên hệ
                CTV qua SĐT/Zalo <strong>{phone || "—"}</strong> hoặc chi bằng
                tiền mặt.
              </div>
            </div>
          </div>
        )}

        {/* 3. BẢNG KÊ QUYẾT TOÁN SỐ TIỀN PHÂN RÃ (BREAKDOWN FINTECH) */}
        <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-xs">
          <div className="bg-slate-100/70 px-4 py-2 border-b border-slate-200 flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-slate-600">
            <span>Bảng kê quyết toán</span>
            <span>Kỳ {period}</span>
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
                  <span className="font-medium">2. Cấn trừ nợ hoàn hàng</span>
                  <span className="font-semibold">
                    −{formatVnd(debtOffset)}
                  </span>
                </div>
                {Array.isArray(line.adjustmentEntries) && line.adjustmentEntries.length > 0 ? (
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
                  Số tiền cần chuyển khoản cho CTV
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

        {/* 4. Ô NHẬP MÃ GIAO DỊCH NGÂN HÀNG (ĐỐI SOÁT & AUDIT TRAIL) */}
        <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3.5 space-y-2">
          <label className="text-xs font-semibold text-slate-700 flex items-center justify-between">
            <span>Mã tham chiếu ngân hàng / Mã FT (Tùy chọn):</span>
            <span className="text-[11px] font-normal text-slate-500">
              Lưu vết đối soát
            </span>
          </label>
          <Input
            placeholder="Ví dụ: FT261189345 hoặc mã giao dịch trên biên lai ngân hàng..."
            value={bankRef}
            onChange={(e) => setBankRef(e.target.value)}
            maxLength={60}
            className="!text-xs font-mono"
            allowClear
          />
          <div className="text-[11px] text-slate-500 leading-normal">
            Gợi ý: Dán mã giao dịch thành công từ App ngân hàng vào đây để kế
            toán và giám đốc dễ dàng tra cứu khi CTV cần khiếu nại.
          </div>
        </div>

        {/* 5. Footer CTA buttons */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
          <Button onClick={onClose} disabled={loading} size="middle">
            Để sau
          </Button>
          <Button
            type="primary"
            onClick={handleConfirm}
            loading={loading}
            size="middle"
            className="!bg-[#2D5A27] hover:!bg-[#23471f] font-semibold !px-6"
          >
            {netAmount > 0
              ? `Xác nhận đã chuyển ${formatVnd(netAmount)}`
              : "Xác nhận bù trừ nợ 0 đ"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
