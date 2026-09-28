import React from "react";
import { Eye, X } from "lucide-react";
import { maskPhone } from "../shared/format";
import { Chip, ctvStatusChip } from "./AccountChips";
import { fmtDate, type AccountsScope, type ShopAccount } from "./accountsApi";

export function AccountDetailRow({
  detail,
  scope,
  note,
  setNote,
  busyId,
  onClose,
  onPatch,
  onDelete,
  setReviewAccountId,
}: {
  detail: ShopAccount;
  scope: AccountsScope;
  note: string;
  setNote: (s: string) => void;
  busyId: string | null;
  onClose: () => void;
  onPatch: (id: string, body: Record<string, unknown>) => void;
  onDelete: (row: ShopAccount) => void;
  setReviewAccountId: (id: string) => void;
}) {
  return (
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
          onClick={onClose}
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
                {detail.ctvStatus === "cho_duyet" ? (
                  <button
                    type="button"
                    disabled={busyId === detail.id}
                    onClick={() => setReviewAccountId(detail.id)}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-bold text-white"
                  >
                    <Eye size={14} />
                    Xem hồ sơ / Duyệt
                  </button>
                ) : null}
                <button
                  type="button"
                  disabled={busyId === detail.id}
                  onClick={() =>
                    void onPatch(detail.id, {
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
                void onPatch(detail.id, { adminNote: note })
              }
              className="rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-bold text-white"
            >
              Lưu ghi chú
            </button>
            <button
              type="button"
              disabled={busyId === detail.id}
              onClick={() =>
                void onPatch(detail.id, {
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
              onClick={() => void onDelete(detail)}
              className="rounded-lg border border-rose-300 px-3 py-1.5 text-xs font-bold text-rose-700 hover:bg-rose-50"
            >
              Xóa thành viên
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
