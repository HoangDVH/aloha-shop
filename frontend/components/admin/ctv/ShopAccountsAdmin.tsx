"use client";

/**
 * Vận hành → Khách hàng và cộng tác viên
 * UI CRM: KPI + tabs + bảng + chi tiết ngay dưới dòng (kiểu Hàng hóa)
 */
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { toast } from "@/components/admin/toast";
import {
  defaultThisMonthRange,
  type AdminDateRange,
} from "@/components/admin/ui/AdminDateRangePicker";
import { AddCtvModal, type AddCtvFormValues } from "./AddCtvModal";
import { CtvApplicationModal } from "./CtvApplicationModal";
import { useCtvUiStore } from "./ctvUiStore";
import {
  api,
  type AccountsScope,
  type ShopAccount,
  type Stats,
  type TabId,
} from "./accounts/accountsApi";
import { AccountsToolbar } from "./accounts/AccountsToolbar";
import { AccountsTable } from "./accounts/AccountsTable";

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
  const setReviewAccountId = useCtvUiStore((s) => s.setReviewAccountId);

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
      if (expandedId === id) {
        /* keep expanded */
      }
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Lỗi cập nhật");
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

      <AccountsToolbar
        scope={scope}
        tab={tab}
        setTab={setTab}
        tabs={tabs}
        statusOptions={statusOptions}
        q={q}
        setQ={setQ}
        searchPlaceholder={searchPlaceholder}
        dateRange={dateRange}
        setDateRange={setDateRange}
        onOpenAdd={() => setAddOpen(true)}
        onConfigClick={onConfigClick}
        configOpen={configOpen}
        configPanel={configPanel}
      />

      {scope === "ctv" ? (
        <AddCtvModal
          open={addOpen}
          busy={addBusy}
          onClose={() => !addBusy && setAddOpen(false)}
          onSubmit={createCtv}
        />
      ) : null}

      <AccountsTable
        items={items}
        loading={loading}
        scope={scope}
        showCtvColumns={showCtvColumns}
        colSpan={colSpan}
        expandedId={expandedId}
        expanded={expanded}
        toggleExpand={toggleExpand}
        openCtvDetail={openCtvDetail}
        busyId={busyId}
        patchAccount={patchAccount}
        deleteAccount={deleteAccount}
        setReviewAccountId={setReviewAccountId}
        note={note}
        setNote={setNote}
        setExpandedId={setExpandedId}
        page={page}
        pageSize={pageSize}
        total={total}
        setPage={setPage}
        setPageSize={setPageSize}
      />

      <CtvApplicationModal
        onDone={() => {
          toast.success("Đã cập nhật hồ sơ CTV");
          void load();
        }}
      />
    </div>
  );
}
