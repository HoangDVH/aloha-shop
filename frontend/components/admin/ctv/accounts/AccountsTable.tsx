import React from "react";
import { ChevronRight, Eye, Lock, Mail, Phone, Trash2, Unlock } from "lucide-react";
import { AdminTableRowSkeleton } from "@/components/admin/ui/AdminSkeleton";
import { ThuMuaListPagination } from "@/components/admin/ui/ThuMuaListPagination";
import { CtvPagination } from "../shared/CtvPagination";
import { maskPhone } from "../shared/format";
import { Chip, ctvStatusChip } from "./AccountChips";
import { AccountDetailRow } from "./AccountDetailRow";
import { fmtDate, type AccountsScope, type ShopAccount } from "./accountsApi";

export function AccountsTable({
  items,
  loading,
  scope,
  showCtvColumns,
  colSpan,
  expandedId,
  expanded,
  toggleExpand,
  openCtvDetail,
  busyId,
  patchAccount,
  deleteAccount,
  setReviewAccountId,
  note,
  setNote,
  setExpandedId,
  page,
  pageSize,
  total,
  setPage,
  setPageSize,
}: {
  items: ShopAccount[];
  loading: boolean;
  scope: AccountsScope;
  showCtvColumns: boolean;
  colSpan: number;
  expandedId: string | null;
  expanded: ShopAccount | null;
  toggleExpand: (id: string) => void;
  openCtvDetail: (row: ShopAccount) => void;
  busyId: string | null;
  patchAccount: (id: string, body: Record<string, unknown>) => void;
  deleteAccount: (row: ShopAccount) => void;
  setReviewAccountId: (id: string) => void;
  note: string;
  setNote: (v: string) => void;
  setExpandedId: (id: string | null) => void;
  page: number;
  pageSize: number;
  total: number;
  setPage: (p: number) => void;
  setPageSize: (s: number) => void;
}) {
  return (
    <div className="min-h-0 flex-1">
      {/* 1. BẢNG DỮ LIỆU ĐẦY ĐỦ TRÊN DESKTOP (TABLE CHO MÁY TÍNH >= md) */}
      <div className="hidden md:block overflow-auto">
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
                              title="Xem hồ sơ đăng ký"
                              onClick={() => setReviewAccountId(row.id)}
                              className="rounded-md border border-slate-200 bg-white p-1.5 text-slate-700 hover:bg-slate-50"
                            >
                              <Eye size={14} />
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
                          <AccountDetailRow
                            detail={detail}
                            scope={scope}
                            note={note}
                            setNote={setNote}
                            busyId={busyId}
                            onClose={() => setExpandedId(null)}
                            onPatch={patchAccount}
                            onDelete={deleteAccount}
                            setReviewAccountId={setReviewAccountId}
                          />
                        </td>
                      </tr>
                    ) : null}
                  </React.Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* 2. DANH SÁCH MOBILE DẠNG HÀNG PHẲNG (< md: CHUẨN IOS / TECHCOMBANK / OPTION 2) */}
      <div className="block md:hidden">
        {loading && !items.length ? (
          <div className="divide-y divide-slate-100 animate-pulse">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="p-3.5 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="h-8 w-8 rounded-full bg-slate-200" />
                    <div className="h-4 w-32 bg-slate-200 rounded" />
                  </div>
                  <div className="h-5 w-16 bg-slate-200 rounded-full" />
                </div>
                <div className="h-3 w-48 bg-slate-200 rounded" />
                <div className="flex justify-between items-center pt-1">
                  <div className="h-3 w-20 bg-slate-200 rounded" />
                  <div className="h-6 w-20 bg-slate-200 rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : !items.length ? (
          <div className="p-8 text-center text-slate-400 text-xs">
            {scope === "customers"
              ? "Chưa có khách hàng nào phù hợp"
              : scope === "ctv"
                ? "Chưa có cộng tác viên nào phù hợp"
                : "Chưa có tài khoản nào phù hợp"}
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {items.map((row) => {
              const open = expandedId === row.id;
              const detail = open ? expanded || row : null;
              const ctvSt = row.roles.includes("ctv") ? ctvStatusChip(row) : null;
              return (
                <div key={row.id} className="transition">
                  <div
                    onClick={() => {
                      if (scope === "ctv" && row.ctvCode) {
                        openCtvDetail(row);
                        return;
                      }
                      toggleExpand(row.id);
                    }}
                    className="p-3.5 hover:bg-slate-50/70 active:bg-slate-100/70 transition cursor-pointer space-y-2"
                  >
                    {/* Hàng 1: Avatar + Tên + Mã CTV + Trạng thái */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        {row.avatarUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={row.avatarUrl}
                            alt=""
                            className="h-8 w-8 rounded-full object-cover shrink-0 ring-1 ring-slate-200"
                          />
                        ) : (
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#2D5A27]/10 text-xs font-bold text-[#2D5A27]">
                            {(row.fullName || row.email || "?").slice(0, 1).toUpperCase()}
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 truncate">
                            <span className="font-bold text-sm text-slate-900 truncate">
                              {row.fullName || "—"}
                            </span>
                            <ChevronRight size={14} className="text-slate-400 shrink-0" />
                          </div>
                          {row.ctvCode ? (
                            <div className="text-[11px] font-mono text-[#2D5A27] font-semibold">
                              {row.ctvCode}
                            </div>
                          ) : null}
                        </div>
                      </div>

                      <div className="shrink-0 flex flex-col items-end gap-1">
                        {scope === "customers" ? (
                          !row.active ? (
                            <Chip tone="red">Tạm dừng</Chip>
                          ) : (
                            <Chip tone="green">Hoạt động</Chip>
                          )
                        ) : ctvSt ? (
                          <Chip tone={ctvSt.tone}>{ctvSt.label}</Chip>
                        ) : !row.active ? (
                          <Chip tone="red">Đã khóa</Chip>
                        ) : (
                          <Chip tone="green">Hoạt động</Chip>
                        )}
                        {scope === "all" ? (
                          <div className="flex gap-1">
                            {row.roles.includes("customer") ? <Chip tone="green">Khách</Chip> : null}
                            {row.roles.includes("ctv") ? <Chip tone="orange">CTV</Chip> : null}
                          </div>
                        ) : null}
                      </div>
                    </div>

                    {/* Hàng 2: SĐT & Email */}
                    <div className="flex items-center justify-between text-xs text-slate-600 gap-2">
                      <div className="min-w-0 truncate">
                        {row.email ? (
                          <span className="text-slate-700 truncate">{row.email}</span>
                        ) : null}
                        {row.phone ? (
                          <a
                            href={`tel:${row.phone}`}
                            onClick={(e) => e.stopPropagation()}
                            className="text-slate-500 ml-1.5 hover:text-[#2D5A27] hover:underline inline-flex items-center gap-0.5"
                          >
                            <Phone size={10} className="text-slate-400" />
                            <span>{maskPhone(row.phone)}</span>
                          </a>
                        ) : null}
                      </div>
                      <div className="shrink-0 text-[11px] text-slate-400 tabular-nums">
                        {fmtDate(row.createdAt)}
                      </div>
                    </div>

                    {/* Hàng 3: Thao tác nhanh trên mobile */}
                    <div
                      className="flex items-center justify-end gap-1.5 pt-0.5"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {scope !== "customers" &&
                      row.roles.includes("ctv") &&
                      row.ctvStatus === "cho_duyet" ? (
                        <button
                          type="button"
                          disabled={busyId === row.id}
                          onClick={() => setReviewAccountId(row.id)}
                          className="inline-flex items-center gap-1 rounded-lg bg-[#2D5A27] px-2.5 py-1 text-xs font-semibold text-white shadow-2xs hover:bg-[#23481e] active:scale-95 transition"
                        >
                          <Eye size={13} />
                          <span>Duyệt hồ sơ</span>
                        </button>
                      ) : null}

                      <button
                        type="button"
                        disabled={busyId === row.id}
                        title={row.active ? "Khóa" : "Mở khóa"}
                        onClick={() => void patchAccount(row.id, { active: !row.active })}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 active:scale-95 transition"
                      >
                        {row.active ? <Lock size={13} /> : <Unlock size={13} />}
                        <span>{row.active ? "Khóa" : "Mở"}</span>
                      </button>

                      <button
                        type="button"
                        disabled={busyId === row.id}
                        title="Xóa thành viên"
                        onClick={() => void deleteAccount(row)}
                        className="inline-flex items-center justify-center h-7 w-7 rounded-lg border border-rose-200 bg-white text-rose-600 hover:bg-rose-50 active:scale-95 transition"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>

                  {/* Chi tiết mở rộng khi bấm */}
                  {open && detail ? (
                    <div className="border-t border-slate-100 p-2 bg-slate-50/60" onClick={(e) => e.stopPropagation()}>
                      <AccountDetailRow
                        detail={detail}
                        scope={scope}
                        note={note}
                        setNote={setNote}
                        busyId={busyId}
                        onClose={() => setExpandedId(null)}
                        onPatch={patchAccount}
                        onDelete={deleteAccount}
                        setReviewAccountId={setReviewAccountId}
                      />
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 3. PHÂN TRANG */}
      <div className="border-t border-slate-100 bg-slate-50/40">
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
