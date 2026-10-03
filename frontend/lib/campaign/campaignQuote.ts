"use client";

import { useEffect, useRef, useState } from "react";
import { useToast } from "@/components/Toast";
import { useCampaignView } from "./useCampaignView";
import { currentSlotKey } from "./slotClock";
import { droppedFlashMas, flashMas } from "./flashCartDiff";

/** Dòng giỏ sau giá chiến dịch do server tính (quote / tạo đơn dùng chung 1 hàm). */
export type CampaignQuoteLineUI = {
  ma: string;
  ten: string;
  quantity: number;
  price: number;
  listPrice?: number;
  flash?: boolean;
  isGift?: boolean;
  giftFor?: string;
  note?: string;
};

export type CampaignQuoteUI = {
  lines: CampaignQuoteLineUI[];
  flashSavings: number;
  /** Giá trước KM − giá web: chỉ để hiện "Giảm giá sản phẩm", tiền hàng (`subtotal`) đã là giá web. */
  anchorSavings: number;
  notices: string[];
};

export type FlashLineView = { saleQty: number; salePrice: number; listPrice: number; lineTotal: number };

/** Phần giá sale của 1 mã trong giỏ (có thể chỉ một phần số lượng). */
export function flashLineFor(campaign: CampaignQuoteUI | null | undefined, ma: string): FlashLineView | null {
  const rows = (campaign?.lines || []).filter((l) => l.ma === ma && !l.isGift);
  const sale = rows.find((l) => l.flash);
  if (!sale) return null;
  return {
    saleQty: sale.quantity,
    salePrice: sale.price,
    listPrice: sale.listPrice ?? sale.price,
    lineTotal: rows.reduce((n, l) => n + l.price * l.quantity, 0),
  };
}

export function giftLinesOf(campaign: CampaignQuoteUI | null | undefined): CampaignQuoteLineUI[] {
  return (campaign?.lines || []).filter((l) => l.isGift);
}

/**
 * Khoá đổi khi chiến dịch đổi giai đoạn / mở-đóng khung giờ (theo giờ server),
 * dùng làm dependency để giỏ tự báo giá lại mà không cần tải trang.
 */
export function useCampaignRequoteKey(): string {
  const view = useCampaignView();
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setTick((n) => n + 1), 15_000);
    return () => window.clearInterval(id);
  }, []);
  const c = view.campaign;
  if (!c) return `${view.data?.state || "none"}`;
  const slot = currentSlotKey(c.slots, Date.now() + view.offsetMs);
  return `${c.id}:${c.phase}:${slot || "-"}:${view.data?.state || ""}`;
}

/**
 * Báo khách khi sản phẩm trong giỏ vừa vào giá sale, vừa hết khung giờ (về giá thường),
 * hoặc server báo hết suất / quà.
 */
export function useCampaignCartNotices(campaign: CampaignQuoteUI | null | undefined): void {
  const toast = useToast();
  const prevFlash = useRef<Set<string> | null>(null);
  const prevNotices = useRef("");
  useEffect(() => {
    if (!campaign) return;
    const now = flashMas(campaign);
    const prev = prevFlash.current;
    const dropped = prev ? droppedFlashMas(prev, campaign) : [];
    if (prev && now.size > prev.size) {
      toast.push(`${now.size - prev.size} sản phẩm trong giỏ đã vào giá sale`);
    }
    prevFlash.current = now;
    const joined = campaign.notices.join("\n");
    if (joined && joined !== prevNotices.current) toast.push(campaign.notices[0]);
    else if (dropped.length) toast.push(`Giá sale của ${dropped.length} sản phẩm trong giỏ đã kết thúc, giá đã về giá thường.`);
    prevNotices.current = joined;
  }, [campaign, toast]);
}
