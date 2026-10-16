"use client";

import { useEffect, useState } from "react";
import { Alert, Button, Input, InputNumber, Select, Pagination, Spin } from "antd";
import { Plus } from "lucide-react";
import { adminFetch } from "@/components/admin/api/adminFetch";

import { DndContext, closestCenter, PointerSensor, KeyboardSensor, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { GiftProductRow } from "./GiftProductRow";
import { giftProductPage, insertGiftProduct, moveGiftProduct } from "./productOrder";

type Product = { ma: string; ten: string; anh?: string; gia?: number; visible?: boolean };
type SearchResult = { items: Product[]; selected: Product[]; total: number; limit: number };

function ProductInfo({ product }: { product: Product }) {
  return (
    <div className="flex min-w-0 flex-1 items-center gap-3">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {product.anh ? <img src={product.anh} alt="" className="h-12 w-12 shrink-0 rounded-lg border object-cover" /> : <div className="h-12 w-12 shrink-0 rounded-lg bg-stone-100" />}
      <div className="min-w-0">
        <div className="text-sm font-semibold text-stone-800">{product.ten || product.ma}</div>
        <div className="text-xs text-stone-500">{product.ma}{product.gia != null ? ` · ${product.gia.toLocaleString("vi-VN")}đ` : ""}</div>
      </div>
    </div>
  );
}

export function GiftProductPicker({ value = [], onChange }: {
  value?: string[];
  onChange?: (codes: string[]) => void;
}) {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [selectedPage, setSelectedPage] = useState(1);
  const [selectedPageSize, setSelectedPageSize] = useState(10);
  const selected = giftProductPage(value, selectedPage, selectedPageSize);
  useEffect(() => { setSelectedPage(selected.page); }, [selected.page]);
  const [result, setResult] = useState<SearchResult>({ items: [], selected: [], total: 0, limit: 12 });
  const [known, setKnown] = useState<Record<string, Product>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  const [insertAt, setInsertAt] = useState<"first" | "last" | "position">("first");
  const [insertPosition, setInsertPosition] = useState<number | null>(1);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const codesKey = [...value].sort().join(",");
  const trimmed = query.trim();

  useEffect(() => {
    let cancelled = false;
    if (!trimmed && !codesKey) {
      setResult({ items: [], selected: [], total: 0, limit: 12 });
      setLoading(false);
      setError("");
      return;
    }

    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ q: trimmed, page: String(page), codes: codesKey });
        const data = await adminFetch<SearchResult>(`/api/shop/admin/gifts/products?${params}`);
        if (cancelled) return;
        setResult(data);
        // Refresh availability for every selected code, including deleted products.
        setKnown((prev) => {
          const next = { ...prev };
          // Missing selected codes must lose their cached availability after refresh.
          for (const code of codesKey.split(",").filter(Boolean)) delete next[code];
          return { ...next, ...Object.fromEntries([...data.items, ...data.selected].map((p) => [p.ma, p])) };
        });
        setError("");
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Không thể tải sản phẩm");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 250);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [trimmed, page, codesKey, reload]);

  const move = (code: string, position: number) => {
    const next = moveGiftProduct(value, code, position);
    if (next !== value) {
      onChange?.(next);
      setSelectedPage(Math.floor(next.indexOf(code) / selectedPageSize) + 1);
    }
  };

  const addProduct = (code: string) => {
    const next = insertGiftProduct(value, code, insertAt === "first" ? 1 : insertAt === "last" ? value.length + 1 : insertPosition ?? 1);
    if (next !== value) {
      onChange?.(next);
      setSelectedPage(Math.floor(next.indexOf(code) / selectedPageSize) + 1);
    }
  };

  return (
    <div className="space-y-3.5 rounded-xl border border-stone-200 bg-stone-50/60 p-4">
      {/* 1. Ô tìm kiếm đưa lên đầu */}
      <div>
        <Input.Search
          allowClear
          placeholder="Tìm theo tên hoặc mã sản phẩm để thêm vào gói quà"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setPage(1);
          }}
        />
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-stone-600">
          <span>Vị trí khi thêm:</span>
          <Select size="small" value={insertAt} onChange={setInsertAt} aria-label="Vị trí khi thêm sản phẩm" className="min-w-36" options={[
            { value: "first", label: "Thêm lên đầu" },
            { value: "last", label: "Thêm cuối" },
            { value: "position", label: "Vị trí cụ thể" },
          ]} />
          {insertAt === "position" ? <InputNumber size="small" min={1} max={value.length + 1} precision={0}
            value={insertPosition} onChange={setInsertPosition} aria-label="Vị trí sản phẩm mới" className="!w-20" /> : null}
        </div>
        {error ? (
          <Alert
            type="error"
            title={error}
            className="mt-2"
            action={
              <Button size="small" onClick={() => setReload((n) => n + 1)}>
                Thử lại
              </Button>
            }
          />
        ) : null}

        {/* Kết quả tìm kiếm chỉ hiển thị khi có từ khóa */}
        {trimmed ? (
          <div className="mt-2 rounded-lg border border-stone-200 bg-white p-2 shadow-xs">
            <Spin spinning={loading}>
              <div className="max-h-72 space-y-2 overflow-y-auto">
                {result.items.map((product) => (
                  <div
                    key={product.ma}
                    className="flex items-center gap-2 rounded-lg border border-stone-100 bg-stone-50/50 p-2 hover:bg-stone-50"
                  >
                    <ProductInfo product={product} />
                    <Button
                      size="small"
                      disabled={loading || value.includes(product.ma) || value.length >= 100}
                      icon={<Plus size={14} />}
                      onClick={() => addProduct(product.ma)}
                    >
                      {value.includes(product.ma) ? "Đã chọn" : "Thêm"}
                    </Button>
                  </div>
                ))}
                {!loading && !error && !result.items.length ? (
                  <p className="py-4 text-center text-xs text-stone-500">
                    Không tìm thấy sản phẩm phù hợp với «{trimmed}».
                  </p>
                ) : null}
              </div>
            </Spin>
            {result.total > result.limit ? (
              <div className="mt-2 flex justify-end border-t border-stone-100 pt-2">
                <Pagination
                  size="small"
                  current={page}
                  pageSize={result.limit}
                  total={result.total}
                  onChange={setPage}
                  showSizeChanger={false}
                  hideOnSinglePage
                />
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      {/* 2. Danh sách sản phẩm đã chọn */}
      <div className="border-t border-stone-200/80 pt-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm font-semibold text-stone-800">
            Sản phẩm đã chọn ({value.length}/100)
          </span>
          {value.length ? (
            <span className="text-xs text-stone-400">
              Kéo thả hoặc nhập vị trí
            </span>
          ) : null}
        </div>

        {value.length ? (
          <>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={({ active, over }) => {
            if (over && active.id !== over.id) move(String(active.id), value.indexOf(String(over.id)) + 1);
          }}>
          <SortableContext items={selected.codes} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
            {selected.codes.map((code, pageIndex) => {
              const index = selected.start + pageIndex;
              const product = known[code];
              return (
                <GiftProductRow key={code} code={code} index={index} count={value.length} onMove={position => move(code, position)} onRemove={() => onChange?.(value.filter(c => c !== code))}>
                  <div className="min-w-0 flex-1">
                    <ProductInfo product={product || { ma: code, ten: code }} />
                    {!loading && !error && (!product || product.visible === false) ? (
                      <p className="mt-1 text-xs text-amber-700">
                        Sản phẩm đang ẩn hoặc không còn khả dụng trên shop.
                      </p>
                    ) : null}
                  </div>
                </GiftProductRow>
              );
            })}
          </div>
          </SortableContext>
          </DndContext>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs text-stone-500">{selected.start + 1}–{selected.start + selected.codes.length} / {value.length} sản phẩm</span>
            <Pagination size="small" current={selected.page} pageSize={selectedPageSize} total={value.length}
              showSizeChanger pageSizeOptions={[5, 10, 20]} showLessItems
              onChange={(nextPage, size) => {
                setSelectedPage(size === selectedPageSize ? nextPage : 1);
                setSelectedPageSize(size);
              }} />
          </div>
          </>
        ) : (
          <p className="py-2 text-xs text-stone-500">
            Chưa có sản phẩm nào. Tìm kiếm ở trên để thêm sản phẩm vào gói quà.
          </p>
        )}
      </div>

      <p className="text-[11px] text-stone-400">
        Bỏ khỏi hạng mục chỉ gỡ liên kết; sản phẩm vẫn còn trong kho.
      </p>
    </div>
  );
}
