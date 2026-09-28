"use client";

/**
 * Hub CTV / Affiliate — UI hiện đại + phân trang kiểu Thu mua.
 */
import React, { useCallback, useEffect, useState } from "react";
import { RefreshCw, Settings2 } from "lucide-react";
import { toast } from "@/components/admin/toast";
import ShopAccountsAdmin from "./ShopAccountsAdmin";
import { api, TABS, type HubTab, type LegacyProps } from "./legacy/api";
import { HomNay } from "./legacy/HomNay";
import { SettingsPanel } from "./legacy/SettingsPanel";
import { DatPhanTram } from "./legacy/DatPhanTram";
import { CtvDacBiet } from "./legacy/CtvDacBiet";
import { KyThang } from "./legacy/KyThang";
import { CanhBao } from "./legacy/CanhBao";

export default function ShopCtvAffiliateAdminLegacy({
  forcedTab,
  hideChrome,
}: LegacyProps = {}) {
  const [tab, setTab] = useState<HubTab>(forcedTab || "hom-nay");
  const [stats, setStats] = useState<any>(null);
  const [settings, setSettings] = useState<any>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [settingsTick, setSettingsTick] = useState(0);

  useEffect(() => {
    if (forcedTab) setTab(forcedTab);
  }, [forcedTab]);

  const reloadStats = useCallback(async () => {
    try {
      const [s, st] = await Promise.all([
        api<{ ok: boolean } & Record<string, number | string | null>>("/api/shop/admin/ctv/stats"),
        api<{ settings: any }>("/api/shop/admin/ctv/settings"),
      ]);
      setStats(s);
      setSettings(st.settings);
    } catch (e: any) {
      toast.error(e?.message || "Không tải được CTV");
    }
  }, []);

  useEffect(() => {
    void reloadStats();
  }, [reloadStats]);

  /** Realtime: CTV đăng ký / duyệt → cập nhật thẻ Việc hôm nay. */
  useEffect(() => {
    const onAccounts = (ev: Event) => {
      const d = (ev as CustomEvent<{ source?: string }>).detail;
      const src = String(d?.source || "");
      if (src === "ctv_register" || src === "ctv_apply") {
        toast.message("Có CTV mới chờ duyệt");
      }
      void reloadStats();
    };
    window.addEventListener("aloha-shop-accounts-changed", onAccounts);
    return () => window.removeEventListener("aloha-shop-accounts-changed", onAccounts);
  }, [reloadStats]);

  return (
    <div className="flex min-h-0 flex-col gap-4">
      {!hideChrome ? (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <div className="min-w-0">
              <h1 className="text-xl font-bold tracking-tight text-[var(--aloha-ink)]">CTV / Hoa hồng</h1>
              <p className="text-sm text-slate-500">Quản lý % · duyệt CTV · chốt kỳ · chống gian</p>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <button
                type="button"
                onClick={() => void reloadStats()}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                title="Làm mới"
              >
                <RefreshCw size={15} />
              </button>
              <button
                type="button"
                onClick={() => setShowSettings((v) => !v)}
                className={`inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-sm font-semibold ${
                  showSettings
                    ? "border-emerald-600 bg-emerald-700 text-white"
                    : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                }`}
                title="Cấu hình"
              >
                <Settings2 size={15} />
                Cấu hình
              </button>
            </div>
          </div>

          {showSettings && settings ? (
            <SettingsPanel
              settings={settings}
              onSaved={(s) => {
                setSettings(s);
                setSettingsTick((n) => n + 1);
                toast.success("Đã lưu cấu hình");
                void reloadStats();
              }}
            />
          ) : null}

          <div className="flex flex-wrap gap-1.5 rounded-xl border border-slate-200 bg-slate-100/80 p-1.5">
            {TABS.map((t) => {
              const active = tab === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTab(t.id)}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-[13px] font-semibold transition-colors ${
                    active
                      ? "bg-white text-emerald-800 shadow-sm ring-1 ring-slate-200"
                      : "text-slate-600 hover:bg-white/70 hover:text-slate-800"
                  }`}
                >
                  <span className={active ? "text-emerald-700" : "text-slate-400"}>{t.icon}</span>
                  {t.label}
                </button>
              );
            })}
          </div>
        </>
      ) : null}

      <div className="min-h-0 flex-1">
        {tab === "hom-nay" ? <HomNay stats={stats} onGo={setTab} /> : null}
        {tab === "dat-phan-tram" ? (
          <DatPhanTram
            defaultRate={settings?.defaultCommissionRate}
            settingsTick={settingsTick}
          />
        ) : null}
        {tab === "ctv-dac-biet" ? <CtvDacBiet /> : null}
        {tab === "duyet-ctv" ? (
          <div className="-mx-2 md:-mx-4">
            <ShopAccountsAdmin
              embedded
              defaultTab="ctv"
              scope="ctv"
              configOpen={showSettings}
              onConfigClick={() => setShowSettings((v) => !v)}
              configPanel={
                showSettings && settings ? (
                  <SettingsPanel
                    settings={settings}
                    onSaved={(s) => {
                      setSettings(s);
                      setSettingsTick((n) => n + 1);
                      toast.success("Đã lưu cấu hình");
                      void reloadStats();
                    }}
                  />
                ) : null
              }
            />
          </div>
        ) : null}
        {tab === "ky-thang" ? <KyThang onDone={() => void reloadStats()} /> : null}
        {tab === "canh-bao" ? <CanhBao onDone={() => void reloadStats()} /> : null}
      </div>
    </div>
  );
}
