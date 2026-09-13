import { useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";

/** Bật ảo hóa khi danh sách dài — tránh vẽ hàng trăm <tr> cùng lúc. */
export const VIRTUAL_TABLE_THRESHOLD = 35;

export function useTableRowVirtualizer(opts: {
  count: number;
  enabled: boolean;
  estimateSize?: number;
  overscan?: number;
  maxHeightVh?: number;
}) {
  const {
    count,
    enabled,
    estimateSize = 56,
    overscan = 12,
    maxHeightVh = 70,
  } = opts;
  const scrollRef = useRef<HTMLDivElement>(null);
  const active = enabled && count >= VIRTUAL_TABLE_THRESHOLD;
  const virtualizer = useVirtualizer({
    count: active ? count : 0,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => estimateSize,
    overscan,
    enabled: active,
  });
  const virtualRows = active ? virtualizer.getVirtualItems() : [];
  const padTop = virtualRows.length ? virtualRows[0]!.start : 0;
  const padBottom = virtualRows.length
    ? virtualizer.getTotalSize() - virtualRows[virtualRows.length - 1]!.end
    : 0;

  return {
    scrollRef,
    active,
    virtualRows,
    padTop,
    padBottom,
    scrollStyle: active
      ? ({ maxHeight: `${maxHeightVh}vh`, overflow: "auto" as const })
      : undefined,
  };
}
