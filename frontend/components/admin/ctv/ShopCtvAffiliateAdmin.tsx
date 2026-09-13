"use client";

/**
 * Hub CTV / Affiliate — UI hiện đại + phân trang kiểu Thu mua.
 */
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  CalendarDays,
  Percent,
  RefreshCw,
  Search,
  Settings2,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import { toast } from "@/components/admin/toast";
import ShopAccountsAdmin from "./ShopAccountsAdmin";
import { ThuMuaListPagination } from "@/components/admin/ui/ThuMuaListPagination";

type HubTab =
  | "hom-nay"
  | "dat-phan-tram"
  | "ctv-dac-biet"
  | "duyet-ctv"
  | "ky-thang"
  | "canh-bao";

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    credentials: "include",
    headers: {
      Accept: "application/json",
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...(init?.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok)
    throw new Error(
      (data as { error?: string }).error ||
        (data as { message?: string }).message ||
        `HTTP ${res.status}`
    );
  return data as T;
}

function formatVnd(n: number) {
  return `${Math.round(n || 0).toLocaleString("vi-VN")}đ`;
}

function currentPeriod() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

const TABS: { id: HubTab; label: string; icon: React.ReactNode }[] = [
  { id: "hom-nay", label: "Việc hôm nay", icon: <Sparkles size={14} /> },
  { id: "dat-phan-tram", label: "Đặt % hoa hồng", icon: <Percent size={14} /> },
  { id: "ctv-dac-biet", label: "CTV đặc biệt", icon: <Users size={14} /> },
  { id: "duyet-ctv", label: "Duyệt CTV", icon: <Users size={14} /> },
  { id: "ky-thang", label: "Kỳ tháng", icon: <CalendarDays size={14} /> },
  { id: "canh-bao", label: "Cảnh báo", icon: <AlertTriangle size={14} /> },
];

export default function ShopCtvAffiliateAdmin() {
  const [tab, setTab] = useState<HubTab>("hom-nay");
  const [stats, setStats] = useState<any>(null);
  const [settings, setSettings] = useState<any>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [settingsTick, setSettingsTick] = useState(0);

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
    <div className="flex min-h-[70vh] flex-col gap-4">
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
            <ShopAccountsAdmin embedded />
          </div>
        ) : null}
        {tab === "ky-thang" ? <KyThang onDone={() => void reloadStats()} /> : null}
        {tab === "canh-bao" ? <CanhBao onDone={() => void reloadStats()} /> : null}
      </div>
    </div>
  );
}

function HomNay({
  stats,
  onGo,
}: {
  stats: any;
  onGo: (t: HubTab) => void;
}) {
  const cards = [
    {
      label: "Chờ duyệt CTV",
      value: String(stats?.ctvPending ?? "—"),
      sub: "Tài khoản",
      go: "duyet-ctv" as HubTab,
      accent: "border-l-amber-400",
      valueCls: "text-amber-800",
    },
    {
      label: "Cảnh báo mới (7 ngày)",
      value: String(stats?.fraudNew ?? "—"),
      sub: "Cần xem",
      go: "canh-bao" as HubTab,
      accent: "border-l-rose-400",
      valueCls: "text-rose-700",
    },
    {
      label: "HH đang giữ",
      value: formatVnd(Number(stats?.heldAmount) || 0),
      sub: `${stats?.heldCount || 0} dòng · chờ hết đổi trả`,
      go: "ky-thang" as HubTab,
      accent: "border-l-orange-400",
      valueCls: "text-orange-800",
    },
    {
      label: "Đủ điều kiện (chưa vào kỳ)",
      value: formatVnd(Number(stats?.eligibleAmount) || 0),
      sub: `${stats?.eligibleCount || 0} dòng`,
      go: "ky-thang" as HubTab,
      accent: "border-l-emerald-500",
      valueCls: "text-emerald-800",
    },
    {
      label: `Kỳ ${stats?.currentPeriod || currentPeriod()}`,
      value:
        stats?.currentBillStatus === "locked"
          ? "Đã chốt"
          : stats?.currentBillStatus === "paid"
            ? "Đã chi"
            : "Chưa chốt",
      sub: "Bill tháng AMS",
      go: "ky-thang" as HubTab,
      accent: "border-l-sky-400",
      valueCls: "text-sky-800",
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
      {cards.map((c) => (
        <button
          key={c.label}
          type="button"
          onClick={() => onGo(c.go)}
          className={`flex min-h-[108px] flex-col rounded-xl border border-slate-200 border-l-4 bg-white p-4 text-left shadow-sm transition hover:border-slate-300 hover:shadow ${c.accent}`}
        >
          <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            {c.label}
          </div>
          <div
            className={`mt-2 text-[22px] font-bold leading-none tracking-tight tabular-nums ${c.valueCls}`}
          >
            {c.value}
          </div>
          <div className="mt-auto pt-3 text-[12px] leading-snug text-slate-500">{c.sub}</div>
        </button>
      ))}
    </div>
  );
}

function SettingsPanel({
  settings,
  onSaved,
}: {
  settings: any;
  onSaved: (s: any) => void;
}) {
  const [form, setForm] = useState(settings);
  const [saving, setSaving] = useState(false);
  useEffect(() => setForm(settings), [settings]);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 text-sm font-bold text-slate-800">Cấu hình hoa hồng</div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        {(
          [
            ["defaultCommissionRate", "% mặc định shop"],
            ["returnHoldDays", "Ngày giữ sau giao"],
            ["attributionWindowDays", "Cửa sổ click (ngày)"],
            ["settleDay", "Ngày gợi ý chốt kỳ"],
            ["selfBuyMaxHits", "Ngưỡng tự mua"],
            ["addressMatchMaxHits", "Ngưỡng trùng SĐT"],
          ] as const
        ).map(([key, label]) => (
          <label key={key} className="block text-[12px] font-semibold text-slate-600">
            {label}
            <input
              type="number"
              value={form[key] ?? ""}
              onChange={(e) => setForm({ ...form, [key]: Number(e.target.value) })}
              className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-emerald-500"
            />
          </label>
        ))}
      </div>
      <div className="mt-3 flex justify-end">
        <button
          type="button"
          disabled={saving}
          className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-800 disabled:opacity-60"
          onClick={async () => {
            setSaving(true);
            try {
              const r = await api<{ settings: any }>("/api/shop/admin/ctv/settings", {
                method: "PATCH",
                body: JSON.stringify(form),
              });
              setForm(r.settings);
              onSaved(r.settings);
            } catch (e: any) {
              toast.error(e?.message || "Lưu thất bại");
            } finally {
              setSaving(false);
            }
          }}
        >
          {saving ? "Đang lưu…" : "Lưu cấu hình"}
        </button>
      </div>
    </div>
  );
}

type ProductRateRow = {
  ma: string;
  ten: string;
  anh?: string;
  gia: number;
  ctvCommissionRate: number | null;
  effectiveRate: number;
  rateSource: string;
};

function DatPhanTram({
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
  const [pageSize, setPageSize] = useState(15);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [batchRate, setBatchRate] = useState("");
  const [liveDefault, setLiveDefault] = useState(defaultRate);
  const searchWrapRef = useRef<HTMLDivElement>(null);
  const suggestTimer = useRef<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api<{ data: ProductRateRow[]; total: number; defaultRate?: number }>(
        `/api/shop/admin/ctv/product-rates?q=${encodeURIComponent(q)}&page=${page}&limit=${pageSize}`
      );
      setRows(r.data || []);
      setTotal(r.total || 0);
      if (r.defaultRate != null) setLiveDefault(r.defaultRate);
    } catch (e: any) {
      toast.error(e?.message || "Lỗi tải SP");
    } finally {
      setLoading(false);
    }
  }, [q, page, pageSize]);

  useEffect(() => {
    void load();
  }, [load, settingsTick]);

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
    } catch (e: any) {
      toast.error(e?.message || "Lỗi");
    }
  };

  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 px-4 py-3">
        <div className="text-sm text-slate-600">
          % mặc định shop:{" "}
          <span className="font-bold text-emerald-800">{liveDefault ?? "—"}%</span>
          <span className="text-slate-400"> · SP chưa set riêng dùng mức này</span>
        </div>
        {selected.size > 0 ? (
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <input
              value={batchRate}
              onChange={(e) => setBatchRate(e.target.value)}
              placeholder="% hàng loạt"
              className="w-24 rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
            />
            <button
              type="button"
              className="rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-bold text-white"
              onClick={async () => {
                const rate = Number(batchRate);
                if (!Number.isFinite(rate) || rate < 0) {
                  toast.error("Nhập % hợp lệ");
                  return;
                }
                try {
                  await api("/api/shop/admin/ctv/product-rates", {
                    method: "POST",
                    body: JSON.stringify({
                      items: [...selected].map((ma) => ({ ma, ctvCommissionRate: rate })),
                    }),
                  });
                  toast.success(`Đã sửa ${selected.size} SP`);
                  setSelected(new Set());
                  void load();
                } catch (e: any) {
                  toast.error(e?.message || "Lỗi");
                }
              }}
            >
              Sửa {selected.size} SP
            </button>
          </div>
        ) : null}
      </div>

      <div className="border-b border-slate-100 px-4 py-3">
        <div ref={searchWrapRef} className="relative max-w-xl">
          <Search
            size={15}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            value={suggestLive}
            onChange={(e) => {
              const v = e.target.value;
              setSuggestLive(v);
              setSuggestOpen(!!v.trim());
            }}
            onFocus={() => {
              if (suggestLive.trim()) setSuggestOpen(true);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                if (suggestions.length === 1) applySearch(suggestions[0].ma);
                else applySearch(suggestLive);
              }
              if (e.key === "Escape") setSuggestOpen(false);
            }}
            placeholder="Tìm mã / tên SP"
            className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-9 text-sm outline-none focus:border-emerald-500"
          />
          {(suggestLive || q) && (
            <button
              type="button"
              className="absolute right-2 top-1/2 z-10 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full border-0 bg-transparent text-slate-500 hover:bg-[#EFE9DC] hover:text-slate-700"
              onClick={() => {
                setSuggestLive("");
                setQ("");
                setPage(1);
                setSuggestOpen(false);
              }}
              title="Xóa tìm"
            >
              <X size={14} strokeWidth={2} />
            </button>
          )}

          {suggestOpen && suggestLive.trim() ? (
            <div className="absolute left-0 right-0 top-full z-50 mt-1.5 max-h-[340px] overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 shadow-xl">
              {suggestions.length === 0 ? (
                <div className="px-3 py-3 text-[13px] text-slate-400">
                  Không có SP khớp «{suggestLive.trim()}»
                </div>
              ) : (
                suggestions.map((p) => (
                  <button
                    key={p.ma}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => applySearch(p.ma)}
                    className="flex w-full items-start gap-2.5 border-0 bg-white px-3 py-2 text-left hover:bg-[#F7F3EA]"
                  >
                    <div className="h-10 w-10 shrink-0 overflow-hidden rounded-md bg-slate-100">
                      {p.anh ? (
                        <img src={p.anh} alt="" className="h-full w-full object-cover" />
                      ) : null}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13px] font-semibold text-slate-800">
                        {p.ten || p.ma}
                      </div>
                      <div className="mt-0.5 text-[11px] text-slate-500">
                        {p.ma} · {formatVnd(p.gia)} · {p.effectiveRate}%
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          ) : null}
        </div>
      </div>

      <div className="min-h-[280px] flex-1 overflow-auto">
        {loading ? (
          <p className="p-6 text-sm text-slate-400">Đang tải…</p>
        ) : !rows.length ? (
          <p className="p-6 text-sm text-slate-400">Không có sản phẩm</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {rows.map((r) => (
              <div
                key={r.ma}
                className="grid grid-cols-[28px_48px_minmax(0,1fr)_88px_110px] items-center gap-3 px-4 py-2.5 hover:bg-slate-50/80"
              >
                <input
                  type="checkbox"
                  checked={selected.has(r.ma)}
                  onChange={(e) => {
                    const n = new Set(selected);
                    if (e.target.checked) n.add(r.ma);
                    else n.delete(r.ma);
                    setSelected(n);
                  }}
                  className="h-[15px] w-[15px] cursor-pointer"
                />
                <div className="h-12 w-12 overflow-hidden rounded-lg bg-slate-100">
                  {r.anh ? (
                    <img src={r.anh} alt="" className="h-full w-full object-cover" />
                  ) : null}
                </div>
                <div className="min-w-0">
                  <div className="truncate text-[13px] font-semibold leading-5 text-slate-800">
                    {r.ten || r.ma}
                  </div>
                  <div className="mt-0.5 truncate text-[11px] leading-4 text-slate-500">
                    {r.ma} · {formatVnd(r.gia)} ·{" "}
                    {r.rateSource === "shop"
                      ? "mặc định"
                      : r.rateSource === "excluded"
                        ? "loại trừ"
                        : "riêng SP"}
                  </div>
                </div>
                <input
                  type="number"
                  defaultValue={r.ctvCommissionRate ?? ""}
                  placeholder={String(r.effectiveRate)}
                  key={`${r.ma}-${r.ctvCommissionRate}-${r.effectiveRate}`}
                  onBlur={(e) => {
                    const v = e.target.value.trim();
                    if (v === "") return;
                    void saveOne(r.ma, Number(v));
                  }}
                  className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-center text-sm tabular-nums outline-none focus:border-emerald-500"
                />
                <button
                  type="button"
                  className="rounded-lg border border-slate-200 px-2 py-1.5 text-[11px] font-semibold text-slate-600 hover:bg-slate-50"
                  onClick={() => void saveOne(r.ma, null)}
                >
                  Về mặc định
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <ThuMuaListPagination
        page={page}
        pageSize={pageSize}
        total={total}
        onPageChange={setPage}
        onPageSizeChange={(n) => {
          setPageSize(n);
          setPage(1);
        }}
        itemLabel="SP"
      />
    </div>
  );
}

function CtvDacBiet() {
  const [ctvCode, setCtvCode] = useState("");
  const [ma, setMa] = useState("");
  const [rate, setRate] = useState("");
  const [rows, setRows] = useState<any[]>([]);

  const load = useCallback(async () => {
    if (!ctvCode.trim()) return;
    try {
      const r = await api<{ data: any[] }>(
        `/api/shop/admin/ctv/overrides?ctvCode=${encodeURIComponent(ctvCode.trim().toUpperCase())}`
      );
      setRows(r.data || []);
    } catch (e: any) {
      toast.error(e?.message || "Lỗi");
    }
  }, [ctvCode]);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="mb-3 text-sm text-slate-500">
        Gán % cao hơn cho cặp CTV + sản phẩm (Target Campaign).
      </p>
      <div className="mb-4 flex flex-wrap gap-2">
        <input
          placeholder="Mã CTV"
          value={ctvCode}
          onChange={(e) => setCtvCode(e.target.value.toUpperCase())}
          className="w-28 rounded-lg border border-slate-200 px-3 py-2 text-sm"
        />
        <button
          type="button"
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold hover:bg-slate-50"
          onClick={() => void load()}
        >
          Xem override
        </button>
        <input
          placeholder="Mã SP"
          value={ma}
          onChange={(e) => setMa(e.target.value.toUpperCase())}
          className="w-28 rounded-lg border border-slate-200 px-3 py-2 text-sm"
        />
        <input
          placeholder="%"
          value={rate}
          onChange={(e) => setRate(e.target.value)}
          className="w-20 rounded-lg border border-slate-200 px-3 py-2 text-sm"
        />
        <button
          type="button"
          className="rounded-lg bg-emerald-700 px-3 py-2 text-sm font-bold text-white"
          onClick={async () => {
            try {
              await api("/api/shop/admin/ctv/overrides", {
                method: "PUT",
                body: JSON.stringify({
                  ctvCode: ctvCode.trim().toUpperCase(),
                  ma: ma.trim().toUpperCase(),
                  rate: Number(rate),
                }),
              });
              toast.success("Đã lưu");
              void load();
            } catch (e: any) {
              toast.error(e?.message || "Lỗi (kiểm tra % ≥ mức mở)");
            }
          }}
        >
          Thêm / sửa
        </button>
      </div>
      <div className="flex flex-col gap-2">
        {rows.map((r) => (
          <div
            key={`${r.ctvCode}-${r.ma}`}
            className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-sm"
          >
            <span>
              <b>{r.ma}</b> · {r.rate}%
            </span>
            <button
              type="button"
              className="rounded-lg border border-rose-200 px-2 py-1 text-xs font-semibold text-rose-700"
              onClick={async () => {
                await api("/api/shop/admin/ctv/overrides", {
                  method: "DELETE",
                  body: JSON.stringify({ ctvCode: r.ctvCode, ma: r.ma }),
                });
                toast.success("Đã xóa");
                void load();
              }}
            >
              Xóa
            </button>
          </div>
        ))}
        {!rows.length ? (
          <p className="text-sm text-slate-400">Chưa có override — nhập mã CTV rồi bấm Xem.</p>
        ) : null}
      </div>
    </div>
  );
}

function KyThang({ onDone }: { onDone: () => void }) {
  const [period, setPeriod] = useState(currentPeriod());
  const [bill, setBill] = useState<any>(null);
  const [eligible, setEligible] = useState<any[]>([]);

  const load = useCallback(async () => {
    try {
      const [b, c] = await Promise.all([
        api<{ bill: any }>(`/api/shop/admin/ctv/bills?period=${encodeURIComponent(period)}`),
        api<{ data: any[]; sums: any }>("/api/shop/admin/ctv/commissions?status=eligible&limit=30"),
      ]);
      setBill(b.bill);
      setEligible(c.data || []);
    } catch (e: any) {
      toast.error(e?.message || "Lỗi");
    }
  }, [period]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <input
          type="month"
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
        />
        <button
          type="button"
          className="rounded-lg bg-emerald-700 px-3 py-2 text-sm font-bold text-white"
          onClick={async () => {
            const ok = window.confirm(`Chốt kỳ ${period}? Không sửa lung tung sau khi chốt.`);
            if (!ok) return;
            try {
              const r = await api<{ bill: any }>("/api/shop/admin/ctv/bills/lock", {
                method: "POST",
                body: JSON.stringify({ period }),
              });
              setBill(r.bill);
              toast.success("Đã chốt kỳ");
              onDone();
              void load();
            } catch (e: any) {
              toast.error(e?.message || "Chốt thất bại");
            }
          }}
        >
          Chốt kỳ tháng
        </button>
        {bill?.status === "locked" ? (
          <button
            type="button"
            className="rounded-lg bg-slate-800 px-3 py-2 text-sm font-bold text-white"
            onClick={async () => {
              const ok = window.confirm(`Đánh dấu đã chuyển tiền cả kỳ ${period}?`);
              if (!ok) return;
              try {
                await api(`/api/shop/admin/ctv/bills/${encodeURIComponent(period)}/mark-paid`, {
                  method: "POST",
                  body: JSON.stringify({}),
                });
                toast.success("Đã đánh dấu chi");
                onDone();
                void load();
              } catch (e: any) {
                toast.error(e?.message || "Lỗi");
              }
            }}
          >
            Đánh dấu đã chuyển tiền (cả kỳ)
          </button>
        ) : null}
      </div>

      {bill ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 shadow-sm">
          <div className="font-bold text-slate-800">
            Bill {bill.period} ·{" "}
            {bill.status === "locked"
              ? "Đã chốt"
              : bill.status === "paid"
                ? "Đã chi"
                : bill.status}
          </div>
          <div className="mt-1 text-sm text-slate-600">
            Tổng HH: <b>{formatVnd(bill.totals?.commission || 0)}</b> · {bill.totals?.ctvCount || 0}{" "}
            CTV · {bill.totals?.lineCount || 0} dòng
          </div>
          <div className="mt-3 flex flex-col gap-2">
            {(bill.ctvLines || []).map((l: any) => (
              <div
                key={l.ctvCode}
                className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
              >
                <span>
                  <b>{l.ctvCode}</b> · {l.orderCount} đơn · {formatVnd(l.net)}
                  {l.paidAt ? " · đã chi" : ""}
                </span>
                {bill.status === "locked" && !l.paidAt ? (
                  <button
                    type="button"
                    className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold"
                    onClick={async () => {
                      await api(
                        `/api/shop/admin/ctv/bills/${encodeURIComponent(period)}/mark-paid`,
                        {
                          method: "POST",
                          body: JSON.stringify({ ctvCode: l.ctvCode }),
                        }
                      );
                      toast.success(`Đã chi ${l.ctvCode}`);
                      void load();
                      onDone();
                    }}
                  >
                    Chi CTV này
                  </button>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <p className="text-sm text-slate-500">Chưa có bill kỳ này — có thể chốt khi đủ dòng.</p>
      )}

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="mb-2 text-sm font-bold text-slate-800">Chưa vào kỳ (đủ điều kiện)</h3>
        <div className="flex flex-col gap-1.5">
          {eligible.map((r) => (
            <div
              key={r.id}
              className="flex justify-between rounded-lg border border-slate-100 px-3 py-2 text-xs"
            >
              <span>
                {r.orderCode} · {r.ma} · {r.ctvCode}
              </span>
              <b>{formatVnd(r.amount)}</b>
            </div>
          ))}
          {!eligible.length ? (
            <p className="text-xs text-slate-400">Không có dòng đủ điều kiện.</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function CanhBao({ onDone }: { onDone: () => void }) {
  const [rows, setRows] = useState<any[]>([]);
  const load = useCallback(async () => {
    try {
      const r = await api<{ data: any[] }>("/api/shop/admin/ctv/fraud?limit=50");
      setRows(r.data || []);
    } catch (e: any) {
      toast.error(e?.message || "Lỗi");
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="flex flex-col gap-2">
      {rows.map((r) => (
        <div
          key={r.id}
          className="rounded-xl border border-rose-200 bg-rose-50/60 p-4 text-sm shadow-sm"
        >
          <div className="font-bold text-slate-800">
            {r.type} · {r.ctvCode}
            {r.orderCode ? ` · ${r.orderCode}` : ""}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            {(r.details || []).join(" · ") || "—"} ·{" "}
            {(r.createdAt || "").slice(0, 16).replace("T", " ")}
          </div>
          <button
            type="button"
            className="mt-3 rounded-lg border border-rose-300 bg-white px-3 py-1.5 text-xs font-bold text-rose-700"
            onClick={async () => {
              const ok = window.confirm(
                `Khóa CTV ${r.ctvCode} và hủy mọi hoa hồng chưa chi?`
              );
              if (!ok) return;
              try {
                await api(`/api/shop/admin/ctv/${encodeURIComponent(r.ctvCode)}/ban`, {
                  method: "POST",
                  body: JSON.stringify({ reason: r.type || "fraud" }),
                });
                toast.success("Đã khóa CTV");
                onDone();
                void load();
              } catch (e: any) {
                toast.error(e?.message || "Lỗi");
              }
            }}
          >
            Khóa CTV & hủy HH chưa chi
          </button>
        </div>
      ))}
      {!rows.length ? (
        <p className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-400">
          Chưa có cảnh báo.
        </p>
      ) : null}
    </div>
  );
}
