import React from "react";
import { Eye, Lock, Trash2, Unlock } from "lucide-react";
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
  );
}
