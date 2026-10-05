import React, { type ReactNode } from "react";
import {
  Circle,
  Flower2,
  Gift,
  Leaf,
  MoreHorizontal,
  Package,
  Shovel,
  Sprout,
  Wrench,
} from "lucide-react";
import type { ShopCategoryNavNode } from "@/lib/api";
import {
  ICON_CLASS,
  IconPot,
  IconSproutBox,
  IconVase,
} from "./icons";

/** Cột flyout — cố định, mọi cấp bằng nhau */
export const FLYOUT_COL_CLASS = "flex w-[260px] shrink-0 flex-col";
export const FLYOUT_SCROLL_CLASS = "max-h-[min(70vh,420px)] overflow-y-auto overscroll-contain py-1";

export function nodeSubs(node: ShopCategoryNavNode): ShopCategoryNavNode[] {
  return node.subs || [];
}

/**
 * Nhãn thanh danh mục (gần mockup shop).
 * Flyout / title vẫn dùng tên đầy đủ KV.
 */
export const NAV_SHORT: Record<string, string> = {
  KHÁC: "Khác",
  "CÂY CẢNH ĐỦ LOẠI": "Cây cảnh",
  "CHẬU TRỒNG CÂY": "Chậu cây",
  "BÌNH CẮM HOA": "Bình hoa",
  "ĐẤT ĐÁ GIÁ THỂ DINH DƯỠNG TRỒNG CÂY": "Giá thể",
  "HẠT GIỐNG": "Hạt giống",
  "PHỤ KIỆN TRANG TRÍ": "Phụ kiện",
  "ĐĨA LÓT CHẬU": "Đĩa lót",
  "DỤNG CỤ TRỒNG CÂY": "Dụng cụ",
  "TÚI VÀ HỘP ĐỂ SẢN PHẨM": "Túi & hộp",
  "VẬT TƯ VÀ THIẾT BỊ": "Vật tư",
  "QUÀ TẶNG CÂY": "Quà tặng",
};

export const NAV_ICONS: Record<string, ReactNode> = {
  KHÁC: <MoreHorizontal className={ICON_CLASS} strokeWidth={1.75} />,
  "CÂY CẢNH ĐỦ LOẠI": <Sprout className={ICON_CLASS} strokeWidth={1.75} />,
  "CHẬU TRỒNG CÂY": <IconPot className={ICON_CLASS} />,
  "BÌNH CẮM HOA": <IconVase className={ICON_CLASS} />,
  "ĐẤT ĐÁ GIÁ THỂ DINH DƯỠNG TRỒNG CÂY": (
    <IconSproutBox className={ICON_CLASS} />
  ),
  "HẠT GIỐNG": <Leaf className={ICON_CLASS} strokeWidth={1.75} />,
  "PHỤ KIỆN TRANG TRÍ": <Flower2 className={ICON_CLASS} strokeWidth={1.75} />,
  "ĐĨA LÓT CHẬU": <Circle className={ICON_CLASS} strokeWidth={1.75} />,
  "DỤNG CỤ TRỒNG CÂY": <Shovel className={ICON_CLASS} strokeWidth={1.75} />,
  "TÚI VÀ HỘP ĐỂ SẢN PHẨM": <Package className={ICON_CLASS} strokeWidth={1.75} />,
  "VẬT TƯ VÀ THIẾT BỊ": <Wrench className={ICON_CLASS} strokeWidth={1.75} />,
  "QUÀ TẶNG CÂY": <Gift className={ICON_CLASS} strokeWidth={1.75} />,
};

export function normKey(name: string): string {
  return String(name || "")
    .trim()
    .replace(/\s+/g, " ")
    .toUpperCase();
}

export function foldKey(name: string): string {
  return normKey(name)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function lookupNav<T>(map: Record<string, T>, name: string): T | undefined {
  const key = normKey(name);
  if (map[key] !== undefined) return map[key];
  const folded = foldKey(name);
  for (const [k, v] of Object.entries(map)) {
    if (foldKey(k) === folded) return v;
  }
  // Khớp theo từ khóa chính (API đôi khi lệch tên)
  const hits: Array<[string, T]> = [];
  for (const [k, v] of Object.entries(map)) {
    const fk = foldKey(k);
    if (folded.includes(fk) || fk.includes(folded)) hits.push([k, v]);
  }
  if (hits.length === 1) return hits[0][1];
  return undefined;
}

export function navBarLabel(name: string): string {
  return lookupNav(NAV_SHORT, name) || String(name || "").trim();
}

export function navBarIcon(name: string): ReactNode {
  return (
    lookupNav(NAV_ICONS, name) || (
      <Sprout className={ICON_CLASS} strokeWidth={1.75} />
    )
  );
}

/**
 * Gộp UI trên navbar (data/tree không đổi):
 * - Giá thể: chèn Hạt giống dưới «THUỐC VÀ DINH DƯỠNG CHO CÂY»
 * - Phụ kiện: chèn Dụng cụ + Túi hộp dưới «PHỤ KIỆN TIỂU CẢNH»
 */
export const NAV_UI_MERGE_GROUPS = [
  {
    id: "gia-the",
    label: "Giá thể",
    primaryName: "ĐẤT ĐÁ GIÁ THỂ DINH DƯỠNG TRỒNG CÂY",
    memberNames: [
      "ĐẤT ĐÁ GIÁ THỂ DINH DƯỠNG TRỒNG CÂY",
      "HẠT GIỐNG",
    ] as const,
    injectAfterName: "THUỐC VÀ DINH DƯỠNG CHO CÂY",
  },
  {
    id: "phu-kien",
    label: "Phụ kiện",
    primaryName: "PHỤ KIỆN TRANG TRÍ",
    memberNames: [
      "PHỤ KIỆN TRANG TRÍ",
      "DỤNG CỤ TRỒNG CÂY",
      "TÚI VÀ HỘP ĐỂ SẢN PHẨM",
    ] as const,
    injectAfterName: "PHỤ KIỆN TIỂU CẢNH",
  },
] as const;

export function nameMatchesAny(name: string, candidates: readonly string[]): boolean {
  const folded = foldKey(name);
  return candidates.some((n) => {
    const target = foldKey(n);
    return folded === target || folded.includes(target) || target.includes(folded);
  });
}

export function findNavMergeGroup(name: string) {
  return NAV_UI_MERGE_GROUPS.find((g) => nameMatchesAny(name, g.memberNames)) || null;
}

/** Viết hoa chữ cái đầu mỗi từ (vd. CÂY KIM TIỀN → Cây Kim Tiền). */
export function toTitleCaseVi(name: string): string {
  const s = String(name || "").trim().replace(/\s+/g, " ");
  if (!s) return s;
  return s
    .split(/(\s+|[-–—])/)
    .map((part) => {
      if (!part || /^[\s\-–—]+$/.test(part)) return part;
      if (/^ctp$/i.test(part)) return "CTP";
      const lower = part.toLocaleLowerCase("vi");
      return lower.charAt(0).toLocaleUpperCase("vi") + lower.slice(1);
    })
    .join("");
}

/** Nhánh có giá trong tên → rút gọn (CÂY THÀNH PHẨM TRÊN 150K… → Ctp Trên 150k…). */
export function mobileCatLabel(name: string): string {
  const s = String(name || "").trim().replace(/\s+/g, " ");
  if (!s) return s;
  const f = foldKey(s);
  const hasPrice =
    /\d\s*K\b/.test(f) ||
    /\d\s*TR\b/.test(f) ||
    /\d+TR/.test(f) ||
    (/\d/.test(s) &&
      (f.includes("DUOI") ||
        f.includes("TREN") ||
        f.includes("DONG GIA") ||
        /SALE[- ]?\d/.test(f) ||
        /SALE-\d/.test(f)));

  if (!hasPrice) return toTitleCaseVi(s);

  if (f.startsWith("CAY THANH PHAM")) {
    const rest = s.replace(/^CÂY\s+THÀNH\s+PHẨM\s*/i, "").trim();
    return toTitleCaseVi(rest ? `CTP ${rest}` : "CTP");
  }
  return toTitleCaseVi(s);
}

/** Thứ tự 9 nhánh mẹ trên rail mobile (không gộp như desktop). */
export const MOBILE_ROOT_ORDER = [
  "CÂY CẢNH ĐỦ LOẠI",
  "CHẬU TRỒNG CÂY",
  "BÌNH CẮM HOA",
  "PHỤ KIỆN TRANG TRÍ",
  "ĐẤT ĐÁ GIÁ THỂ DINH DƯỠNG TRỒNG CÂY",
  "HẠT GIỐNG",
  "ĐĨA LÓT CHẬU",
  "DỤNG CỤ TRỒNG CÂY",
  "TÚI VÀ HỘP ĐỂ SẢN PHẨM",
] as const;

export const MOBILE_CAT_ACTIVE_KEY = "aloha:mobile-cat-active";

/** Nhánh con L2 ưu tiên hiển thị trước theo từng nhóm mẹ L1 */
export const L2_PREFERRED_BY_L1: Record<string, readonly string[]> = {
  "PHỤ KIỆN TRANG TRÍ": ["PHỤ KIỆN TIỂU CẢNH"],
  "CHẬU TRỒNG CÂY": ["CHẬU COMBO THEO BỘ"],
};

/**
 * Sắp xếp các nhánh con L2 bên phải danh mục:
 * 1. Ưu tiên các nhánh được cấu hình ưu tiên (vd. "Chậu combo theo bộ", "Phụ kiện tiểu cảnh").
 * 2. Ưu tiên các nhánh có nhiều nhóm con L3 hơn lên đầu (subs.length giảm dần).
 * 3. Nếu cùng số nhóm con, ưu tiên nhánh có nhiều sản phẩm hơn (count giảm dần).
 * 4. Các nhánh ít/không có con (chỉ 1 ảnh đơn) sẽ nằm ở dưới.
 */
export function orderL2Nodes(
  parentName: string,
  nodes: ShopCategoryNavNode[]
): ShopCategoryNavNode[] {
  let preferred: readonly string[] = [];
  for (const [key, list] of Object.entries(L2_PREFERRED_BY_L1)) {
    if (nameMatchesAny(parentName, [key])) {
      preferred = list;
      break;
    }
  }

  const preferredMap = new Map<number, number>();
  nodes.forEach((n) => {
    const idx = preferred.findIndex((pName) => nameMatchesAny(n.name, [pName]));
    if (idx !== -1) {
      preferredMap.set(n.id, idx);
    }
  });

  return [...nodes].sort((a, b) => {
    const aPref = preferredMap.has(a.id);
    const bPref = preferredMap.has(b.id);
    if (aPref && !bPref) return -1;
    if (!aPref && bPref) return 1;
    if (aPref && bPref) {
      return (preferredMap.get(a.id) ?? 0) - (preferredMap.get(b.id) ?? 0);
    }

    const aKids = nodeSubs(a).length;
    const bKids = nodeSubs(b).length;
    if (bKids !== aKids) return bKids - aKids;

    const aCount = Number.isFinite(a.count) ? a.count : 0;
    const bCount = Number.isFinite(b.count) ? b.count : 0;
    return bCount - aCount;
  });
}
