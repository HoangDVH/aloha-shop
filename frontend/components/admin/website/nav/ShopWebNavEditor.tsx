"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Eye,
  EyeOff,
  GripVertical,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { textMatchesQuery } from "@/components/admin/utils/productSearch";
import type { NavConfig } from "../api";
import { WbBtn, WbField, wbInput, wbSelect } from "../ui";

export type CatNode = {
  id?: number;
  name: string;
  path?: string;
  slug?: string;
  count?: number;
  subs?: CatNode[];
};

export function flattenCats(
  nodes: CatNode[],
  out: { path: string; name: string; depth: number }[] = [],
  depth = 0
) {
  for (const n of nodes) {
    const path = String(n.path || n.name || "").trim();
    if (path) out.push({ path, name: n.name || path, depth });
    if (n.subs?.length) flattenCats(n.subs, out, depth + 1);
  }
  return out;
}

function countNodes(nodes: CatNode[]): number {
  let n = 0;
  for (const c of nodes) {
    n += 1;
    if (c.subs?.length) n += countNodes(c.subs);
  }
  return n;
}

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

function newId() {
  return `nav_${Math.random().toString(36).slice(2, 9)}`;
}

function CatTreeRow({
  node,
  depth,
  expanded,
  setExpanded,
  hiddenSet,
  onToggleVisible,
}: {
  node: CatNode;
  depth: number;
  expanded: Record<string, boolean>;
  setExpanded: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  hiddenSet: Set<string>;
  onToggleVisible: (path: string) => void;
}) {
  const path = String(node.path || node.name || "").trim();
  const hasChildren = !!(node.subs && node.subs.length > 0);
  const isOpen = !!expanded[path];
  const visible = path ? !hiddenSet.has(path) : true;

  return (
    <div>
      <div
        className={`flex items-center gap-1 rounded-md py-1.5 pr-2 transition ${
          visible ? "hover:bg-[#F0F7FF]" : "opacity-70 hover:bg-gray-50"
        }`}
        style={{ paddingLeft: depth * 16 + 8 }}
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
          tabIndex={hasChildren ? 0 : -1}
          aria-label={hasChildren ? (isOpen ? "Thu gọn" : "Mở rộng") : undefined}
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

        <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            checked={visible}
            onChange={() => path && onToggleVisible(path)}
            className="h-[15px] w-[15px] shrink-0 cursor-pointer accent-[#0070e0]"
            title={visible ? "Đang hiện trên menu — bấm để ẩn" : "Đang ẩn — bấm để hiện"}
          />
          <span
            className={`min-w-0 flex-1 truncate text-[13px] ${
              depth === 0 ? "font-semibold" : "font-normal"
            } ${visible ? "text-gray-800" : "text-gray-400 line-through"}`}
          >
            {node.name}
          </span>
          {typeof node.count === "number" ? (
            <span className="shrink-0 text-[11px] tabular-nums text-gray-400">
              ({node.count.toLocaleString("vi-VN")})
            </span>
          ) : null}
        </label>
      </div>

      {hasChildren && isOpen
        ? node.subs!.map((child) => (
            <CatTreeRow
              key={String(child.path || child.name)}
              node={child}
              depth={depth + 1}
              expanded={expanded}
              setExpanded={setExpanded}
              hiddenSet={hiddenSet}
              onToggleVisible={onToggleVisible}
            />
          ))
        : null}
    </div>
  );
}

/** Panel menu — sidebar Giao diện (lưu qua Đồng bộ / Áp dụng). */
export function ShopNavPanel({
  nav,
  setNav,
  cats,
}: {
  nav: NavConfig;
  setNav: (next: NavConfig) => void;
  cats: CatNode[];
  accent?: string;
}) {
  const [q, setQ] = useState("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const filtered = useMemo(() => filterTree(cats, q), [cats, q]);
  const total = useMemo(() => countNodes(cats), [cats]);
  const hiddenSet = useMemo(
    () => new Set(nav.hiddenCategoryPaths || []),
    [nav.hiddenCategoryPaths]
  );

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

  const toggleHidden = (path: string) => {
    const set = new Set(nav.hiddenCategoryPaths);
    if (set.has(path)) set.delete(path);
    else set.add(path);
    setNav({ ...nav, hiddenCategoryPaths: [...set] });
  };

  const expandAll = () => {
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
    mark(cats);
    setExpanded(next);
  };

  const collapseAll = () => setExpanded({});

  return (
    <div className="space-y-5">
      <p className="text-[12px] leading-relaxed text-gray-500">
        Tick = hiện trên menu web. Bỏ tick = ẩn khỏi menu (SP vẫn tìm được). Muốn ẩn hẳn SP →
        tab <span className="font-medium text-gray-700">Hàng hóa web</span>.
      </p>

      <div>
        <div className="mb-2 flex items-baseline justify-between gap-2">
          <h4 className="text-[13px] font-semibold text-gray-900">Nhóm hàng</h4>
          <span className="text-[11px] text-gray-400">{total} mục</span>
        </div>

        <div className="mb-2 flex items-center gap-1.5">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Tìm nhóm (vd: thanh pham)…"
              className={`${wbInput} !h-8 pl-8 text-xs`}
            />
          </div>
          <button
            type="button"
            onClick={expandAll}
            className="h-8 shrink-0 rounded-lg border-0 bg-gray-100 px-2 text-[11px] font-semibold text-gray-600 hover:bg-gray-200"
            style={{ border: "none" }}
          >
            Mở
          </button>
          <button
            type="button"
            onClick={collapseAll}
            className="h-8 shrink-0 rounded-lg border-0 bg-gray-100 px-2 text-[11px] font-semibold text-gray-600 hover:bg-gray-200"
            style={{ border: "none" }}
          >
            Đóng
          </button>
        </div>

        <div className="max-h-[320px] overflow-y-auto rounded-xl border border-gray-200 bg-white py-1">
          {filtered.length === 0 ? (
            <p className="px-3 py-8 text-center text-[12px] text-gray-400">
              {cats.length === 0 ? "Không tải được cây danh mục" : "Không khớp tìm kiếm"}
            </p>
          ) : (
            filtered.map((node) => (
              <CatTreeRow
                key={String(node.path || node.name)}
                node={node}
                depth={0}
                expanded={expanded}
                setExpanded={setExpanded}
                hiddenSet={hiddenSet}
                onToggleVisible={toggleHidden}
              />
            ))
          )}
        </div>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between gap-2">
          <h4 className="text-[13px] font-semibold text-gray-900">Mục tùy chỉnh</h4>
          <WbBtn
            variant="ghost"
            className="!h-7 !px-2 !text-xs text-[#3D6B3A] hover:bg-[#3D6B3A]/10"
            onClick={() =>
              setNav({
                ...nav,
                customItems: [
                  ...nav.customItems,
                  {
                    id: newId(),
                    label: "Mục mới",
                    href: "/",
                    position: "after",
                    enabled: true,
                  },
                ],
              })
            }
          >
            <Plus className="h-3.5 w-3.5" /> Thêm
          </WbBtn>
        </div>

        <ul className="space-y-2.5">
          {nav.customItems.length === 0 ? (
            <li className="rounded-xl border border-dashed border-gray-200 bg-gray-50/50 px-3 py-6 text-center text-[12px] text-gray-400">
              Chưa có mục (Combo, Liên hệ…)
            </li>
          ) : (
            nav.customItems.map((item, idx) => (
              <li
                key={item.id}
                className="space-y-2 rounded-xl border border-gray-200 bg-white p-3 shadow-sm"
              >
                <div className="flex items-center gap-2">
                  <input
                    className={`${wbInput} min-w-0 flex-1`}
                    value={item.label}
                    onChange={(e) => {
                      const customItems = [...nav.customItems];
                      customItems[idx] = { ...item, label: e.target.value };
                      setNav({ ...nav, customItems });
                    }}
                    placeholder="Nhãn"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const customItems = [...nav.customItems];
                      customItems[idx] = { ...item, enabled: !item.enabled };
                      setNav({ ...nav, customItems });
                    }}
                    className={`inline-flex h-9 shrink-0 items-center gap-1 rounded-lg border-0 px-2.5 text-[11px] font-semibold ${
                      item.enabled
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-gray-100 text-gray-500"
                    }`}
                    style={{ border: "none" }}
                  >
                    {item.enabled ? (
                      <>
                        <Eye className="h-3 w-3" /> Hiện
                      </>
                    ) : (
                      <>
                        <EyeOff className="h-3 w-3" /> Ẩn
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setNav({
                        ...nav,
                        customItems: nav.customItems.filter((x) => x.id !== item.id),
                      })
                    }
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border-0 text-gray-400 hover:bg-red-50 hover:text-red-600"
                    style={{ border: "none" }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <WbField label="Liên kết">
                  <input
                    className={`${wbInput} font-mono text-xs`}
                    value={item.href}
                    onChange={(e) => {
                      const customItems = [...nav.customItems];
                      customItems[idx] = { ...item, href: e.target.value };
                      setNav({ ...nav, customItems });
                    }}
                    placeholder="/tim?q=… hoặc https://…"
                  />
                </WbField>
                <WbField label="Vị trí">
                  <select
                    className={wbSelect}
                    value={String(item.position)}
                    onChange={(e) => {
                      const v = e.target.value;
                      const customItems = [...nav.customItems];
                      customItems[idx] = {
                        ...item,
                        position:
                          v === "before" || v === "after" ? v : Number(v) || "after",
                      };
                      setNav({ ...nav, customItems });
                    }}
                  >
                    <option value="before">Trước danh mục</option>
                    <option value="after">Sau danh mục</option>
                  </select>
                </WbField>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
}
