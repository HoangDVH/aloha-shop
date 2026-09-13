/**
 * Đề xuất giá theo ABC (cách công ty hay dùng) — chỉ dùng trên App.
 * Không đẩy nhóm ABC / câu đề xuất lên KiotViet.
 */

export type AbcClass = 'A' | 'B' | 'C';

export type PriceSuggestInput = {
  ma: string;
  soldQty: number;
  ton: number;
  gv: number;
  si: number;
  chung: number;
  web: number;
  /** Hệ số chuẩn % trên GV — mặc định Sỉ 50 / Chung 130 */
  rateSi?: number;
  rateChung?: number;
  /** Số ngày cửa sổ bán (30 hoặc 90) — để tính bán/ngày */
  windowDays: number;
};

export type PriceSuggestResult = {
  abc: AbcClass;
  soldQty: number;
  daysOfStock: number | null;
  text: string;
  /** Hệ số nhân giá hiện tại (1 = giữ, 1.05 = +5%, 0.95 = −5%) */
  priceFactor: number;
  action: 'hold' | 'up' | 'down' | 'restock' | 'clear';
};

/** Xếp A/B/C theo Pareto trên map SL bán (chỉ các mã đang xét). */
export function classifyAbcBySoldQty(
  soldByMa: Record<string, number>,
  mas: string[]
): Record<string, AbcClass> {
  const rows = mas.map((ma) => {
    const key = String(ma || '').trim().toUpperCase();
    return { ma: key, qty: Math.max(0, Number(soldByMa[key]) || 0) };
  });
  const withSales = rows.filter((r) => r.qty > 0).sort((a, b) => b.qty - a.qty);
  const total = withSales.reduce((s, r) => s + r.qty, 0);

  const out: Record<string, AbcClass> = {};
  for (const r of rows) {
    if (r.qty <= 0) out[r.ma] = 'C';
  }
  if (total <= 0 || withSales.length === 0) {
    for (const r of rows) if (!out[r.ma]) out[r.ma] = 'C';
    return out;
  }

  let cum = 0;
  for (const r of withSales) {
    cum += r.qty;
    const share = cum / total;
    if (share <= 0.7) out[r.ma] = 'A';
    else if (share <= 0.9) out[r.ma] = 'B';
    else out[r.ma] = 'C';
  }
  for (const r of rows) if (!out[r.ma]) out[r.ma] = 'C';
  return out;
}

function marginPct(price: number, gv: number): number | null {
  if (!(gv > 0) || !(price > 0)) return null;
  return Math.round(((price - gv) / gv) * 1000) / 10;
}

/**
 * Sinh đề xuất 1 dòng — tiếng Việt ngắn.
 * priceFactor chỉ áp khi người dùng bấm «Áp» trên App.
 */
export function buildPriceSuggest(
  input: PriceSuggestInput,
  abc: AbcClass
): PriceSuggestResult {
  const days = Math.max(1, Number(input.windowDays) || 30);
  const sold = Math.max(0, Number(input.soldQty) || 0);
  const ton = Math.max(0, Number(input.ton) || 0);
  const perDay = sold / days;
  const daysOfStock = perDay > 0 ? Math.round((ton / perDay) * 10) / 10 : ton > 0 ? null : 0;

  const rateSi = input.rateSi ?? 50;
  const rateChung = input.rateChung ?? 130;
  const mSi = marginPct(input.si, input.gv);
  const mChung = marginPct(input.chung, input.gv);
  const lowMargin =
    (mSi != null && mSi < rateSi - 5) || (mChung != null && mChung < rateChung - 10);
  const lowStock = daysOfStock != null && daysOfStock >= 0 && daysOfStock < 14;
  const highStock = daysOfStock == null ? ton > 0 && sold === 0 : daysOfStock > 60;

  if (abc === 'A') {
    if (lowStock) {
      return {
        abc,
        soldQty: sold,
        daysOfStock,
        text: 'Bán chạy · sắp hết · ưu tiên nhập · giữ/tăng nhẹ giá',
        priceFactor: 1.03,
        action: 'restock',
      };
    }
    if (lowMargin) {
      return {
        abc,
        soldQty: sold,
        daysOfStock,
        text: 'Bán chạy · lời thấp · nên tăng sỉ/chung ~5%',
        priceFactor: 1.05,
        action: 'up',
      };
    }
    return {
      abc,
      soldQty: sold,
      daysOfStock,
      text: 'Bán chạy · giữ giá',
      priceFactor: 1,
      action: 'hold',
    };
  }

  if (abc === 'B') {
    if (lowMargin) {
      return {
        abc,
        soldQty: sold,
        daysOfStock,
        text: 'Bán vừa · lời thấp · chỉnh nhẹ về chuẩn',
        priceFactor: 1.03,
        action: 'up',
      };
    }
    return {
      abc,
      soldQty: sold,
      daysOfStock,
      text: 'Bán vừa · giữ giá',
      priceFactor: 1,
      action: 'hold',
    };
  }

  // C
  if (highStock || (sold === 0 && ton > 0)) {
    return {
      abc,
      soldQty: sold,
      daysOfStock,
      text: sold === 0 ? 'Chưa bán · tồn còn · cân nhắc giảm ~8% để xả' : 'Bán chậm · tồn cao · giảm ~8% / hạn chế nhập',
      priceFactor: 0.92,
      action: 'clear',
    };
  }
  if (sold === 0) {
    return {
      abc,
      soldQty: sold,
      daysOfStock,
      text: 'Chưa bán trong kỳ · không ưu tiên nhập',
      priceFactor: 1,
      action: 'hold',
    };
  }
  return {
    abc,
    soldQty: sold,
    daysOfStock,
    text: 'Bán chậm · giữ hoặc theo dõi',
    priceFactor: 1,
    action: 'hold',
  };
}

export function applyPriceFactor(price: number, factor: number): number {
  const p = Math.round(Number(price) || 0);
  if (!(p > 0) || !(factor > 0) || factor === 1) return p;
  return Math.max(0, Math.round(p * factor));
}
