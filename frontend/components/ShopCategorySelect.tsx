"use client";

/**
 * Bộ chọn nhóm hàng shop — cùng UX/logic với tab Hàng hóa (KiotVietCategorySelect).
 * Khác biệt chính trước đây (portal + sync URL khi panel mở) làm tick nhóm con bị “nuốt”.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, ChevronRight, GripVertical, Search, X } from "lucide-react";
import { fetchCategoryTree, type ShopCategoryNavNode } from "@/lib/api";

type TreeNode = {
  id: string;
  name: string;
  fullPath: string;
  count: number;
  children: TreeNode[];
};

function normPath(raw: string): string {
  // Phải khớp `>>` (2 ký tự) — KHÔNG khớp từng `>` lẻ, kẻo "A >> B" thành "A >> >> B"
  // rồi tick lưu path khác path hiển thị → checkbox không sáng.
  return String(raw || "")
    .trim()
    .replace(/\s*(?:>>|▸)\s*/g, " >> ")
    .replace(/\s+/g, " ")
    .trim();
}

function foldVi(raw: string): string {
  return String(raw || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function navToTree(nodes: ShopCategoryNavNode[], prefix = ""): TreeNode[] {
  return (nodes || []).map((n) => {
    const fullPath = normPath(n.path || (prefix ? `${prefix} >> ${n.name}` : n.name));
    return {
      id: String(n.id ?? fullPath),
      name: String(n.name || ""),
      fullPath,
      count: Number(n.count) || 0,
      children: navToTree(n.subs || [], fullPath),
    };
  });
}

function isPathCovered(path: string, selected: Set<string>): boolean {
  if (selected.has(path)) return true;
  for (const sel of selected) {
    if (path.startsWith(sel + " >> ")) return true;
  }
  return false;
}

function catTextMatch(name: string, fullPath: string, query: string): boolean {
  const q = foldVi(query);
  if (!q) return true;
  const nameF = foldVi(name);
  const pathF = foldVi(fullPath);
  if (nameF.includes(q) || pathF.includes(q)) return true;
  const tokens = q.split(" ").filter(Boolean);
  if (tokens.length <= 1) return false;
  const hay = `${nameF} ${pathF}`;
  return tokens.every((t) => hay.includes(t));
}

function filterNodes(nodes: TreeNode[], query: string): TreeNode[] {
  if (!query.trim()) return nodes;
  return nodes.reduce<TreeNode[]>((acc, node) => {
    if (catTextMatch(node.name, node.fullPath, query)) {
      acc.push(node);
      return acc;
    }
    const kids = filterNodes(node.children, query);
    if (kids.length) acc.push({ ...node, children: kids });
    return acc;
  }, []);
}

function leafLabel(path: string): string {
  const parts = normPath(path).split(/\s*>>\s*/);
  return parts[parts.length - 1] || path;
}

function CategoryTreeRow({
  node,
  depth,
  isExpanded,
  isChecked,
  onToggle,
  onExpand,
  expandedNodes,
  selectedSet,
}: {
  node: TreeNode;
  depth: number;
  isExpanded: boolean;
  isChecked: boolean;
  onToggle: (node: TreeNode) => void;
  onExpand: (id: string, e: React.MouseEvent) => void;
  expandedNodes: Record<string, boolean>;
  selectedSet: Set<string>;
}) {
  const hasChildren = node.children.length > 0;

  return (
    <div>
      <div
        onClick={() => onToggle(node)}
        className="flex cursor-pointer select-none items-center rounded px-2 py-1.5 text-[13px] hover:bg-slate-50"
        style={{
          paddingLeft: depth * 18 + 8,
          background: isChecked ? "#e6f4ff" : "transparent",
        }}
      >
        <span
          className="mr-1 inline-flex h-4 w-4 shrink-0 items-center justify-center text-[#888]"
          onClick={(e) => {
            if (hasChildren) {
              e.stopPropagation();
              onExpand(node.id, e);
            }
          }}
        >
          {hasChildren ? (
            isExpanded ? (
              <ChevronDown size={14} />
            ) : (
              <ChevronRight size={14} />
            )
          ) : (
            <GripVertical size={10} className="opacity-30" />
          )}
        </span>

        <input
          type="checkbox"
          checked={isChecked}
          readOnly
          tabIndex={-1}
          className="pointer-events-none mr-2 h-[15px] w-[15px] shrink-0 accent-[#0070e0]"
        />

        <span className="flex min-w-0 flex-1 items-center justify-between gap-2">
          <span
            className="min-w-0 flex-1 break-words leading-snug"
            style={{
              fontWeight: depth === 0 ? 600 : 400,
              color: isChecked ? "#0070e0" : "#1f2937",
            }}
            title={node.fullPath}
          >
            {node.name}
          </span>
          <span className="shrink-0 self-start text-[11px] font-normal text-[#6b7280]">
            ({node.count.toLocaleString("vi-VN")})
          </span>
        </span>
      </div>

      {hasChildren && isExpanded
        ? node.children.map((child) => (
            <CategoryTreeRow
              key={child.fullPath || child.id}
              node={child}
              depth={depth + 1}
              isExpanded={!!expandedNodes[child.id]}
              isChecked={
                selectedSet.has(child.fullPath) ||
                isPathCovered(child.fullPath, selectedSet)
              }
              onToggle={onToggle}
              onExpand={onExpand}
              expandedNodes={expandedNodes}
              selectedSet={selectedSet}
            />
          ))
        : null}
    </div>
  );
}

export function ShopCategorySelect({
  value,
  onChange,
  placeholder = "Chọn nhóm hàng",
}: {
  value: string[];
  onChange: (paths: string[]) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({});
  const [tree, setTree] = useState<TreeNode[]>([]);
  const [treeBusy, setTreeBusy] = useState(false);
  const [tempSelected, setTempSelected] = useState<string[]>(() =>
    (value || []).map(normPath).filter(Boolean)
  );
  const [panelPos, setPanelPos] = useState<React.CSSProperties>({});
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const valueKey = (value || []).map(normPath).filter(Boolean).sort().join("|");

  // Giống Hàng hóa: chỉ nạp lại khi value thật sự đổi VÀ panel đang đóng
  useEffect(() => {
    if (open) return;
    setTempSelected((value || []).map(normPath).filter(Boolean));
  }, [valueKey, open]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open || tree.length) return;
    let cancelled = false;
    setTreeBusy(true);
    fetchCategoryTree()
      .then((res) => {
        if (!cancelled && res.items?.length) setTree(navToTree(res.items));
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setTreeBusy(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, tree.length]);

  const placePanel = useCallback(() => {
    if (!rootRef.current) return;
    const rect = rootRef.current.getBoundingClientRect();
    // Rộng hơn sidebar — tên nhóm dài (CÂY THÀNH PHẨM…) hiện đủ, giống Hàng hóa
    const width = Math.min(Math.max(rect.width, 520), Math.min(640, window.innerWidth - 16));
    const left = Math.min(Math.max(8, rect.left), window.innerWidth - width - 8);
    const spaceBelow = window.innerHeight - rect.bottom - 12;
    const spaceAbove = rect.top - 12;
    const openUp = spaceBelow < 300 && spaceAbove > spaceBelow;
    const maxH = Math.min(480, Math.max(260, openUp ? spaceAbove : spaceBelow));
    setPanelPos(
      openUp
        ? {
            position: "fixed",
            left,
            bottom: window.innerHeight - rect.top + 4,
            width,
            maxHeight: maxH,
            zIndex: 100000,
          }
        : {
            position: "fixed",
            left,
            top: rect.bottom + 4,
            width,
            maxHeight: maxH,
            zIndex: 100000,
          }
    );
  }, []);

  useEffect(() => {
    if (!open) return;
    placePanel();
    const onDoc = (e: MouseEvent) => {
      const path = typeof e.composedPath === "function" ? e.composedPath() : [];
      const t = e.target as Node;
      if (rootRef.current && (path.includes(rootRef.current) || rootRef.current.contains(t))) {
        return;
      }
      if (panelRef.current && (path.includes(panelRef.current) || panelRef.current.contains(t))) {
        return;
      }
      setOpen(false);
      setSearchQuery("");
    };
    window.addEventListener("resize", placePanel);
    window.addEventListener("scroll", placePanel, true);
    document.addEventListener("mousedown", onDoc);
    return () => {
      window.removeEventListener("resize", placePanel);
      window.removeEventListener("scroll", placePanel, true);
      document.removeEventListener("mousedown", onDoc);
    };
  }, [open, placePanel]);

  const displayedTree = useMemo(
    () => filterNodes(tree, searchQuery),
    [tree, searchQuery]
  );

  useEffect(() => {
    if (!open || !searchQuery.trim()) return;
    const expandMatched: Record<string, boolean> = {};
    const walk = (nodes: TreeNode[]) => {
      for (const n of nodes) {
        if (n.children.length) {
          expandMatched[n.id] = true;
          walk(n.children);
        }
      }
    };
    walk(displayedTree);
    setExpandedNodes((prev) => ({ ...prev, ...expandMatched }));
  }, [open, searchQuery, displayedTree]);

  const selectedSet = useMemo(
    () => new Set(tempSelected.map(normPath)),
    [tempSelected]
  );

  const toggleExpand = useCallback((id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedNodes((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  /** Giống tab Hàng hóa + bổ sung: tick con khi mẹ đang chọn → thu hẹp sang đúng con */
  const handleToggleSelectNode = useCallback((targetNode: TreeNode) => {
    const path = normPath(targetNode.fullPath);
    if (!path) return;
    setTempSelected((prev) => {
      const list = prev.map(normPath).filter(Boolean);
      const set = new Set(list);
      const exact = set.has(path);
      const covered = isPathCovered(path, set);

      if (exact) {
        return list.filter(
          (s) => s !== path && !s.startsWith(path + " >> ")
        );
      }

      if (covered) {
        // Mẹ đang bao phủ → bỏ mẹ, chọn đúng nhóm con đang bấm (Hàng hóa chỉ bỏ mẹ)
        return [
          ...list.filter(
            (s) =>
              s !== path &&
              !s.startsWith(path + " >> ") &&
              !path.startsWith(s + " >> ")
          ),
          path,
        ];
      }

      return [
        ...list.filter((s) => !s.startsWith(path + " >> ") && s !== path),
        path,
      ];
    });
  }, []);

  const handleApply = () => {
    onChange(tempSelected.map(normPath).filter(Boolean));
    setOpen(false);
    setSearchQuery("");
  };

  const handleClearAll = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setTempSelected([]);
    onChange([]);
    setOpen(false);
    setSearchQuery("");
  };

  const displayText = useMemo(() => {
    const sel = (value || []).map(normPath).filter(Boolean);
    if (!sel.length) return placeholder;
    if (sel.length === 1) return leafLabel(sel[0]);
    return `Đã chọn (${sel.length} nhóm hàng)`;
  }, [value, placeholder]);

  const panel =
    open && typeof document !== "undefined" ? (
      <div
        ref={panelRef}
        style={{
          ...panelPos,
          background: "#fff",
          border: "1px solid #d9d9d9",
          borderRadius: 6,
          boxShadow: "0 6px 16px rgba(0,0,0,0.15)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        <div className="flex shrink-0 items-center justify-between px-3 pb-1.5 pt-2.5">
          <div className="text-sm font-bold text-[#101828]">Nhóm hàng</div>
          <button
            type="button"
            onClick={() =>
              window.alert(
                "Tạo nhóm hàng mới trên KiotViet, rồi đồng bộ sản phẩm trên ALOHA."
              )
            }
            className="border-0 bg-transparent p-0.5 text-[13px] font-semibold text-[#0090da] hover:underline"
          >
            + Tạo mới
          </button>
        </div>

        <div className="flex shrink-0 items-center gap-1.5 border-b border-[#f0f0f0] px-3 pb-2">
          <div className="relative flex-1">
            <Search
              size={14}
              className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[#999]"
            />
            <input
              type="text"
              placeholder="Tìm kiếm"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoFocus
              className="h-[34px] w-full rounded-lg border border-[#d0d5dd] py-0 pl-8 pr-7 text-[13px] text-[#333] outline-none focus:border-[#0070e0]"
            />
            {searchQuery ? (
              <button
                type="button"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-[#999]"
                onClick={() => setSearchQuery("")}
                aria-label="Xóa tìm"
              >
                <X size={14} />
              </button>
            ) : null}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-1.5">
          {treeBusy ? (
            <div className="px-3 py-6 text-center text-xs text-slate-400">
              Đang tải nhóm hàng…
            </div>
          ) : displayedTree.length ? (
            displayedTree.map((node) => (
              <CategoryTreeRow
                key={node.fullPath || node.id}
                node={node}
                depth={0}
                isExpanded={!!expandedNodes[node.id]}
                isChecked={isPathCovered(node.fullPath, selectedSet)}
                onToggle={handleToggleSelectNode}
                onExpand={toggleExpand}
                expandedNodes={expandedNodes}
                selectedSet={selectedSet}
              />
            ))
          ) : (
            <p className="px-3 py-6 text-center text-xs text-slate-400">
              {searchQuery.trim()
                ? "Không tìm thấy nhóm hàng phù hợp."
                : "Chưa có dữ liệu nhóm hàng."}
            </p>
          )}
        </div>

        <div className="flex shrink-0 items-center justify-between border-t border-[#f0f0f0] px-3 py-2">
          <button
            type="button"
            onClick={() =>
              setTempSelected(displayedTree.map((n) => normPath(n.fullPath)))
            }
            className="border-0 bg-transparent p-1 text-[13px] font-semibold text-[#0090da] hover:underline"
          >
            Chọn tất cả
          </button>
          <button
            type="button"
            onClick={handleApply}
            className="rounded-md border-0 bg-[#0070e0] px-4 py-1.5 text-[13px] font-semibold text-white hover:bg-[#0066cc]"
          >
            Áp dụng
          </button>
        </div>
      </div>
    ) : null;

  return (
    <div ref={rootRef} className="relative w-full min-w-0">
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="text-[12.5px] font-semibold text-[#1F3A24]">
          Nhóm hàng{value.length ? ` (${value.length})` : ""}
        </span>
        {value.length > 0 ? (
          <button
            type="button"
            onClick={handleClearAll}
            className="text-[12px] font-semibold text-[#0090da] hover:underline"
          >
            Bỏ lọc nhóm
          </button>
        ) : null}
      </div>

      <button
        type="button"
        onClick={() => {
          if (open) {
            setOpen(false);
            return;
          }
          setTempSelected((value || []).map(normPath).filter(Boolean));
          placePanel();
          setOpen(true);
        }}
        className="flex h-9 w-full items-center gap-1.5 rounded border px-2.5 text-left text-[13px]"
        style={{
          background: "#fff",
          borderColor: open ? "#0070e0" : "#d9d9d9",
          boxShadow: open ? "0 0 0 2px rgba(0,112,224,0.2)" : undefined,
          color: value.length ? "#0070e0" : "#555",
          fontWeight: value.length ? 700 : 400,
        }}
      >
        <span className="min-w-0 flex-1 truncate">{displayText}</span>
        {value.length > 0 ? (
          <span
            role="button"
            tabIndex={0}
            title="Xóa chọn nhóm"
            onClick={handleClearAll}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") handleClearAll();
            }}
            className="inline-flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full bg-[#e8e8e8] text-[#555]"
          >
            <X size={12} />
          </span>
        ) : null}
        <ChevronDown
          size={16}
          className="shrink-0 text-[#888] transition"
          style={{ transform: open ? "rotate(180deg)" : undefined }}
        />
      </button>

      {panel ? createPortal(panel, document.body) : null}
    </div>
  );
}
