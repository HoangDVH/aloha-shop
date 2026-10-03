"use client";

import { create } from "zustand";
import { formatVnd } from "@/lib/api";

export type ZaloAskProduct = { name: string; price: number | null; image: string };

/** Sản phẩm đang xem (trang chi tiết đặt vào) để nút Zalo soạn sẵn câu hỏi tư vấn. */
export const useZaloAskProduct = create<{
  product: ZaloAskProduct | null;
  setProduct: (p: ZaloAskProduct | null) => void;
}>((set) => ({
  product: null,
  setProduct: (product) => set({ product }),
}));

/** Câu khách dán vào Zalo; link ở dòng riêng để Zalo hiện thẻ xem trước (ảnh + tên SP). */
export function zaloAskText(p: ZaloAskProduct, url: string): string {
  const price = p.price && p.price > 0 ? ` – ${formatVnd(p.price)}` : "";
  return `Chào Aloha, mình cần tư vấn sản phẩm: ${p.name}${price}\n${url}`;
}
