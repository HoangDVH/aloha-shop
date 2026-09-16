"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Check,
  Clock,
  ExternalLink,
  FileText,
  Globe,
  History,
  Image as ImageIcon,
  Layers,
  Loader2,
  Monitor,
  MoreHorizontal,
  Palette,
  Plus,
  RefreshCw,
  RotateCcw,
  Smartphone,
  Sparkles,
  Trash2,
  Type,
  Megaphone,
} from "lucide-react";
import { toast } from "@/components/admin/toast";
import {
  websiteApi,
  FONT_OPTIONS,
  type AppearanceBlock,
  type AppearanceFontFamily,
  type AppearanceHistoryMeta,
  type AppearanceLayout,
  type AppearanceTheme,
  type NavConfig,
} from "../api";
import { reloadShopPreviewIframes } from "../reloadShopPreview";
import { ShopNavPanel, type CatNode } from "../nav/ShopWebNavEditor";
import { ShopCategoryPicker } from "./ShopCategoryPicker";
import { BlockList, BLOCK_LABEL } from "./BlockList";
import { BrandAccordion, type BrandSectionId } from "./BrandAccordion";
import { HeroSlidesForm, type HeroSlideDraft } from "./HeroSlidesForm";
import { ImageUploadField } from "./ImageUploadField";
import {
  WB,
  WbBadge,
  WbBtn,
  WbField,
  WbIconSegment,
  WbLoading,
  WbSectionLabel,
  WbSegment,
  wbInput,
  wbSelect,
} from "../ui";

const SHOP_PREVIEW_URL =
  (typeof import.meta !== "undefined" && (import.meta as any).env?.VITE_SHOP_PREVIEW_URL) ||
  "http://localhost:3002";

const COLOR_PRESETS = [
  "#3D6B3A",
  "#0D9488",
  "#0891B2",
  "#2563EB",
  "#4F46E5",
  "#7C3AED",
  "#DB2777",
  "#DC2626",
  "#EA580C",
  "#CA8A04",
  "#65A30D",
  "#059669",
  "#334155",
  "#0F172A",
];

type SidePanel = "brand" | "home" | "menu" | "footer";

function newId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

function emptyPopup(): NonNullable<AppearanceTheme["popup"]> {
  return {
    enabled: false,
    campaignId: "promo",
    title: "Giảm giá đặc biệt",
    body: "Nhập mã bên dưới khi thanh toán — áp dụng cho đơn trên web.",
    imageUrl: "",
    ctaLabel: "Dùng mã ngay",
    ctaHref: "/tim",
    couponCode: "ALOHA10",
    delaySeconds: 3,
    frequencyDays: 7,
    showOncePerCampaign: true,
  };
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function splitLocalFromIso(iso: string | null | undefined): {
  date: string;
  time: string;
} {
  if (!iso) return { date: "", time: "" };
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return { date: "", time: "" };
  const d = new Date(t);
  return {
    date: `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`,
    time: `${pad2(d.getHours())}:${pad2(d.getMinutes())}`,
  };
}

/** Ghép ngày + giờ máy local → ISO UTC để lưu server. */
function combineLocalToIso(date: string, time: string): string | null {
  const d = date.trim();
  const tm = (time.trim() || "00:00").slice(0, 5);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return null;
  if (!/^\d{2}:\d{2}$/.test(tm)) return null;
  const parsed = Date.parse(`${d}T${tm}:00`);
  if (!Number.isFinite(parsed)) return null;
  return new Date(parsed).toISOString();
}

function formatScheduleVi(iso: string | null | undefined): string {
  if (!iso) return "";
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "";
  const d = new Date(t);
  const ngay = `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}`;
  const gio = `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  return `${gio} ngày ${ngay}`;
}

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
      setDraft(r.draft);
      setCats(tree.items || []);
      setDirtyFlag(!!r.dirty);
      setHistory(Array.isArray(r.history) ? r.history : []);
      setScheduledAt(r.scheduledPublishAt || null);
      const split = splitLocalFromIso(r.scheduledPublishAt);
      setScheduleDate(split.date);
      setScheduleTime(split.time);
      setSelectedId((id) =>
        id && r.draft.blocks.some((b) => b.id === id) ? id : null
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
        theme: { ...d.theme, popup: { ...cur, ...patch } },
      };
    });
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
        limit: 15,
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
  const popup = draft.theme.popup || emptyPopup();
  const seo = draft.theme.seo || { title: "", description: "" };

  return (
    <div
      className="flex h-[calc(100vh-8rem)] min-h-[520px] flex-col"
      style={{ background: WB.canvas }}
    >
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-gray-200 bg-white px-4">
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          <div
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white"
            style={{ background: primary }}
          >
            <Palette className="h-4 w-4" />
          </div>
          <h2 className="truncate text-[13px] font-semibold text-gray-900">
            Chỉnh sửa giao diện
          </h2>
          {dirtyFlag ? (
            <WbBadge tone="warn">Chưa áp dụng</WbBadge>
          ) : (
            <WbBadge tone="success">Đã đồng bộ</WbBadge>
          )}
          {scheduledAt ? (
            <button
              type="button"
              onClick={() => setToolsOpen(true)}
              className="hidden max-w-[220px] truncate rounded-full border-0 bg-amber-50 px-2.5 py-0.5 text-left text-[11px] font-semibold text-amber-800 hover:bg-amber-100 sm:inline"
              title="Mở hẹn giờ"
            >
              Hẹn {formatScheduleVi(scheduledAt)}
            </button>
          ) : null}
        </div>

        <WbIconSegment
          value={device}
          onChange={setDevice}
          options={[
            { id: "desktop", title: "Desktop", Icon: Monitor },
            { id: "mobile", title: "Mobile", Icon: Smartphone },
          ]}
        />

        <div className="flex flex-1 items-center justify-end gap-1.5">
          <div ref={toolsRef} className="relative">
            <WbBtn
              variant="ghost"
              className="!px-2.5"
              onClick={() => setToolsOpen((o) => !o)}
              title="Lịch sử & hẹn giờ"
            >
              <MoreHorizontal className="h-4 w-4" />
              <span className="hidden xl:inline">Thêm</span>
            </WbBtn>
            {toolsOpen ? (
              <div className="absolute right-0 top-full z-50 mt-1.5 w-[340px] rounded-xl border border-gray-200 bg-white p-3.5 shadow-xl">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <p className="text-[12px] font-semibold text-gray-900">
                    Lịch sử & hẹn giờ
                  </p>
                  <WbBtn
                    variant="ghost"
                    className="!h-7 !px-2 text-[11px]"
                    onClick={() => {
                      setToolsOpen(false);
                      void revert();
                    }}
                  >
                    <RotateCcw className="h-3 w-3" /> Hoàn tác XB
                  </WbBtn>
                </div>

                <div className="space-y-3">
                  <WbField label="Khôi phục bản đã áp dụng">
                    <select
                      className={wbSelect}
                      defaultValue=""
                      disabled={saving || history.length === 0}
                      onChange={(e) => {
                        const id = e.target.value;
                        e.target.value = "";
                        if (id) {
                          setToolsOpen(false);
                          void restoreHistory(id);
                        }
                      }}
                    >
                      <option value="">
                        {history.length
                          ? `${history.length} bản gần đây…`
                          : "Chưa có lịch sử"}
                      </option>
                      {history.map((h) => (
                        <option key={h.id} value={h.id}>
                          {formatScheduleVi(h.at) ||
                            new Date(h.at).toLocaleString("vi-VN")}
                          {h.by ? ` · ${h.by}` : ""}
                          {h.note ? ` · ${h.note}` : ""}
                        </option>
                      ))}
                    </select>
                  </WbField>

                  <div className="border-t border-gray-100 pt-3">
                    <p className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                      <Clock className="h-3.5 w-3.5" /> Hẹn giờ áp dụng
                    </p>
                    <p className="mb-2 text-[11px] leading-snug text-amber-800/90">
                      Web shop chỉ đổi đúng giờ hẹn. Muốn khách thấy ngay → bấm
                      «Áp dụng». Khung xem trước cũng là bản đang lên web.
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      <WbField label="Ngày">
                        <input
                          type="date"
                          className={wbInput}
                          value={scheduleDate}
                          onChange={(e) => setScheduleDate(e.target.value)}
                        />
                      </WbField>
                      <WbField label="Giờ (24h)">
                        <input
                          type="time"
                          step={60}
                          className={wbInput}
                          value={scheduleTime}
                          onChange={(e) => setScheduleTime(e.target.value)}
                        />
                      </WbField>
                    </div>
                    <p className="mt-1.5 text-[11px] text-gray-500">
                      {scheduledAt
                        ? `Đang chờ đến ${formatScheduleVi(scheduledAt)} rồi mới lên web`
                        : scheduleDate
                          ? `Sẽ hẹn: ${formatScheduleVi(combineLocalToIso(scheduleDate, scheduleTime || "00:00") || undefined) || "—"}`
                          : "VD giờ: 14:30 = 2 giờ 30 chiều"}
                    </p>
                    <div className="mt-2.5 flex gap-2">
                      <WbBtn
                        variant="secondary"
                        disabled={saving || !scheduleDate}
                        className="!h-8 flex-1"
                        onClick={() => void saveSchedule()}
                      >
                        <History className="h-3.5 w-3.5" /> Lưu hẹn
                      </WbBtn>
                      {scheduledAt || scheduleDate || scheduleTime ? (
                        <WbBtn
                          variant="ghost"
                          disabled={saving}
                          className="!h-8"
                          onClick={() => void clearSchedule()}
                        >
                          Hủy hẹn
                        </WbBtn>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          <WbBtn
            variant="ghost"
            disabled={saving}
            onClick={() => void syncPreview()}
            className="!px-2.5"
            title="Lưu nháp & làm mới xem trước"
          >
            {saving ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
            <span className="hidden sm:inline">Đồng bộ</span>
          </WbBtn>
          <WbBtn variant="ghost" href={SHOP_PREVIEW_URL} className="!px-2.5">
            <ExternalLink className="h-3.5 w-3.5" />
            <span className="hidden lg:inline">Xem trước</span>
          </WbBtn>
          <WbBtn variant="primary" disabled={saving} onClick={() => void applyPublish()}>
            {saving ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Check className="h-3.5 w-3.5" />
            )}
            Áp dụng
          </WbBtn>
        </div>
      </header>

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
              <div className="space-y-3">
                <WbSectionLabel>Thương hiệu & SEO</WbSectionLabel>
                <p className="text-[11px] text-gray-500">
                  Bấm từng mục để mở form sửa — giống tab Trang chủ.
                </p>
                <BrandAccordion
                  openId={brandOpen}
                  onOpen={setBrandOpen}
                  primary={primary}
                  items={[
                    {
                      id: "color",
                      label: "Màu chủ đạo",
                      hint: primary,
                      Icon: Palette,
                      body: (
                        <div className="flex flex-wrap gap-2">
                          {COLOR_PRESETS.map((c) => {
                            const on = primary.toLowerCase() === c.toLowerCase();
                            return (
                              <button
                                key={c}
                                type="button"
                                title={c}
                                onClick={() =>
                                  setDraft({
                                    ...draft,
                                    theme: {
                                      ...draft.theme,
                                      primaryColor: c,
                                      headerBg: c,
                                    },
                                  })
                                }
                                className={`relative h-8 w-8 rounded-full transition ${
                                  on
                                    ? "ring-2 ring-gray-900 ring-offset-2"
                                    : "ring-1 ring-black/10 hover:scale-105"
                                }`}
                                style={{ background: c }}
                              >
                                {on ? (
                                  <Check className="absolute inset-0 m-auto h-3.5 w-3.5 text-white drop-shadow" />
                                ) : null}
                              </button>
                            );
                          })}
                          <label className="relative h-8 w-8 cursor-pointer overflow-hidden rounded-full ring-1 ring-gray-200 hover:ring-gray-300">
                            <input
                              type="color"
                              className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                              value={primary}
                              onChange={(e) =>
                                setDraft({
                                  ...draft,
                                  theme: {
                                    ...draft.theme,
                                    primaryColor: e.target.value,
                                    headerBg: e.target.value,
                                  },
                                })
                              }
                            />
                            <span className="flex h-full w-full items-center justify-center bg-gray-50 text-xs font-bold text-gray-400">
                              +
                            </span>
                          </label>
                        </div>
                      ),
                    },
                    {
                      id: "identity",
                      label: "Tên · Logo · Font · Favicon",
                      hint: draft.theme.siteName || "Chưa đặt tên",
                      Icon: Type,
                      body: (
                        <div className="space-y-3">
                          <WbField label="Tên shop">
                            <input
                              className={wbInput}
                              value={draft.theme.siteName || ""}
                              onChange={(e) =>
                                patchTheme({ siteName: e.target.value })
                              }
                            />
                          </WbField>
                          <WbField label="Font chữ">
                            <select
                              className={wbSelect}
                              value={draft.theme.fontFamily || "system"}
                              onChange={(e) =>
                                patchTheme({
                                  fontFamily: e.target
                                    .value as AppearanceFontFamily,
                                })
                              }
                            >
                              {FONT_OPTIONS.map((f) => (
                                <option key={f.id} value={f.id}>
                                  {f.label}
                                </option>
                              ))}
                            </select>
                          </WbField>
                          <WbField
                            label="Logo"
                            hint="PNG/WebP nền trong suốt — tối đa 4MB."
                          >
                            <ImageUploadField
                              kind="logo"
                              value={draft.theme.logoUrl || ""}
                              onChange={(url) => patchTheme({ logoUrl: url })}
                              hint="PNG trong suốt · tối đa 4MB"
                              previewClassName="overflow-hidden rounded-lg border border-gray-200"
                              previewBg={primary}
                            />
                          </WbField>
                          <WbField label="URL logo (tuỳ chọn)">
                            <input
                              className={wbInput}
                              value={draft.theme.logoUrl || ""}
                              onChange={(e) =>
                                patchTheme({ logoUrl: e.target.value })
                              }
                              placeholder="/brand/logo-header-on-theme.png"
                            />
                          </WbField>
                          <WbField
                            label="Favicon"
                            hint="Icon tab trình duyệt · PNG/WebP vuông."
                          >
                            <ImageUploadField
                              kind="favicon"
                              value={draft.theme.faviconUrl || ""}
                              onChange={(url) =>
                                patchTheme({ faviconUrl: url })
                              }
                              hint="Favicon · tối đa 4MB"
                              previewClassName="overflow-hidden rounded-lg border border-gray-200"
                            />
                          </WbField>
                        </div>
                      ),
                    },
                    {
                      id: "seo",
                      label: "SEO trang chủ",
                      hint: "Chỉnh trong tab Tối ưu SEO",
                      Icon: Globe,
                      body: (
                        <div className="space-y-3">
                          <p className="text-[12px] leading-relaxed text-slate-600">
                            Tiêu đề, mô tả, ảnh OG và template sản phẩm/danh mục
                            được quản lý tại tab{" "}
                            <strong>Tối ưu SEO</strong> (sidebar).
                          </p>
                          <a
                            href="/admin/seo"
                            className="inline-flex h-9 items-center rounded-lg bg-[var(--aloha-green)] px-3.5 text-[13px] font-semibold text-white shadow-sm hover:bg-[#2F5530]"
                          >
                            Mở tab Tối ưu SEO
                          </a>
                          {(seo.title || seo.description) && (
                            <div className="rounded-lg bg-slate-50 px-3 py-2 text-[12px] text-slate-600">
                              <p className="font-semibold text-slate-800">
                                {seo.title || "—"}
                              </p>
                              <p className="mt-0.5 line-clamp-2">
                                {seo.description || ""}
                              </p>
                            </div>
                          )}
                        </div>
                      ),
                    },
                    {
                      id: "popup",
                      label: "Popup khuyến mãi",
                      hint: popup.enabled
                        ? popup.imageUrl
                          ? "Bật · có ảnh"
                          : "Bật · chưa có ảnh"
                        : "Đang tắt",
                      Icon: Megaphone,
                      body: (
                        <div className="space-y-3">
                          <p className="text-[11px] leading-snug text-amber-800/90">
                            Kiểu sàn: <strong>chỉ hiện ảnh</strong>. Cần ảnh +{" "}
                            <strong>Áp dụng</strong>. API (:3000) phải chạy. Đã
                            đóng rồi → đổi mã chiến dịch, hoặc mở{" "}
                            <code className="rounded bg-amber-100 px-1">
                              ?popup=1
                            </code>{" "}
                            để xem lại.
                          </p>
                          <label className="flex items-center gap-2 text-[13px] text-gray-800">
                            <input
                              type="checkbox"
                              checked={!!popup.enabled}
                              onChange={(e) =>
                                patchPopup({ enabled: e.target.checked })
                              }
                            />
                            Bật popup khuyến mãi trên web
                          </label>
                          <WbField
                            label="Ảnh khuyến mãi (bắt buộc)"
                            hint="Chữ KM nên nằm sẵn trong ảnh. Ảnh đứng/vuông đẹp nhất."
                          >
                            <ImageUploadField
                              kind="banner"
                              value={popup.imageUrl || ""}
                              onChange={(url) =>
                                patchPopup({ imageUrl: url })
                              }
                              previewClassName="overflow-hidden rounded-lg border border-gray-200"
                            />
                          </WbField>
                          <WbField
                            label="Link khi bấm ảnh"
                            hint="VD trang SP: /sp/V1T hoặc /tim"
                          >
                            <input
                              className={wbInput}
                              value={popup.ctaHref || ""}
                              onChange={(e) =>
                                patchPopup({ ctaHref: e.target.value })
                              }
                              placeholder="/sp/..."
                            />
                          </WbField>
                          <WbField
                            label="Mã chiến dịch"
                            hint="Đổi mã khi muốn khách thấy popup lại."
                          >
                            <input
                              className={wbInput}
                              value={popup.campaignId || ""}
                              onChange={(e) =>
                                patchPopup({ campaignId: e.target.value })
                              }
                              placeholder="promo"
                            />
                          </WbField>
                          <div className="grid grid-cols-2 gap-2">
                            <WbField label="Trễ (giây)">
                              <input
                                type="number"
                                min={0}
                                max={120}
                                className={wbInput}
                                value={Number(popup.delaySeconds) || 0}
                                onChange={(e) =>
                                  patchPopup({
                                    delaySeconds: Math.max(
                                      0,
                                      Math.min(
                                        120,
                                        Number(e.target.value) || 0
                                      )
                                    ),
                                  })
                                }
                              />
                            </WbField>
                            <WbField label="Hiện lại sau (ngày)">
                              <input
                                type="number"
                                min={1}
                                max={365}
                                className={wbInput}
                                value={Number(popup.frequencyDays) || 7}
                                onChange={(e) =>
                                  patchPopup({
                                    frequencyDays: Math.max(
                                      1,
                                      Math.min(
                                        365,
                                        Number(e.target.value) || 7
                                      )
                                    ),
                                  })
                                }
                              />
                            </WbField>
                          </div>
                          <label className="flex items-center gap-2 text-[12px] text-gray-700">
                            <input
                              type="checkbox"
                              checked={popup.showOncePerCampaign !== false}
                              onChange={(e) =>
                                patchPopup({
                                  showOncePerCampaign: e.target.checked,
                                })
                              }
                            />
                            Mỗi chiến dịch chỉ hiện 1 lần (sau khi đóng)
                          </label>
                        </div>
                      ),
                    },
                  ]}
                />
              </div>
            ) : null}

            {side === "home" ? (
              <div className="space-y-4">
                <WbSectionLabel
                  action={
                    <div className="flex flex-wrap items-center gap-1.5">
                      <button
                        type="button"
                        onClick={addProductSection}
                        className="inline-flex h-8 items-center gap-1 rounded-lg border border-solid border-[#3D6B3A]/40 bg-[#E8EFE4] px-2.5 text-[11px] font-bold text-[#2F5530] shadow-sm hover:bg-[#DCE8D6]"
                        style={{ borderStyle: "solid" }}
                      >
                        <Plus className="h-3.5 w-3.5" /> Thêm mục SP
                      </button>
                      <button
                        type="button"
                        onClick={addArticleSection}
                        className="inline-flex h-8 items-center gap-1 rounded-lg border border-solid border-[#3D6B3A]/40 bg-white px-2.5 text-[11px] font-bold text-[#2F5530] shadow-sm hover:bg-[#E8EFE4]"
                        style={{ borderStyle: "solid" }}
                      >
                        <FileText className="h-3.5 w-3.5" /> Thêm bài viết
                      </button>
                    </div>
                  }
                >
                  Khối trang chủ
                </WbSectionLabel>

                <BlockList
                  blocks={draft.blocks}
                  selectedId={selectedId}
                  primary={primary}
                  onSelect={(id) =>
                    setSelectedId((cur) => (cur === id ? null : id))
                  }
                  onToggle={(id) => {
                    const b = draft.blocks.find((x) => x.id === id);
                    if (b) updateBlock(id, { enabled: !b.enabled });
                  }}
                  onReorder={(blocks) => setDraft({ ...draft, blocks })}
                  renderEditor={(b) => {
                    if (b.type === "hero" || b.type === "banner_carousel") {
                      return (
                        <div className="space-y-3 rounded-xl border border-gray-200 bg-white p-3.5">
                          <div className="flex items-center justify-between gap-2">
                            <p className="flex items-center gap-2 text-[13px] font-semibold text-gray-900">
                              <ImageIcon className="h-4 w-4 text-gray-500" />
                              {BLOCK_LABEL[b.type] || b.type}
                            </p>
                            <WbBadge tone={b.enabled ? "success" : "neutral"}>
                              {b.enabled ? "Đang hiện" : "Đang ẩn"}
                            </WbBadge>
                          </div>
                          <HeroSlidesForm
                            slides={(b.props.slides as HeroSlideDraft[]) || []}
                            useDefaultBanners={b.props.useDefaultBanners !== false}
                            onChange={({ slides, useDefaultBanners }) =>
                              updateProps(b.id, { slides, useDefaultBanners })
                            }
                          />
                        </div>
                      );
                    }
                    if (b.type === "product_section") {
                      return (
                        <div className="space-y-3 rounded-xl border border-gray-200 bg-white p-3.5">
                          <div className="flex items-center justify-between gap-2">
                            <p className="flex items-center gap-2 text-[13px] font-semibold text-gray-900">
                              <Layers className="h-4 w-4 text-gray-500" />
                              {BLOCK_LABEL[b.type] || b.type}
                            </p>
                            <WbBadge tone={b.enabled ? "success" : "neutral"}>
                              {b.enabled ? "Đang hiện" : "Đang ẩn"}
                            </WbBadge>
                          </div>
                          <div className="space-y-3">
                            <WbField label="Tiêu đề">
                              <input
                                className={wbInput}
                                value={String(b.props.title || "")}
                                onChange={(e) =>
                                  updateProps(b.id, { title: e.target.value })
                                }
                              />
                            </WbField>
                            <WbField
                              label="Nguồn sản phẩm"
                              hint="Mới / Nổi bật / Bán chạy lấy SP đã gắn NHÃN tương ứng ở tab Sản phẩm web"
                            >
                              <select
                                className={wbSelect}
                                value={
                                  String(b.props.source || "ban_chay") === "nhom"
                                    ? "category"
                                    : String(b.props.source || "ban_chay")
                                }
                                onChange={(e) => {
                                  const source = e.target.value;
                                  const labelTitle =
                                    source === "moi"
                                      ? "Sản phẩm mới"
                                      : source === "noi_bat"
                                        ? "Sản phẩm nổi bật"
                                        : source === "ban_chay"
                                          ? "Sản phẩm bán chạy"
                                          : "";
                                  updateProps(b.id, {
                                    source,
                                    ...(labelTitle &&
                                    (!b.props.title ||
                                      ["Mục sản phẩm mới", "Sản phẩm bán chạy", "Sản phẩm mới", "Sản phẩm nổi bật"].includes(
                                        String(b.props.title)
                                      ))
                                      ? { title: labelTitle }
                                      : {}),
                                  });
                                }}
                              >
                                <option value="ban_chay">Theo nhãn: Bán chạy</option>
                                <option value="moi">Theo nhãn: Mới</option>
                                <option value="noi_bat">Theo nhãn: Nổi bật</option>
                                <option value="category">Theo nhóm hàng (categoryId)</option>
                              </select>
                            </WbField>
                            {String(b.props.source) === "nhom" ||
                            String(b.props.source) === "category" ? (
                              <WbField
                                label="Nhóm hàng"
                                hint="Lưu categoryId — khớp DB shop mới"
                              >
                                <ShopCategoryPicker
                                  cats={cats}
                                  valueCategoryId={Number(b.props.categoryId) || 0}
                                  valuePath={String(b.props.nhomPath || b.props.categoryName || "")}
                                  onChange={(picked) =>
                                    updateProps(b.id, {
                                      source: "category",
                                      categoryId: picked.categoryId || 0,
                                      categoryName: picked.name,
                                      categorySlug: picked.slug,
                                      nhomPath: picked.path,
                                      nhomName: picked.name,
                                      nhomSlug: picked.slug,
                                      title:
                                        picked.name &&
                                        (!b.props.title ||
                                          String(b.props.title) === "Mục sản phẩm mới")
                                          ? picked.name
                                          : b.props.title,
                                    })
                                  }
                                />
                              </WbField>
                            ) : null}
                            <WbField label="Số sản phẩm">
                              <input
                                type="number"
                                min={4}
                                max={40}
                                className={wbInput}
                                value={Number(b.props.limit) || 15}
                                onChange={(e) =>
                                  updateProps(b.id, {
                                    limit: Math.max(
                                      4,
                                      Math.min(40, Number(e.target.value) || 15)
                                    ),
                                  })
                                }
                              />
                            </WbField>
                            <WbBtn
                              variant="danger"
                              className="!h-8 !px-2"
                              onClick={() => {
                                if (!confirm("Xóa mục này khỏi trang chủ?")) return;
                                setDraft((d) =>
                                  d
                                    ? {
                                        ...d,
                                        blocks: d.blocks.filter((x) => x.id !== b.id),
                                      }
                                    : d
                                );
                                setSelectedId(null);
                              }}
                            >
                              <Trash2 className="h-3.5 w-3.5" /> Xóa mục
                            </WbBtn>
                          </div>
                        </div>
                      );
                    }
                    if (b.type === "article_section") {
                      return (
                        <div className="space-y-3 rounded-xl border border-gray-200 bg-white p-3.5">
                          <div className="flex items-center justify-between gap-2">
                            <p className="flex items-center gap-2 text-[13px] font-semibold text-gray-900">
                              <FileText className="h-4 w-4 text-gray-500" />
                              {BLOCK_LABEL[b.type] || b.type}
                            </p>
                            <WbBadge tone={b.enabled ? "success" : "neutral"}>
                              {b.enabled ? "Đang hiện" : "Đang ẩn"}
                            </WbBadge>
                          </div>
                          <WbField label="Tiêu đề">
                            <input
                              className={wbInput}
                              value={String(b.props.title || "")}
                              onChange={(e) =>
                                updateProps(b.id, { title: e.target.value })
                              }
                            />
                          </WbField>
                          <WbField
                            label="Số bài (2–6)"
                            hint="Chỉ lấy bài đang Hiện và đã tới ngày xuất bản"
                          >
                            <input
                              type="number"
                              min={2}
                              max={6}
                              className={wbInput}
                              value={Number(b.props.limit) || 3}
                              onChange={(e) =>
                                updateProps(b.id, {
                                  limit: Math.max(
                                    2,
                                    Math.min(6, Number(e.target.value) || 3)
                                  ),
                                })
                              }
                            />
                          </WbField>
                          <WbBtn
                            variant="danger"
                            className="!h-8 !px-2"
                            onClick={() => {
                              if (!confirm("Xóa khối bài viết khỏi trang chủ?")) return;
                              setDraft((d) =>
                                d
                                  ? {
                                      ...d,
                                      blocks: d.blocks.filter((x) => x.id !== b.id),
                                    }
                                  : d
                              );
                              setSelectedId(null);
                            }}
                          >
                            <Trash2 className="h-3.5 w-3.5" /> Xóa mục
                          </WbBtn>
                        </div>
                      );
                    }
                    if (b.type === "feature_strip") {
                      return (
                        <div className="rounded-xl border border-gray-200 bg-white p-3.5">
                          <p className="flex items-center gap-2 text-[13px] font-semibold text-gray-900">
                            <Sparkles className="h-4 w-4 text-gray-500" />
                            {BLOCK_LABEL[b.type]}
                          </p>
                          <p className="mt-2 text-[12px] text-gray-500">
                            Khối dịch vụ / Why Aloha — bật/tắt bằng công tắc trên danh sách.
                          </p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
              </div>
            ) : null}

            {side === "menu" ? (
              <ShopNavPanel
                nav={
                  draft.nav || {
                    hiddenCategoryPaths: [],
                    customItems: [],
                  }
                }
                setNav={setNav}
                cats={cats}
              />
            ) : null}

            {side === "footer" ? (
              <div className="space-y-3">
                <WbSectionLabel>Thông tin liên hệ</WbSectionLabel>
                {(
                  [
                    ["phone", "Số điện thoại"],
                    ["zalo", "Zalo"],
                    ["email", "Email"],
                    ["address", "Địa chỉ"],
                  ] as const
                ).map(([k, label]) => (
                  <WbField key={k} label={label}>
                    <input
                      className={wbInput}
                      value={(draft.theme.footer as any)?.[k] || ""}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          theme: {
                            ...draft.theme,
                            footer: { ...draft.theme.footer, [k]: e.target.value },
                          },
                        })
                      }
                    />
                  </WbField>
                ))}
              </div>
            ) : null}
          </div>
        </aside>

        <div className="relative hidden min-w-0 flex-1 flex-col bg-white md:flex">
          <div className="flex h-9 shrink-0 items-center justify-between border-b border-gray-200 px-4 text-[11px] text-gray-500">
            <span className="font-medium">
              Xem trước · {device === "mobile" ? "Mobile 390px" : "Desktop"}
            </span>
            <span className="truncate font-mono text-[10px] text-gray-400">
              {SHOP_PREVIEW_URL}
            </span>
          </div>
          <div className="flex min-h-0 flex-1 justify-center overflow-hidden p-0">
            <div
              className={`flex h-full overflow-hidden border-0 bg-white transition-all duration-300 ${
                device === "mobile"
                  ? "mx-auto w-[390px] max-w-full border-x border-gray-200"
                  : "w-full"
              }`}
            >
              <iframe
                ref={iframeRef}
                key={previewKey}
                src={previewSrc}
                title="Shop preview"
                className="h-full w-full border-0 bg-white"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
