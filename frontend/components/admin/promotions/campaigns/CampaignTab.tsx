"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button, Dropdown, Input, Spin, Tag, App } from "antd";
import { CalendarHeart, MoreHorizontal, Plus, RefreshCw, Search } from "lucide-react";
import { campaignAdminApi, type CampaignSummary } from "@/lib/campaign/campaignAdminApi";
import { CampaignWizard } from "./CampaignWizard";
import { RunningCampaign } from "./RunningCampaign";
import { STEPS } from "./wizardModel";

export type View = { mode: "list" } | { mode: "edit"; id: string; step?: number } | { mode: "running"; id: string };

/** Mở thẳng 1 chiến dịch: `?campaign=<id>&step=display` (từ Giao diện → Banner trang chủ). */
function viewFromUrl(): View | null {
  const q = new URLSearchParams(window.location.search);
  const id = q.get("campaign");
  if (!id) return null;
  const step = STEPS.findIndex((s) => s.key === q.get("step"));
  return { mode: "edit", id, step: step >= 0 ? step : undefined };
}
type Preset = { key: string; label: string };

const TONE_COLOR = { green: "green", amber: "gold", gray: "default", red: "red" } as const;

function PresetCards({ presets, onPick, busy }: { presets: Preset[]; onPick: (key: string) => void; busy: boolean }) {
  return (
    <div className="space-y-3">
      <div className="rounded-xl bg-gradient-to-r from-emerald-50/70 via-teal-50/40 to-slate-50 border border-emerald-100 p-4">
        <h3 className="text-sm font-bold text-emerald-950">Chọn mẫu dịp lễ để bắt đầu nhanh</h3>
        <p className="mt-0.5 text-xs text-emerald-800/80">
          Mẫu đã điền sẵn ngày giờ, bảng màu, khẩu hiệu — chỉ cần chọn sản phẩm giảm giá, voucher và ảnh banner.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        {presets.map((p) => (
          <button
            key={p.key}
            type="button"
            disabled={busy}
            onClick={() => onPick(p.key)}
            className="group flex flex-col justify-between p-3.5 rounded-2xl border border-slate-200/90 bg-white hover:border-emerald-500 hover:shadow-md transition-all text-left min-h-[96px] disabled:opacity-50"
          >
            <div className="flex items-center justify-between w-full">
              <div className="p-2 rounded-xl bg-emerald-50 text-emerald-700 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                <CalendarHeart size={16} />
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 group-hover:text-emerald-700">Mẫu có sẵn</span>
            </div>
            <span className="text-xs font-bold text-slate-800 group-hover:text-emerald-800 transition-colors mt-2">{p.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function RowActions({ c, canManage, onChanged }: { c: CampaignSummary; canManage: boolean; onChanged: () => void }) {
  const { message, modal } = App.useApp();
  const act = (fn: () => Promise<unknown>, ok: string) => () =>
    fn().then(() => {
      message.success(ok);
      onChanged();
    }).catch((e) => message.error(e?.message || "Không thực hiện được"));
  const items = [
    { key: "dup", label: "Nhân bản", onClick: act(() => campaignAdminApi.duplicate(c.id), "Đã nhân bản thành bản nháp") },
    {
      key: "arc",
      label: "Lưu trữ",
      onClick: () =>
        modal.confirm({
          title: "Lưu trữ chiến dịch?",
          content: "Chiến dịch tắt khỏi web và chuyển vào lưu trữ. Đơn và báo cáo vẫn giữ nguyên.",
          okText: "Lưu trữ",
          onOk: act(() => campaignAdminApi.archive(c.id), "Đã lưu trữ"),
        }),
    },
    ...(c.status === "draft"
      ? [{ key: "del", label: "Xoá bản nháp", danger: true, onClick: () => modal.confirm({ title: "Xoá bản nháp này?", okText: "Xoá", okButtonProps: { danger: true }, onOk: act(() => campaignAdminApi.remove(c.id), "Đã xoá") }) }]
      : []),
  ];
  if (!canManage) return null;
  return (
    <Dropdown menu={{ items }} trigger={["click"]}>
      <Button icon={<MoreHorizontal size={14} />} className="!h-8 !w-8 !rounded-lg text-slate-500 hover:text-slate-800 flex items-center justify-center p-0" />
    </Dropdown>
  );
}

function CampaignRow({ c, canManage, open, onChanged }: { c: CampaignSummary; canManage: boolean; open: (v: View) => void; onChanged: () => void }) {
  const live = c.status === "published" || c.status === "paused";
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-slate-200/90 bg-white p-4 shadow-xs hover:border-slate-300 transition-all">
      <div className="min-w-0 space-y-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-bold text-slate-900">{c.name}</span>
          <Tag color={TONE_COLOR[c.statusView.tone]} className="rounded-md font-semibold text-xs border-0 px-2 py-0.5">
            {c.statusView.text}
          </Tag>
          {c.hasUnpublishedChanges && live ? (
            <Tag color="orange" className="rounded-md text-[11px] font-semibold border-0 px-2 py-0.5">
              Có thay đổi chưa áp dụng
            </Tag>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
          <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-emerald-50 text-[#2D5A27] font-semibold text-[11px] border border-emerald-200/60">
            {c.productCount} sản phẩm sale
          </span>
          <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 font-semibold text-[11px]">
            {c.giftCount} quà tặng
          </span>
          <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-emerald-50 text-[#2D5A27] font-semibold text-[11px]">
            {c.voucherCount} voucher
          </span>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
        {live ? (
          <Button
            type="primary"
            className="!h-8 !rounded-lg !bg-[#2D5A27] hover:!bg-[#23481e] font-semibold text-xs text-white"
            onClick={() => open({ mode: "running", id: c.id })}
          >
            Xem số liệu
          </Button>
        ) : null}
        <Button onClick={() => open({ mode: "edit", id: c.id })} className="!h-8 !rounded-lg font-semibold text-xs">
          Chỉnh sửa
        </Button>
        <RowActions c={c} canManage={canManage} onChanged={onChanged} />
      </div>
    </div>
  );
}

export function CampaignTab({
  onViewModeChange,
}: {
  onViewModeChange?: (isEditingOrRunning: boolean) => void;
}) {
  const { message } = App.useApp();
  const [items, setItems] = useState<CampaignSummary[] | null>(null);
  const [presets, setPresets] = useState<Preset[]>([]);
  const [canManage, setCanManage] = useState(false);
  const [view, setView] = useState<View>({ mode: "list" });
  const [busy, setBusy] = useState(false);
  const [statusTab, setStatusTab] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const displayedCampaigns = useMemo(() => {
    if (!items) return [];
    const q = searchQuery.toLowerCase().trim();
    return items.filter((c) => {
      if (statusTab === "live" && c.status !== "published") return false;
      if (statusTab === "draft" && c.status !== "draft") return false;
      if (statusTab === "paused" && c.status !== "paused") return false;
      if (statusTab === "other" && ["published", "draft", "paused"].includes(c.status)) return false;
      if (q && !c.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [items, statusTab, searchQuery]);

  useEffect(() => {
    const v = viewFromUrl();
    if (v) {
      setView(v);
    }
  }, []);

  useEffect(() => {
    onViewModeChange?.(view.mode !== "list");
  }, [view.mode, onViewModeChange]);

  const load = useCallback(() => {
    void campaignAdminApi.list().then((r) => {
      setItems(r.items);
      setPresets(r.presets);
      setCanManage(r.canManage);
    }).catch((e) => {
      message.error(e?.message || "Không tải được chiến dịch");
      setItems([]);
    });
  }, []);
  useEffect(load, [load]);

  const create = async (preset: string) => {
    setBusy(true);
    try {
      const r = await campaignAdminApi.create(preset);
      setView({ mode: "edit", id: r.item._id });
      load();
    } catch (e: any) {
      message.error(e?.message || "Không tạo được chiến dịch");
    } finally {
      setBusy(false);
    }
  };

  if (view.mode === "edit") {
    return (
      <CampaignWizard
        id={view.id}
        initialStep={view.step}
        canManage={canManage}
        onBack={() => {
          setView({ mode: "list" });
          load();
        }}
        onPublished={() => load()}
      />
    );
  }
  const running = view.mode === "running" ? items?.find((c) => c.id === view.id) : null;
  if (running) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-6 shadow-xs">
        <RunningCampaign
          summary={running}
          canManage={canManage}
          onBack={() => setView({ mode: "list" })}
          onEdit={() => setView({ mode: "edit", id: running.id })}
          onChanged={load}
        />
      </div>
    );
  }

  if (!items) return <div className="flex justify-center py-10"><Spin /></div>;

  const liveCount = items.filter((c) => c.status === "published").length;
  const draftCount = items.filter((c) => c.status === "draft").length;
  const pausedCount = items.filter((c) => c.status === "paused").length;

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-6 shadow-xs space-y-4">
      {items.length ? (
        <>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-slate-900">
                  Chiến dịch khuyến mãi
                </h2>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  {items.length} chiến dịch
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Quản lý các sự kiện flash sale, ưu đãi ngày lễ và dải sản phẩm giảm giá
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                icon={<RefreshCw size={14} className={busy ? "animate-spin" : ""} />}
                onClick={load}
                className="!h-9 !rounded-lg text-xs"
              >
                Làm mới
              </Button>
              {canManage ? (
                <Dropdown
                  menu={{
                    items: presets.map((p) => ({
                      key: p.key,
                      label: p.label,
                      icon: <CalendarHeart size={14} className="text-emerald-600" />,
                      onClick: () => void create(p.key),
                    })),
                  }}
                  trigger={["click"]}
                >
                  <Button
                    type="primary"
                    icon={<Plus size={15} />}
                    loading={busy}
                    className="!h-9 !rounded-lg !bg-[#2D5A27] hover:!bg-[#23481e] font-bold text-xs shadow-xs text-white"
                  >
                    + Tạo chiến dịch
                  </Button>
                </Dropdown>
              ) : null}
            </div>
          </div>

          {/* Thanh lọc trạng thái & Tìm kiếm */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-2 bg-slate-50/80 rounded-xl border border-slate-200/80">
            <div className="flex items-center gap-1 overflow-x-auto text-xs">
              <button
                type="button"
                onClick={() => setStatusTab("all")}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                  statusTab === "all"
                    ? "bg-[#2D5A27] text-white shadow-2xs"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60"
                }`}
              >
                Tất cả ({items.length})
              </button>
              {liveCount > 0 && (
                <button
                  type="button"
                  onClick={() => setStatusTab("live")}
                  className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                    statusTab === "live"
                      ? "bg-[#2D5A27] text-white shadow-2xs"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60"
                  }`}
                >
                  Đang chạy ({liveCount})
                </button>
              )}
              <button
                type="button"
                onClick={() => setStatusTab("draft")}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                  statusTab === "draft"
                    ? "bg-[#2D5A27] text-white shadow-2xs"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60"
                }`}
              >
                Bản nháp ({draftCount})
              </button>
              {pausedCount > 0 && (
                <button
                  type="button"
                  onClick={() => setStatusTab("paused")}
                  className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                    statusTab === "paused"
                      ? "bg-[#2D5A27] text-white shadow-2xs"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60"
                  }`}
                >
                  Tạm dừng ({pausedCount})
                </button>
              )}
            </div>

            <div className="w-full sm:w-64">
              <Input
                prefix={<Search size={13} className="text-slate-400" />}
                placeholder="Tìm tên chiến dịch..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                allowClear
                className="!h-8 !rounded-lg text-xs bg-white"
              />
            </div>
          </div>

          {displayedCampaigns.length === 0 ? (
            <div className="text-center py-8 text-xs text-slate-400">
              Không tìm thấy chiến dịch nào khớp với bộ lọc.
            </div>
          ) : (
            <div className="space-y-2.5">
              {displayedCampaigns.map((c) => (
                <CampaignRow key={c.id} c={c} canManage={canManage} open={setView} onChanged={load} />
              ))}
            </div>
          )}
        </>
      ) : canManage ? (
        <PresetCards presets={presets} onPick={(k) => void create(k)} busy={busy} />
      ) : (
        <p className="text-[13px] text-slate-500">Chưa có chiến dịch nào. Quản lý tạo chiến dịch mới từ đây.</p>
      )}
    </div>
  );
}
