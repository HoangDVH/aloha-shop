"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { categoryHref, type ShopCategoryNavNode } from "@/lib/api";

/** Cột flyout — cố định, mọi cấp bằng nhau */
const FLYOUT_COL_CLASS = "flex w-[260px] shrink-0 flex-col";
const FLYOUT_SCROLL_CLASS = "max-h-[min(70vh,420px)] overflow-y-auto overscroll-contain py-1";

function nodeSubs(node: ShopCategoryNavNode): ShopCategoryNavNode[] {
  return node.subs || [];
}

const NAV_LABELS: Record<string, string> = {
  "CHẬU TRỒNG CÂY": "Chậu cây",
  "CÂY CẢNH ĐỦ LOẠI": "Cây cảnh",
  "ĐẤT ĐÁ GIÁ THỂ DINH DƯỠNG TRỒNG CÂY": "Giá thể",
  "TÚI VÀ HỘP ĐỂ SẢN PHẨM": "Túi & hộp",
  "VẬT TƯ VÀ THIẾT BỊ": "Vật tư",
  "PHỤ KIỆN TRANG TRÍ": "Phụ kiện",
  "DỤNG CỤ TRỒNG CÂY": "Dụng cụ",
  "ĐĨA LÓT CHẬU": "Đĩa lót",
  "HẠT GIỐNG": "Hạt giống",
  "BÌNH CẮM HOA": "Bình cắm",
};

function normKey(name: string): string {
  return String(name || "")
    .trim()
    .replace(/\s+/g, " ")
    .toUpperCase();
}

function titleCaseVi(raw: string): string {
  const s = String(raw || "").trim();
  if (!s) return s;
  return s
    .toLowerCase()
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/** Nhãn navbar — cùng kiểu chữ, không lệch HOA/to nhỏ. */
function navLabel(name: string): string {
  const key = normKey(name);
  return NAV_LABELS[key] || titleCaseVi(name);
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
  return (
    <Link
      href={categoryHref(node)}
      onClick={onNavigate}
      onMouseEnter={onHover}
      className={`flex items-center justify-between gap-2 px-4 py-2 text-sm ${
        active
          ? "bg-[var(--aloha-green-light)] font-semibold text-[var(--aloha-green)]"
          : "text-slate-700 hover:bg-[var(--aloha-green-light)] hover:text-[var(--aloha-green)]"
      }`}
    >
      <span className="min-w-0 truncate">{node.name}</span>
      <span className="flex shrink-0 items-center gap-1">
        {hasKids ? <ChevronRight size={14} className="text-slate-400" /> : null}
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
    <div className="flex overflow-hidden rounded-xl border border-[#E5DFD2] bg-white shadow-xl">
      {columns.map((items, colIdx) => {
        const activeNode = hoverPath[colIdx] ?? null;
        const isFirst = colIdx === 0;
        return (
          <div
            key={colIdx}
            className={`${FLYOUT_COL_CLASS} ${
              colIdx < columns.length - 1 ? "border-r border-[#E5DFD2]" : ""
            }`}
          >
            {isFirst ? (
              <Link
                href={categoryHref(root)}
                onClick={onNavigate}
                className="shrink-0 border-b border-[#E5DFD2] px-4 py-2 text-sm font-bold text-[var(--aloha-green)] hover:bg-[#F7F3EA]"
              >
                Tất cả {root.name}
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

/** Navbar ngang — nhánh mẹ + flyout nhiều cột khi hover */
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

  const openNode = tree.find((n) => n.id === openId) ?? null;

  return (
    <div className={`min-w-0 flex-1 overflow-visible ${className}`}>
      <div className="flex flex-wrap items-center gap-0.5 xl:gap-1">
        {tree.map((node) => {
          const hasKids = nodeSubs(node).length > 0;
          const open = openId === node.id;
          return (
            <div
              key={node.id}
              className="relative shrink-0"
              onMouseEnter={() => {
                if (hasKids) {
                  setOpenId(node.id);
                  setHoverPath([]);
                }
              }}
              onMouseLeave={() => {
                setOpenId((id) => (id === node.id ? null : id));
                setHoverPath([]);
              }}
            >
              <Link
                href={categoryHref(node)}
                onClick={onNavigate}
                className="inline-flex items-center gap-1 rounded-md px-2.5 py-2 text-[13px] font-semibold normal-case leading-none text-[var(--aloha-green)] hover:bg-[var(--aloha-green-light)] xl:text-[14px]"
                title={node.name}
              >
                <span className="whitespace-nowrap">{navLabel(node.name)}</span>
                {hasKids ? <ChevronDown size={13} className="shrink-0 opacity-70" /> : null}
              </Link>
              {hasKids && open && openNode ? (
                <div className="absolute left-0 top-full z-[70] pt-1.5">
                  <MultiColumnFlyout
                    root={openNode}
                    hoverPath={hoverPath}
                    onHoverPath={setHoverPath}
                    onNavigate={onNavigate}
                  />
                </div>
              ) : null}
            </div>
          );
        })}
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
    <div className={depth === 0 ? "rounded-lg border border-[#E5DFD2]/80" : ""}>
      <div className="flex items-center" style={{ paddingLeft: depth > 0 ? depth * 12 : 0 }}>
        <Link
          href={categoryHref(node)}
          onClick={onNavigate}
          className={`min-w-0 flex-1 py-2.5 text-sm ${
            depth === 0 ? "px-3 font-semibold text-[var(--aloha-green)]" : "px-4 text-slate-700"
          }`}
        >
          {depth === 0 ? navLabel(node.name) : titleCaseVi(node.name)}
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
        <div className={depth === 0 ? "border-t border-[#E5DFD2] bg-[#FAFAF7] py-1" : "pb-1"}>
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
