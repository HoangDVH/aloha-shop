"use client";

import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
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

function foldKey(name: string): string {
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

function navBarLabel(name: string): string {
  return lookupNav(NAV_SHORT, name) || String(name || "").trim();
}

function navBarIcon(name: string): ReactNode {
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
}: {
  node: ShopCategoryNavNode;
  active: boolean;
  onHover: () => void;
  onNavigate?: () => void;
}) {
  const hasKids = nodeSubs(node).length > 0;
  const label = node.name;
  return (
    <Link
      href={categoryHref(node)}
      onClick={onNavigate}
      onMouseEnter={onHover}
      title={label}
      className={`group flex items-start justify-between gap-2 px-4 py-2 text-sm leading-snug ${
        active
          ? "bg-[var(--aloha-green)] font-semibold text-white"
          : "text-slate-700 hover:bg-[var(--aloha-green)] hover:text-white"
      }`}
    >
      <span className="min-w-0 flex-1 line-clamp-2 break-words">{label}</span>
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
                <span className="line-clamp-2 break-words">Tất cả {root.name}</span>
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
        className={`group relative inline-flex h-full w-full min-w-0 items-center justify-center gap-1 px-1.5 text-[12px] font-bold leading-tight text-[var(--aloha-green)] transition-colors hover:text-[var(--aloha-green-dark)] sm:gap-1.5 sm:px-2 sm:text-[13px] xl:text-[14px] ${
          open ? "text-[var(--aloha-green-dark)]" : ""
        }`}
        title={node.name}
      >
        <span className="shrink-0 text-[var(--aloha-green)]">
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

/** Navbar ngang — luôn hiện đủ danh mục, trải đều (không gạch dọc / «Thêm»). */
export function CategoryNavBar({
  tree,
  onNavigate,
  className = "",
}: {
  tree: ShopCategoryNavNode[];
  onNavigate?: () => void;
  className?: string;
}) {
  const [openId, setOpenId] = useState<number | null>(null);
  const [hoverPath, setHoverPath] = useState<ShopCategoryNavNode[]>([]);

  if (!tree.length) return null;

  return (
    <div className={`relative min-w-0 flex-1 overflow-visible ${className}`}>
      <div className="flex h-12 w-full flex-nowrap items-stretch overflow-visible">
        {tree.map((node) => (
          <NavItemButton
            key={node.id}
            node={node}
            open={openId === node.id}
            onOpen={() => {
              setOpenId(node.id);
              setHoverPath([]);
            }}
            onClose={() => {
              setOpenId((id) => (id === node.id ? null : id));
              setHoverPath([]);
            }}
            hoverPath={openId === node.id ? hoverPath : []}
            onHoverPath={setHoverPath}
            onNavigate={onNavigate}
          />
        ))}
      </div>
    </div>
  );
}

/** Mobile — danh sách nhánh mẹ, bấm mở con (đệ quy) */
function MobileTreeNode({
  node,
  depth,
  onNavigate,
}: {
  node: ShopCategoryNavNode;
  depth: number;
  onNavigate?: () => void;
}) {
  const subs = nodeSubs(node);
  const hasKids = subs.length > 0;
  const [open, setOpen] = useState(false);

  return (
    <div className={depth === 0 ? "rounded-lg border border-[var(--aloha-line)]/80" : ""}>
      <div className="flex items-center" style={{ paddingLeft: depth > 0 ? depth * 12 : 0 }}>
        <Link
          href={categoryHref(node)}
          onClick={onNavigate}
          title={node.name}
          className={`flex min-w-0 flex-1 items-center gap-2.5 py-2.5 text-sm leading-snug ${
            depth === 0
              ? "px-3 font-semibold text-[var(--aloha-ink)]"
              : "px-4 text-slate-700"
          }`}
        >
          {depth === 0 ? (
            <span className="text-[var(--aloha-green)]">{navBarIcon(node.name)}</span>
          ) : null}
          <span className="line-clamp-2 break-words">
            {depth === 0 ? navBarLabel(node.name) : node.name}
          </span>
        </Link>
        {hasKids ? (
          <button
            type="button"
            className="px-3 py-2.5 text-[var(--aloha-green)]"
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? "Thu gọn" : "Mở nhóm con"}
          >
            <ChevronDown size={16} className={open ? "rotate-180" : ""} />
          </button>
        ) : null}
      </div>
      {hasKids && open ? (
        <div className={depth === 0 ? "border-t border-[var(--aloha-line)] bg-[var(--aloha-cream)] py-1" : "pb-1"}>
          {subs.map((ch) => (
            <MobileTreeNode key={ch.id} node={ch} depth={depth + 1} onNavigate={onNavigate} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function CategoryMobileNav({
  tree,
  onNavigate,
}: {
  tree: ShopCategoryNavNode[];
  onNavigate?: () => void;
}) {
  if (!tree.length) return null;

  return (
    <div className="flex flex-col gap-1">
      <Link
        href="/tim"
        onClick={onNavigate}
        className="rounded-lg px-3 py-2.5 text-sm font-semibold text-[var(--aloha-green)] hover:bg-[var(--aloha-green-light)]"
      >
        Tất cả sản phẩm
      </Link>
      {tree.map((node) => (
        <MobileTreeNode key={node.id} node={node} depth={0} onNavigate={onNavigate} />
      ))}
    </div>
  );
}
