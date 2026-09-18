"use client";

/**
 * Vận hành → Khách hàng và cộng tác viên
 * UI CRM: KPI + tabs + bảng + chi tiết ngay dưới dòng (kiểu Hàng hóa)
 */
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, Search, X, Check, Lock, Unlock, Trash2, Settings2, UserPlus } from "lucide-react";
import { toast } from "@/components/admin/toast";
import { CtvPagination } from "./shared/CtvPagination";
import { ThuMuaListPagination } from "@/components/admin/ui/ThuMuaListPagination";
import {
  AdminDateRangePicker,
  defaultThisMonthRange,
  type AdminDateRange,
} from "@/components/admin/ui/AdminDateRangePicker";
import { AddCtvModal, type AddCtvFormValues } from "./AddCtvModal";
import {
  AdminTableRowSkeleton,
} from "@/components/admin/ui/AdminSkeleton";
import { maskPhone } from "./shared/format";

type ShopRole = "customer" | "ctv";
type CtvStatus = "cho_duyet" | "active" | "khoa";

type ShopAccount = {
  id: string;
  email: string;
  phone: string | null;
  fullName: string;
  avatarUrl: string | null;
  roles: ShopRole[];
  ctvCode: string | null;
  ctvStatus: CtvStatus | null;
  active: boolean;
  authProviders: string[];
  createdAt: string | null;
  lastLoginAt: string | null;
  adminNote?: string | null;
  commissionRate?: number | null;
};

type Stats = {
  total: number;
  customers: number;
  ctvTotal?: number;
  ctvActive: number;
  ctvPending: number;
  locked: number;
  ctvLocked?: number;
  customerLocked?: number;
};

type TabId = "all" | "customer" | "ctv" | "active" | "pending" | "locked";
type AccountsScope = "all" | "ctv" | "customers";

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
  if (!res.ok) throw new Error((data as { error?: string }).error || `HTTP ${res.status}`);
  return data as T;
}

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("vi-VN");
  } catch {
    return "—";
  }
}

function Chip({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone: "green" | "orange" | "gray" | "red";
}) {
  const cls =
    tone === "green"
      ? "bg-emerald-50 text-emerald-700"
      : tone === "orange"
        ? "bg-orange-50 text-orange-700"
        : tone === "red"
          ? "bg-red-50 text-red-700"
          : "bg-slate-100 text-slate-600";
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-bold ${cls}`}>
      {children}
    </span>
  );
}

/** Nhãn trạng thái CTV — ghi rõ tiếng Việt như mockup */
function ctvStatusChip(row: ShopAccount): {
  label: string;
  tone: "green" | "orange" | "red" | "gray";
} {
  if (!row.active || row.ctvStatus === "khoa") {
    return { label: "Tạm dừng", tone: "red" };
  }
  if (row.ctvStatus === "active") {
    return { label: "Hoạt động", tone: "green" };
  }
  if (row.ctvStatus === "cho_duyet") {
    return { label: "Chờ duyệt", tone: "orange" };
  }
  return { label: "Hoạt động", tone: "green" };
}

export default function ShopAccountsAdmin({
  embedded = false,
  defaultTab,
  scope = "all",
  onConfigClick,
  configOpen = false,
  configPanel = null,
}: {
  embedded?: boolean;
  defaultTab?: TabId;
  /** all = CTV+khách; ctv = chỉ cộng tác viên; customers = chỉ khách mua */
  scope?: AccountsScope;
  onConfigClick?: () => void;
  configOpen?: boolean;
  configPanel?: React.ReactNode;
}) {
  const router = useRouter();
  const initialTab: TabId =
    defaultTab ||
    (scope === "ctv" ? "ctv" : scope === "customers" ? "customer" : "all");
  const [tab, setTab] = useState<TabId>(initialTab);
  const [dateRange, setDateRange] = useState<AdminDateRange | null>(
    scope === "ctv" ? defaultThisMonthRange() : null
  );
  const [q, setQ] = useState("");
  const [qDebounced, setQDebounced] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);
  const [stats, setStats] = useState<Stats | null>(null);
  const [items, setItems] = useState<ShopAccount[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [addBusy, setAddBusy] = useState(false);

  const apiScope =
    scope === "ctv" ? "ctv" : scope === "customers" ? "customer" : "";

  useEffect(() => {
    const t = window.setTimeout(() => setQDebounced(q.trim()), 300);
    return () => window.clearTimeout(t);
  }, [q]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const scopeQs = apiScope ? `&scope=${encodeURIComponent(apiScope)}` : "";
      const timeQs =
        scope === "ctv" && dateRange
          ? `&from=${encodeURIComponent(dateRange.from)}&to=${encodeURIComponent(dateRange.to)}`
          : "";
      const [st, list] = await Promise.all([
        api<{ ok: boolean } & Stats>("/api/shop/admin/accounts/stats"),
        api<{ ok: boolean; total: number; items: ShopAccount[] }>(
          `/api/shop/admin/accounts?tab=${tab}&q=${encodeURIComponent(qDebounced)}&page=${page}&limit=${pageSize}${scopeQs}${timeQs}`
        ),
      ]);
      setStats(st);
      setItems(list.items || []);
      setTotal(list.total || 0);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Không tải được danh sách");
    } finally {
      setLoading(false);
    }
  }, [tab, qDebounced, page, pageSize, apiScope, scope, dateRange]);

  useEffect(() => {
    void load();
  }, [load]);

  /** Realtime: CTV đăng ký / duyệt / sửa TK trên máy khác → tự tải lại. */
  useEffect(() => {
    const onAccounts = (ev: Event) => {
      const d = (ev as CustomEvent<{ source?: string }>).detail;
      const src = String(d?.source || "");
      if (
        (src === "ctv_register" || src === "ctv_apply") &&
        scope !== "customers"
      ) {
        toast.message("Có CTV mới chờ duyệt");
        if (tab !== "pending") setTab("pending");
      }
      void load();
    };
    window.addEventListener("aloha-shop-accounts-changed", onAccounts);
    return () => window.removeEventListener("aloha-shop-accounts-changed", onAccounts);
  }, [load, tab, scope]);

  useEffect(() => {
    setPage(1);
    setExpandedId(null);
  }, [tab, qDebounced, dateRange]);

  const expanded = useMemo(
    () => (expandedId ? items.find((x) => x.id === expandedId) || null : null),
    [expandedId, items]
  );

  useEffect(() => {
    setNote(expanded?.adminNote || "");
  }, [expanded?.id, expanded?.adminNote]);

  const tabs = useMemo(() => {
    if (scope === "ctv") {
      return [] as const;
    }
    if (scope === "customers") {
      return [
        { id: "customer" as const, label: "Tất cả", count: stats?.customers },
        {
          id: "locked" as const,
          label: "Đã khóa",
          count: stats?.customerLocked ?? stats?.locked,
        },
      ];
    }
    return [
      { id: "all" as const, label: "Tất cả", count: stats?.total },
      { id: "customer" as const, label: "Khách", count: stats?.customers },
      { id: "ctv" as const, label: "CTV", count: stats?.ctvActive },
      { id: "pending" as const, label: "Chờ duyệt", count: stats?.ctvPending },
      { id: "locked" as const, label: "Đã khóa", count: stats?.locked },
    ];
  }, [stats, scope]);

  const statusOptions = useMemo(
    () =>
      [
        { id: "ctv" as TabId, label: "Tất cả" },
        { id: "active" as TabId, label: "Hoạt động" },
        { id: "pending" as TabId, label: "Chờ duyệt" },
        { id: "locked" as TabId, label: "Đã khóa" },
      ] as const,
    []
  );

  const kpiCards = useMemo(() => {
    if (scope === "ctv") {
      return [
        {
          label: "Tổng CTV",
          value: stats?.ctvTotal ?? stats?.ctvActive,
          tab: "ctv" as TabId,
        },
        {
          label: "CTV đang hoạt động",
          value: stats?.ctvActive,
          tab: "active" as TabId,
        },
        {
          label: "CTV chờ duyệt",
          value: stats?.ctvPending,
          tab: "pending" as TabId,
          warn: true,
        },
        {
          label: "Đã khóa",
          value: stats?.ctvLocked ?? stats?.locked,
          tab: "locked" as TabId,
        },
      ];
    }
    if (scope === "customers") {
      return [
        {
          label: "Tổng khách",
          value: stats?.customers,
          tab: "customer" as TabId,
        },
        {
          label: "Đã khóa",
          value: stats?.customerLocked ?? stats?.locked,
          tab: "locked" as TabId,
        },
      ];
    }
    return [
      { label: "Tổng tài khoản", value: stats?.total, tab: "all" as TabId },
      { label: "Khách mua", value: stats?.customers, tab: "customer" as TabId },
      { label: "CTV đang hoạt động", value: stats?.ctvActive, tab: "ctv" as TabId },
      {
        label: "CTV chờ duyệt",
        value: stats?.ctvPending,
        tab: "pending" as TabId,
        warn: true,
      },
    ];
  }, [stats, scope]);

  const title =
    scope === "ctv"
      ? "Danh sách cộng tác viên"
      : scope === "customers"
        ? "Quản lý khách hàng"
        : "Khách hàng và cộng tác viên";
  const subtitle =
    scope === "ctv"
      ? "Duyệt, khóa và quản lý tài khoản CTV"
      : scope === "customers"
        ? "Tài khoản khách mua trên web bán"
        : "Tài khoản web bán — duyệt CTV, khóa / xóa thành viên";
  const searchPlaceholder =
    scope === "customers"
      ? "Tìm tên, email, SĐT…"
      : scope === "ctv"
        ? "Tìm theo tên, SĐT, mã CTV…"
        : "Tìm tên, email, SĐT, mã CTV…";
  const showCtvColumns = scope !== "customers";
  const colSpan = scope === "all" ? 7 : scope === "ctv" ? 6 : 5;

  function toggleExpand(id: string) {
    setExpandedId((cur) => (cur === id ? null : id));
  }

  function openCtvDetail(row: ShopAccount) {
    const code = String(row.ctvCode || "").trim();
    if (!code) {
      toast.error("CTV chưa có mã");
      return;
    }
    router.push(`/admin/ctv/danh-sach/${encodeURIComponent(code)}`);
  }

  async function deleteAccount(row: ShopAccount) {
    const kind = row.roles.includes("ctv") ? "CTV" : "khách";
    const ok = window.confirm(
      `Xóa ${kind} «${row.fullName || row.email}»?\nKhông khôi phục được.`
    );
    if (!ok) return;
    setBusyId(row.id);
    try {
      await api(`/api/shop/admin/accounts/${row.id}`, { method: "DELETE" });
      toast.success("Đã xóa tài khoản");
      if (expandedId === row.id) setExpandedId(null);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Lỗi xóa");
    } finally {
      setBusyId(null);
    }
  }

  async function createCtv(values: AddCtvFormValues) {
    setAddBusy(true);
    try {
      const r = await api<{ ok: boolean; loginHint?: string; inviteQueued?: boolean }>(
        "/api/shop/admin/accounts",
        {
          method: "POST",
          body: JSON.stringify({
            fullName: values.fullName.trim(),
            phone: values.phone.trim(),
            email: values.email.trim() || undefined,
            address: values.address.trim() || undefined,
            gender: values.gender || undefined,
            birthday: values.birthday || undefined,
            referralChannel: values.referralChannel || undefined,
            username: values.username.trim(),
            password: values.password,
            sendInvite: values.sendInvite,
          }),
        }
      );
      toast.success(
        r.inviteQueued
          ? `Đã tạo CTV. ${r.loginHint || ""}`
          : `Đã tạo CTV. ${r.loginHint || ""}`
      );
      setAddOpen(false);
      setTab("active");
      await load();
    } finally {
      setAddBusy(false);
    }
  }

  async function patchAccount(id: string, body: Record<string, unknown>) {
    setBusyId(id);
    try {
      const r = await api<{ user: ShopAccount }>(`/api/shop/admin/accounts/${id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      toast.success("Đã cập nhật");
      setItems((prev) => prev.map((x) => (x.id === id ? r.user : x)));
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Lỗi cập nhật");
    } finally {
      setBusyId(null);
    }
  }

  async function approveCtv(id: string) {
    setBusyId(id);
    try {
      const r = await api<{ user: ShopAccount }>(`/api/shop/admin/accounts/${id}/approve-ctv`, {
        method: "POST",
      });
      toast.success("Đã duyệt CTV");
      setItems((prev) => prev.map((x) => (x.id === id ? r.user : x)));
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Lỗi duyệt");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div
      className={`flex h-full flex-col gap-4 ${
        embedded ? "min-h-[60vh] p-2 md:p-3" : "min-h-[70vh] p-4 md:p-6"
      }`}
    >
      {!embedded ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-slate-800">{title}</h1>
            <p className="text-sm text-slate-500">{subtitle}</p>
          </div>
          <button
            type="button"
            onClick={() => void load()}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} /> Làm mới
          </button>
        </div>
      ) : scope !== "ctv" ? (
        <div className="flex items-center justify-end">
          <button
            type="button"
            onClick={() => void load()}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} /> Làm mới
          </button>
        </div>
      ) : null}

      {scope !== "ctv" ? (
        <div
          className={`grid grid-cols-2 gap-3 ${
            kpiCards.length >= 4 ? "lg:grid-cols-4" : "lg:grid-cols-2"
          }`}
        >
          {kpiCards.map((c) => (
            <button
              key={c.label}
              type="button"
              onClick={() => setTab(c.tab)}
              className={`rounded-xl border bg-white p-4 text-left shadow-sm ${
                tab === c.tab ? "border-emerald-500 ring-1 ring-emerald-200" : "border-slate-200"
              }`}
            >
              <div className="text-xs font-medium text-slate-500">{c.label}</div>
              <div
                className={`mt-1 text-2xl font-bold ${
                  c.warn && (c.value || 0) > 0 ? "text-orange-600" : "text-slate-800"
                }`}
              >
                {c.value ?? "—"}
              </div>
            </button>
          ))}
        </div>
      ) : null}

      {scope === "ctv" ? (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[220px] flex-1 sm:max-w-md">
              <Search
                size={16}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={searchPlaceholder}
                className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-emerald-500"
              />
            </div>
            <label className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13px] font-semibold text-slate-600">
              <span className="text-slate-400">Trạng thái:</span>
              <select
                value={tab}
                onChange={(e) => setTab(e.target.value as TabId)}
                className="border-0 bg-transparent pr-1 font-bold text-[#1a2e1a] outline-none"
                aria-label="Lọc trạng thái"
              >
                {statusOptions.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
            <AdminDateRangePicker
              value={dateRange}
              allowClear
              onChange={setDateRange}
              placeholder="Thời gian: Tất cả"
            />
            <button
              type="button"
              onClick={() => setAddOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#2D5A27] px-3 py-2 text-[13px] font-semibold text-white shadow-sm hover:bg-[#244a20]"
            >
              <UserPlus size={15} />
              Thêm cộng tác viên
            </button>
            {onConfigClick ? (
              <button
                type="button"
                onClick={onConfigClick}
                className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-[13px] font-semibold ${
                  configOpen
                    ? "border-emerald-600 bg-emerald-700 text-white"
                    : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                <Settings2 size={15} />
                Cấu hình CTV
              </button>
            ) : null}
          </div>
          {configPanel}
          <AddCtvModal
            open={addOpen}
            busy={addBusy}
            onClose={() => !addBusy && setAddOpen(false)}
            onSubmit={createCtv}
          />
        </>
      ) : (
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-2">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${
                tab === t.id
                  ? "bg-emerald-700 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {t.label}
              {t.count != null ? <span className="ml-1 opacity-80">({t.count})</span> : null}
            </button>
          ))}
          <div className="relative ml-auto min-w-[220px] flex-1 sm:max-w-xs">
            <Search
              size={16}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-emerald-500"
            />
          </div>
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="sticky top-0 z-10 bg-slate-50 text-xs font-semibold uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Họ tên</th>
              {scope === "all" ? <th className="px-3 py-3">Loại</th> : null}
              <th className="px-3 py-3">Liên hệ</th>
              {showCtvColumns ? <th className="px-3 py-3">Mã CTV</th> : null}
              <th className="px-3 py-3">Trạng thái</th>
              <th className="px-3 py-3">Ngày tạo</th>
              <th className="px-3 py-3 text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {loading && !items.length ? (
              <>
                {Array.from({ length: 8 }, (_, i) => (
                  <AdminTableRowSkeleton key={i} cols={colSpan} />
                ))}
              </>
            ) : !items.length ? (
              <tr>
                <td colSpan={colSpan} className="px-4 py-12 text-center text-slate-400">
                  {scope === "customers"
                    ? "Chưa có khách hàng"
                    : scope === "ctv"
                      ? "Chưa có cộng tác viên"
                      : "Chưa có tài khoản"}
                </td>
              </tr>
            ) : (
              items.map((row) => {
                const open = expandedId === row.id;
                const detail = open ? expanded || row : null;
                return (
                  <React.Fragment key={row.id}>
                    <tr
                      onClick={() => {
                        if (scope === "ctv" && row.ctvCode) {
                          openCtvDetail(row);
                          return;
                        }
                        toggleExpand(row.id);
                      }}
                      className={`cursor-pointer border-b border-[#eef1f5] transition-colors ${
                        open ? "bg-[#E8EFE4]" : "hover:bg-[#f5f7f5]"
                      }`}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {row.avatarUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={row.avatarUrl}
                              alt=""
                              className="h-8 w-8 rounded-full object-cover"
                            />
                          ) : (
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-200 text-xs font-bold text-slate-600">
                              {(row.fullName || "?").slice(0, 1).toUpperCase()}
                            </div>
                          )}
                          <div>
                            <div className="font-semibold text-slate-800">
                              {row.fullName || "—"}
                            </div>
                            <div className="text-xs text-slate-400">
                              {row.authProviders.join(", ")}
                            </div>
                          </div>
                        </div>
                      </td>
                      {scope === "all" ? (
                        <td className="px-3 py-3">
                          <div className="flex flex-wrap gap-1">
                            {row.roles.includes("customer") ? (
                              <Chip tone="green">Khách</Chip>
                            ) : null}
                            {row.roles.includes("ctv") ? (
                              <Chip tone="orange">CTV</Chip>
                            ) : null}
                          </div>
                        </td>
                      ) : null}
                      <td className="px-3 py-3">
                        <div className="text-slate-700">{row.email}</div>
                        <div className="text-xs text-slate-400">{maskPhone(row.phone)}</div>
                      </td>
                      {showCtvColumns ? (
                        <td className="px-3 py-3 font-mono text-xs">{row.ctvCode || "—"}</td>
                      ) : null}
                      <td className="px-3 py-3">
                        {scope === "customers" ? (
                          !row.active ? (
                            <Chip tone="red">Tạm dừng</Chip>
                          ) : (
                            <Chip tone="green">Hoạt động</Chip>
                          )
                        ) : row.roles.includes("ctv") ? (
                          (() => {
                            const st = ctvStatusChip(row);
                            return <Chip tone={st.tone}>{st.label}</Chip>;
                          })()
                        ) : !row.active ? (
                          <Chip tone="red">Tạm dừng</Chip>
                        ) : (
                          <Chip tone="gray">Hoạt động</Chip>
                        )}
                      </td>
                      <td className="px-3 py-3 text-slate-500">{fmtDate(row.createdAt)}</td>
                      <td
                        className="px-3 py-3 text-right"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="inline-flex gap-1">
                          {scope !== "customers" &&
                          row.roles.includes("ctv") &&
                          row.ctvStatus === "cho_duyet" ? (
                            <button
                              type="button"
                              disabled={busyId === row.id}
                              title="Duyệt CTV"
                              onClick={() => void approveCtv(row.id)}
                              className="rounded-md bg-emerald-600 p-1.5 text-white hover:bg-emerald-700"
                            >
                              <Check size={14} />
                            </button>
                          ) : null}
                          <button
                            type="button"
                            disabled={busyId === row.id}
                            title={row.active ? "Khóa" : "Mở khóa"}
                            onClick={() => void patchAccount(row.id, { active: !row.active })}
                            className="rounded-md border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-50"
                          >
                            {row.active ? <Lock size={14} /> : <Unlock size={14} />}
                          </button>
                          <button
                            type="button"
                            disabled={busyId === row.id}
                            title="Xóa thành viên"
                            onClick={() => void deleteAccount(row)}
                            className="rounded-md border border-rose-200 p-1.5 text-rose-600 hover:bg-rose-50"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>

                    {open && detail ? (
                      <tr className="bg-white">
                        <td
                          colSpan={colSpan}
                          className="border-b border-[#d0e8f8] p-0"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="mx-3 mb-3 overflow-hidden rounded-md border border-[#cfe8f7] bg-white shadow-sm">
                            <div className="flex items-center justify-between gap-3 border-b border-[#e8ecf0] bg-[#FFFCF6] px-4 py-2.5">
                              <div className="min-w-0">
                                <div className="truncate text-[15px] font-bold text-slate-800">
                                  {detail.fullName}
                                </div>
                                <div className="truncate text-xs text-slate-500">
                                  {detail.email}
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => setExpandedId(null)}
                                className="rounded p-1 text-slate-500 hover:bg-slate-100"
                                title="Đóng"
                              >
                                <X size={18} />
                              </button>
                            </div>

                            <div className="grid gap-4 p-4 text-sm md:grid-cols-2 lg:grid-cols-3">
                              <div>
                                <div className="mb-1.5 text-xs font-bold uppercase tracking-wide text-slate-400">
                                  Hồ sơ
                                </div>
                                <div className="space-y-1 text-slate-700">
                                  <div>SĐT: {maskPhone(detail.phone)}</div>
                                  <div>
                                    Đăng nhập: {detail.authProviders.join(", ") || "—"}
                                  </div>
                                  <div>Tạo: {fmtDate(detail.createdAt)}</div>
                                  <div>
                                    Đăng nhập gần nhất: {fmtDate(detail.lastLoginAt)}
                                  </div>
                                  <div className="flex flex-wrap gap-1 pt-1">
                                    {detail.roles.includes("customer") ? (
                                      <Chip tone="green">Khách</Chip>
                                    ) : null}
                                    {detail.roles.includes("ctv") ? (
                                      <Chip tone="orange">CTV</Chip>
                                    ) : null}
                                    {!detail.active ? <Chip tone="red">Đã khóa</Chip> : null}
                                  </div>
                                </div>
                              </div>

                              {scope !== "customers" && detail.roles.includes("ctv") ? (
                                <div>
                                  <div className="mb-1.5 text-xs font-bold uppercase tracking-wide text-slate-400">
                                    Cộng tác viên
                                  </div>
                                  <div className="space-y-2 text-slate-700">
                                    <div>
                                      Mã CTV:{" "}
                                      <span className="font-mono font-bold">
                                        {detail.ctvCode || "—"}
                                      </span>
                                    </div>
                                    <div>
                                      Trạng thái:{" "}
                                      <strong>
                                        {ctvStatusChip(detail).label}
                                      </strong>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                      {detail.ctvStatus !== "active" ? (
                                        <button
                                          type="button"
                                          disabled={busyId === detail.id}
                                          onClick={() => void approveCtv(detail.id)}
                                          className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white"
                                        >
                                          Duyệt CTV
                                        </button>
                                      ) : null}
                                      <button
                                        type="button"
                                        disabled={busyId === detail.id}
                                        onClick={() =>
                                          void patchAccount(detail.id, {
                                            ctvStatus:
                                              detail.ctvStatus === "khoa" ? "active" : "khoa",
                                          })
                                        }
                                        className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold"
                                      >
                                        {detail.ctvStatus === "khoa" ? "Mở CTV" : "Khóa CTV"}
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              ) : null}
                              {scope === "all" && !detail.roles.includes("ctv") ? (
                                <div>
                                  <div className="mb-1.5 text-xs font-bold uppercase tracking-wide text-slate-400">
                                    Cộng tác viên
                                  </div>
                                  <p className="text-slate-500">Chưa đăng ký CTV</p>
                                </div>
                              ) : null}

                              <div>
                                <div className="mb-1.5 text-xs font-bold uppercase tracking-wide text-slate-400">
                                  Ghi chú nội bộ
                                </div>
                                <textarea
                                  value={note}
                                  onChange={(e) => setNote(e.target.value)}
                                  rows={3}
                                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                                  placeholder="Ghi chú…"
                                />
                                <div className="mt-2 flex flex-wrap gap-2">
                                  <button
                                    type="button"
                                    disabled={busyId === detail.id}
                                    onClick={() =>
                                      void patchAccount(detail.id, { adminNote: note })
                                    }
                                    className="rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-bold text-white"
                                  >
                                    Lưu ghi chú
                                  </button>
                                  <button
                                    type="button"
                                    disabled={busyId === detail.id}
                                    onClick={() =>
                                      void patchAccount(detail.id, {
                                        active: !detail.active,
                                      })
                                    }
                                    className={`rounded-lg px-3 py-1.5 text-xs font-bold text-white ${
                                      detail.active
                                        ? "bg-red-600 hover:bg-red-700"
                                        : "bg-emerald-600 hover:bg-emerald-700"
                                    }`}
                                  >
                                    {detail.active ? "Khóa tài khoản" : "Mở khóa tài khoản"}
                                  </button>
                                  <button
                                    type="button"
                                    disabled={busyId === detail.id}
                                    onClick={() => void deleteAccount(detail)}
                                    className="rounded-lg border border-rose-300 px-3 py-1.5 text-xs font-bold text-rose-700 hover:bg-rose-50"
                                  >
                                    Xóa thành viên
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    ) : null}
                  </React.Fragment>
                );
              })
            )}
          </tbody>
        </table>

        {scope === "ctv" || scope === "customers" ? (
          <CtvPagination
            page={page}
            pageSize={pageSize}
            total={total}
            onPageChange={setPage}
            itemLabel={
              scope === "customers" ? "khách" : scope === "ctv" ? "CTV" : "tài khoản"
            }
          />
        ) : (
          <ThuMuaListPagination
            page={page}
            pageSize={pageSize}
            total={total}
            onPageChange={setPage}
            onPageSizeChange={(n) => {
              setPageSize(n);
              setPage(1);
            }}
            itemLabel="tài khoản"
          />
        )}
      </div>
    </div>
  );
}
