"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "@/components/admin/toast";
import {
  websiteApi,
  type AppearanceBlock,
  type AppearanceHistoryMeta,
  type AppearanceLayout,
  type AppearanceTheme,
  type NavConfig,
} from "../api";
import { reloadShopPreviewIframes } from "../reloadShopPreview";
import type { CatNode } from "../nav/ShopWebNavEditor";
import type { BrandSectionId } from "./BrandAccordion";
import {
  WB,
  WbLoading,
  WbSegment,
} from "../ui";
import {
  SHOP_PREVIEW_URL,
  type SidePanel,
  combineLocalToIso,
  emptyPopup,
  ensureCoreHomeProductBlocks,
  formatScheduleVi,
  newId,
  splitLocalFromIso,
} from "./editorUtils";
import { EditorHeader } from "./EditorHeader";
import { BrandPanel } from "./panels/BrandPanel";
import { HomePanel } from "./panels/HomePanel";
import { MenuPanel } from "./panels/MenuPanel";
import { FooterPanel } from "./panels/FooterPanel";
import { EditorPreview } from "./EditorPreview";

export function ShopAppearanceEditor() {
  const [draft, setDraft] = useState<AppearanceLayout | null>(null);
  const [cats, setCats] = useState<CatNode[]>([]);
  const [dirtyFlag, setDirtyFlag] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [side, setSide] = useState<SidePanel>("home");
  const [previewKey, setPreviewKey] = useState(0);
  const [history, setHistory] = useState<AppearanceHistoryMeta[]>([]);
  const [scheduledAt, setScheduledAt] = useState<string | null>(null);
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleTime, setScheduleTime] = useState("");
  const [toolsOpen, setToolsOpen] = useState(false);
  const [brandOpen, setBrandOpen] = useState<BrandSectionId | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const toolsRef = useRef<HTMLDivElement | null>(null);

  const previewSrc = `${SHOP_PREVIEW_URL}/?_preview=${previewKey}`;


  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [r, tree] = await Promise.all([
        websiteApi<{
          draft: AppearanceLayout;
          dirty: boolean;
          history?: AppearanceHistoryMeta[];
          scheduledPublishAt?: string | null;
        }>("/api/shop/admin/appearance"),
        websiteApi<{ items: CatNode[] }>("/api/shop/category-tree").catch(() => ({
          items: [] as CatNode[],
        })),
      ]);
      const draftEnsured = ensureCoreHomeProductBlocks(r.draft);
      setDraft(draftEnsured);
      setCats(tree.items || []);
      setDirtyFlag(!!r.dirty || draftEnsured.blocks.length !== r.draft.blocks.length);
      setHistory(Array.isArray(r.history) ? r.history : []);
      setScheduledAt(r.scheduledPublishAt || null);
      const split = splitLocalFromIso(r.scheduledPublishAt);
      setScheduleDate(split.date);
      setScheduleTime(split.time);
      setSelectedId((id) =>
        id && draftEnsured.blocks.some((b) => b.id === id) ? id : null
      );
    } catch (e: any) {
      toast.error(e?.message || "Không tải được giao diện");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!toolsOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (!toolsRef.current?.contains(e.target as Node)) setToolsOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setToolsOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [toolsOpen]);

  const refreshPreview = () => {
    setPreviewKey((k) => k + 1);
    reloadShopPreviewIframes();
  };

  const saveDraftQuiet = async () => {
    if (!draft) return;
    const r = await websiteApi<{ draft: AppearanceLayout }>(
      "/api/shop/admin/appearance/draft",
      {
        method: "PUT",
        body: JSON.stringify({
          version: draft.version,
          blocks: draft.blocks,
          nav: draft.nav,
          theme: draft.theme,
        }),
      }
    );
    setDraft(r.draft);
    return r.draft;
  };

  const syncPreview = async () => {
    if (!draft) return;
    setSaving(true);
    try {
      await saveDraftQuiet();
      setDirtyFlag(true);
      refreshPreview();
      toast.success("Đã lưu nháp. Xem trước = bản đang lên web — bấm Áp dụng để khách thấy ngay");
    } catch (e: any) {
      toast.error(e?.message || "Đồng bộ thất bại");
    } finally {
      setSaving(false);
    }
  };

  const applyPublish = async () => {
    if (!confirm("Áp dụng lên web khách? Khách sẽ thấy ngay.")) return;
    setSaving(true);
    try {
      await saveDraftQuiet();
      await websiteApi("/api/shop/admin/appearance/publish", { method: "POST" });
      setDirtyFlag(false);
      refreshPreview();
      toast.success("Đã áp dụng — web shop cập nhật ngay");
      void load();
    } catch (e: any) {
      toast.error(e?.message || "Áp dụng thất bại");
    } finally {
      setSaving(false);
    }
  };

  const revert = async () => {
    if (!confirm("Hoàn tác về bản đã xuất bản trước đó?")) return;
    try {
      await websiteApi("/api/shop/admin/appearance/revert", { method: "POST" });
      toast.success("Đã hoàn tác");
      refreshPreview();
      void load();
    } catch (e: any) {
      toast.error(e?.message || "Hoàn tác thất bại");
    }
  };

  const saveSchedule = async () => {
    setSaving(true);
    try {
      await saveDraftQuiet();
      const scheduledPublishAt = combineLocalToIso(scheduleDate, scheduleTime);
      if (scheduleDate && !scheduledPublishAt) {
        toast.error("Ngày/giờ hẹn không hợp lệ");
        return;
      }
      const r = await websiteApi<{
        scheduledPublishAt: string | null;
        publishedNow?: boolean;
      }>("/api/shop/admin/appearance/schedule", {
        method: "POST",
        body: JSON.stringify({ scheduledPublishAt }),
      });
      if (r.publishedNow) {
        setScheduledAt(null);
        setScheduleDate("");
        setScheduleTime("");
        setDirtyFlag(false);
        refreshPreview();
        toast.success("Đã đến giờ — đã áp dụng lên web shop ngay");
        setToolsOpen(false);
        void load();
        return;
      }
      setScheduledAt(r.scheduledPublishAt || null);
      const split = splitLocalFromIso(r.scheduledPublishAt);
      setScheduleDate(split.date);
      setScheduleTime(split.time);
      toast.success(
        r.scheduledPublishAt
          ? `Đã hẹn — web shop chỉ đổi lúc ${formatScheduleVi(r.scheduledPublishAt)} (chưa đổi ngay)`
          : "Đã hủy hẹn giờ áp dụng"
      );
      void load();
    } catch (e: any) {
      toast.error(e?.message || "Hẹn giờ thất bại");
    } finally {
      setSaving(false);
    }
  };

  const restoreHistory = async (historyId: string) => {
    if (!historyId) return;
    if (
      !confirm(
        "Khôi phục bản này vào nháp? (Chưa lên web khách cho đến khi Áp dụng)"
      )
    )
      return;
    setSaving(true);
    try {
      const r = await websiteApi<{ draft: AppearanceLayout }>(
        "/api/shop/admin/appearance/restore",
        {
          method: "POST",
          body: JSON.stringify({ historyId }),
        }
      );
      setDraft(r.draft);
      setDirtyFlag(true);
      toast.success("Đã khôi phục vào nháp");
      void load();
    } catch (e: any) {
      toast.error(e?.message || "Khôi phục thất bại");
    } finally {
      setSaving(false);
    }
  };

  const clearSchedule = async () => {
    setScheduleDate("");
    setScheduleTime("");
    setSaving(true);
    try {
      await websiteApi("/api/shop/admin/appearance/schedule", {
        method: "POST",
        body: JSON.stringify({ scheduledPublishAt: null }),
      });
      setScheduledAt(null);
      toast.success("Đã hủy hẹn giờ");
      void load();
    } catch (e: any) {
      toast.error(e?.message || "Hủy hẹn thất bại");
    } finally {
      setSaving(false);
    }
  };

  const updateBlock = (id: string, patch: Partial<AppearanceBlock>) => {
    setDraft((d) => {
      if (!d) return d;
      return {
        ...d,
        blocks: d.blocks.map((b) => (b.id === id ? { ...b, ...patch } : b)),
      };
    });
  };

  const updateProps = (id: string, props: Record<string, unknown>) => {
    setDraft((d) => {
      if (!d) return d;
      return {
        ...d,
        blocks: d.blocks.map((b) =>
          b.id === id ? { ...b, props: { ...b.props, ...props } } : b
        ),
      };
    });
  };

  const patchTheme = (patch: Partial<AppearanceTheme>) => {
    setDraft((d) => (d ? { ...d, theme: { ...d.theme, ...patch } } : d));
  };

  const patchPopup = (
    patch: Partial<NonNullable<AppearanceTheme["popup"]>>
  ) => {
    setDraft((d) => {
      if (!d) return d;
      const cur = d.theme.popup || emptyPopup();
      return {
        ...d,
        theme: {
          ...d.theme,
          popup: { ...cur, ...patch },
        },
      };
    });
  };

  const addProductSection = () => {
    const b: AppearanceBlock = {
      id: newId("sec"),
      type: "product_section",
      enabled: true,
      props: {
        title: "Mục sản phẩm mới",
        source: "category",
        categoryId: 0,
        categoryName: "",
        categorySlug: "",
        nhomPath: "",
        nhomName: "",
        nhomSlug: "",
        limit: 10,
        sort: "ban_chay",
      },
    };
    setDraft((d) => (d ? { ...d, blocks: [...d.blocks, b] } : d));
    setSelectedId(b.id);
    setSide("home");
  };

  const addArticleSection = () => {
    const b: AppearanceBlock = {
      id: newId("art"),
      type: "article_section",
      enabled: true,
      props: {
        title: "Bài viết mới",
        limit: 3,
      },
    };
    setDraft((d) => (d ? { ...d, blocks: [...d.blocks, b] } : d));
    setSelectedId(b.id);
    setSide("home");
  };

  const setNav = (next: NavConfig) => {
    setDraft((d) => (d ? { ...d, nav: next } : d));
  };

  if (loading || !draft) {
    return <WbLoading label="Đang tải giao diện…" />;
  }

  const primary = draft.theme.primaryColor || WB.accent;

  return (
    <div
      className="flex h-[calc(100vh-8rem)] min-h-[520px] flex-col"
      style={{ background: WB.canvas }}
    >
      <EditorHeader
        primary={primary}
        dirtyFlag={dirtyFlag}
        scheduledAt={scheduledAt}
        device={device}
        setDevice={setDevice}
        toolsRef={toolsRef}
        toolsOpen={toolsOpen}
        setToolsOpen={setToolsOpen}
        saving={saving}
        history={history}
        scheduleDate={scheduleDate}
        setScheduleDate={setScheduleDate}
        scheduleTime={scheduleTime}
        setScheduleTime={setScheduleTime}
        revert={revert}
        restoreHistory={restoreHistory}
        saveSchedule={saveSchedule}
        clearSchedule={clearSchedule}
        syncPreview={syncPreview}
        applyPublish={applyPublish}
        shopPreviewUrl={SHOP_PREVIEW_URL}
      />

      <div className="flex min-h-0 flex-1">
        <aside className="flex w-[min(100%,380px)] shrink-0 flex-col border-r border-gray-200 bg-white lg:w-[400px]">
          <div className="shrink-0 border-b border-gray-100 px-3 py-2.5">
            <WbSegment
              value={side}
              onChange={setSide}
              size="sm"
              options={[
                { id: "brand", label: "Thương hiệu" },
                { id: "home", label: "Trang chủ" },
                { id: "menu", label: "Menu" },
                { id: "footer", label: "Footer" },
              ]}
            />
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
            {side === "brand" ? (
              <BrandPanel
                draft={draft}
                setDraft={setDraft}
                primary={primary}
                brandOpen={brandOpen}
                setBrandOpen={setBrandOpen}
                patchTheme={patchTheme}
                patchPopup={patchPopup}
              />
            ) : null}

            {side === "home" ? (
              <HomePanel
                draft={draft}
                setDraft={setDraft}
                selectedId={selectedId}
                setSelectedId={setSelectedId}
                primary={primary}
                cats={cats}
                addProductSection={addProductSection}
                addArticleSection={addArticleSection}
                updateBlock={updateBlock}
                updateProps={updateProps}
              />
            ) : null}

            {side === "menu" ? (
              <MenuPanel
                draft={draft}
                setNav={setNav}
                cats={cats}
              />
            ) : null}

            {side === "footer" ? (
              <FooterPanel
                draft={draft}
                setDraft={setDraft}
              />
            ) : null}
          </div>
        </aside>

        <EditorPreview
          device={device}
          previewKey={previewKey}
          previewSrc={previewSrc}
          iframeRef={iframeRef}
          shopPreviewUrl={SHOP_PREVIEW_URL}
        />
      </div>
    </div>
  );
}
