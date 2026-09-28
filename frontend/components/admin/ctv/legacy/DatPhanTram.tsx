"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "@/components/admin/toast";
import { api, type ProductRateRow } from "./api";
import { ShopDefaultRateBanner } from "./dat-phan-tram/ShopDefaultRateBanner";
import { ProductRateTable } from "./dat-phan-tram/ProductRateTable";
import { BulkModals } from "./dat-phan-tram/BulkModals";

export function DatPhanTram({
  defaultRate,
  settingsTick,
}: {
  defaultRate?: number;
  settingsTick: number;
}) {
  const [q, setQ] = useState("");
  const [suggestLive, setSuggestLive] = useState("");
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<ProductRateRow[]>([]);
  const [rows, setRows] = useState<ProductRateRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 15;
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [batchRate, setBatchRate] = useState("");
  const [liveDefault, setLiveDefault] = useState(defaultRate);
  const [rateFilterTab, setRateFilterTab] = useState<"all" | "default" | "custom" | "excluded">("all");
  const [stats, setStats] = useState<{
    totalProducts: number;
    defaultRateProducts: number;
    customRateProducts: number;
    excludedProducts: number;
  } | null>(null);

  // Modal / action states for bulk operations
  const [showShopDefaultModal, setShowShopDefaultModal] = useState(false);
  const [newShopRate, setNewShopRate] = useState<string>("");
  const [shopRateApplyMode, setShopRateApplyMode] = useState<"unconfigured_only" | "overwrite_all">("unconfigured_only");
  const [showApplyAllModal, setShowApplyAllModal] = useState(false);
  const [allProductsRate, setAllProductsRate] = useState<string>("");
  const [submittingBulk, setSubmittingBulk] = useState(false);

  const searchWrapRef = useRef<HTMLDivElement>(null);
  const suggestTimer = useRef<number | null>(null);

  const loadStats = useCallback(async () => {
    try {
      const s = await api<{
        ok: boolean;
        defaultRate: number;
        totalProducts: number;
        defaultRateProducts: number;
        customRateProducts: number;
        excludedProducts: number;
      }>("/api/shop/admin/ctv/product-rates-stats");
      if (s.ok) {
        setStats({
          totalProducts: s.totalProducts,
          defaultRateProducts: s.defaultRateProducts,
          customRateProducts: s.customRateProducts,
          excludedProducts: s.excludedProducts,
        });
        if (s.defaultRate != null) setLiveDefault(s.defaultRate);
      }
    } catch {
      // ignore
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api<{ data: ProductRateRow[]; total: number; defaultRate?: number }>(
        `/api/shop/admin/ctv/product-rates?q=${encodeURIComponent(q)}&rateType=${rateFilterTab}&page=${page}&limit=${pageSize}`
      );
      setRows(r.data || []);
      setTotal(r.total || 0);
      if (r.defaultRate != null) setLiveDefault(r.defaultRate);
    } catch (e: any) {
      toast.error(e?.message || "Lỗi tải SP");
    } finally {
      setLoading(false);
    }
  }, [q, rateFilterTab, page, pageSize]);

  useEffect(() => {
    void load();
  }, [load, settingsTick]);

  useEffect(() => {
    void loadStats();
  }, [loadStats, settingsTick]);

  useEffect(() => {
    if (defaultRate != null) setLiveDefault(defaultRate);
  }, [defaultRate, settingsTick]);

  useEffect(() => {
    if (suggestTimer.current) window.clearTimeout(suggestTimer.current);
    const typed = suggestLive.trim();
    if (!typed) {
      setSuggestions([]);
      return;
    }
    suggestTimer.current = window.setTimeout(async () => {
      try {
        const r = await api<{ data: ProductRateRow[] }>(
          `/api/shop/admin/ctv/product-rates?q=${encodeURIComponent(typed)}&page=1&limit=12`
        );
        setSuggestions(r.data || []);
      } catch {
        setSuggestions([]);
      }
    }, 280);
    return () => {
      if (suggestTimer.current) window.clearTimeout(suggestTimer.current);
    };
  }, [suggestLive]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!searchWrapRef.current?.contains(e.target as Node)) setSuggestOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const applySearch = (term: string) => {
    setQ(term.trim());
    setPage(1);
    setSuggestLive(term.trim());
    setSuggestOpen(false);
  };

  const saveOne = async (ma: string, rate: number | null) => {
    try {
      await api("/api/shop/admin/ctv/product-rates", {
        method: "POST",
        body: JSON.stringify({
          items: rate == null ? [{ ma, clearRate: true }] : [{ ma, ctvCommissionRate: rate }],
        }),
      });
      toast.success(`Đã cập nhật ${ma}`);
      void load();
      void loadStats();
    } catch (e: any) {
      toast.error(e?.message || "Lỗi");
    }
  };

  // 1. Áp dụng tỷ lệ mặc định toàn shop (Shop-wide Default Rate)
  const handleSaveShopDefault = async () => {
    const rate = Number(newShopRate);
    if (!Number.isFinite(rate) || rate < 0) {
      toast.error("Vui lòng nhập tỷ lệ % hợp lệ (≥ 0)");
      return;
    }
    setSubmittingBulk(true);
    try {
      const res = await api<{ ok: boolean; message: string; defaultRate: number }>(
        "/api/shop/admin/ctv/product-rates/bulk",
        {
          method: "POST",
          body: JSON.stringify({
            action: "set_shop_default",
            rate,
            applyMode: shopRateApplyMode,
          }),
        }
      );
      toast.success(res.message || "Đã lưu tỷ lệ toàn shop");
      setLiveDefault(res.defaultRate);
      setShowShopDefaultModal(false);
      void load();
      void loadStats();
    } catch (e: any) {
      toast.error(e?.message || "Lỗi lưu tỷ lệ toàn shop");
    } finally {
      setSubmittingBulk(false);
    }
  };

  // 2. Gán cứng % hoa hồng cho toàn bộ sản phẩm trong shop
  const handleApplyAllProducts = async () => {
    const rate = Number(allProductsRate);
    if (!Number.isFinite(rate) || rate < 0) {
      toast.error("Vui lòng nhập tỷ lệ % hợp lệ (≥ 0)");
      return;
    }
    setSubmittingBulk(true);
    try {
      const res = await api<{ ok: boolean; message: string }>(
        "/api/shop/admin/ctv/product-rates/bulk",
        {
          method: "POST",
          body: JSON.stringify({
            action: "apply_all_products",
            rate,
          }),
        }
      );
      toast.success(res.message || "Đã áp dụng cho toàn bộ sản phẩm");
      setShowApplyAllModal(false);
      void load();
      void loadStats();
    } catch (e: any) {
      toast.error(e?.message || "Lỗi áp dụng cho toàn bộ SP");
    } finally {
      setSubmittingBulk(false);
    }
  };

  // 3. Khôi phục toàn bộ sản phẩm về tỷ lệ mặc định shop
  const handleResetAllToDefault = async () => {
    const ok = window.confirm(
      `Xác nhận xóa bỏ toàn bộ cài đặt riêng của các sản phẩm và đưa tất cả về mức mặc định ${liveDefault ?? 0}%?`
    );
    if (!ok) return;
    setSubmittingBulk(true);
    try {
      const res = await api<{ ok: boolean; message: string }>(
        "/api/shop/admin/ctv/product-rates/bulk",
        {
          method: "POST",
          body: JSON.stringify({
            action: "reset_all_to_default",
          }),
        }
      );
      toast.success(res.message || "Đã khôi phục toàn bộ về mặc định");
      void load();
      void loadStats();
    } catch (e: any) {
      toast.error(e?.message || "Lỗi khôi phục mặc định");
    } finally {
      setSubmittingBulk(false);
    }
  };

  const handleBatchSetSelected = async () => {
    const rate = Number(batchRate);
    if (!Number.isFinite(rate) || rate < 0) {
      toast.error("Nhập % hợp lệ");
      return;
    }
    try {
      await api("/api/shop/admin/ctv/product-rates/bulk", {
        method: "POST",
        body: JSON.stringify({
          action: "bulk_set_selected",
          maList: [...selected],
          rate,
        }),
      });
      toast.success(`Đã cập nhật ${selected.size} SP thành ${rate}%`);
      setSelected(new Set());
      setBatchRate("");
      void load();
      void loadStats();
    } catch (e: any) {
      toast.error(e?.message || "Lỗi cập nhật");
    }
  };

  const handleBatchClearSelected = async () => {
    try {
      await api("/api/shop/admin/ctv/product-rates/bulk", {
        method: "POST",
        body: JSON.stringify({
          action: "bulk_set_selected",
          maList: [...selected],
          clearRate: true,
        }),
      });
      toast.success(`Đã đưa ${selected.size} SP về mặc định`);
      setSelected(new Set());
      void load();
      void loadStats();
    } catch (e: any) {
      toast.error(e?.message || "Lỗi");
    }
  };

  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <ShopDefaultRateBanner
        liveDefault={liveDefault}
        submittingBulk={submittingBulk}
        stats={stats}
        rateFilterTab={rateFilterTab}
        setRateFilterTab={setRateFilterTab}
        setPage={setPage}
        onOpenShopDefaultModal={() => {
          setNewShopRate(String(liveDefault ?? 5));
          setShopRateApplyMode("unconfigured_only");
          setShowShopDefaultModal(true);
        }}
        onOpenApplyAllModal={() => {
          setAllProductsRate(String(liveDefault ?? 10));
          setShowApplyAllModal(true);
        }}
        onResetAllToDefault={() => void handleResetAllToDefault()}
      />

      <ProductRateTable
        rows={rows}
        selected={selected}
        setSelected={setSelected}
        batchRate={batchRate}
        setBatchRate={setBatchRate}
        searchWrapRef={searchWrapRef}
        suggestLive={suggestLive}
        setSuggestLive={setSuggestLive}
        suggestOpen={suggestOpen}
        setSuggestOpen={setSuggestOpen}
        suggestions={suggestions}
        q={q}
        setQ={setQ}
        applySearch={applySearch}
        loading={loading}
        saveOne={saveOne}
        handleBatchSetSelected={handleBatchSetSelected}
        handleBatchClearSelected={handleBatchClearSelected}
        page={page}
        pageSize={pageSize}
        total={total}
        setPage={setPage}
      />

      <BulkModals
        showShopDefaultModal={showShopDefaultModal}
        setShowShopDefaultModal={setShowShopDefaultModal}
        newShopRate={newShopRate}
        setNewShopRate={setNewShopRate}
        shopRateApplyMode={shopRateApplyMode}
        setShopRateApplyMode={setShopRateApplyMode}
        submittingBulk={submittingBulk}
        handleSaveShopDefault={handleSaveShopDefault}
        showApplyAllModal={showApplyAllModal}
        setShowApplyAllModal={setShowApplyAllModal}
        allProductsRate={allProductsRate}
        setAllProductsRate={setAllProductsRate}
        handleApplyAllProducts={handleApplyAllProducts}
      />
    </div>
  );
}
