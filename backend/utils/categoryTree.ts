/**
 * Cây nhóm hàng theo categoryId KiotViet — đếm/lọc gồm cả nhánh con (giống KV).
 */
import { normalizeString } from "./helpers";

export type KvCategoryRow = {
  categoryId: number;
  categoryName: string;
  parentId?: number | null;
  rank?: number;
};

export type CategoryNode = {
  id: string;
  name: string;
  fullPath: string;
  count: number;
  children: CategoryNode[];
  categoryId?: number;
  sortOrder?: number;
};

function normName(s: string): string {
  return String(s || "")
    .trim()
    .replace(/\s+/g, " ");
}

function pathKey(s: string): string {
  return String(s || "")
    .trim()
    .replace(/\s*(?:>>|▸|>)\s*/g, " >> ")
    .replace(/\s+/g, " ")
    .toLowerCase();
}

/** Flatten KV hierarchical or flat categories list */
export function flattenKvCategories(raw: any[]): KvCategoryRow[] {
  const out: KvCategoryRow[] = [];
  const seen = new Set<number>();

  const push = (n: any, parentFallback?: number | null) => {
    const categoryId = Number(n?.categoryId ?? n?.id) || 0;
    const categoryName = normName(n?.categoryName || n?.name || "");
    if (!categoryId || !categoryName || seen.has(categoryId)) return;
    seen.add(categoryId);
    const parentId =
      n?.parentId != null && n.parentId !== ""
        ? Number(n.parentId) || null
        : parentFallback != null
          ? parentFallback
          : null;
    out.push({ categoryId, categoryName, parentId, rank: Number(n?.rank) || 0 });
    const children = n?.children || n?.Children || [];
    if (Array.isArray(children)) {
      for (const ch of children) push(ch, categoryId);
    }
  };

  for (const n of raw || []) push(n, null);
  return out;
}

let lastTree: CategoryNode[] = [];
let pathToIds = new Map<string, number[]>(); // fullPath lower → [id, ...descendant ids]
let idToPath = new Map<number, string>();

export function getLastCategoryTree(): CategoryNode[] {
  return lastTree;
}

export function collectCategoryIdsForPaths(selectedPaths: string[]): Set<number> {
  const ids = new Set<number>();
  for (const raw of selectedPaths || []) {
    const key = pathKey(raw);
    if (!key) continue;
    const list = pathToIds.get(key);
    if (list) list.forEach((id) => ids.add(id));
  }
  return ids;
}

function rebuildPathIndex(roots: CategoryNode[]) {
  pathToIds = new Map();
  idToPath = new Map();

  const walk = (node: CategoryNode): number[] => {
    const self = node.categoryId ? [node.categoryId] : [];
    const childIds: number[] = [];
    for (const ch of node.children) childIds.push(...walk(ch));
    const all = [...self, ...childIds];
    pathToIds.set(pathKey(node.fullPath), all);
    if (node.categoryId) idToPath.set(node.categoryId, node.fullPath);
    return all;
  };
  roots.forEach(walk);
}

/**
 * Dựng cây từ danh mục KV (có parentId) + đếm SP theo categoryId (gồm con).
 * Đếm unique mã trong nhánh; gồm cả SP ngừng KD (KV đếm đủ, vd. Cây cảnh = 815).
 */
export function buildCategoryTreeFromKv(
  categories: KvCategoryRow[],
  products: any[]
): CategoryNode[] {
  const byId = new Map<
    number,
    CategoryNode & { parentId: number | null; rank: number }
  >();

  for (const c of categories) {
    const id = Number(c.categoryId) || 0;
    const name = normName(c.categoryName);
    if (!id || !name) continue;
    byId.set(id, {
      id: String(id),
      name,
      fullPath: name,
      count: 0,
      children: [],
      categoryId: id,
      parentId: c.parentId != null ? Number(c.parentId) || null : null,
      rank: Number(c.rank) || 0,
      sortOrder: Number(c.rank) || 0,
    });
  }

  const roots: CategoryNode[] = [];
  for (const node of byId.values()) {
    const pid = node.parentId;
    if (pid && byId.has(pid)) {
      byId.get(pid)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  const fillPath = (node: CategoryNode, prefix: string) => {
    node.fullPath = prefix ? `${prefix} >> ${node.name}` : node.name;
    for (const ch of node.children) fillPath(ch, node.fullPath);
  };
  roots.forEach((r) => fillPath(r, ""));

  // ma theo từng categoryId — rollup unique mã cả nhánh (tránh đếm trùng khi cùng mã ở 2 nhóm con)
  const masById = new Map<number, Set<string>>();
  for (const p of products || []) {
    if (p?.deletedAt) continue; // null/undefined = còn dùng
    const cid = Number(p?.categoryId) || 0;
    const ma = String(p?.ma || p?.code || "")
      .trim()
      .toUpperCase();
    if (!cid || !ma) continue;
    let set = masById.get(cid);
    if (!set) {
      set = new Set();
      masById.set(cid, set);
    }
    set.add(ma);
  }

  const rollup = (node: CategoryNode): Set<string> => {
    const all = new Set<string>(masById.get(Number(node.categoryId) || 0) || []);
    for (const ch of node.children) {
      for (const ma of rollup(ch)) all.add(ma);
    }
    node.count = all.size;
    return all;
  };
  roots.forEach(rollup);

  const sortNodes = (nodes: CategoryNode[]) => {
    nodes.sort((a, b) => {
      const ra = Number((a as any).rank ?? a.sortOrder) || 0;
      const rb = Number((b as any).rank ?? b.sortOrder) || 0;
      if (ra !== rb) return ra - rb;
      return a.name.localeCompare(b.name, "vi");
    });
    nodes.forEach((n) => sortNodes(n.children));
  };
  sortNodes(roots);

  lastTree = roots;
  rebuildPathIndex(roots);
  return roots;
}

/** Chỉ mục đường dẫn → categoryId (+ con) — dùng trên server, không dùng biến global. */
export function buildCategoryPathIndex(roots: CategoryNode[]): Map<string, number[]> {
  const pathToIds = new Map<string, number[]>();
  const walk = (node: CategoryNode): number[] => {
    const self = node.categoryId ? [node.categoryId] : [];
    const childIds: number[] = [];
    for (const ch of node.children) childIds.push(...walk(ch));
    const all = [...self, ...childIds];
    pathToIds.set(pathKey(node.fullPath), all);
    return all;
  };
  roots.forEach(walk);
  return pathToIds;
}

/** Gom categoryId (+ con) từ đường dẫn — khớp chính xác, đuôi nhánh, hoặc tên lá. */
export function resolveCategoryIdsFromPathIndex(
  pathToIds: Map<string, number[]>,
  raw: string
): number[] {
  const key = pathKey(raw);
  if (!key) return [];

  const direct = pathToIds.get(key);
  if (direct?.length) return direct;

  const segments = key
    .split(/\s*>>\s*/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (!segments.length) return [];

  const out = new Set<number>();

  for (const [p, ids] of pathToIds) {
    if (p === key) {
      ids.forEach((id) => out.add(id));
      continue;
    }
    const pSegs = p
      .split(/\s*>>\s*/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (pSegs.length >= segments.length) {
      const tail = pSegs.slice(-segments.length).join(" >> ");
      if (pathKey(tail) === key) ids.forEach((id) => out.add(id));
    }
  }

  if (out.size) return [...out];

  if (segments.length === 1) {
    const leaf = segments[0];
    for (const [p, ids] of pathToIds) {
      const last = p.split(/\s*>>\s*/).pop()?.trim() || "";
      if (last === leaf) ids.forEach((id) => out.add(id));
    }
  }

  return [...out];
}

/** Khớp SP theo categoryId nhánh đã chọn (ưu tiên); fallback đường dẫn cũ. */
export function matchProductByCategorySelection(
  product: any,
  selectedPaths: string | string[],
  categoryIds?: Set<number>
): boolean {
  if (!selectedPaths || (Array.isArray(selectedPaths) && selectedPaths.length === 0)) {
    return true;
  }
  if (!product) return false;

  const ids =
    categoryIds && categoryIds.size > 0
      ? categoryIds
      : collectCategoryIdsForPaths(
          Array.isArray(selectedPaths) ? selectedPaths : [selectedPaths]
        );

  if (ids.size > 0) {
    const cid = Number(product.categoryId) || 0;
    if (cid && ids.has(cid)) return true;
    // không có categoryId trên SP → fallback path bên dưới
  }

  const filters = (Array.isArray(selectedPaths) ? selectedPaths : [selectedPaths])
    .map((s) => pathKey(s))
    .filter(Boolean);
  if (!filters.length) return true;

  const segs: string[] = [];
  if (Array.isArray(product.ancestor) && product.ancestor.length) {
    for (const a of product.ancestor) {
      const part = normName(String(a || ""));
      if (part && !segs.includes(part)) segs.push(part);
    }
  } else if (product.nhomPath) {
    String(product.nhomPath)
      .split(/\s*(?:>>|▸|>)\s*/)
      .map((s) => normName(s))
      .filter(Boolean)
      .forEach((s) => {
        if (!segs.includes(s)) segs.push(s);
      });
  } else if (product.nhom) {
    segs.push(normName(product.nhom));
  }
  const full = segs.join(" >> ").toLowerCase();
  if (!full) return false;
  return filters.some((f) => full === f || full.startsWith(f + " >> "));
}

export function filterCategoryNodes(nodes: CategoryNode[], query: string): CategoryNode[] {
  const q = normalizeString(query);
  if (!q) return nodes;
  return nodes.reduce<CategoryNode[]>((acc, node) => {
    const nameF = normalizeString(node.name);
    const pathF = normalizeString(node.fullPath);
    const selfHit =
      nameF.includes(q) ||
      pathF.includes(q) ||
      q.split(" ").filter(Boolean).every((t) => `${nameF} ${pathF}`.includes(t));
    if (selfHit) {
      acc.push(node);
      return acc;
    }
    const kids = filterCategoryNodes(node.children, query);
    if (kids.length) acc.push({ ...node, children: kids });
    return acc;
  }, []);
}
