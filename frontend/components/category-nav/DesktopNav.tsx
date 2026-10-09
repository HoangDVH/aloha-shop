"use client";

import Link from "next/link";
import React, { useMemo, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { categoryHref, type ShopCategoryNavNode } from "@/lib/api";
import {
  FLYOUT_COL_CLASS,
  FLYOUT_SCROLL_CLASS,
  navBarIcon,
  navBarLabel,
  nodeSubs,
  orderL2Nodes,
} from "./navLabels";
import { buildNavSlots } from "./navSlots";

export function FlyoutRow({
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
export function MultiColumnFlyout({
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
    const cols: ShopCategoryNavNode[][] = [orderL2Nodes(root.name, nodeSubs(root))];
    for (let i = 0; i < hoverPath.length; i++) {
      const subs = orderL2Nodes(hoverPath[i].name, nodeSubs(hoverPath[i]));
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

export function NavItemButton({
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
export function MergedGroupNavItem({
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
