"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, Button, Drawer, Empty, Input, Popconfirm, Select, Skeleton, Table, Tabs, Tag, message } from "antd";
import { ArrowUpRight, ChevronRight, RefreshCw, Search, UserPlus, X } from "lucide-react";
import { siRequest } from "@/lib/siQueries";
import { requireDirectoryResponse } from "@/lib/customerDirectoryResponse";
import { InviteWholesale } from "../si/InviteWholesale";
import { SiAccountsPanel, type SiAccountRow } from "../si/SiAccountsPanel";
import { SiOrderSyncPanel } from "../si/SiOrderSyncPanel";
import { CtvApplicationModal } from "../ctv/CtvApplicationModal";
import { AddCtvModal, type AddCtvFormValues } from "../ctv/AddCtvModal";
import { useCtvUiStore } from "../ctv/ctvUiStore";

type Account = {
  id: string; fullName: string; email: string; phone: string | null; roles: string[];
  active: boolean; siRegion?: string | null; siStatus?: string | null;
  ctvStatus?: string | null; ctvCode?: string | null; adminNote?: string | null;
  createdAt?: string | null; lastLoginAt?: string | null; authProviders: string[];
};
type Filters = { customerType: string; affiliate: string; wholesaleStatus: string; accountState: string; pending: string };
const defaults: Filters = { customerType: "all", affiliate: "all", wholesaleStatus: "all", accountState: "all", pending: "" };
type Counts = { total: number; retail: number; HCM: number; TINH: number; unassigned: number; affiliates: number; pending: number };
const statusLabels: Record<string, string> = { active: "Đã duyệt", cho_duyet: "Chờ duyệt", khoa: "Tạm khóa", tu_choi: "Cần bổ sung" };
const ctvLabels: Record<string, string> = { ...statusLabels, active: "Hoạt động", tu_choi: "Từ chối" };
const typeOptions = [
  { value: "all", label: "Tất cả loại khách" }, { value: "retail", label: "Khách lẻ" },
  { value: "wholesale", label: "Tất cả khách sỉ" }, { value: "HCM", label: "Sỉ HCM" },
  { value: "TINH", label: "Sỉ tỉnh" }, { value: "unassigned", label: "Sỉ chưa xác nhận vùng" },
];
const affiliateOptions = [
  { value: "all", label: "Tất cả" }, { value: "member", label: "Có vai trò CTV" }, { value: "none", label: "Không phải CTV" },
  ...Object.entries(ctvLabels).map(([value, label]) => ({ value, label })),
];
function category(account: Account) {
  if (!account.roles.includes("si")) return { label: "Khách lẻ", color: "default" };
  if (account.siRegion === "HCM") return { label: "Sỉ HCM", color: "blue" };
  if (account.siRegion === "TINH") return { label: "Sỉ tỉnh", color: "purple" };
  return { label: "Sỉ chưa xác nhận vùng", color: "gold" };
}
function StatusTag({ value, ctv = false }: { value?: string | null; ctv?: boolean }) {
  return <Tag color={value === "active" ? "green" : value === "cho_duyet" ? "gold" : value === "khoa" ? "red" : "default"}>
    {(ctv ? ctvLabels : statusLabels)[value || ""] || "Chưa xác định"}
  </Tag>;
}
function date(value?: string | null) { return value ? new Date(value).toLocaleString("vi-VN") : "—"; }

export default function CustomerDirectory() {
  const qc = useQueryClient();
  const [view, setView] = useState("customers");
  const [filters, setFilters] = useState<Filters>(defaults);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [siId, setSiId] = useState<string | null>(null);
  const [addCtv, setAddCtv] = useState(false);
  const reviewCtv = useCtvUiStore(s => s.setReviewAccountId);
  const refresh = () => { void qc.invalidateQueries({ queryKey: ["admin", "directory"] }); };

  useEffect(() => {
    const timer = window.setTimeout(() => { setDebouncedSearch(search.trim()); setPage(1); }, 300);
    return () => window.clearTimeout(timer);
  }, [search]);
  useEffect(() => {
    const reload = () => { void qc.invalidateQueries({ queryKey: ["admin", "directory"] }); };
    window.addEventListener("aloha-shop-accounts-changed", reload);
    return () => window.removeEventListener("aloha-shop-accounts-changed", reload);
  }, [qc]);

  const stats = useQuery({ queryKey: ["admin", "directory", "segments"],
    queryFn: () => siRequest<Counts>("/api/shop/admin/accounts/segments"), refetchInterval: 30000 });
  const list = useQuery({ queryKey: ["admin", "directory", "list", filters, debouncedSearch, page, pageSize],
    queryFn: async () => requireDirectoryResponse(await siRequest<{ items: Account[]; total: number; directoryVersion?: number }>(`/api/shop/admin/accounts?${new URLSearchParams({
      scope: "directory", ...filters, q: debouncedSearch, page: String(page), limit: String(pageSize),
    })}`)), enabled: view === "customers", refetchInterval: 30000, retry: false });
  useEffect(() => {
    if (list.data) setPage(current => Math.min(current, Math.max(1, Math.ceil(list.data.total / pageSize))));
  }, [list.data, pageSize]);
  const detail = useQuery({ queryKey: ["admin", "directory", "detail", selectedId],
    queryFn: () => siRequest<{ user: Account }>(`/api/shop/admin/accounts/${selectedId}`), enabled: Boolean(selectedId) });
  const si = useQuery({ queryKey: ["admin", "si", "detail", siId],
    queryFn: () => siRequest<SiAccountRow>(`/api/shop/admin/si/${siId}`), enabled: Boolean(siId), staleTime: 0, refetchOnWindowFocus: false });
  const createCtv = useMutation({
    mutationFn: (values: AddCtvFormValues) => siRequest<{ loginHint?: string }>("/api/shop/admin/accounts", {
      ...values, fullName: values.fullName.trim(), phone: values.phone.trim(), email: values.email.trim() || undefined,
      address: values.address.trim() || undefined, username: values.username.trim(),
    }),
    onSuccess: data => { setAddCtv(false); refresh(); void message.success(data.loginHint || "Đã tạo cộng tác viên"); },
  });

  const change = (key: keyof Filters, value: string) => { setFilters(f => ({ ...f, [key]: value })); setPage(1); };
  const clear = () => { setFilters(defaults); setSearch(""); setDebouncedSearch(""); setPage(1); };
  const filtered = search !== "" || Object.entries(filters).some(([key, value]) => value !== defaults[key as keyof Filters]);

  return <div className="mx-auto max-w-[1600px] space-y-3 pb-8">
    {stats.error && <Alert type="warning" showIcon title="Chưa tải được thống kê" action={<Button onClick={() => void stats.refetch()}>Thử lại</Button>} />}
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
      <Tabs className="min-w-0 max-w-full [&_.ant-tabs-nav]:!mb-0" activeKey={view} onChange={setView} items={[
        { key: "customers", label: "Danh sách khách hàng" }, { key: "sync", label: "Đồng bộ đơn sỉ KiotViet" },
      ]} />
      <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
        <Button icon={<RefreshCw size={15} />} loading={list.isFetching || stats.isFetching} onClick={refresh}>Làm mới</Button>
        <InviteWholesale />
        <Button type="primary" icon={<UserPlus size={16} />} onClick={() => setAddCtv(true)}>Thêm CTV</Button>
      </div>
    </div>
    {view === "sync" ? <SiOrderSyncPanel /> : <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
      <div className="space-y-4 border-b border-slate-100 p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><h2 className="text-base font-semibold text-slate-800">Danh sách khách hàng <span className="ml-2 rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-500">{list.isPending || list.isError ? "…" : list.data?.total.toLocaleString("vi-VN")}</span></h2>
            <p className="mt-1 text-xs text-slate-500">Lọc kết hợp loại khách, hồ sơ sỉ và vai trò cộng tác viên.</p></div>
          <div className="flex flex-wrap gap-2">
            <Button type={filters.pending ? "primary" : "default"} onClick={() => change("pending", filters.pending ? "" : "1")}>
              Chờ duyệt {stats.data && !stats.isError ? `(${stats.data.pending})` : ""}
            </Button>
            <Button type={filters.customerType === "unassigned" ? "primary" : "default"} onClick={() => change("customerType", filters.customerType === "unassigned" ? "all" : "unassigned")}>
              Sỉ chưa có vùng {stats.data && !stats.isError ? `(${stats.data.unassigned})` : ""}
            </Button>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(240px,1.5fr)_repeat(4,minmax(145px,1fr))]">
          <label className="space-y-1.5"><span className="text-xs font-medium text-slate-500">Tìm khách hàng</span>
            <Input size="large" prefix={<Search size={16} className="text-slate-400" />} allowClear placeholder="Tên, SĐT, email, mã CTV" value={search} onChange={e => setSearch(e.target.value)} /></label>
          <Filter label="Loại khách" value={filters.customerType} options={typeOptions} onChange={v => change("customerType", v)} />
          <Filter label="Cộng tác viên" value={filters.affiliate} options={affiliateOptions} onChange={v => change("affiliate", v)} />
          <Filter label="Hồ sơ sỉ" value={filters.wholesaleStatus} options={[{ value: "all", label: "Tất cả trạng thái" }, ...Object.entries(statusLabels).map(([value, label]) => ({ value, label }))]} onChange={v => change("wholesaleStatus", v)} />
          <Filter label="Tài khoản" value={filters.accountState} options={[{ value: "all", label: "Tất cả" }, { value: "active", label: "Đang mở" }, { value: "locked", label: "Đã khóa" }]} onChange={v => change("accountState", v)} />
        </div>
        {filtered && <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500"><span>Đang áp dụng bộ lọc</span><Button type="text" size="small" icon={<X size={13} />} onClick={clear}>Xóa bộ lọc</Button></div>}
      </div>
      {list.error && <div className="p-4"><Alert type="error" showIcon title="Không tải được danh sách khách hàng" description={list.error.message} action={<Button onClick={() => void list.refetch()}>Thử lại</Button>} /></div>}
      <Table<Account> rowKey="id" loading={list.isFetching} dataSource={list.isError ? [] : list.data?.items || []} scroll={{ x: 1080 }}
        locale={{ emptyText: <div className="py-10"><Empty description={filtered ? "Không có khách phù hợp với bộ lọc" : "Chưa có khách hàng"} />{filtered && <Button className="mt-3" onClick={clear}>Xóa bộ lọc</Button>}</div> }}
        pagination={{ current: page, pageSize, total: list.data?.total || 0, showSizeChanger: true, pageSizeOptions: [15, 30, 50],
          onChange: (next, size) => { setPage(size !== pageSize ? 1 : next); setPageSize(size); }, showTotal: total => `${total.toLocaleString("vi-VN")} khách hàng` }}
        columns={[
          { title: "Khách hàng", key: "name", width: 260, render: (_, row) => <button type="button" onClick={() => setSelectedId(row.id)} className="flex w-full items-center gap-3 rounded-lg text-left focus-visible:outline-2 focus-visible:outline-green-700">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#edf4e9] font-semibold text-[#456b3c]">{(row.fullName || row.email || "?").slice(0, 1).toUpperCase()}</span>
            <span className="min-w-0"><span className="block font-semibold text-slate-800">{row.fullName || "Chưa có tên"}</span><span className="block max-w-[210px] truncate text-xs text-slate-500">{row.email || "Chưa có email"}</span></span>
          </button> },
          { title: "Số điện thoại", dataIndex: "phone", width: 145, render: value => <span className="whitespace-nowrap text-slate-600">{value || "—"}</span> },
          { title: "Loại khách", key: "type", width: 185, render: (_, row) => <Tag color={category(row).color}>{category(row).label}</Tag> },
          { title: "Cộng tác viên", key: "ctv", width: 155, render: (_, row) => row.roles.includes("ctv") ? <div><StatusTag ctv value={row.ctvStatus} /><span className="mt-1 block font-mono text-xs text-slate-500">{row.ctvCode || "Chưa cấp mã"}</span></div> : <span className="text-xs text-slate-400">Không phải CTV</span> },
          { title: "Hồ sơ sỉ", key: "si", width: 140, render: (_, row) => row.roles.includes("si") ? <StatusTag value={row.siStatus} /> : <span className="text-slate-400">—</span> },
          { title: "Tài khoản", key: "state", width: 125, render: (_, row) => <span className={`inline-flex items-center gap-1.5 text-xs ${row.active === false ? "text-red-600" : "text-emerald-700"}`}><span className={`h-1.5 w-1.5 rounded-full ${row.active === false ? "bg-red-500" : "bg-emerald-500"}`} />{row.active === false ? "Đã khóa" : "Đang mở"}</span> },
          { title: "", key: "action", width: 100, render: (_, row) => <Button type="text" aria-label={`Xem hồ sơ ${row.fullName}`} onClick={() => setSelectedId(row.id)}>Chi tiết <ChevronRight size={14} /></Button> },
        ]} />
    </section>}

    <Drawer open={Boolean(selectedId)} onClose={() => setSelectedId(null)} title="Chi tiết khách hàng" size="large" destroyOnHidden>
      {detail.isPending ? <Skeleton active /> : detail.error ? <Alert type="error" title={detail.error.message} action={<Button onClick={() => void detail.refetch()}>Thử lại</Button>} /> : detail.data && <AccountDetails key={detail.data.user.id} account={detail.data.user} onChanged={refresh} onDeleted={() => { setSelectedId(null); refresh(); }}
        onSi={() => { setSiId(detail.data.user.id); setSelectedId(null); }} onCtv={() => { reviewCtv(detail.data.user.id); setSelectedId(null); }} />}
    </Drawer>
    {siId && (si.isFetching || si.error || !si.data ? <Drawer open onClose={() => setSiId(null)} title="Hồ sơ khách sỉ" size="large">
      {si.error ? <Alert type="error" title={si.error.message} action={<Button onClick={() => void si.refetch()}>Thử lại</Button>} /> : <Skeleton active />}
    </Drawer> : <SiAccountsPanel key={siId} initialAccount={si.data} onClose={() => { setSiId(null); refresh(); }} />)}
    <CtvApplicationModal onDone={refresh} />
    <AddCtvModal open={addCtv} onClose={() => setAddCtv(false)} busy={createCtv.isPending} onSubmit={async values => { await createCtv.mutateAsync(values); }} />
  </div>;
}

function Filter({ label, value, options, onChange }: { label: string; value: string; options: { value: string; label: string }[]; onChange: (value: string) => void }) {
  return <div className="space-y-1.5"><div className="text-xs font-medium text-slate-500">{label}</div><Select aria-label={label} size="large" className="w-full" value={value} options={options} onChange={onChange} /></div>;
}

function AccountDetails({ account, onChanged, onDeleted, onSi, onCtv }: { account: Account; onChanged: () => void; onDeleted: () => void; onSi: () => void; onCtv: () => void }) {
  const [note, setNote] = useState(account.adminNote || "");
  const update = useMutation({ mutationFn: (body: Record<string, unknown>) => siRequest(`/api/shop/admin/accounts/${account.id}`, body, "PATCH"),
    onSuccess: () => { onChanged(); void message.success("Đã cập nhật khách hàng"); } });
  const remove = useMutation({ mutationFn: () => siRequest(`/api/shop/admin/accounts/${account.id}`, {}, "DELETE"), onSuccess: onDeleted });
  const busy = update.isPending || remove.isPending;
  return <div className="space-y-6">
    <div className="rounded-2xl bg-[#f1f6ee] p-5"><h2 className="text-xl font-semibold text-[#19351d]">{account.fullName || "Chưa có tên"}</h2>
      <p className="mt-1 break-all text-sm text-slate-500">{account.email || "Chưa có email"}</p>
      <div className="mt-3 flex flex-wrap gap-2"><Tag color={category(account).color}>{category(account).label}</Tag>{account.roles.includes("ctv") && <Tag color="cyan">Cộng tác viên</Tag>}{account.active === false && <Tag color="red">Tài khoản đã khóa</Tag>}</div>
    </div>
    <dl className="grid grid-cols-2 gap-4 text-sm">{[["Số điện thoại", account.phone || "—"], ["Ngày tham gia", date(account.createdAt)], ["Đăng nhập gần nhất", date(account.lastLoginAt)], ["Phương thức đăng nhập", account.authProviders?.join(", ") || "—"]].map(([label, value]) => <div key={label}><dt className="mb-1 text-xs text-slate-500">{label}</dt><dd className="break-words text-slate-800">{value}</dd></div>)}</dl>
    <section className="space-y-3 rounded-xl border border-slate-200 p-4"><div className="flex items-center justify-between"><h3 className="font-semibold">Hồ sơ mua sỉ</h3>{account.roles.includes("si") && <StatusTag value={account.siStatus} />}</div>
      {account.roles.includes("si") ? <><p className="text-sm text-slate-500">Xem thông tin kinh doanh, xác minh vùng và quản lý quyền mua sỉ.</p><Button onClick={onSi}>Xem và xử lý hồ sơ sỉ <ArrowUpRight size={14} /></Button></> : <p className="text-sm text-slate-500">Chưa đăng ký mua sỉ. Dùng “Mời khách sỉ” để gửi lời mời đăng ký.</p>}
    </section>
    <section className="space-y-3 rounded-xl border border-slate-200 p-4"><div className="flex items-center justify-between"><h3 className="font-semibold">Cộng tác viên</h3>{account.roles.includes("ctv") && <StatusTag ctv value={account.ctvStatus} />}</div>
      {account.roles.includes("ctv") ? <><p className="text-sm text-slate-500">Mã CTV: <span className="font-mono text-slate-800">{account.ctvCode || "Chưa cấp mã"}</span></p><div className="flex flex-wrap gap-2">
        {account.ctvStatus === "cho_duyet" && <Button onClick={onCtv}>Xem và duyệt hồ sơ CTV</Button>}
        {account.ctvCode && <Link className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-[#456b3c]" href={`/admin/ctv/danh-sach/${encodeURIComponent(account.ctvCode)}`}>Chi tiết & hoa hồng <ArrowUpRight size={14} /></Link>}
        {["active", "khoa"].includes(account.ctvStatus || "") && <Popconfirm title={account.ctvStatus === "khoa" ? "Mở lại quyền CTV?" : "Tạm khóa quyền CTV?"} onConfirm={() => update.mutateAsync({ ctvStatus: account.ctvStatus === "khoa" ? "active" : "khoa" })} okText="Xác nhận" cancelText="Hủy"><Button disabled={busy}>{account.ctvStatus === "khoa" ? "Mở quyền CTV" : "Khóa quyền CTV"}</Button></Popconfirm>}
      </div></> : <p className="text-sm text-slate-500">Khách hàng chưa đăng ký làm cộng tác viên.</p>}
    </section>
    <section className="space-y-3"><label htmlFor="directory-note" className="font-semibold">Ghi chú nội bộ</label><Input.TextArea id="directory-note" rows={4} value={note} onChange={e => setNote(e.target.value)} placeholder="Thông tin cần lưu ý khi chăm sóc khách…" /><Button type="primary" loading={update.isPending} disabled={busy || note === (account.adminNote || "")} onClick={() => update.mutate({ adminNote: note })}>Lưu ghi chú</Button></section>
    {(update.error || remove.error) && <Alert type="error" title={(update.error || remove.error)?.message} />}
    <section className="space-y-3 border-t border-slate-100 pt-5"><h3 className="font-semibold">Quản lý tài khoản</h3><p className="text-xs text-slate-500">Khóa tài khoản sẽ chặn đăng nhập và sử dụng tài khoản này.</p><div className="flex flex-wrap gap-2">
      <Popconfirm title={account.active === false ? "Mở lại tài khoản này?" : "Khóa tài khoản này?"} onConfirm={() => update.mutateAsync({ active: account.active === false })} okText="Xác nhận" cancelText="Hủy"><Button disabled={busy}>{account.active === false ? "Mở khóa tài khoản" : "Khóa tài khoản"}</Button></Popconfirm>
      <Popconfirm title="Xóa tài khoản khách hàng?" description="Thao tác này không thể khôi phục." onConfirm={() => remove.mutateAsync()} okText="Xóa tài khoản" cancelText="Hủy"><Button danger disabled={busy} loading={remove.isPending}>Xóa tài khoản</Button></Popconfirm>
    </div></section>
  </div>;
}
