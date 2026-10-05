"use client";

import { useEffect, useState, useMemo } from "react";
import { Ticket, Truck, Info, X, Check, Calendar, ArrowRight } from "lucide-react";
import { getAvailablePromotions, type AvailablePromotionUI } from "@/lib/promotions";
import type { ShopProduct } from "@/lib/api";
import { formatVnd } from "@/lib/api";
import { formatVoucherBadge, pctText } from "@/lib/voucherFormat";

interface ProductPromotionBadgesProps {
  product: ShopProduct;
  livePrice?: number;
  isWholesale?: boolean;
}

interface FormattedBadge {
  promotion: AvailablePromotionUI;
  label: string;
  type: "goods" | "shipping";
}

const formatBadgeText = (p: AvailablePromotionUI) => formatVoucherBadge(p);

export function ProductPromotionBadges({
  product,
  livePrice,
  isWholesale = false,
}: ProductPromotionBadgesProps) {
  const [promotions, setPromotions] = useState<AvailablePromotionUI[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [selectedPromo, setSelectedPromo] = useState<AvailablePromotionUI | null>(null);

  useEffect(() => {
    let active = true;
    getAvailablePromotions()
      .then((items) => {
        if (active) {
          setPromotions(items);
          setLoaded(true);
        }
      })
      .catch(() => {
        if (active) setLoaded(true);
      });
    return () => {
      active = false;
    };
  }, []);

  const applicableBadges = useMemo<FormattedBadge[]>(() => {
    if (!promotions.length) return [];

    // Lọc theo đối tượng và phạm vi áp dụng của SP
    const matched = promotions.filter((p) => {
      // Bỏ qua voucher sỉ nếu đang xem giá lẻ
      if (p.targetCustomer === "wholesale" && !isWholesale) return false;
      if (p.targetCustomer === "retail" && isWholesale) return false;

      // Kiểm tra scope
      if (p.scope === "category" && p.categoryIds?.length) {
        const catIdStr = product.categoryId ? String(product.categoryId) : "";
        const catSlug = product.categorySlug || "";
        const matchCat = p.categoryIds.some(
          (c) => c === catIdStr || c === catSlug || (product.nhom && c === product.nhom)
        );
        if (!matchCat) return false;
      }

      if (p.scope === "product" && p.productMas?.length) {
        const prodMa = String(product.ma || "").trim().toUpperCase();
        const matchProd = p.productMas.some((m) => String(m).trim().toUpperCase() === prodMa);
        if (!matchProd) return false;
      }

      return true;
    });

    // Chia nhóm: Voucher giảm tiền hàng & Voucher vận chuyển (KHÔNG CÓ TÍCH XU)
    const goodsPromos = matched.filter((p) => p.benefitType !== "shipping");
    const shipPromos = matched.filter((p) => p.benefitType === "shipping");

    const badges: FormattedBadge[] = [];

    // Chọn tối đa 1-2 voucher giảm tiền hàng tốt nhất
    if (goodsPromos.length > 0) {
      // Ưu tiên voucher có mức giảm cao nhất
      const sortedGoods = [...goodsPromos].sort((a, b) => {
        const valA = a.discountType === "fixed" ? a.discountValue : (a.maxDiscountVnd || a.discountValue * 1000);
        const valB = b.discountType === "fixed" ? b.discountValue : (b.maxDiscountVnd || b.discountValue * 1000);
        return valB - valA;
      });
      badges.push({
        promotion: sortedGoods[0],
        ...formatBadgeText(sortedGoods[0]),
      });
      if (sortedGoods.length > 1 && shipPromos.length === 0) {
        badges.push({
          promotion: sortedGoods[1],
          ...formatBadgeText(sortedGoods[1]),
        });
      }
    }

    // Chọn voucher hỗ trợ ship tốt nhất
    if (shipPromos.length > 0) {
      badges.push({
        promotion: shipPromos[0],
        ...formatBadgeText(shipPromos[0]),
      });
    }

    return badges;
  }, [promotions, product, isWholesale]);

  if (!loaded || applicableBadges.length === 0) {
    return null;
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2 pt-1">
        <span className="text-xs font-medium text-slate-500 shrink-0">
          Mã giảm áp dụng:
        </span>

        <div className="flex flex-wrap items-center gap-2">
          {applicableBadges.map(({ promotion, label, type }) => {
            const isShipping = type === "shipping";
            return (
              <button
                key={promotion.id}
                type="button"
                onClick={() => setSelectedPromo(promotion)}
                title="Bấm để xem chi tiết điều kiện mã"
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-semibold shadow-xs transition cursor-pointer select-none active:scale-[0.98] ${
                  isShipping
                    ? "bg-[#ecfdf5] text-[#065f46] border border-[#a7f3d0] hover:bg-[#d1fae5]"
                    : "bg-[#fff9eb] text-[#b45309] border border-[#fde68a] hover:bg-[#fef3c7]"
                }`}
              >
                {isShipping ? (
                  <Truck className="h-3.5 w-3.5 shrink-0 text-[#059669]" />
                ) : (
                  <Ticket className="h-3.5 w-3.5 shrink-0 text-[#d97706]" />
                )}
                <span>{label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Modal chi tiết điều kiện voucher */}
      {selectedPromo && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs transition-opacity"
          onClick={() => setSelectedPromo(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl ring-1 ring-black/10 animate-in fade-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                {selectedPromo.benefitType === "shipping" ? (
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                    <Truck className="h-5 w-5" />
                  </div>
                ) : (
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                    <Ticket className="h-5 w-5" />
                  </div>
                )}
                <div>
                  <h3 className="text-sm font-bold text-slate-800">
                    {selectedPromo.title || "Ưu đãi giảm giá"}
                  </h3>
                  <span className="text-[11px] font-medium text-slate-500">
                    {selectedPromo.benefitType === "shipping" ? "Hỗ trợ phí vận chuyển" : "Giảm giá tiền hàng"}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedPromo(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
                aria-label="Đóng"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3 py-4 text-xs text-slate-600 leading-relaxed">
              {selectedPromo.description && (
                <p className="bg-slate-50 p-2.5 rounded-lg border border-slate-100 text-slate-700">
                  {selectedPromo.description}
                </p>
              )}

              <div className="space-y-2 border-t border-dashed border-slate-200 pt-3">
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Mức giảm:</span>
                  <span className="font-semibold text-rose-600">
                    {selectedPromo.discountType === "percentage"
                      ? `Giảm ${pctText(selectedPromo)}${
                          selectedPromo.maxDiscountVnd
                            ? ` (Tối đa ${formatVnd(selectedPromo.maxDiscountVnd)})`
                            : ""
                        }`
                      : `Giảm ${formatVnd(selectedPromo.discountValue)}`}
                  </span>
                </div>

                {selectedPromo.minOrderThreshold ? (
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500">Đơn tối thiểu:</span>
                    <span className="font-medium text-slate-800">
                      {formatVnd(selectedPromo.minOrderThreshold)}
                    </span>
                  </div>
                ) : null}

                {selectedPromo.endDate && (
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500">Hạn sử dụng:</span>
                    <span className="font-medium text-slate-800">
                      Đến hết {new Date(selectedPromo.endDate).toLocaleDateString("vi-VN")}
                    </span>
                  </div>
                )}

                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Hình thức áp dụng:</span>
                  <span className="font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded text-[11px]">
                    {selectedPromo.type === "auto" ? "Tự động áp dụng khi đạt đơn" : "Áp dụng tại bước thanh toán"}
                  </span>
                </div>
              </div>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={() => setSelectedPromo(null)}
                className="w-full rounded-xl bg-[var(--aloha-green,#15803d)] py-2.5 text-xs font-bold text-white shadow-sm hover:opacity-95 transition"
              >
                Đã hiểu
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
