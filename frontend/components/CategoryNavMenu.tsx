"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  ChevronDown,
  ChevronRight,
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
import { categoryHref, type ShopCategoryNavNode } from "@/lib/api";
import { isPhongThuyL3, navIllustrationSrc } from "@/lib/navIllustrations";

/** Cột flyout — cố định, mọi cấp bằng nhau */
const FLYOUT_COL_CLASS = "flex w-[260px] shrink-0 flex-col";
const FLYOUT_SCROLL_CLASS = "max-h-[min(70vh,420px)] overflow-y-auto overscroll-contain py-1";

function nodeSubs(node: ShopCategoryNavNode): ShopCategoryNavNode[] {
  return node.subs || [];
}

/**
 * Nhãn thanh danh mục (gần mockup shop).
 * Flyout / title vẫn dùng tên đầy đủ KV.
 */
const NAV_SHORT: Record<string, string> = {
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

function IconPot({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path
        d="M7.5 9.5h9l-1.2 9.2a1.5 1.5 0 0 1-1.5 1.3h-3.6a1.5 1.5 0 0 1-1.5-1.3L7.5 9.5Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
      <path
        d="M6.5 9.5h11"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
      <path
        d="M9 9.5V8.2A2.2 2.2 0 0 1 11.2 6h1.6A2.2 2.2 0 0 1 15 8.2V9.5"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconVase({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path
        d="M9.5 4.5h5M10.2 4.5c0 2.2-1.4 3.6-1.8 5.4-.6 2.6.2 6.8 1.8 8.6.5.6 1.2.9 2 .9s1.5-.3 2-.9c1.6-1.8 2.4-6 1.8-8.6-.4-1.8-1.8-3.2-1.8-5.4"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconSproutBox({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <rect
        x="5.5"
        y="12.5"
        width="13"
        height="7"
        rx="1.5"
        stroke="currentColor"
        strokeWidth="1.75"
      />
      <path
        d="M12 12.5V9.5"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
      <path
        d="M12 9.8c-1.6-1.8-3.8-2.2-5-2 .4 1.8 2.2 3.4 4.2 3.6"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M12 9.8c1.6-1.8 3.8-2.2 5-2-.4 1.8-2.2 3.4-4.2 3.6"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const ICON_CLASS = "h-[18px] w-[18px] shrink-0";

const NAV_ICONS: Record<string, ReactNode> = {
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

function normKey(name: string): string {
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

function lookupNav<T>(map: Record<string, T>, name: string): T | undefined {
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

function FlyoutRow({
  node,
  active,
  onHover,
  onNavigate,
  rootStyle = false,
}: {
  node: ShopCategoryNavNode;
  active: boolean;
  onHover: () => void;
  onNavigate?: () => void;
  /** Cột gốc nhóm gộp: icon + nhãn ngắn */
  rootStyle?: boolean;
}) {
  const hasKids = nodeSubs(node).length > 0;
  const label = rootStyle ? navBarLabel(node.name) : node.name;
  return (
    <Link
      href={categoryHref(node)}
      onClick={onNavigate}
      onMouseEnter={onHover}
      title={node.name}
      className={`group flex items-start justify-between gap-2 px-4 py-2 text-sm leading-snug ${
        active
          ? "bg-[var(--aloha-green)] font-semibold text-white"
          : "text-slate-700 hover:bg-[var(--aloha-green)] hover:text-white"
      }`}
    >
      <span className="flex min-w-0 flex-1 items-start gap-2">
        {rootStyle ? (
          <span
            className={`mt-0.5 shrink-0 ${
              active ? "text-white" : "text-[var(--aloha-green)] group-hover:text-white"
            }`}
          >
            {navBarIcon(node.name)}
          </span>
        ) : null}
        <span className="min-w-0 flex-1 line-clamp-2 break-words">{label}</span>
      </span>
      <span className="flex shrink-0 items-center gap-1 pt-0.5">
        {hasKids ? (
          <ChevronRight
            size={14}
            className={active ? "text-white/80" : "text-slate-400 group-hover:text-white/80"}
          />
        ) : null}
      </span>
    </Link>
  );
}

/** Panel nhiều cột — mỗi cột cùng rộng + cao tối đa, dài thì cuộn */
function MultiColumnFlyout({
  root,
  hoverPath,
  onHoverPath,
  onNavigate,
}: {
  root: ShopCategoryNavNode;
  hoverPath: ShopCategoryNavNode[];
  onHoverPath: (path: ShopCategoryNavNode[]) => void;
  onNavigate?: () => void;
}) {
  const columns = useMemo(() => {
    const cols: ShopCategoryNavNode[][] = [nodeSubs(root)];
    for (let i = 0; i < hoverPath.length; i++) {
      const subs = nodeSubs(hoverPath[i]);
      if (subs.length) cols.push(subs);
    }
    return cols;
  }, [root, hoverPath]);

  return (
    <div className="flex overflow-hidden rounded-xl border border-[var(--aloha-line)] bg-white shadow-xl">
      {columns.map((items, colIdx) => {
        const activeNode = hoverPath[colIdx] ?? null;
        const isFirst = colIdx === 0;
        return (
          <div
            key={colIdx}
            className={`${FLYOUT_COL_CLASS} ${
              colIdx < columns.length - 1 ? "border-r border-[var(--aloha-line)]" : ""
            }`}
          >
            {isFirst ? (
              <Link
                href={categoryHref(root)}
                onClick={onNavigate}
                title={root.name}
                className="shrink-0 border-b border-[var(--aloha-line)] bg-white px-4 py-2 text-sm font-bold leading-snug text-[var(--aloha-green)] hover:bg-[var(--aloha-green-light)] hover:underline"
              >
                <span className="line-clamp-2 break-words">
                  Tất cả {navBarLabel(root.name)}
                </span>
              </Link>
            ) : null}
            <div className={FLYOUT_SCROLL_CLASS}>
              {items.map((node) => (
                <FlyoutRow
                  key={node.id}
                  node={node}
                  active={activeNode?.id === node.id}
                  onHover={() => onHoverPath([...hoverPath.slice(0, colIdx), node])}
                  onNavigate={onNavigate}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/**
 * Gộp UI trên navbar (data/tree không đổi):
 * - Giá thể: chèn Hạt giống dưới «THUỐC VÀ DINH DƯỠNG CHO CÂY»
 * - Phụ kiện: chèn Dụng cụ + Túi hộp dưới «PHỤ KIỆN TIỂU CẢNH»
 */
const NAV_UI_MERGE_GROUPS = [
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

function findNavMergeGroup(name: string) {
  return NAV_UI_MERGE_GROUPS.find((g) => nameMatchesAny(name, g.memberNames)) || null;
}

/** Chèn node vào danh sách UI ngay sau mục neo (không tìm thấy → cuối danh sách). */
function injectNodesAfter(
  items: ShopCategoryNavNode[],
  afterName: string,
  extras: ShopCategoryNavNode[]
): ShopCategoryNavNode[] {
  if (!extras.length) return items;
  const existing = new Set(items.map((n) => n.id));
  const toAdd = extras.filter((n) => !existing.has(n.id));
  if (!toAdd.length) return items;
  const idx = items.findIndex((n) => nameMatchesAny(n.name, [afterName]));
  if (idx < 0) return [...items, ...toAdd];
  return [...items.slice(0, idx + 1), ...toAdd, ...items.slice(idx + 1)];
}

function buildUiFlyoutRoot(
  primary: ShopCategoryNavNode,
  injectAfterName: string,
  injectNodes: ShopCategoryNavNode[]
): ShopCategoryNavNode {
  const subs = injectNodesAfter(nodeSubs(primary), injectAfterName, injectNodes);
  return {
    ...primary,
    hasChild: subs.length > 0,
    subs,
  };
}

type NavSlot =
  | { kind: "node"; node: ShopCategoryNavNode }
  | {
      kind: "merge";
      id: string;
      label: string;
      primary: ShopCategoryNavNode;
      flyoutRoot: ShopCategoryNavNode;
    };

function buildNavSlots(tree: ShopCategoryNavNode[]): NavSlot[] {
  const slots: NavSlot[] = [];
  const usedGroups = new Set<string>();

  for (const node of tree) {
    const group = findNavMergeGroup(node.name);
    if (!group) {
      slots.push({ kind: "node", node });
      continue;
    }
    if (usedGroups.has(group.id)) continue;
    usedGroups.add(group.id);

    const members = tree.filter((n) => nameMatchesAny(n.name, group.memberNames));
    const primary =
      members.find((n) => nameMatchesAny(n.name, [group.primaryName])) || members[0];
    if (!primary) continue;

    const injectNodes = members.filter((n) => n.id !== primary.id);
    if (!injectNodes.length) {
      slots.push({ kind: "node", node: primary });
      continue;
    }

    slots.push({
      kind: "merge",
      id: group.id,
      label: group.label,
      primary,
      flyoutRoot: buildUiFlyoutRoot(primary, group.injectAfterName, injectNodes),
    });
  }
  return slots;
}

function NavItemButton({
  node,
  open,
  onOpen,
  onClose,
  hoverPath,
  onHoverPath,
  onNavigate,
}: {
  node: ShopCategoryNavNode;
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  hoverPath: ShopCategoryNavNode[];
  onHoverPath: (path: ShopCategoryNavNode[]) => void;
  onNavigate?: () => void;
}) {
  const hasKids = nodeSubs(node).length > 0;
  return (
    <div
      className="relative flex h-full min-w-0 flex-1 items-stretch"
      onMouseEnter={() => {
        if (hasKids) onOpen();
      }}
      onMouseLeave={onClose}
    >
      <Link
        href={categoryHref(node)}
        onClick={onNavigate}
        className={`group relative inline-flex h-full w-full min-w-0 items-center justify-center gap-1 px-1.5 text-[14px] font-semibold leading-tight text-[var(--aloha-ink)] transition-colors hover:text-[var(--aloha-green)] sm:gap-1.5 sm:px-2 sm:text-[15px] xl:text-base ${
          open ? "text-[var(--aloha-green)]" : ""
        }`}
        title={node.name}
      >
        <span className="shrink-0 text-[var(--aloha-muted)] group-hover:text-[var(--aloha-green)]">
          {navBarIcon(node.name)}
        </span>
        <span className="truncate">{navBarLabel(node.name)}</span>
        {hasKids ? (
          <ChevronDown
            size={13}
            strokeWidth={2.25}
            className={`shrink-0 opacity-70 transition-transform ${
              open ? "rotate-180" : ""
            }`}
            aria-hidden
          />
        ) : null}
        <span
          className={`pointer-events-none absolute inset-x-2 bottom-0 h-[2.5px] rounded-full bg-[var(--aloha-green)] transition-opacity ${
            open ? "opacity-100" : "opacity-0 group-hover:opacity-100"
          }`}
          aria-hidden
        />
      </Link>
      {hasKids && open ? (
        <div className="absolute left-0 top-full z-[70] pt-1.5">
          <MultiColumnFlyout
            root={node}
            hoverPath={hoverPath}
            onHoverPath={onHoverPath}
            onNavigate={onNavigate}
          />
        </div>
      ) : null}
    </div>
  );
}

/** Mục navbar gộp UI — flyout của nhóm chính + chèn mục phụ vào cột 1. */
function MergedGroupNavItem({
  label,
  primary,
  flyoutRoot,
  open,
  onOpen,
  onClose,
  hoverPath,
  onHoverPath,
  onNavigate,
}: {
  label: string;
  primary: ShopCategoryNavNode;
  flyoutRoot: ShopCategoryNavNode;
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  hoverPath: ShopCategoryNavNode[];
  onHoverPath: (path: ShopCategoryNavNode[]) => void;
  onNavigate?: () => void;
}) {
  const hasFlyout = nodeSubs(flyoutRoot).length > 0;
  return (
    <div
      className="relative flex h-full min-w-0 flex-1 items-stretch"
      onMouseEnter={() => {
        if (hasFlyout) onOpen();
      }}
      onMouseLeave={onClose}
    >
      <Link
        href={categoryHref(primary)}
        onClick={onNavigate}
        className={`group relative inline-flex h-full w-full min-w-0 items-center justify-center gap-1 px-1.5 text-[14px] font-semibold leading-tight text-[var(--aloha-ink)] transition-colors hover:text-[var(--aloha-green)] sm:gap-1.5 sm:px-2 sm:text-[15px] xl:text-base ${
          open ? "text-[var(--aloha-green)]" : ""
        }`}
        title={primary.name}
      >
        <span className="shrink-0 text-[var(--aloha-muted)] group-hover:text-[var(--aloha-green)]">
          {navBarIcon(primary.name)}
        </span>
        <span className="truncate">{label}</span>
        {hasFlyout ? (
          <ChevronDown
            size={13}
            strokeWidth={2.25}
            className={`shrink-0 opacity-70 transition-transform ${open ? "rotate-180" : ""}`}
            aria-hidden
          />
        ) : null}
        <span
          className={`pointer-events-none absolute inset-x-2 bottom-0 h-[2.5px] rounded-full bg-[var(--aloha-green)] transition-opacity ${
            open ? "opacity-100" : "opacity-0 group-hover:opacity-100"
          }`}
          aria-hidden
        />
      </Link>
      {hasFlyout && open ? (
        <div className="absolute left-0 top-full z-[70] pt-1.5">
          <MultiColumnFlyout
            root={flyoutRoot}
            hoverPath={hoverPath}
            onHoverPath={onHoverPath}
            onNavigate={onNavigate}
          />
        </div>
      ) : null}
    </div>
  );
}

/** Navbar ngang — gộp UI Giá thể / Phụ kiện (chèn mục phụ trong dropdown); còn lại từng mục. */
export function CategoryNavBar({
  tree,
  onNavigate,
  className = "",
}: {
  tree: ShopCategoryNavNode[];
  onNavigate?: () => void;
  className?: string;
}) {
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [hoverPath, setHoverPath] = useState<ShopCategoryNavNode[]>([]);
  const slots = useMemo(() => buildNavSlots(tree), [tree]);

  if (!tree.length) return null;

  return (
    <div className={`relative min-w-0 flex-1 overflow-visible ${className}`}>
      <div className="flex h-12 w-full flex-nowrap items-stretch overflow-visible">
        {slots.map((slot) => {
          if (slot.kind === "merge") {
            const key = slot.id;
            return (
              <MergedGroupNavItem
                key={key}
                label={slot.label}
                primary={slot.primary}
                flyoutRoot={slot.flyoutRoot}
                open={openKey === key}
                onOpen={() => {
                  setOpenKey(key);
                  setHoverPath([]);
                }}
                onClose={() => {
                  setOpenKey((k) => (k === key ? null : k));
                  setHoverPath([]);
                }}
                hoverPath={openKey === key ? hoverPath : []}
                onHoverPath={setHoverPath}
                onNavigate={onNavigate}
              />
            );
          }
          const node = slot.node;
          return (
            <NavItemButton
              key={node.id}
              node={node}
              open={openKey === String(node.id)}
              onOpen={() => {
                setOpenKey(String(node.id));
                setHoverPath([]);
              }}
              onClose={() => {
                setOpenKey((k) => (k === String(node.id) ? null : k));
                setHoverPath([]);
              }}
              hoverPath={openKey === String(node.id) ? hoverPath : []}
              onHoverPath={setHoverPath}
              onNavigate={onNavigate}
            />
          );
        })}
      </div>
    </div>
  );
}

/** Thứ tự 9 nhánh mẹ trên rail mobile (không gộp như desktop). */
const MOBILE_ROOT_ORDER = [
  "CÂY CẢNH ĐỦ LOẠI",
  "CHẬU TRỒNG CÂY",
  "BÌNH CẮM HOA",
  "ĐẤT ĐÁ GIÁ THỂ DINH DƯỠNG TRỒNG CÂY",
  "HẠT GIỐNG",
  "PHỤ KIỆN TRANG TRÍ",
  "ĐĨA LÓT CHẬU",
  "DỤNG CỤ TRỒNG CÂY",
  "TÚI VÀ HỘP ĐỂ SẢN PHẨM",
] as const;

const MOBILE_CAT_ACTIVE_KEY = "aloha:mobile-cat-active";

function orderMobileRoots(tree: ShopCategoryNavNode[]): ShopCategoryNavNode[] {
  const used = new Set<number>();
  const ordered: ShopCategoryNavNode[] = [];
  for (const name of MOBILE_ROOT_ORDER) {
    const hit = tree.find(
      (n) => !used.has(n.id) && nameMatchesAny(n.name, [name])
    );
    if (hit) {
      used.add(hit.id);
      ordered.push(hit);
    }
  }
  for (const n of tree) {
    if (used.has(n.id)) continue;
    // Bỏ Khác / Vật tư / Quà khỏi rail chính
    if (
      nameMatchesAny(n.name, ["KHÁC", "VẬT TƯ VÀ THIẾT BỊ", "QUÀ TẶNG CÂY"])
    ) {
      continue;
    }
    ordered.push(n);
  }
  return ordered;
}

function mobileTileSrc(node: ShopCategoryNavNode): string {
  if (isPhongThuyL3(node)) return navIllustrationSrc(node.name);
  return String(node.image || "").trim();
}

function mobileTileHasImage(node: ShopCategoryNavNode): boolean {
  return Boolean(mobileTileSrc(node));
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
function mobileCatLabel(name: string): string {
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

function MobileCatTile({
  node,
  onNavigate,
}: {
  node: ShopCategoryNavNode;
  onNavigate?: () => void;
}) {
  const [imgFailed, setImgFailed] = useState(false);
  const src = mobileTileSrc(node);
  if (!src || imgFailed) return null;

  return (
    <Link
      href={categoryHref(node)}
      onClick={onNavigate}
      className="flex flex-col items-center gap-1.5 text-center"
    >
      {/* Ảnh nhỏ — bo góc nhẹ như TGDĐ */}
      <span className="flex h-[3.5rem] w-[3.5rem] shrink-0 items-center justify-center overflow-hidden rounded-md">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt=""
          className="max-h-full max-w-full rounded-md object-contain"
          loading="lazy"
          onError={() => setImgFailed(true)}
        />
      </span>
      <span className="line-clamp-2 min-h-[2.5em] w-full px-0.5 text-[11px] font-normal leading-[1.25] text-[#333]">
        {mobileCatLabel(node.name)}
      </span>
    </Link>
  );
}

/** Mobile — rail 9 mẹ trái + lưới ảnh/chữ phải (kiểu TGDĐ). */
export function CategoryMobileNav({
  tree,
  onNavigate,
}: {
  tree: ShopCategoryNavNode[];
  onNavigate?: () => void;
}) {
  const roots = useMemo(() => orderMobileRoots(tree), [tree]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const rightRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!roots.length) return;
    let saved: number | null = null;
    try {
      const raw = sessionStorage.getItem(MOBILE_CAT_ACTIVE_KEY);
      const n = Number(raw);
      if (Number.isFinite(n) && roots.some((r) => r.id === n)) saved = n;
    } catch {
      /* ignore */
    }
    setActiveId(saved ?? roots[0].id);
  }, [roots]);

  useEffect(() => {
    if (activeId == null) return;
    try {
      sessionStorage.setItem(MOBILE_CAT_ACTIVE_KEY, String(activeId));
    } catch {
      /* ignore */
    }
    rightRef.current?.scrollTo({ top: 0 });
  }, [activeId]);

  const active = roots.find((r) => r.id === activeId) || roots[0] || null;
  if (!roots.length || !active) return null;

  const l2 = nodeSubs(active);
  const leafOnly = l2
    .filter((n) => !nodeSubs(n).length)
    .filter(mobileTileHasImage)
    .slice(0, 9);
  const withKids = l2
    .map((section) => ({
      section,
      kids: nodeSubs(section).filter(mobileTileHasImage).slice(0, 9),
    }))
    .filter((x) => x.kids.length > 0);
  const rootLeafTile = !l2.length && mobileTileHasImage(active);
  const hasGrid =
    withKids.length > 0 || leafOnly.length > 0 || rootLeafTile;

  return (
    <div className="flex h-full min-h-0 flex-1 overflow-hidden bg-[#F3F4F6]">
      {/* Rail trái — ~28%, xám / trắng khi chọn (TGDĐ) */}
      <nav
        className="w-[28%] max-w-[6.75rem] shrink-0 overflow-y-auto overscroll-contain"
        aria-label="Nhóm hàng"
      >
        {roots.map((node) => {
          const selected = node.id === active.id;
          return (
            <button
              key={node.id}
              type="button"
              onClick={() => setActiveId(node.id)}
              className={`relative flex min-h-[3.5rem] w-full flex-col items-center justify-center gap-1 px-1 py-2.5 text-center transition-colors ${
                selected
                  ? "bg-white text-[#222]"
                  : "bg-transparent text-[#666]"
              }`}
              aria-current={selected ? "true" : undefined}
            >
              {selected ? (
                <span
                  className="absolute inset-y-2 left-0 w-[3px] rounded-r bg-[var(--aloha-green)]"
                  aria-hidden
                />
              ) : null}
              <span className={selected ? "text-[var(--aloha-green)]" : "text-[#888]"}>
                {navBarIcon(node.name)}
              </span>
              <span
                className={`line-clamp-2 px-0.5 text-[11px] leading-tight ${
                  selected ? "font-bold" : "font-medium"
                }`}
              >
                {navBarLabel(node.name)}
              </span>
            </button>
          );
        })}
      </nav>

      {/* Cột phải */}
      <div
        ref={rightRef}
        className="min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain bg-white px-3 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3"
      >
        {withKids.map(({ section, kids }) => {
          return (
            <section key={section.id} className="mb-6">
              <div className="mb-3 flex items-baseline justify-between gap-2">
                <h3 className="min-w-0 truncate text-[16px] font-extrabold text-[#222]">
                  {mobileCatLabel(section.name)}
                </h3>
                <Link
                  href={categoryHref(section)}
                  onClick={onNavigate}
                  className="shrink-0 text-[12px] font-normal text-[#999]"
                >
                  Xem tất cả &gt;
                </Link>
              </div>
              <div className="grid grid-cols-3 gap-x-1 gap-y-5">
                {kids.map((leaf) => (
                  <MobileCatTile
                    key={leaf.id}
                    node={leaf}
                    onNavigate={onNavigate}
                  />
                ))}
              </div>
            </section>
          );
        })}

        {leafOnly.length ? (
          <section className="mb-6">
            {withKids.length ? (
              <div className="mb-3 flex items-baseline justify-between gap-2">
                <h3 className="text-[15px] font-bold text-[#222]">Khác</h3>
                <Link
                  href={categoryHref(active)}
                  onClick={onNavigate}
                  className="shrink-0 text-[12px] font-normal text-[#999]"
                >
                  Xem tất cả &gt;
                </Link>
              </div>
            ) : (
              <div className="mb-3 flex items-baseline justify-between gap-2">
                <h3 className="min-w-0 truncate text-[15px] font-bold text-[#222]">
                  {mobileCatLabel(active.name)}
                </h3>
                <Link
                  href={categoryHref(active)}
                  onClick={onNavigate}
                  className="shrink-0 text-[12px] font-normal text-[#999]"
                >
                  Xem tất cả &gt;
                </Link>
              </div>
            )}
            <div className="grid grid-cols-3 gap-x-1 gap-y-5">
              {leafOnly.map((leaf) => (
                <MobileCatTile
                  key={leaf.id}
                  node={leaf}
                  onNavigate={onNavigate}
                />
              ))}
            </div>
          </section>
        ) : null}

        {/* Nhóm mẹ lá (Bình hoa, Hạt giống): 1 ảnh kho + xem tất cả */}
        {rootLeafTile ? (
          <section className="mb-6">
            <div className="mb-3 flex items-baseline justify-between gap-2">
              <h3 className="min-w-0 truncate text-[15px] font-bold text-[#222]">
                {mobileCatLabel(active.name)}
              </h3>
              <Link
                href={categoryHref(active)}
                onClick={onNavigate}
                className="shrink-0 text-[12px] font-normal text-[#999]"
              >
                Xem tất cả &gt;
              </Link>
            </div>
            <div className="grid grid-cols-3 gap-x-1 gap-y-5">
              <MobileCatTile node={active} onNavigate={onNavigate} />
            </div>
          </section>
        ) : null}

        {!hasGrid ? (
          <div className="flex flex-col items-center gap-3 py-10 text-center">
            <p className="text-sm text-[#888]">Chưa có danh mục con để hiển thị.</p>
            <Link
              href={categoryHref(active)}
              onClick={onNavigate}
              className="text-sm font-semibold text-[var(--aloha-green)]"
            >
              Xem tất cả sản phẩm &gt;
            </Link>
          </div>
        ) : null}
      </div>
    </div>
  );
}
