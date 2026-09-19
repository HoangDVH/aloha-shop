"use client";

import React, { type ReactNode } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, FileText, Image as ImageIcon, Layers, Palette, Sparkles } from "lucide-react";
import type { AppearanceBlock } from "../api";
import { WB, WbToggle } from "../ui";

const BLOCK_LABEL: Record<string, string> = {
  hero: "Banner chính",
  banner_carousel: "Banner carousel",
  feature_strip: "Dịch vụ / Why Aloha",
  product_section: "Nhóm hàng hóa",
  article_section: "Bài viết mới",
  rich_text: "Thông báo",
  spacer: "Khoảng trống",
  category_highlight: "Sản phẩm nổi bật",
};

function blockIcon(type: string) {
  if (type === "hero" || type === "banner_carousel") return ImageIcon;
  if (type === "feature_strip") return Sparkles;
  if (type === "product_section") return Layers;
  if (type === "article_section") return FileText;
  return Palette;
}

function SortableRow({
  block,
  active,
  primary,
  onSelect,
  onToggle,
  editor,
}: {
  block: AppearanceBlock;
  active: boolean;
  primary: string;
  onSelect: () => void;
  onToggle: () => void;
  editor?: ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: block.id,
  });
  const Icon = blockIcon(block.type);
  const label =
    block.type === "product_section"
      ? String(block.props.title || "Nhóm hàng hóa")
      : block.type === "article_section"
        ? String(block.props.title || "Bài viết mới")
        : BLOCK_LABEL[block.type] || block.type;

  return (
    <li ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }}>
      <div
        className="group flex h-11 items-center gap-2 rounded-xl px-2 transition"
        style={{
          background: active ? WB.rowActive : isDragging ? "#F0F2F5" : "transparent",
          boxShadow: active
            ? `inset 0 0 0 1px ${primary}33`
            : isDragging
              ? "0 4px 12px rgba(15,23,42,0.12)"
              : undefined,
          opacity: isDragging ? 0.92 : 1,
          zIndex: isDragging ? 20 : undefined,
        }}
      >
        <button
          type="button"
          className="flex h-8 w-7 shrink-0 cursor-grab items-center justify-center rounded-md border-0 bg-transparent text-gray-400 hover:bg-gray-100 hover:text-gray-600 active:cursor-grabbing"
          style={{ border: "none" }}
          title="Kéo để sắp xếp"
          aria-label="Kéo để sắp xếp"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          className="flex h-full min-w-0 flex-1 items-center gap-2 border-0 bg-transparent px-0 text-left"
          style={{ border: "none", background: "transparent" }}
          onClick={onSelect}
        >
          <span
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
            style={{
              background: active ? `${primary}18` : "#F0F2F5",
              color: active ? primary : "#6B7280",
            }}
          >
            <Icon className="h-4 w-4" />
          </span>
          <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-gray-800">
            {label}
          </span>
        </button>
        <WbToggle
          on={block.enabled}
          onChange={onToggle}
          title={block.enabled ? "Ẩn khối" : "Hiện khối"}
        />
      </div>
      {active && editor ? <div className="mb-1 mt-1.5 pl-1">{editor}</div> : null}
    </li>
  );
}

export function BlockList({
  blocks,
  selectedId,
  primary,
  onSelect,
  onToggle,
  onReorder,
  renderEditor,
}: {
  blocks: AppearanceBlock[];
  selectedId: string | null;
  primary: string;
  onSelect: (id: string) => void;
  onToggle: (id: string) => void;
  onReorder: (next: AppearanceBlock[]) => void;
  /** Form chỉnh sửa nằm ngay dưới dòng đang chọn. */
  renderEditor?: (block: AppearanceBlock) => ReactNode;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = blocks.findIndex((b) => b.id === active.id);
    const newIndex = blocks.findIndex((b) => b.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    onReorder(arrayMove(blocks, oldIndex, newIndex));
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={blocks.map((b) => b.id)} strategy={verticalListSortingStrategy}>
        <ul className="space-y-1.5">
          {blocks.map((b) => (
            <SortableRow
              key={b.id}
              block={b}
              active={selectedId === b.id}
              primary={primary}
              onSelect={() => onSelect(b.id)}
              onToggle={() => onToggle(b.id)}
              editor={
                selectedId === b.id && renderEditor ? renderEditor(b) : undefined
              }
            />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
}

export { BLOCK_LABEL };
