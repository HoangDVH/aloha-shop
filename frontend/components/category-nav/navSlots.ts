import type { ShopCategoryNavNode } from "@/lib/api";
import {
  findNavMergeGroup,
  MOBILE_ROOT_ORDER,
  nameMatchesAny,
  nodeSubs,
} from "./navLabels";

/** Chèn node vào danh sách UI ngay sau mục neo (không tìm thấy → cuối danh sách). */
export function injectNodesAfter(
  items: ShopCategoryNavNode[],
  afterName: string,
  extras: ShopCategoryNavNode[]
): ShopCategoryNavNode[] {
  if (!extras.length) return items;
  const existing = new Set(items.map((n) => n.id));
  const toAdd = extras.filter((n) => !existing.has(n.id));
  if (!toAdd.length) return items;
  const idx = items.findIndex((n) => nameMatchesAny(n.name, [afterName]));
  if (idx < 0) return [...items, ...toAdd];
  return [...items.slice(0, idx + 1), ...toAdd, ...items.slice(idx + 1)];
}

export function buildUiFlyoutRoot(
  primary: ShopCategoryNavNode,
  injectAfterName: string,
  injectNodes: ShopCategoryNavNode[]
): ShopCategoryNavNode {
  const subs = injectNodesAfter(nodeSubs(primary), injectAfterName, injectNodes);
  return {
    ...primary,
    hasChild: subs.length > 0,
    subs,
  };
}

export type NavSlot =
  | { kind: "node"; node: ShopCategoryNavNode }
  | {
      kind: "merge";
      id: string;
      label: string;
      primary: ShopCategoryNavNode;
      flyoutRoot: ShopCategoryNavNode;
    };

export function buildNavSlots(tree: ShopCategoryNavNode[]): NavSlot[] {
  const slots: NavSlot[] = [];
  const usedGroups = new Set<string>();

  for (const node of tree) {
    const group = findNavMergeGroup(node.name);
    if (!group) {
      slots.push({ kind: "node", node });
      continue;
    }
    if (usedGroups.has(group.id)) continue;
    usedGroups.add(group.id);

    const members = tree.filter((n) => nameMatchesAny(n.name, group.memberNames));
    const primary =
      members.find((n) => nameMatchesAny(n.name, [group.primaryName])) || members[0];
    if (!primary) continue;

    const injectNodes = members.filter((n) => n.id !== primary.id);
    if (!injectNodes.length) {
      slots.push({ kind: "node", node: primary });
      continue;
    }

    slots.push({
      kind: "merge",
      id: group.id,
      label: group.label,
      primary,
      flyoutRoot: buildUiFlyoutRoot(primary, group.injectAfterName, injectNodes),
    });
  }
  return slots;
}

export function orderMobileRoots(tree: ShopCategoryNavNode[]): ShopCategoryNavNode[] {
  const used = new Set<number>();
  const ordered: ShopCategoryNavNode[] = [];
  for (const name of MOBILE_ROOT_ORDER) {
    const hit = tree.find(
      (n) => !used.has(n.id) && nameMatchesAny(n.name, [name])
    );
    if (hit) {
      used.add(hit.id);
      ordered.push(hit);
    }
  }
  for (const n of tree) {
    if (used.has(n.id)) continue;
    // Bỏ Khác / Vật tư / Quà khỏi rail chính
    if (
      nameMatchesAny(n.name, ["KHÁC", "VẬT TƯ VÀ THIẾT BỊ", "QUÀ TẶNG CÂY"])
    ) {
      continue;
    }
    ordered.push(n);
  }
  return ordered;
}
