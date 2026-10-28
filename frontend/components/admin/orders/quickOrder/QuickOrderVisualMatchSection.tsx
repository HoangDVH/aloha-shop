"use client";

import { Button, Tag } from "antd";
import { Sparkles, ShoppingBag } from "lucide-react";
import type {
  QuickOrderCandidate,
  QuickOrderItem,
  QuickOrderVisualAnalysis,
} from "./quickOrderModalTypes";

export function QuickOrderVisualMatchSection({
  imagePreview,
  visualAnalysis,
  candidates,
  items,
  onSelectCandidate,
}: {
  imagePreview: string | null;
  visualAnalysis: QuickOrderVisualAnalysis | null;
  candidates: QuickOrderCandidate[];
  items: QuickOrderItem[];
  onSelectCandidate: (candidate: QuickOrderCandidate) => void;
}) {
  if (!imagePreview || (!visualAnalysis && (!candidates || candidates.length === 0))) {
    return null;
  }

  return (
    <div className="p-3.5 bg-gradient-to-r from-emerald-50/80 via-teal-50/50 to-slate-50 rounded-xl border border-emerald-200/90 space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-xs font-bold text-[#2D5A27] uppercase tracking-wider flex items-center gap-1.5">
          <Sparkles size={15} className="text-[#2D5A27]" />
          Nhận diện thông minh từ hình ảnh
        </div>
        <Tag color="green" className="text-[10px] m-0 border-0 bg-emerald-100 text-emerald-800 font-semibold">
          AI Vision Match
        </Tag>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 items-start">
        {/* ẢNH GỐC CỦA KHÁCH + TAGS */}
        <div className="flex sm:flex-col items-center sm:items-start gap-2 bg-white/90 p-2.5 rounded-lg border border-emerald-100 shadow-2xs shrink-0 w-full sm:w-36">
          <img
            src={imagePreview}
            alt="Ảnh khách gửi"
            className="w-16 h-16 sm:w-28 sm:h-28 object-cover rounded-md border border-slate-200 shadow-2xs shrink-0"
          />
          <div className="space-y-1 text-[11px] flex-1 sm:w-full">
            <div className="font-bold text-slate-700 text-[10px] uppercase text-slate-400">Ảnh khách gửi</div>
            {visualAnalysis?.plantName && (
              <div className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded truncate">
                🌿 {visualAnalysis.plantName}
              </div>
            )}
            {visualAnalysis?.potType && (
              <div className="text-[10px] text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded truncate">
                🏺 {visualAnalysis.potType}
              </div>
            )}
            {visualAnalysis?.accessories && visualAnalysis.accessories.length > 0 && (
              <div className="text-[10px] text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded truncate">
                ✨ {visualAnalysis.accessories.slice(0, 2).join(", ")}
              </div>
            )}
          </div>
        </div>

        {/* DANH SÁCH SẢN PHẨM KHỚP NHẤT TRONG KHO */}
        <div className="flex-1 w-full space-y-1.5">
          <div className="text-[11px] font-semibold text-slate-600 flex items-center justify-between">
            <span>Mẫu tương đồng nhất trong kho Aloha:</span>
            <span className="text-[10px] text-slate-400">Bấm để chọn món</span>
          </div>

          {(!candidates || candidates.length === 0) ? (
            <div className="p-4 bg-white/80 rounded-lg border border-dashed border-slate-200 text-center text-xs text-slate-500">
              Chưa tìm thấy mẫu tương đồng chính xác trong kho. Bạn có thể tìm nhanh ở ô bên dưới.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-1.5">
              {candidates.map((c) => {
                const isSelected = items.some((it) => it.productCode === c.productCode);
                return (
                  <div
                    key={c.productCode}
                    className={`p-2 rounded-lg border transition flex items-center justify-between gap-2.5 text-xs ${
                      isSelected
                        ? "bg-white border-[#2D5A27] shadow-2xs ring-1 ring-[#2D5A27]/20"
                        : "bg-white/80 border-slate-200 hover:bg-white hover:border-slate-300"
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      {c.imageUrl ? (
                        <img
                          src={c.imageUrl}
                          alt=""
                          className="w-10 h-10 object-cover rounded border border-slate-100 shrink-0"
                        />
                      ) : (
                        <div className="w-10 h-10 bg-slate-100 rounded flex items-center justify-center text-slate-400 shrink-0">
                          <ShoppingBag size={14} />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold text-slate-800 truncate text-[11px]">
                          {c.productName}
                        </div>
                        <div className="text-[10px] text-slate-400 flex flex-wrap items-center gap-1.5">
                          <span className="font-mono text-slate-600">{c.productCode}</span>
                          <span>•</span>
                          <span className="text-emerald-700 font-bold">
                            {c.price.toLocaleString("vi-VN")} ₫
                          </span>
                          <span>•</span>
                          <span>Tồn: {c.stock}</span>
                          {c.confidence && (
                            <span className="text-[9px] bg-emerald-50 text-emerald-700 px-1 py-0.2 rounded font-bold">
                              {c.confidence}% khớp
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="shrink-0">
                      {isSelected ? (
                        <Tag color="green" className="m-0 text-[10px] font-bold">
                          ✓ Đang chọn
                        </Tag>
                      ) : (
                        <Button
                          size="small"
                          type="default"
                          onClick={() => onSelectCandidate(c)}
                          className="text-[11px] h-7 px-2.5 rounded-lg font-medium hover:border-[#2D5A27] hover:text-[#2D5A27]"
                        >
                          + Chọn mẫu này
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
