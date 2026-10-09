"use client";
import { Children, cloneElement, Fragment, isValidElement, useState, type ReactNode } from "react";

export function flattenChips(children: ReactNode, parentKey = ""): ReactNode[] {
  return Children.toArray(children).flatMap((node, index) => {
    const key = `${parentKey}/${isValidElement(node) ? node.key : `text:${index}`}`;
    if (isValidElement<{ children?: ReactNode }>(node) && node.type === Fragment) {
      return flattenChips(node.props.children, key);
    }
    return [isValidElement(node) ? cloneElement(node, { key }) : node];
  });
}

/** Mobile keeps every choice swipeable; desktop previews five choices and wraps. */
export function CatalogChipRow({ children, leading = 0, row }: { children: ReactNode; leading?: number; row?: string }) {
  const [expanded, setExpanded] = useState(false);
  const items = flattenChips(children);
  let optional = 0;
  const visible = items.map((item, index) => {
    if (index < leading || (isValidElement<{ "data-always-visible"?: boolean }>(item) && item.props["data-always-visible"])) return true;
    return optional++ < 5;
  });
  const hidden = visible.filter(value => !value).length;
  return <div data-catalog-row={row} className="flex min-w-0 items-center gap-2 overflow-x-auto whitespace-nowrap [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:flex-wrap lg:overflow-visible">
    {items.map((item, index) => <Fragment key={isValidElement(item) && item.key != null ? item.key : index}>
      {visible[index] || expanded ? item : <span className="contents lg:hidden">{item}</span>}
    </Fragment>)}
    {hidden > 0 ? <button type="button" aria-expanded={expanded} onClick={() => setExpanded(v => !v)} className="hidden min-h-11 shrink-0 items-center rounded-md border border-dashed border-[var(--aloha-green)] px-3 text-xs font-semibold text-[var(--aloha-green)] lg:inline-flex">
      {expanded ? "Thu gọn" : `Xem thêm (${hidden})`}
    </button> : null}
  </div>;
}
