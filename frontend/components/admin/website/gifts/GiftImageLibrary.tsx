"use client";

import { useEffect, useState } from "react";
import { Alert, Button, Input, Modal, Pagination, Spin } from "antd";
import { adminFetch } from "@/components/admin/api/adminFetch";

type LibraryProduct = { ma: string; ten: string; anh?: string; images: string[] };
type LibraryResult = { items: LibraryProduct[]; total: number; limit: number };

export function GiftImageLibrary({ open, onClose, onSelect }: {
  open: boolean;
  onClose: () => void;
  onSelect: (image: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<LibraryResult>({ items: [], total: 0, limit: 12 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ q: query, page: String(page) });
        const data = await adminFetch<LibraryResult>(`/api/shop/admin/gifts/products?${params}`);
        if (!cancelled) { setResult(data); setError(""); }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Không thể tải ảnh từ kho Aloha");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 250);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [open, query, page, retry]);

  return (
    <Modal title="Chọn ảnh từ kho sản phẩm Aloha" open={open} onCancel={onClose} footer={null} width={850} zIndex={1100}>
      <div className="space-y-4">
        <p className="text-xs text-stone-500">Tìm sản phẩm rồi bấm vào ảnh muốn dùng làm ảnh thẻ quà tặng.</p>
        <Input.Search allowClear placeholder="Tìm theo tên hoặc mã sản phẩm" value={query} onChange={(e) => { setQuery(e.target.value); setPage(1); }} />
        {error ? <Alert type="error" title={error} action={<Button size="small" onClick={() => setRetry((n) => n + 1)}>Thử lại</Button>} /> : null}
        <Spin spinning={loading}>
          <div className="grid max-h-[480px] grid-cols-2 gap-3 overflow-y-auto p-1 sm:grid-cols-3 md:grid-cols-4">
            {result.items.map((product) => {
              const images = product.images?.length ? product.images : product.anh ? [product.anh] : [];
              return (
                <div key={product.ma} className="overflow-hidden rounded-xl border border-stone-200 bg-white p-2">
                  <button type="button" disabled={loading || !images[0]} onClick={() => onSelect(images[0])} aria-label={`Chọn ảnh chính ${product.ten}`} className="block aspect-square w-full overflow-hidden rounded-lg bg-stone-50 transition hover:ring-2 hover:ring-emerald-600">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {images[0] ? <img src={images[0]} alt={product.ten} className="h-full w-full object-contain" /> : null}
                  </button>
                  <div className="mt-2 text-xs font-semibold text-stone-800">{product.ten}</div>
                  <div className="text-[11px] text-stone-500">{product.ma} · {images.length} ảnh</div>
                  {images.length > 1 ? (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {images.slice(1).map((image, index) => (
                        <button key={image} type="button" disabled={loading} onClick={() => onSelect(image)} aria-label={`Chọn ảnh ${index + 2} ${product.ten}`} className="h-9 w-9 overflow-hidden rounded border transition hover:ring-2 hover:ring-emerald-600">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={image} alt="" className="h-full w-full object-cover" />
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
          {!loading && !error && !result.items.length ? <p className="py-8 text-center text-sm text-stone-500">Không tìm thấy sản phẩm có ảnh phù hợp.</p> : null}
        </Spin>
        <Pagination size="small" current={page} pageSize={result.limit} total={result.total} onChange={setPage} showSizeChanger={false} hideOnSinglePage />
      </div>
    </Modal>
  );
}
