import type { ShopCategoryNavNode } from "./api";
import type { NavConfig, NavCustomItem } from "./appearanceTypes";

function filterTree(
  nodes: ShopCategoryNavNode[],
  hidden: Set<string>
): ShopCategoryNavNode[] {
  const out: ShopCategoryNavNode[] = [];
  for (const n of nodes) {
    const path = String(n.path || n.name || "").trim();
    if (path && hidden.has(path)) continue;
    const name = String(n.name || "").trim();
    if (name && hidden.has(name)) continue;
    const subs = filterTree(n.subs || [], hidden);
    out.push({ ...n, subs });
  }
  return out;
}

export type NavBarItem =
  | { kind: "category"; node: ShopCategoryNavNode }
  | {
      kind: "custom";
      id: string;
      label: string;
      href: string;
      openInNewTab?: boolean;
    };

/** Áp D2/D3 lên cây danh mục + mục tùy chỉnh. */
export function applyNavConfig(
  tree: ShopCategoryNavNode[],
  nav?: NavConfig | null
): { tree: ShopCategoryNavNode[]; before: NavCustomItem[]; after: NavCustomItem[] } {
  const hidden = new Set(
    (nav?.hiddenCategoryPaths || []).map((p) => String(p || "").trim()).filter(Boolean)
  );
  const filtered = hidden.size ? filterTree(tree, hidden) : tree;
  const customs = (nav?.customItems || []).filter((c) => c && c.enabled !== false);
  const before = customs.filter((c) => c.position === "before");
  const after = customs.filter((c) => c.position !== "before");
  return { tree: filtered, before, after };
}
