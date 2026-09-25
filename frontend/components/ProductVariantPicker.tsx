"use client";

import { useEffect, useMemo, useState } from "react";
import { Check } from "lucide-react";
import {
  fetchProductVariants,
  type ShopProduct,
  type ShopVariantAxis,
  type ShopVariantModel,
} from "@/lib/api";

function norm(s: string): string {
  return String(s || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
}

function modelMatches(
  m: ShopVariantModel,
  selected: Record<string, string>,
  axes: ShopVariantAxis[]
): boolean {
  for (const ax of axes) {
    const want = selected[ax.name];
    if (!want) continue;
    if (ax.kind === "unit") {
      if (norm(m.dvt) !== norm(want)) return false;
    } else {
      const hit = m.attributes.find((a) => norm(a.attributeName) === norm(ax.name));
      if (!hit || norm(hit.attributeValue) !== norm(want)) return false;
    }
  }
  return true;
}

function modelHasValue(
  m: ShopVariantModel,
  axis: ShopVariantAxis,
  value: string
): boolean {
  if (axis.kind === "unit") return norm(m.dvt) === norm(value);
  const hit = m.attributes.find((a) => norm(a.attributeName) === norm(axis.name));
  return Boolean(hit && norm(hit.attributeValue) === norm(value));
}

/** Chỉ khóa theo các trục đứng trước (cascading) — đổi PHÂN LOẠI không bị SIZE hiện tại gạch. */
function cascadeSelected(
  axes: ShopVariantAxis[],
  selected: Record<string, string>,
  upToIndex: number
): Record<string, string> {
  const out: Record<string, string> = {};
  for (let i = 0; i < upToIndex; i++) {
    const name = axes[i]?.name;
    if (name && selected[name]) out[name] = selected[name];
  }
  return out;
}

function pickBestValue(
  axis: ShopVariantAxis,
  pool: ShopVariantModel[],
  prefer?: string
): string | null {
  const vals = axis.values
    .map((v) => v.value)
    .filter((v) => pool.some((m) => modelHasValue(m, axis, v)));
  if (!vals.length) return null;
  if (prefer && vals.some((v) => norm(v) === norm(prefer))) {
    const preferInStock = pool.some(
      (m) => modelHasValue(m, axis, prefer) && m.ton > 0
    );
    if (preferInStock || vals.every((v) => norm(v) === norm(prefer))) return prefer;
  }
  for (const v of vals) {
    if (pool.some((m) => modelHasValue(m, axis, v) && m.ton > 0)) return v;
  }
  return vals[0];
}

function modelImages(m: ShopVariantModel): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const u of [m.anh, ...(m.images || [])]) {
    const s = String(u || "").trim();
    if (!s || seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }
  return out;
}

/**
 * Ảnh hiển thị theo phân loại đang chọn.
 * Tránh combo CÓ HÌNH dùng nhầm ảnh chung với combo TRƠN trên Mongo.
 */
function resolveDistinctImage(
  preferred: ShopVariantModel[],
  constraints: Record<string, string>,
  axes: ShopVariantAxis[],
  allModels: ShopVariantModel[],
  fallback?: string
): string | undefined {
  const firstAttr = axes.find((a) => a.kind === "attr");
  const phanVal = firstAttr ? constraints[firstAttr.name] : "";
  if (firstAttr && phanVal) {
    const same = allModels.filter((m) => modelHasValue(m, firstAttr, phanVal));
    const other = allModels.filter((m) => !modelHasValue(m, firstAttr, phanVal));
    const otherImgs = new Set(other.flatMap(modelImages));
    for (const group of [preferred, same]) {
      for (const m of group) {
        for (const img of modelImages(m)) {
          if (!otherImgs.has(img)) return img;
        }
      }
    }
  }
  for (const m of preferred) {
    const imgs = modelImages(m);
    if (imgs[0]) return imgs[0];
  }
  return fallback || undefined;
}

export function buildVariantGallery(
  model: ShopVariantModel | null,
  selected: Record<string, string>,
  axes: ShopVariantAxis[],
  allModels: ShopVariantModel[],
  fallbackProduct?: { anh?: string; images?: string[] }
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  const push = (u?: string) => {
    const s = String(u || "").trim();
    if (!s || seen.has(s)) return;
    seen.add(s);
    out.push(s);
  };

  const matched = model
    ? [model]
    : allModels.filter((m) => modelMatches(m, selected, axes));
  const hero = resolveDistinctImage(matched, selected, axes, allModels);
  push(hero);

  for (const m of matched) {
    for (const img of modelImages(m)) push(img);
  }

  // Thêm ảnh các size cùng phân loại (để gallery đa dạng)
  const firstAttr = axes.find((a) => a.kind === "attr");
  if (firstAttr && selected[firstAttr.name]) {
    const same = allModels.filter((m) =>
      modelHasValue(m, firstAttr, selected[firstAttr.name])
    );
    for (const m of same) {
      for (const img of modelImages(m)) push(img);
    }
  }

  if (!out.length) {
    push(fallbackProduct?.anh);
    for (const img of fallbackProduct?.images || []) push(img);
  }
  return out;
}

export type VariantSelection = {
  model: ShopVariantModel | null;
  loading: boolean;
  canPurchase: boolean;
  axes: ShopVariantAxis[];
};

export function useProductVariants(product: ShopProduct): {
  selection: VariantSelection;
  selected: Record<string, string>;
  pick: (axisName: string, value: string) => void;
  axes: ShopVariantAxis[];
  gallery: string[];
} {
  const [loading, setLoading] = useState(true);
  const [axes, setAxes] = useState<ShopVariantAxis[]>([]);
  const [models, setModels] = useState<ShopVariantModel[]>([]);
  const [selected, setSelected] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const res = await fetchProductVariants(product.ma);
        if (cancelled) return;
        const ax = res.axes || [];
        const mods = res.models?.length
          ? res.models
          : res.current
            ? [res.current]
            : [];
        setAxes(ax);
        setModels(mods);
        const init: Record<string, string> = {};
        const seed =
          mods.find((m) => m.ma.toUpperCase() === product.ma.toUpperCase()) ||
          mods.find((m) => m.ton > 0) ||
          mods[0];
        if (seed) {
          for (const a of ax) {
            if (a.kind === "unit") init[a.name] = seed.dvt;
            else {
              const hit = seed.attributes.find(
                (x) => norm(x.attributeName) === norm(a.name)
              );
              if (hit) init[a.name] = hit.attributeValue;
            }
          }
        }
        setSelected(init);
      } catch {
        if (!cancelled) {
          setAxes([]);
          setModels([]);
          setSelected({});
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [product.ma]);

  const model = useMemo(() => {
    if (!axes.length) {
      return (
        models.find((m) => m.ma.toUpperCase() === product.ma.toUpperCase()) ||
        null
      );
    }
    const allPicked = axes.every((a) => Boolean(selected[a.name]));
    if (!allPicked) return null;
    const hits = models.filter((m) => modelMatches(m, selected, axes));
    return hits.find((m) => m.ton > 0) || hits[0] || null;
  }, [axes, models, selected, product.ma]);

  const pick = (axisName: string, value: string) => {
    setSelected((prev) => {
      const idx = axes.findIndex((a) => a.name === axisName);
      if (idx < 0) return { ...prev, [axisName]: value };

      const next: Record<string, string> = { ...prev, [axisName]: value };
      // Cascading: giữ/đổi các trục sau cho khớp phân loại mới
      for (let j = idx + 1; j < axes.length; j++) {
        const ax = axes[j];
        const constraints = cascadeSelected(axes, next, j);
        const pool = models.filter((m) => modelMatches(m, constraints, axes));
        const best = pickBestValue(ax, pool, next[ax.name]);
        if (best) next[ax.name] = best;
        else delete next[ax.name];
      }
      return next;
    });
  };

  const displayAxes = useMemo((): ShopVariantAxis[] => {
    return axes.map((ax, axisIndex) => {
      const constraints = cascadeSelected(axes, selected, axisIndex);
      const pool = models.filter((m) => modelMatches(m, constraints, axes));

      const values = ax.values
        .filter((v) => pool.some((m) => modelHasValue(m, ax, v.value)))
        .map((v) => {
          const withVal = pool.filter((m) => modelHasValue(m, ax, v.value));
          const inStock = withVal.some((m) => m.ton > 0);
          const trial = { ...constraints, [ax.name]: v.value };
          const matched = models.filter((m) => modelMatches(m, trial, axes));
          const image = resolveDistinctImage(
            matched.length ? matched : withVal,
            trial,
            axes,
            models,
            v.image
          );
          return {
            ...v,
            // Cho chọn cả biến thể hết hàng để đặt trước
            available: withVal.length > 0,
            outOfStock: !inStock && withVal.length > 0,
            image,
          };
        });

      return { ...ax, values };
    });
  }, [axes, models, selected]);

  const gallery = useMemo(
    () =>
      buildVariantGallery(model, selected, axes, models, {
        anh: product.anh,
        images: product.images,
      }),
    [model, selected, axes, models, product.anh, product.images]
  );

  return {
    selection: {
      model,
      loading,
      canPurchase: Boolean(model && !loading),
      axes,
    },
    selected,
    pick,
    axes: displayAxes,
    gallery,
  };
}

export function ProductVariantPicker({
  axes,
  selected,
  onPick,
  sheet = false,
}: {
  axes: ShopVariantAxis[];
  selected: Record<string, string>;
  onPick: (axisName: string, value: string) => void;
  sheet?: boolean;
}) {
  if (!axes.length) return null;
  if (sheet) return (
    <div className="space-y-6">
      {axes.map(ax => {
        const withImages = ax.kind === "attr" && ax.values.some(v => v.image);
        return <fieldset key={ax.name}>
          <legend className="mb-3 text-base font-semibold text-stone-900">{ax.name} ({ax.values.length})</legend>
          <div className={withImages ? "grid grid-cols-3 gap-2" : "flex flex-wrap gap-2"}>
            {ax.values.map(v => {
              const active = norm(selected[ax.name] || "") === norm(v.value);
              return <button key={v.value} type="button" aria-pressed={active} disabled={!v.available && !active} onClick={() => onPick(ax.name, v.value)}
                className={`min-w-0 overflow-hidden rounded-xl border text-sm transition disabled:opacity-35 ${active ? "border-[#e91e50] bg-[#fff5f7] text-[#c91543] ring-1 ring-[#e91e50]" : "border-stone-200 bg-white text-stone-800"} ${withImages ? "flex flex-col" : "min-h-11 min-w-16 px-4 py-2"}`}>
                {withImages && <div className="aspect-square w-full bg-stone-50">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {v.image && <img src={v.image} alt="" loading="lazy" className="h-full w-full object-contain" />}
                </div>}
                <span className={withImages ? "w-full break-words px-2 py-2.5 text-center" : ""}>{v.value}{v.outOfStock && <span className="mt-1 block text-[11px] text-amber-700">Đặt trước</span>}</span>
              </button>;
            })}
          </div>
        </fieldset>;
      })}
    </div>
  );
  return (
    <div className="space-y-3">
      {axes.map((ax) => (
        <div key={ax.name}>
          <div className="mb-1.5 text-sm text-slate-500">{ax.name}:</div>
          <div className="flex flex-wrap gap-2">
            {ax.values.map((v) => {
              const active = norm(selected[ax.name] || "") === norm(v.value);
              const disabled = !v.available && !active;
              return (
                <button
                  key={v.value}
                  type="button"
                  disabled={disabled}
                  onClick={() => onPick(ax.name, v.value)}
                  title={v.outOfStock ? "Đặt trước" : v.value}
                  className={`inline-flex max-w-full items-stretch overflow-hidden rounded-lg border text-sm font-semibold transition ${
                    active
                      ? "border-[var(--aloha-green)] text-[var(--aloha-ink)]"
                      : disabled
                        ? "cursor-not-allowed border-[#eee] text-slate-300 line-through"
                        : "border-[#ddd] text-slate-700 hover:border-[var(--aloha-green)]"
                  }`}
                >
                  {active ? (
                    <span className="flex items-center bg-[var(--aloha-green)] px-2 text-white">
                      <Check size={16} strokeWidth={2.5} />
                    </span>
                  ) : null}
                  {v.image && ax.kind === "attr" ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={v.image}
                      alt=""
                      className="h-9 w-9 shrink-0 object-cover"
                    />
                  ) : null}
                  <span className="px-3 py-2">{v.value}</span>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
