"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "@/components/admin/toast";
import { ThuMuaListPagination } from "@/components/admin/ui/ThuMuaListPagination";
import { websiteApi } from "../api";
import {
  AUDIENCE_TABS,
  BADGE_OPTIONS,
  BADGE_FILTER_OPTIONS,
  type AudienceType,
  type BadgeFilter,
  type Row,
} from "./catalog/catalogTypes";
import { ProductCatalogDesktopToolbar } from "./catalog/ProductCatalogDesktopToolbar";
import { ProductCatalogMobileToolbar } from "./catalog/ProductCatalogMobileToolbar";
import { ProductCatalogDesktopTable } from "./catalog/ProductCatalogDesktopTable";
import { ProductCatalogMobileList } from "./catalog/ProductCatalogMobileList";
import { ProductCatalogDrawers } from "./catalog/ProductCatalogDrawers";

export { type Row, type BadgeFilter, type AudienceType } from "./catalog/catalogTypes";

export function ShopWebProductsAdmin() {
  const [audience, setAudience] = useState<AudienceType>("common");
  const [draft, setDraft] = useState("");
  const [appliedQ, setAppliedQ] = useState("");
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<Row[]>([]);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [visible, setVisible] = useState<"all" | "1" | "0">("all");
  const [badgeFilter, setBadgeFilter] = useState<BadgeFilter>("all");
  const [applyingDefaults, setApplyingDefaults] = useState(false);
  const [selectedNhoms, setSelectedNhoms] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(40);
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busyMa, setBusyMa] = useState<string | null>(null);
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);
  const [mobileGuideOpen, setMobileGuideOpen] = useState(false);
  const [badgeTargetRow, setBadgeTargetRow] = useState<Row | null>(null);
  const draftRef = useRef("");
  const suggestSeq = useRef(0);

  const siBadge = audience === "si_noi_bat" ? "noi_bat" : "uu_dai";
  const badgeOptions =
    audience === "common"
      ? BADGE_OPTIONS
      : BADGE_OPTIONS.filter((o) => !o.value || o.value === siBadge);
  const badgeFilterOptions =
    audience === "common"
      ? BADGE_FILTER_OPTIONS
      : BADGE_FILTER_OPTIONS.filter((o) => o.value === "auto" || o.value === siBadge);

  const activeFilterCount =
    (selectedNhoms.length > 0 ? 1 : 0) +
    (visible !== "all" ? 1 : 0) +
    (badgeFilter !== "all" ? 1 : 0);

  const handleAudienceChange = (val: AudienceType) => {
    if (val === audience || loading || Boolean(busyMa) || applyingDefaults) return;
    setAudience(val);
    setBadgeFilter("all");
    setPage(1);
    setRows([]);
    setSuggestions([]);
    setLoading(true);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(pageSize),
        visible,
        audience,
      });
      if (appliedQ.trim()) params.set("q", appliedQ.trim());
      for (const n of selectedNhoms) {
        const p = String(n || "").trim();
        if (p) params.append("nhom", p);
      }
      params.set("audience", audience);
      if (badgeFilter !== "all") params.set("badge", badgeFilter);
      const r = await websiteApi<{
        items: Row[];
        total: number;
        pages: number;
      }>(`/api/shop/admin/products?${params}`);
      setRows(r.items || []);
      setTotal(r.total || 0);
    } catch (e: any) {
      toast.error(e?.message || "Không tải được danh sách");
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, appliedQ, visible, selectedNhoms, badgeFilter, audience]);

  useEffect(() => {
    void load();
  }, [load]);

  /** Gõ → gợi ý dropdown (không lọc bảng). */
  useEffect(() => {
    const term = draft.trim();
    if (!term) {
      setSuggestions([]);
      setSuggestLoading(false);
      return;
    }
    const seq = ++suggestSeq.current;
    setSuggestLoading(true);
    const t = setTimeout(() => {
      const params = new URLSearchParams({
        page: "1",
        limit: "12",
        visible,
        q: term,
      });
      for (const n of selectedNhoms) {
        const p = String(n || "").trim();
        if (p) params.append("nhom", p);
      }
      params.set("audience", audience);
      if (badgeFilter !== "all") params.set("badge", badgeFilter);
      void websiteApi<{ items: Row[] }>(`/api/shop/admin/products?${params}`)
        .then((r) => {
          if (seq !== suggestSeq.current) return;
          setSuggestions(r.items || []);
        })
        .catch(() => {
          if (seq !== suggestSeq.current) return;
          setSuggestions([]);
        })
        .finally(() => {
          if (seq === suggestSeq.current) setSuggestLoading(false);
        });
    }, 220);
    return () => clearTimeout(t);
  }, [draft, visible, selectedNhoms, badgeFilter, audience]);

  const applySearch = (term: string) => {
    const next = term.trim();
    setAppliedQ(next);
    setDraft(next);
    draftRef.current = next;
    setPage(1);
    setSuggestOpen(false);
  };

  const clearSearch = () => {
    setDraft("");
    draftRef.current = "";
    setAppliedQ("");
    setSuggestions([]);
    setSuggestOpen(false);
    setPage(1);
  };

  const pickSuggestion = (row: Row) => {
    applySearch(row.ma);
  };

  const patchRow = (ma: string, patch: Partial<Row>) => {
    setRows((list) => list.map((x) => (x.ma === ma ? { ...x, ...patch } : x)));
    setSuggestions((list) => list.map((x) => (x.ma === ma ? { ...x, ...patch } : x)));
  };

  const toggle = async (row: Row) => {
    setBusyMa(row.ma);
    try {
      await websiteApi(`/api/shop/admin/products/${encodeURIComponent(row.ma)}/visibility`, {
        method: "PATCH",
        body: JSON.stringify({ hienThiWeb: !row.hienThiWeb }),
      });
      patchRow(row.ma, { hienThiWeb: !row.hienThiWeb });
      toast.success(
        !row.hienThiWeb ? `Đã hiện ${row.ma} trên web` : `Đã ẩn ${row.ma} khỏi web`
      );
    } catch (e: any) {
      toast.error(e?.message || "Đổi trạng thái thất bại");
    } finally {
      setBusyMa(null);
    }
  };

  const saveMerch = async (
    row: Row,
    patch: { webPin?: number; webBadge?: string }
  ) => {
    setBusyMa(row.ma);
    if (patch.webBadge !== undefined || patch.webPin !== undefined) {
      patchRow(row.ma, {
        ...(patch.webBadge !== undefined ? { webBadge: patch.webBadge } : {}),
        ...(patch.webPin !== undefined ? { webPin: patch.webPin } : {}),
      });
    }
    try {
      const r = await websiteApi<{
        ok?: boolean;
        webPin?: number;
        webBadge?: string;
        clearedMas?: string[];
      }>(`/api/shop/admin/products/${encodeURIComponent(row.ma)}/merchandising`, {
        method: "PATCH",
        body: JSON.stringify({ ...patch, audience }),
      });
      const savedBadge =
        r.webBadge !== undefined ? r.webBadge : patch.webBadge;
      if (
        patch.webBadge !== undefined &&
        String(patch.webBadge || "").trim() &&
        !String(savedBadge || "").trim()
      ) {
        toast.error(
          "Máy chủ không nhận nhãn này — thử restart API (npm run dev) rồi gắn lại"
        );
        void load();
        return;
      }
      patchRow(row.ma, {
        webPin: r.webPin !== undefined ? r.webPin : patch.webPin,
        webBadge: savedBadge,
      });
      if (r.clearedMas?.length) {
        for (const m of r.clearedMas) {
          patchRow(m, { webPin: 0 });
        }
        toast.success(
          `Đã lưu ${row.ma}` +
            (r.clearedMas.length
              ? ` · nhả ghim: ${r.clearedMas.join(", ")}`
              : "")
        );
      } else {
        toast.success(`Đã lưu ghim/nhãn ${row.ma}`);
      }
    } catch (e: any) {
      toast.error(e?.message || "Lưu ghim/nhãn thất bại");
      void load();
    } finally {
      setBusyMa(null);
    }
  };

  const applyDefaultBadges = async () => {
    if (applyingDefaults) return;
    setApplyingDefaults(true);
    try {
      const r = await websiteApi<{
        banChaySapHet: number;
        datTruoc: number;
        moi: number;
        updated: number;
        skippedManual: number;
      }>("/api/shop/admin/products/apply-default-badges", { method: "POST" });
      toast.success(
        `Đã áp nhãn mặc định: ${r.banChaySapHet || 0} bán chạy+sắp hết · ${r.datTruoc || 0} đặt trước` +
          (r.skippedManual ? ` · bỏ qua ${r.skippedManual} đã gắn nhãn` : "")
      );
      void load();
    } catch (e: any) {
      toast.error(e?.message || "Áp nhãn mặc định thất bại");
    } finally {
      setApplyingDefaults(false);
    }
  };

  return (
    <div className="flex min-h-[calc(100vh-10rem)] flex-col bg-white p-3.5 md:p-5">
      {/* 1A. TOOLBAR TRÊN DESKTOP */}
      <ProductCatalogDesktopToolbar
        audience={audience}
        onAudienceChange={handleAudienceChange}
        total={total}
        appliedQ={appliedQ}
        draft={draft}
        setDraft={setDraft}
        draftRef={draftRef}
        suggestOpen={suggestOpen}
        setSuggestOpen={setSuggestOpen}
        suggestions={suggestions}
        suggestLoading={suggestLoading}
        onApplySearch={applySearch}
        onClearSearch={clearSearch}
        onPickSuggestion={pickSuggestion}
        selectedNhoms={selectedNhoms}
        setSelectedNhoms={setSelectedNhoms}
        visible={visible}
        setVisible={setVisible}
        badgeFilter={badgeFilter}
        setBadgeFilter={setBadgeFilter}
        badgeFilterOptions={badgeFilterOptions}
        onRefresh={() => void load()}
        onApplyDefaultBadges={() => void applyDefaultBadges()}
        applyingDefaults={applyingDefaults}
        loading={loading}
        busyMa={busyMa}
        setPage={setPage}
      />

      {/* 1B. TOOLBAR GỌN GÀNG TRÊN MOBILE */}
      <ProductCatalogMobileToolbar
        audience={audience}
        onAudienceChange={handleAudienceChange}
        total={total}
        appliedQ={appliedQ}
        draft={draft}
        setDraft={setDraft}
        draftRef={draftRef}
        suggestOpen={suggestOpen}
        setSuggestOpen={setSuggestOpen}
        suggestions={suggestions}
        suggestLoading={suggestLoading}
        onApplySearch={applySearch}
        onClearSearch={clearSearch}
        onPickSuggestion={pickSuggestion}
        activeFilterCount={activeFilterCount}
        onOpenMobileFilter={() => setMobileFilterOpen(true)}
        onOpenMobileGuide={() => setMobileGuideOpen(true)}
        onRefresh={() => void load()}
        onApplyDefaultBadges={() => void applyDefaultBadges()}
        applyingDefaults={applyingDefaults}
        loading={loading}
        busyMa={busyMa}
      />

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden border border-gray-200 bg-white">
        {/* 1. BẢNG DỮ LIỆU ĐẦY ĐỦ TRÊN DESKTOP */}
        <ProductCatalogDesktopTable
          rows={rows}
          loading={loading}
          badgeFilter={badgeFilter}
          badgeOptions={badgeOptions}
          audience={audience}
          busyMa={busyMa}
          onPatchRow={patchRow}
          onSaveMerch={(row, patch) => void saveMerch(row, patch)}
          onToggle={(row) => void toggle(row)}
        />

        {/* 2. DANH SÁCH MOBILE */}
        <ProductCatalogMobileList
          rows={rows}
          loading={loading}
          audience={audience}
          busyMa={busyMa}
          onPatchRow={patchRow}
          onSaveMerch={(row, patch) => void saveMerch(row, patch)}
          onToggle={(row) => void toggle(row)}
          onSetBadgeTargetRow={setBadgeTargetRow}
        />

        <ThuMuaListPagination
          page={page}
          pageSize={pageSize}
          total={total}
          onPageChange={setPage}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setPage(1);
          }}
          itemLabel="hàng hóa"
        />
      </div>

      {/* 3. DRAWERS & MODALS (Bộ lọc, Chọn nhãn, Hướng dẫn) */}
      <ProductCatalogDrawers
        mobileFilterOpen={mobileFilterOpen}
        onCloseMobileFilter={() => setMobileFilterOpen(false)}
        activeFilterCount={activeFilterCount}
        selectedNhoms={selectedNhoms}
        setSelectedNhoms={setSelectedNhoms}
        visible={visible}
        setVisible={setVisible}
        badgeFilter={badgeFilter}
        setBadgeFilter={setBadgeFilter}
        badgeFilterOptions={badgeFilterOptions}
        total={total}
        setPage={setPage}
        badgeTargetRow={badgeTargetRow}
        onCloseBadgeDrawer={() => setBadgeTargetRow(null)}
        badgeOptions={badgeOptions}
        onSaveMerch={(row, patch) => void saveMerch(row, patch)}
        mobileGuideOpen={mobileGuideOpen}
        onCloseMobileGuide={() => setMobileGuideOpen(false)}
        audience={audience}
      />
    </div>
  );
}
