"use client";

import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Modal, Button, Alert, Spin } from "antd";
import { toast } from "sonner";
import {
  QrCode,
  RefreshCw,
  Send,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Smartphone,
  ShieldCheck,
  MessageSquare,
} from "lucide-react";

export type ZaloNotifyStatus = {
  targetPhone: string;
  connected: boolean;
  ownUid?: string;
  targetGroupId?: string;
  targetGroupName?: string;
  status: string;
  hasQr: boolean;
  qrImage?: string;
  savedAt?: string | null;
  daysActive?: number;
  daysRemaining?: number;
  isExpiringSoon?: boolean;
};

export function AdminZaloStatusButton({ mobile = false }: { mobile?: boolean }) {
  const qc = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const [activeStepText, setActiveStepText] = useState("");

  const { data: status, refetch } = useQuery<ZaloNotifyStatus>({
    queryKey: ["admin", "zalo-notify", "status"],
    queryFn: async () => {
      const res = await fetch("/api/shop/zalo-notify/status", { cache: "no-store" });
      if (!res.ok) throw new Error("Không thể tải trạng thái Zalo");
      return res.json();
    },
    refetchInterval: modalOpen && qrDataUrl ? 1500 : 30000,
  });

  // Khi modal mở và đang hiển thị QR, nếu server báo đã kết nối thành công -> đóng QR
  useEffect(() => {
    if (status?.connected && qrDataUrl) {
      setQrDataUrl("");
      setActiveStepText("Đã kết nối thành công!");
      toast.success("✅ Đã kết nối Zalo bot thành công!");
    }
  }, [status?.connected, qrDataUrl]);

  const handleGenerateQr = async (force = false) => {
    setGenerating(true);
    setActiveStepText("Đang yêu cầu Zalo tạo mã QR...");
    try {
      const res = await fetch("/api/shop/zalo-notify/qr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ force }),
      });
      const data = await res.json();
      if (data.qr || data.qrImage) {
        setQrDataUrl(data.qr || data.qrImage);
        setActiveStepText("Mở Zalo quét mã QR để kết nối");
      } else {
        toast.error(data.error || "Không nhận được mã QR từ Zalo");
      }
      void refetch();
    } catch (err: any) {
      toast.error(err?.message || "Lỗi tạo mã QR");
    } finally {
      setGenerating(false);
    }
  };

  const handleTestSend = async () => {
    setSendingTest(true);
    try {
      const res = await fetch("/api/shop/zalo-notify/test-send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "ctv" }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success("✅ Đã gửi thông báo kiểm tra vào nhóm Zalo!");
      } else {
        toast.error(`⚠️ Gửi thất bại: ${data.reason || "Vui lòng kiểm tra lại session"}`);
      }
    } catch (e: any) {
      toast.error(e?.message || "Lỗi gửi thông báo test");
    } finally {
      setSendingTest(false);
    }
  };

  const isConnected = Boolean(status?.connected);
  const isExpiringSoon = Boolean(status?.isExpiringSoon);
  const daysRemaining = status?.daysRemaining ?? 0;

  // 1. Giao diện Mobile
  if (mobile) {
    return (
      <>
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className={`relative flex h-8 w-8 items-center justify-center rounded-lg border text-xs font-semibold transition ${
            !isConnected
              ? "border-rose-300 bg-rose-50 text-rose-700"
              : isExpiringSoon
              ? "border-amber-300 bg-amber-50 text-amber-700"
              : "border-slate-200 bg-slate-50 text-slate-700"
          }`}
          title={
            !isConnected
              ? "Zalo mất kết nối"
              : isExpiringSoon
              ? `Zalo sắp hết hạn (còn ${daysRemaining} ngày)`
              : "Zalo đang kết nối tốt"
          }
        >
          <MessageSquare className="h-4 w-4" />
          <span
            className={`absolute top-1 right-1 h-2 w-2 rounded-full ring-2 ring-white ${
              !isConnected
                ? "bg-rose-500 animate-pulse"
                : isExpiringSoon
                ? "bg-amber-500 animate-ping"
                : "bg-emerald-500"
            }`}
          />
        </button>

        {renderModal()}
      </>
    );
  }

  // 2. Giao diện Desktop
  return (
    <>
      {!isConnected ? (
        <button
          type="button"
          onClick={() => {
            setModalOpen(true);
            void handleGenerateQr(true);
          }}
          className="flex items-center gap-1.5 rounded-full border border-rose-300 bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-700 transition hover:bg-rose-100 shadow-xs animate-pulse"
          title="Zalo thông báo mất kết nối — Bấm để quét mã QR kết nối lại"
        >
          <span className="h-2 w-2 rounded-full bg-rose-500" />
          <span>Zalo: Cần kết nối</span>
        </button>
      ) : isExpiringSoon ? (
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="flex items-center gap-1.5 rounded-full border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-800 transition hover:bg-amber-100 shadow-xs"
          title={`Zalo sắp hết hạn (còn khoảng ${daysRemaining} ngày) — Bấm để gia hạn sớm`}
        >
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-500" />
          </span>
          <span>Zalo: Còn {daysRemaining} ngày</span>
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="flex items-center gap-1.5 rounded-full border border-slate-200/90 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-800"
          title={`Zalo bot đang kết nối tốt (Số: ${status?.targetPhone || "0337095980"}) — Còn ~${daysRemaining} ngày`}
        >
          <span className="h-2 w-2 rounded-full bg-emerald-500" />
          <span>Zalo Báo Tin</span>
        </button>
      )}

      {renderModal()}
    </>
  );

  function renderModal() {
    return (
      <Modal
        open={modalOpen}
        onCancel={() => {
          setModalOpen(false);
          setQrDataUrl("");
        }}
        footer={null}
        title={
          <div className="flex items-center gap-2 text-base font-bold text-slate-800">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-600 text-white font-black text-xs">
              Z
            </span>
            <span>Kết nối Zalo Thông Báo Aloha</span>
          </div>
        }
        centered
        width={460}
      >
        <div className="space-y-4 pt-2">
          {/* Card trạng thái */}
          <div
            className={`rounded-xl border p-4 ${
              !isConnected
                ? "border-rose-200 bg-rose-50/60"
                : isExpiringSoon
                ? "border-amber-200 bg-amber-50/60"
                : "border-emerald-200 bg-emerald-50/50"
            }`}
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-slate-500">Trạng thái kết nối</p>
                <div className="mt-1 flex items-center gap-2">
                  {!isConnected ? (
                    <>
                      <XCircle className="h-5 w-5 text-rose-600" />
                      <span className="text-sm font-bold text-rose-700">Chưa kết nối / Hết hạn</span>
                    </>
                  ) : isExpiringSoon ? (
                    <>
                      <AlertTriangle className="h-5 w-5 text-amber-600" />
                      <span className="text-sm font-bold text-amber-800">
                        Sắp hết hạn (Còn ~{daysRemaining} ngày)
                      </span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                      <span className="text-sm font-bold text-emerald-800">
                        Đang kết nối bình thường
                      </span>
                    </>
                  )}
                </div>
              </div>

              {isConnected && (
                <div className="text-right text-[11px] text-slate-500">
                  <p>Ước tính còn lại</p>
                  <p className="font-bold text-slate-800 text-xs">~{daysRemaining} ngày</p>
                </div>
              )}
            </div>

            <div className="mt-3 border-t border-slate-200/60 pt-2.5 text-xs text-slate-600 space-y-1">
              <div className="flex justify-between">
                <span>Số điện thoại bot:</span>
                <span className="font-mono font-semibold text-slate-800">
                  {status?.targetPhone || "0337095980"}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Nhóm Zalo nhận tin:</span>
                <span className="font-semibold text-slate-800">
                  {status?.targetGroupName || "Aloha - Thông Báo Sỉ"}
                </span>
              </div>
              {status?.savedAt && (
                <div className="flex justify-between text-[11px] text-slate-500">
                  <span>Lần đăng nhập gần nhất:</span>
                  <span>{new Date(status.savedAt).toLocaleDateString("vi-VN")}</span>
                </div>
              )}
            </div>
          </div>

          {/* Vùng hiển thị mã QR nếu đang quét */}
          {generating ? (
            <div className="flex flex-col items-center justify-center py-8">
              <Spin size="large" />
              <p className="mt-3 text-xs text-slate-500">{activeStepText || "Đang tạo mã QR..."}</p>
            </div>
          ) : qrDataUrl ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-blue-200 bg-blue-50/30 p-5 text-center">
              <div className="rounded-xl border border-blue-200 bg-white p-2 shadow-sm">
                <img
                  src={qrDataUrl}
                  alt="Zalo QR Code"
                  className="h-52 w-52 rounded-lg object-contain"
                />
              </div>

              <div className="mt-4 flex items-center gap-1.5 text-xs font-semibold text-blue-700 animate-pulse">
                <Smartphone className="h-4 w-4" />
                <span>{activeStepText || "Mở Zalo trên điện thoại và quét mã"}</span>
              </div>

              <div className="mt-3 text-[11px] text-slate-500 space-y-0.5">
                <p>1. Mở Zalo trên điện thoại (số {status?.targetPhone || "0337095980"})</p>
                <p>2. Chọn biểu tượng Quét mã QR ở góc trên</p>
                <p>3. Bấm xác nhận đăng nhập trên điện thoại</p>
              </div>

              <Button
                size="small"
                icon={<RefreshCw className="h-3 w-3" />}
                onClick={() => void handleGenerateQr(true)}
                className="mt-3"
              >
                Tạo lại mã QR
              </Button>
            </div>
          ) : null}

          {/* Hàng nút hành động */}
          <div className="flex items-center gap-2 pt-1">
            {!qrDataUrl && (
              <Button
                type="primary"
                icon={<QrCode className="h-4 w-4" />}
                onClick={() => void handleGenerateQr(isConnected)}
                className="flex-1 !bg-emerald-600 hover:!bg-emerald-700 font-semibold"
              >
                {isConnected ? "Quét mã để gia hạn sớm" : "Quét mã QR kết nối"}
              </Button>
            )}

            {isConnected && !qrDataUrl && (
              <Button
                icon={<Send className="h-3.5 w-3.5 text-slate-600" />}
                onClick={handleTestSend}
                loading={sendingTest}
                className="font-medium"
              >
                Gửi tin kiểm tra
              </Button>
            )}
          </div>

          <div className="rounded-lg bg-slate-50 p-2.5 text-[11px] text-slate-500 flex items-start gap-2">
            <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-600 mt-0.5" />
            <span>
              Hệ thống tự động thông báo trước 48h khi phiên Zalo sắp hết hạn. Quản trị viên có thể
              chủ động quét gia hạn bất kỳ lúc nào để tránh gián đoạn.
            </span>
          </div>
        </div>
      </Modal>
    );
  }
}
