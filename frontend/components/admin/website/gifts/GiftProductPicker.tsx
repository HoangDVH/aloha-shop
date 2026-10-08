"use client";

import { useEffect, useState } from "react";
import { Alert, Button, Input, Pagination, Spin } from "antd";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { adminFetch } from "@/components/admin/api/adminFetch";

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
  const [result, setResult] = useState<SearchResult>({ items: [], selected: [], total: 0, limit: 12 });
  const [known, setKnown] = useState<Record<string, Product>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  const codesKey = value.join(",");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ q: query, page: String(page), codes: codesKey });
        const data = await adminFetch<SearchResult>(`/api/shop/admin/gifts/products?${params}`);
        if (cancelled) return;
        setResult(data);
        // Refresh availability for every selected code, including deleted products.
        setKnown(Object.fromEntries([...data.items, ...data.selected].map((p) => [p.ma, p])));
        setError("");
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Không thể tải sản phẩm");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 250);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [query, page, codesKey, reload]);

  const move = (index: number, offset: number) => {
    const codes = [...value];
    [codes[index], codes[index + offset]] = [codes[index + offset], codes[index]];
    onChange?.(codes);
  };

  return (
    <div className="space-y-4 rounded-xl border border-stone-200 bg-stone-50/60 p-4">
      <p className="text-xs text-stone-500">Chọn sản phẩm có sẵn trong kho để hiển thị trên trang quà tặng này. Dùng mũi tên để đổi thứ tự, rồi bấm Lưu thông tin.</p>
      <div>
        <div className="mb-2 text-sm font-semibold">Đã chọn ({value.length}/100)</div>
        {value.length ? (
          <div className="max-h-72 space-y-2 overflow-y-auto">
            {value.map((code, index) => {
              const product = known[code];
              return (
                <div key={code} className="flex items-center gap-2 rounded-lg border bg-white p-2">
                  <span className="text-xs text-stone-400">{index + 1}</span>
                  <div className="min-w-0 flex-1">
                    <ProductInfo product={product || { ma: code, ten: code }} />
                    {!loading && !error && (!product || product.visible === false) ? <p className="mt-1 text-xs text-amber-700">Sản phẩm đang ẩn hoặc không còn khả dụng trên shop.</p> : null}
                  </div>
                  <Button size="small" disabled={index === 0} icon={<ArrowUp size={14} />} aria-label={`Đưa ${code} lên`} onClick={() => move(index, -1)} />
                  <Button size="small" disabled={index === value.length - 1} icon={<ArrowDown size={14} />} aria-label={`Đưa ${code} xuống`} onClick={() => move(index, 1)} />
                  <Button size="small" danger icon={<Trash2 size={14} />} aria-label={`Bỏ ${code} khỏi hạng mục`} onClick={() => onChange?.(value.filter((c) => c !== code))} />
                </div>
              );
            })}
          </div>
        ) : <p className="text-xs text-stone-500">Chưa chọn sản phẩm. Trang quà tặng sẽ hiển thị thông báo đang cập nhật.</p>}
      </div>
      <Input.Search allowClear placeholder="Tìm theo tên hoặc mã sản phẩm" value={query} onChange={(e) => { setQuery(e.target.value); setPage(1); }} />
      {error ? <Alert type="error" title={error} action={<Button size="small" onClick={() => setReload((n) => n + 1)}>Thử lại</Button>} /> : null}
      <Spin spinning={loading}>
        <div className="max-h-80 space-y-2 overflow-y-auto">
          {result.items.map((product) => (
            <div key={product.ma} className="flex items-center gap-2 rounded-lg border bg-white p-2">
              <ProductInfo product={product} />
              <Button size="small" disabled={loading || value.includes(product.ma) || value.length >= 100} icon={<Plus size={14} />} onClick={() => onChange?.([...value, product.ma])}>
                {value.includes(product.ma) ? "Đã chọn" : "Thêm"}
              </Button>
            </div>
          ))}
          {!loading && !error && !result.items.length ? <p className="py-4 text-center text-xs text-stone-500">Không tìm thấy sản phẩm phù hợp.</p> : null}
        </div>
      </Spin>
      <Pagination size="small" current={page} pageSize={result.limit} total={result.total} onChange={setPage} showSizeChanger={false} hideOnSinglePage />
      <p className="text-xs text-stone-500">Bỏ khỏi hạng mục chỉ gỡ liên kết; sản phẩm vẫn còn trong kho.</p>
    </div>
  );
}
