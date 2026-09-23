"use client";

import { Check } from "lucide-react";
import type { ShopOrder } from "@/lib/orders";

type Step = {
  id: string;
  label: string;
  done: boolean;
  active: boolean;
};

/** Dòng đời đơn/HĐ — bám trạng thái KiotViet. */
function buildSteps(o: ShopOrder): Step[] {
  if (o.orderStatus === "cho_xac_nhan") return [
    { id: "request", label: "Đã gửi yêu cầu", done: true, active: false },
    { id: "review", label: "Chờ Aloha gửi ảnh", done: false, active: true },
    { id: "payment", label: "Thanh toán / cọc", done: false, active: false },
    { id: "delivery", label: "Sắp xếp giao hàng", done: false, active: false },
  ];
  const ps = o.paymentStatus || "";
  const os = String(o.orderStatus || o.status || "").toLowerCase();
  const isCod = ps === "cod" || o.method === "Cash" || Boolean(o.usingCod);
  const reported =
    Boolean(o.customerReportedPaidAt) || o.statusValue === "Chờ shop xác nhận CK";

  const paid = ps === "paid" || ps === "cod";
  const cancelled =
    ps === "cancelled" ||
    ps === "expired" ||
    ps === "failed" ||
    os === "huy";

  const shipping = os === "dang_giao";
  const completed = os === "hoan_thanh" || os === "hoan_tat" || os === "xong";
  const waitingPack =
    os === "cho_xu_ly" ||
    os === "thieu_hang" ||
    os === "cho" ||
    os === "cho_thanh_toan" ||
    !os;

  if (cancelled || ps === "underpaid") {
    return [
      { id: "placed", label: "Đặt hàng", done: true, active: false },
      {
        id: "pay",
        label:
          ps === "expired"
            ? "Hết hạn CK"
            : ps === "underpaid"
              ? "Lệch tiền"
              : ps === "failed"
                ? "Lỗi thanh toán"
                : "Đã hủy",
        done: false,
        active: true,
      },
      { id: "process", label: "Chờ xử lý", done: false, active: false },
      { id: "ship", label: "Đang giao", done: false, active: false },
      { id: "done", label: "Hoàn thành", done: false, active: false },
    ];
  }

  const payDone = paid || reported;
  const payActive = (!paid && (ps === "unpaid" || ps === "processing")) || (reported && !paid);

  const processDone = shipping || completed;
  const processActive = paid && !processDone && waitingPack;

  const shipDone = completed;
  const shipActive = shipping && !completed;

  return [
    { id: "placed", label: "Đặt hàng", done: true, active: false },
    {
      id: "pay",
      label: isCod
        ? "COD"
        : paid
          ? "Đã thanh toán"
          : reported
            ? "Chờ xác nhận"
            : "Thanh toán",
      done: payDone,
      active: payActive,
    },
    {
      id: "process",
      label: os === "thieu_hang" ? "Thiếu hàng" : "Chờ xử lý",
      done: processDone,
      active: processActive,
    },
    {
      id: "ship",
      label: "Đang giao hàng",
      done: shipDone,
      active: shipActive,
    },
    {
      id: "done",
      label: "Hoàn thành",
      done: completed,
      active: false,
    },
  ];
}

/** Timeline dòng đời đơn — giống KiotViet. */
export function OrderStatusTimeline({ order }: { order: ShopOrder }) {
  const steps = buildSteps(order);
  const activeIdx = steps.findIndex((s) => s.active);
  let lastDoneIdx = -1;
  steps.forEach((s, idx) => {
    if (s.done) lastDoneIdx = idx;
  });

  return (
    <div>
      <ol className="flex w-full items-start justify-between gap-0.5">
        {steps.map((step, i) => {
          const last = i === steps.length - 1;
          const lineDone = i < lastDoneIdx || (activeIdx > 0 && i < activeIdx);
          return (
            <li key={step.id} className="relative flex flex-1 flex-col items-center text-center">
              {!last ? (
                <span
                  className={`absolute left-[50%] top-[15px] h-0.5 w-full ${
                    lineDone || step.done ? "bg-[var(--aloha-green)]" : "bg-[var(--aloha-line)]"
                  }`}
                  aria-hidden
                />
              ) : null}
              <span
                className={`relative z-[1] flex h-[30px] w-[30px] items-center justify-center rounded-full text-[11px] font-bold ${
                  step.done
                    ? "bg-[var(--aloha-green)] text-white"
                    : step.active
                      ? "bg-[#dfb451] text-[#06231C] ring-4 ring-[#dfb451]/30"
                      : "bg-[#E8E2D6] text-slate-500"
                }`}
              >
                {step.done ? <Check size={14} strokeWidth={3} /> : i + 1}
              </span>
              <span
                className={`mt-2 max-w-[4.8rem] text-[10px] font-bold leading-tight sm:max-w-[5.5rem] sm:text-[11px] ${
                  step.done || step.active ? "text-[var(--aloha-ink)]" : "text-slate-400"
                }`}
              >
                {step.label}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
