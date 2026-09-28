import type {
  PromotionDoc,
  PromotionCodeDoc,
  CartItemToEvaluate,
  BuyerContext,
  EvaluatedCandidate,
  PromotionQuoteResult,
} from "./types.js";

function formatVnd(amount: number): string {
  return `${amount.toLocaleString("vi-VN")}đ`;
}

function normalizeMa(ma: string): string {
  return String(ma || "").trim().toUpperCase();
}

/** Kiểm tra xem 1 sản phẩm có thuộc phạm vi áp dụng của ưu đãi không */
export function isItemInScope(
  item: CartItemToEvaluate,
  promo: PromotionDoc
): boolean {
  const ma = normalizeMa(item.ma);
  if (promo.excludedProductMas && promo.excludedProductMas.length > 0) {
    const excluded = promo.excludedProductMas.map(normalizeMa);
    if (excluded.includes(ma)) return false;
  }

  if (promo.scope === "all") return true;

  if (promo.scope === "product") {
    if (!promo.productMas || !promo.productMas.length) return false;
    const allowed = promo.productMas.map(normalizeMa);
    return allowed.includes(ma);
  }

  if (promo.scope === "category") {
    if (!promo.categoryIds || !promo.categoryIds.length) return false;
    const catId = String(item.categoryId || "").trim();
    if (!catId) return false;
    return promo.categoryIds.includes(catId);
  }

  return false;
}

export function evaluatePromotions(args: {
  items: CartItemToEvaluate[];
  buyer?: BuyerContext;
  promotions: PromotionDoc[];
  codes?: PromotionCodeDoc[];
  selectedCode?: string;
  autoMode?: boolean; // default true
  now?: Date;
}): PromotionQuoteResult {
  const {
    items = [],
    buyer = {},
    promotions = [],
    codes = [],
    selectedCode = "",
    autoMode = true,
    now = new Date(),
  } = args;

  const subtotal = items.reduce(
    (sum, it) => sum + Math.max(0, it.price) * Math.max(1, it.quantity),
    0
  );

  const cleanSelectedCode = String(selectedCode || "").trim().toUpperCase();
  const nowIso = now.toISOString();

  const candidates: EvaluatedCandidate[] = [];

  // Đánh giá từng promotion đang active
  for (const promo of promotions) {
    if (promo.status !== "active") continue;

    let eligible = true;
    let ineligibleReason = "";

    // 1. Kiểm tra thời gian hiệu lực
    if (promo.startDate && promo.startDate > nowIso) {
      eligible = false;
      ineligibleReason = "Chương trình chưa bắt đầu.";
    } else if (promo.endDate && promo.endDate < nowIso) {
      eligible = false;
      ineligibleReason = "Chương trình đã kết thúc.";
    }

    // 2. Kiểm tra giới hạn lượt & ngân sách
    if (eligible && promo.usageLimitTotal != null) {
      if (promo.usedCount + promo.heldCount >= promo.usageLimitTotal) {
        eligible = false;
        ineligibleReason = "Ưu đãi đã hết lượt sử dụng.";
      }
    }

    if (eligible && promo.budgetTotal != null) {
      if (promo.budgetUsed + promo.budgetHeld >= promo.budgetTotal) {
        eligible = false;
        ineligibleReason = "Ưu đãi đã hết ngân sách chương trình.";
      }
    }

    // 3. Kiểm tra đối tượng khách hàng
    if (eligible) {
      if (promo.targetCustomer === "retail" && buyer.isWholesale) {
        eligible = false;
        ineligibleReason = "Chỉ áp dụng cho khách mua lẻ.";
      } else if (promo.targetCustomer === "wholesale" && !buyer.isWholesale) {
        eligible = false;
        ineligibleReason = "Chỉ áp dụng cho tài khoản sỉ.";
      } else if (promo.targetCustomer === "new_web") {
        if (buyer.isNewWebBuyer === false) {
          eligible = false;
          ineligibleReason = "Chỉ áp dụng cho khách mua lần đầu trên website.";
        }
      }
    }

    // 4. Lọc sản phẩm trong phạm vi & tính tiền hàng đủ điều kiện
    const eligibleItems = items.filter((it) => isItemInScope(it, promo));
    const eligibleSubtotal = eligibleItems.reduce(
      (sum, it) => sum + Math.max(0, it.price) * Math.max(1, it.quantity),
      0
    );

    if (eligible && eligibleSubtotal <= 0) {
      eligible = false;
      ineligibleReason = "Sản phẩm trong giỏ chưa thuộc danh sách áp dụng.";
    }

    // 5. Kiểm tra ngưỡng giá trị đơn hàng
    if (eligible && promo.minOrderThreshold != null && promo.minOrderThreshold > 0) {
      const op = promo.thresholdOperator || ">";
      const thresholdMet =
        op === ">"
          ? eligibleSubtotal > promo.minOrderThreshold
          : eligibleSubtotal >= promo.minOrderThreshold;

      if (!thresholdMet) {
        eligible = false;
        const diff = Math.max(1, promo.minOrderThreshold - eligibleSubtotal);
        ineligibleReason =
          op === ">"
            ? `Cần mua thêm trên ${formatVnd(diff)} hàng áp dụng để nhận ưu đãi.`
            : `Cần mua thêm ${formatVnd(diff)} hàng áp dụng để nhận ưu đãi.`;
      }
    }

    // 6. Tính số tiền giảm dự kiến
    let calculatedDiscount = 0;
    if (eligible && eligibleSubtotal > 0) {
      if (promo.discountType === "percentage") {
        const raw = Math.round((eligibleSubtotal * promo.discountValue) / 100);
        if (promo.maxDiscountVnd != null && promo.maxDiscountVnd > 0) {
          calculatedDiscount = Math.min(raw, promo.maxDiscountVnd);
        } else {
          calculatedDiscount = raw;
        }
      } else {
        // fixed amount
        calculatedDiscount = Math.min(Math.round(promo.discountValue), eligibleSubtotal);
      }
      calculatedDiscount = Math.max(0, Math.min(calculatedDiscount, eligibleSubtotal));
    }

    candidates.push({
      promotionId: promo.id,
      title: promo.title,
      type: promo.type,
      discountType: promo.discountType,
      discountValue: promo.discountValue,
      maxDiscountVnd: promo.maxDiscountVnd,
      minOrderThreshold: promo.minOrderThreshold,
      thresholdOperator: promo.thresholdOperator,
      eligible,
      ineligibleReason: eligible ? undefined : ineligibleReason,
      calculatedDiscount,
      isPublic: promo.isPublic !== false,
      scope: promo.scope,
      targetCustomer: promo.targetCustomer,
      endDate: promo.endDate,
      description: promo.description,
    });
  }

  // Quyết định ưu đãi được áp dụng:
  let appliedPromo: PromotionDoc | undefined;
  let appliedDiscountAmount = 0;
  let appliedCode: string | undefined;

  if (cleanSelectedCode) {
    // Luồng nhập / chọn mã thủ công
    const matchingCodeDoc = codes.find(
      (c) => c.code === cleanSelectedCode && c.active !== false
    );

    if (matchingCodeDoc) {
      // Kiểm tra hạn sử dụng của code
      let codeValid = true;
      let codeError = "";
      if (matchingCodeDoc.expiresAt && matchingCodeDoc.expiresAt < nowIso) {
        codeValid = false;
        codeError = "Mã giảm giá đã hết hạn sử dụng.";
      }
      if (
        codeValid &&
        matchingCodeDoc.maxUses != null &&
        matchingCodeDoc.usedCount + matchingCodeDoc.heldCount >= matchingCodeDoc.maxUses
      ) {
        codeValid = false;
        codeError = "Mã giảm giá đã hết lượt sử dụng.";
      }
      if (
        codeValid &&
        matchingCodeDoc.assignedBuyerPhone &&
        buyer.phone &&
        matchingCodeDoc.assignedBuyerPhone !== buyer.phone
      ) {
        codeValid = false;
        codeError = "Mã giảm giá không dành cho số điện thoại này.";
      }

      const associatedPromo = promotions.find(
        (p) => p.id === matchingCodeDoc.promotionId
      );

      if (!associatedPromo || associatedPromo.status !== "active") {
        codeValid = false;
        codeError = "Chương trình ưu đãi của mã này không còn hoạt động.";
      }

      if (codeValid && associatedPromo) {
        const cand = candidates.find((c) => c.promotionId === associatedPromo.id);
        if (cand && cand.eligible && cand.calculatedDiscount > 0) {
          appliedPromo = associatedPromo;
          appliedDiscountAmount = cand.calculatedDiscount;
          appliedCode = cleanSelectedCode;
        } else {
          // Gắn lý do không đủ điều kiện cho code
          candidates.push({
            promotionId: associatedPromo.id,
            title: associatedPromo.title,
            type: "code",
            code: cleanSelectedCode,
            discountType: associatedPromo.discountType,
            discountValue: associatedPromo.discountValue,
            eligible: false,
            ineligibleReason: cand?.ineligibleReason || "Đơn hàng chưa đủ điều kiện dùng mã này.",
            calculatedDiscount: 0,
            isPublic: false,
          });
        }
      } else {
        candidates.push({
          promotionId: "invalid_code",
          title: `Mã ${cleanSelectedCode}`,
          type: "code",
          code: cleanSelectedCode,
          discountType: "fixed",
          discountValue: 0,
          eligible: false,
          ineligibleReason: codeError || "Mã không hợp lệ hoặc đã hết lượt.",
          calculatedDiscount: 0,
          isPublic: false,
        });
      }
    } else {
      // Có thể là promo type='code' có code trùng với ID hoặc title
      candidates.push({
        promotionId: "unknown_code",
        title: `Mã ${cleanSelectedCode}`,
        type: "code",
        code: cleanSelectedCode,
        discountType: "fixed",
        discountValue: 0,
        eligible: false,
        ineligibleReason: "Mã giảm giá không tồn tại.",
        calculatedDiscount: 0,
        isPublic: false,
      });
    }
  } else if (autoMode) {
    // Luồng tự động chọn ưu đãi tốt nhất (auto-best)
    const eligibleAutoCandidates = candidates.filter(
      (c) => c.eligible && c.type === "auto" && c.calculatedDiscount > 0
    );

    if (eligibleAutoCandidates.length > 0) {
      // Sắp xếp theo:
      // 1. calculatedDiscount giảm dần
      // 2. priority của promo giảm dần
      // 3. ID promotion ổn định
      eligibleAutoCandidates.sort((a, b) => {
        if (b.calculatedDiscount !== a.calculatedDiscount) {
          return b.calculatedDiscount - a.calculatedDiscount;
        }
        const promoA = promotions.find((p) => p.id === a.promotionId);
        const promoB = promotions.find((p) => p.id === b.promotionId);
        const prioA = promoA?.priority || 0;
        const prioB = promoB?.priority || 0;
        if (prioB !== prioA) return prioB - prioA;
        return a.promotionId.localeCompare(b.promotionId);
      });

      const best = eligibleAutoCandidates[0];
      appliedPromo = promotions.find((p) => p.id === best.promotionId);
      appliedDiscountAmount = best.calculatedDiscount;
    }
  }

  // Phân bổ giảm giá theo từng dòng sản phẩm đủ điều kiện (Proportional allocation)
  const lineDiscounts: Record<string, number> = {};
  items.forEach((it) => {
    lineDiscounts[it.ma] = 0;
  });

  if (appliedPromo && appliedDiscountAmount > 0) {
    const eligibleItems = items.filter((it) => isItemInScope(it, appliedPromo!));
    const eligibleSubtotal = eligibleItems.reduce(
      (sum, it) => sum + Math.max(0, it.price) * Math.max(1, it.quantity),
      0
    );

    if (eligibleSubtotal > 0) {
      let allocatedTotal = 0;
      const fractions: Array<{ ma: string; fractional: number; maxLineValue: number }> = [];

      eligibleItems.forEach((it) => {
        const lineTotal = Math.max(0, it.price) * Math.max(1, it.quantity);
        const rawLineDiscount = (appliedDiscountAmount * lineTotal) / eligibleSubtotal;
        const floorDiscount = Math.floor(rawLineDiscount);
        lineDiscounts[it.ma] = floorDiscount;
        allocatedTotal += floorDiscount;
        fractions.push({
          ma: it.ma,
          fractional: rawLineDiscount - floorDiscount,
          maxLineValue: lineTotal,
        });
      });

      // Phân bổ số dư lẻ (remainder) cho dòng có phần dư lớn nhất
      let remainder = appliedDiscountAmount - allocatedTotal;
      if (remainder > 0) {
        fractions.sort((a, b) => {
          if (b.fractional !== a.fractional) return b.fractional - a.fractional;
          return a.ma.localeCompare(b.ma);
        });

        for (let i = 0; i < fractions.length && remainder > 0; i++) {
          const item = fractions[i];
          if (lineDiscounts[item.ma] < item.maxLineValue) {
            lineDiscounts[item.ma] += 1;
            remainder -= 1;
          }
        }
      }
    }
  }

  const discountTotal = appliedDiscountAmount;
  const finalTotal = Math.max(0, subtotal - discountTotal);

  return {
    applied: appliedPromo
      ? {
          promotionId: appliedPromo.id,
          title: appliedPromo.title,
          type: appliedPromo.type,
          code: appliedCode,
          discountType: appliedPromo.discountType,
          discountValue: appliedPromo.discountValue,
          discountAmount: discountTotal,
        }
      : undefined,
    lineDiscounts,
    subtotal,
    discountTotal,
    finalTotal,
    candidates,
  };
}
