"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Button, Dropdown, InputNumber } from "antd";
import { GripVertical, MoreHorizontal, Trash2 } from "lucide-react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

export function GiftProductRow({ code, index, count, onMove, onRemove, children }: {
  code: string; index: number; count: number;
  onMove: (position: number) => void; onRemove: () => void; children: ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: code });
  const [position, setPosition] = useState<number | null>(index + 1);
  useEffect(() => setPosition(index + 1), [index]);
  const commit = () => {
    if (position != null && Number.isInteger(position)) onMove(position);
    setPosition(index + 1);
  };
  return <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition, position: "relative", zIndex: isDragging ? 10 : undefined }}
    className={`flex flex-wrap items-center gap-2 rounded-lg border bg-white p-2 ${isDragging ? "shadow-lg" : ""}`}>
    <button type="button" {...attributes} {...listeners} aria-label={`Kéo để đổi vị trí ${code}`}
      className="flex h-10 w-6 shrink-0 touch-none cursor-grab items-center justify-center text-stone-400 active:cursor-grabbing"><GripVertical size={18} /></button>
    <div className="min-w-0 flex-1">{children}</div>
    <div className="ml-auto flex items-center gap-1.5">
      <InputNumber size="small" min={1} max={count} precision={0} controls={false} value={position}
        aria-label={`Vị trí ${code}`} title="Nhập vị trí rồi Enter hoặc rời ô để áp dụng" className="!w-14"
        onChange={setPosition} onPressEnter={e => e.currentTarget.blur()} onBlur={commit} />
      <Dropdown trigger={["click"]} menu={{ items: [
        { key: "first", label: "Đưa lên đầu", disabled: index === 0 },
        { key: "last", label: "Đưa xuống cuối", disabled: index === count - 1 },
      ], onClick: ({ key }) => onMove(key === "first" ? 1 : count) }}>
        <Button size="small" aria-label={`Sắp xếp ${code}`} icon={<MoreHorizontal size={16} />} />
      </Dropdown>
      <Button size="small" danger icon={<Trash2 size={14} />} aria-label={`Bỏ ${code} khỏi hạng mục`} onClick={onRemove} />
    </div>
  </div>;
}
