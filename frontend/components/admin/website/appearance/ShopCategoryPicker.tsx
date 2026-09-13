"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronRight, GripVertical, Search, X } from "lucide-react";
import { textMatchesQuery } from "@/components/admin/utils/productSearch";
import type { CatNode } from "../nav/ShopWebNavEditor";
import { flattenCats } from "../nav/ShopWebNavEditor";
import { wbInput } from "../ui";

function filterTree(nodes: CatNode[], q: string): CatNode[] {
  const needle = q.trim();
  if (!needle) return nodes;
  const walk = (list: CatNode[]): CatNode[] => {
    const out: CatNode[] = [];
    for (const node of list) {
      const kids = node.subs?.length ? walk(node.subs) : [];
      const hit =
        textMatchesQuery(String(node.name || ""), needle) ||
        textMatchesQuery(String(node.path || ""), needle);
      if (hit || kids.length) {
        out.push({ ...node, subs: kids.length ? kids : node.subs });
      }
    }
    return out;
  };
  return walk(nodes);
}

function findNodeById(nodes: CatNode[], id: number): CatNode | null {
  if (!(id > 0)) return null;
  for (const n of nodes) {
    if (Number(n.id) === id) return n;
    if (n.subs?.length) {
      const hit = findNodeById(n.subs, id);
      if (hit) return hit;
    }
  }
  return null;
}

function findNode(nodes: CatNode[], path: string): CatNode | null {
  const want = path.trim();
  for (const n of nodes) {
    const p = String(n.path || n.name || "").trim();
    if (p === want) return n;
    if (n.subs?.length) {
      const hit = findNode(n.subs, want);
      if (hit) return hit;
    }
  }
  return null;
}

function TreeRow({
  node,
  depth,
  selectedPath,
  expanded,
  setExpanded,
  onPick,
}: {
  node: CatNode;
  depth: number;
  selectedPath: string;
  expanded: Record<string, boolean>;
  setExpanded: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  onPick: (node: CatNode) => void;
}) {
  const path = String(node.path || node.name || "").trim();
  const hasChildren = !!(node.subs && node.subs.length);
  const isOpen = !!expanded[path];
  const selected = path === selectedPath;

  return (
    <div>
      <div
        className={`flex cursor-pointer items-center gap-1 rounded-md py-1.5 pr-2 transition ${
          selected ? "bg-[#e6f4ff]" : "hover:bg-gray-50"
        }`}
        style={{ paddingLeft: depth * 16 + 8 }}
        onClick={() => onPick(node)}
      >
        <button
          type="button"
          className="flex h-5 w-5 shrink-0 items-center justify-center border-0 bg-transparent text-gray-400"
          style={{ border: "none" }}
          onClick={(e) => {
            e.stopPropagation();
            if (!hasChildren) return;
            setExpanded((s) => ({ ...s, [path]: !s[path] }));
          }}
        >
          {hasChildren ? (
            isOpen ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" />
            )
          ) : (
            <GripVertical className="h-2.5 w-2.5 opacity-30" />
          )}
        </button>
        <input
          type="radio"
          checked={selected}
          readOnly
          className="h-[14px] w-[14px] shrink-0 accent-[#0070e0]"
          onClick={(e) => {
            e.stopPropagation();
            onPick(node);
          }}
        />
        <span
          className={`min-w-0 flex-1 truncate text-[13px] ${
            depth === 0 ? "font-semibold" : "font-normal"
          } ${selected ? "text-[#0070e0]" : "text-gray-800"}`}
        >
          {node.name}
        </span>
        {typeof node.count === "number" ? (
          <span className="shrink-0 text-[11px] tabular-nums text-gray-400">
            ({node.count.toLocaleString("vi-VN")})
          </span>
        ) : null}
      </div>
      {hasChildren && isOpen
        ? node.subs!.map((child) => (
            <TreeRow
              key={String(child.id || child.path || child.name)}
              node={child}
              depth={depth + 1}
              selectedPath={selectedPath}
              expanded={expanded}
              setExpanded={setExpanded}
              onPick={onPick}
            />
          ))
        : null}
    </div>
  );
}

/** Chọn 1 nhóm hàng — khóa chính categoryId (DB shop mới). */
export function ShopCategoryPicker({
  cats,
  valuePath,
  valueCategoryId,
  onChange,
  placeholder = "Chọn nhóm hàng",
}: {
  cats: CatNode[];
  valuePath?: string;
  valueCategoryId?: number;
  onChange: (picked: {
    categoryId: number;
    path: string;
    name: string;
    slug: string;
  }) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const wrapRef = useRef<HTMLDivElement>(null);

  const flat = useMemo(() => flattenCats(cats), [cats]);
  const selected = useMemo(() => {
    const byId = findNodeById(cats, Number(valueCategoryId) || 0);
    if (byId) return byId;
    return valuePath ? findNode(cats, valuePath) : null;
  }, [cats, valueCategoryId, valuePath]);
  const selectedPath = String(
    selected?.path || selected?.name || valuePath || ""
  ).trim();
  const filtered = useMemo(() => filterTree(cats, q), [cats, q]);

  const label =
    selected?.name ||
    (valuePath
      ? valuePath.includes(">>")
        ? valuePath.split(">>").pop()?.trim() || valuePath
        : valuePath
      : "");

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  useEffect(() => {
    if (!q.trim()) return;
    const next: Record<string, boolean> = {};
    const mark = (nodes: CatNode[]) => {
      for (const n of nodes) {
        const path = String(n.path || n.name || "").trim();
        if (n.subs?.length) {
          next[path] = true;
          mark(n.subs);
        }
      }
    };
    mark(filtered);
    setExpanded((s) => ({ ...s, ...next }));
  }, [q, filtered]);

  useEffect(() => {
    if (!selectedPath || !open) return;
    const next: Record<string, boolean> = {};
    const parts = selectedPath.split(/\s*>>\s*/).filter(Boolean);
    let acc = "";
    for (let i = 0; i < parts.length - 1; i++) {
      acc = acc ? `${acc} >> ${parts[i]}` : parts[i];
      next[acc] = true;
    }
    setExpanded((s) => ({ ...s, ...next }));
  }, [selectedPath, open]);

  const clear = () => onChange({ categoryId: 0, path: "", name: "", slug: "" });

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`${wbInput} flex items-center justify-between gap-2 text-left`}
        style={{ borderStyle: "solid" }}
      >
        <span className={`min-w-0 flex-1 truncate ${label ? "text-gray-900" : "text-gray-400"}`}>
          {label || placeholder}
        </span>
        <span className="flex shrink-0 items-center gap-1 text-gray-400">
          {selectedPath || (Number(valueCategoryId) || 0) > 0 ? (
            <span
              role="button"
              tabIndex={0}
              className="rounded p-0.5 hover:bg-gray-100 hover:text-gray-700"
              onClick={(e) => {
                e.stopPropagation();
                clear();
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  e.stopPropagation();
                  clear();
                }
              }}
            >
              <X className="h-3.5 w-3.5" />
            </span>
          ) : null}
          <ChevronDown className={`h-4 w-4 transition ${open ? "rotate-180" : ""}`} />
        </span>
      </button>

      {open ? (
        <div className="absolute left-0 right-0 z-30 mt-1 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg">
          <div className="border-b border-gray-100 p-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
              <input
                autoFocus
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Tìm nhóm (vd: thanh pham)…"
                className={`${wbInput} !h-8 pl-8 text-xs`}
              />
            </div>
            <p className="mt-1.5 px-0.5 text-[11px] text-gray-400">
              {flat.length} nhóm · chọn theo categoryId (DB shop)
            </p>
          </div>
          <div className="max-h-56 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <p className="px-3 py-6 text-center text-[12px] text-gray-400">
                {cats.length === 0 ? "Không tải được danh mục" : "Không khớp tìm kiếm"}
              </p>
            ) : (
              filtered.map((node) => (
                <TreeRow
                  key={String(node.id || node.path || node.name)}
                  node={node}
                  depth={0}
                  selectedPath={selectedPath}
                  expanded={expanded}
                  setExpanded={setExpanded}
                  onPick={(n) => {
                    const path = String(n.path || n.name || "").trim();
                    onChange({
                      categoryId: Number(n.id) || 0,
                      path,
                      name: String(n.name || path),
                      slug: String(n.slug || ""),
                    });
                    setOpen(false);
                    setQ("");
                  }}
                />
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
