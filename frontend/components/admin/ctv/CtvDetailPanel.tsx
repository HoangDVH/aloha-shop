"use client";

import Link from "next/link";
import React, { useMemo, useState } from "react";
import { Alert, Button, Empty, message } from "antd";
import {
  ArrowLeft,
  Copy,
  FileText,
  Mail,
  MousePointerClick,
  Phone,
  ShoppingCart,
  Wallet,
} from "lucide-react";
import { useCtvAffiliateDetail } from "./ctvQueries";
import { useCtvUiStore } from "./ctvUiStore";
import {
  COMMISSION_STATUS_LABEL,
  CTV_STATUS_LABEL,
  formatPeriodLabel,
  formatVnd,
  maskPhone,
} from "./shared/format";
import {
  AdminDateRangePicker,
  defaultThisMonthRange,
  formatYmdVi,
  type AdminDateRange,
} from "@/components/admin/ui/AdminDateRangePicker";
import {
  AdminRefreshingBadge,
  CtvDetailSkeleton,
} from "@/components/admin/ui/AdminSkeleton";

type TabId = "overview" | "products" | "orders" | "commissions" | "payouts";

function fmtDate(iso: string | null | undefined) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("vi-VN");
  } catch {
    return "—";
  }
}

function statusLabel(account: any) {
  if (!account?.active) return "Đã khóa";
  const st = String(account?.ctvStatus || "");
  if (st === "active") return "Hoạt động";
  return CTV_STATUS_LABEL[st] || st || "—";
}

function statusTone(account: any): "ok" | "warn" | "bad" {
  if (!account?.active || account?.ctvStatus === "khoa") return "bad";
  if (account?.ctvStatus === "active") return "ok";
  return "warn";
}

export default function CtvDetailPanel({
  ctvCode,
  period,
  dateRange,
}: {
  ctvCode: string;
  period: string;
  dateRange?: AdminDateRange;
}) {
  const { setDateRange } = useCtvUiStore();
  const range = dateRange || defaultThisMonthRange();
  const [tab, setTab] = useState<TabId>("overview");
  const { data, isLoading, isError, error, refetch, isFetching } =
    useCtvAffiliateDetail(ctvCode, { from: range.from, to: range.to });

  const account = data?.account;
  const metrics = data?.metrics;
  const products = data?.products || [];
  const recent = data?.recentHistory || [];

  const tabs = useMemo(
    () =>
      [
        { id: "overview" as const, label: "Tổng quan" },
        { id: "products" as const, label: "Sản phẩm đang quảng bá" },
        { id: "orders" as const, label: "Lịch sử đơn" },
        { id: "commissions" as const, label: "Lịch sử hoa hồng" },
        { id: "payouts" as const, label: "Lịch sử thanh toán" },
      ] as const,
    []
  );

  async function copyLink() {
    const url = data?.referralUrl || "";
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      message.success("Đã sao chép link giới thiệu");
    } catch {
      message.error("Không sao chép được");
    }
  }

  if (isLoading && !data) {
    return <CtvDetailSkeleton />;
  }

  if (isError || !account) {
    return (
      <Alert
        type="error"
        showIcon
        message="Không tải được chi tiết CTV"
        description={(error as Error)?.message || "Không tìm thấy"}
        action={
          <Button size="small" onClick={() => void refetch()}>
            Thử lại
          </Button>
        }
      />
    );
  }

  const tone = statusTone(account);

  return (
    <div className="relative flex flex-col gap-4">
      <div className="absolute right-0 top-0 z-10">
        <AdminRefreshingBadge show={Boolean(isFetching && data)} />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="m-0 text-[22px] font-extrabold tracking-tight text-[#1a2e1a]">
            Chi tiết CTV
          </h1>
          <p className="mt-1 mb-0 text-[13px] text-slate-500">
            Hồ sơ và hiệu suất · {formatYmdVi(range.from)} – {formatYmdVi(range.to)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <AdminDateRangePicker
            value={range}
            onChange={(r) => {
              if (r) setDateRange(r);
            }}
          />
          <Link
            href="/admin/ctv/danh-sach"
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#dce6da] bg-white px-3 text-[13px] font-semibold text-slate-700 shadow-sm hover:bg-[#F9FBF9]"
          >
            <ArrowLeft size={14} />
            Quay lại
          </Link>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <div className="rounded-2xl border border-[#e4ebe3] bg-white p-4 shadow-sm">
          <div className="flex items-start gap-3">
            {account.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={account.avatarUrl}
                alt=""
                className="h-14 w-14 rounded-full object-cover"
              />
            ) : (
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#E8EFE4] text-lg font-extrabold text-[#2D5A27]">
                {String(account.fullName || "?").slice(0, 1).toUpperCase()}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="m-0 truncate text-[17px] font-extrabold text-[#1a2e1a]">
                  {account.fullName || "—"}
                </h2>
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold ${
                    tone === "ok"
                      ? "bg-emerald-50 text-emerald-700"
                      : tone === "bad"
                        ? "bg-rose-50 text-rose-700"
                        : "bg-amber-50 text-amber-700"
                  }`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      tone === "ok"
                        ? "bg-emerald-500"
                        : tone === "bad"
                          ? "bg-rose-500"
                          : "bg-amber-500"
                    }`}
                  />
                  {statusLabel(account)}
                </span>
              </div>
              <p className="mt-1 mb-2 text-[13px] font-semibold text-slate-600">
                Mã CTV:{" "}
                <span className="font-mono text-[#2D5A27]">{account.ctvCode}</span>
              </p>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-slate-600">
                {account.phone ? (
                  <span className="inline-flex items-center gap-1.5">
                    <Phone size={13} className="text-slate-400" />
                    {maskPhone(account.phone)}
                  </span>
                ) : null}
                {account.email ? (
                  <span className="inline-flex items-center gap-1.5">
                    <Mail size={13} className="text-slate-400" />
                    {account.email}
                  </span>
                ) : null}
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-[#e4ebe3] bg-white p-4 shadow-sm">
          <p className="m-0 text-[13px] font-bold text-[#1a2e1a]">Link giới thiệu</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <div className="min-w-0 flex-1 truncate rounded-lg border border-[#e2e8e0] bg-[#F9FBF9] px-3 py-2 font-mono text-[12px] text-slate-700">
              {data?.referralUrl || "—"}
            </div>
            <button
              type="button"
              onClick={() => void copyLink()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#2D5A27]/40 px-3 py-2 text-[13px] font-bold text-[#2D5A27] hover:bg-[#F9FBF9]"
            >
              <Copy size={14} />
              Sao chép
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-1 border-b border-[#e8ebe6] pb-1">
        {tabs.map((t) => {
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`rounded-lg px-3 py-2 text-[13px] font-semibold transition ${
                active
                  ? "bg-[#E8EFE4] text-[#1a2e1a]"
                  : "text-slate-500 hover:bg-[#F4F7F4] hover:text-slate-700"
              }`}
            >
              {t.label}
            </button>
          );
        })}
        {isFetching ? (
          <span className="ml-auto self-center text-[11px] text-slate-400">Đang cập nhật…</span>
        ) : null}
      </div>

      {tab === "overview" ? (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              {
                label: "Click",
                value: metrics?.clicks ?? 0,
                icon: <MousePointerClick size={16} />,
              },
              {
                label: "Đơn hàng",
                value: metrics?.orders ?? 0,
                icon: <ShoppingCart size={16} />,
              },
              {
                label: "Doanh thu",
                value: formatVnd(Number(metrics?.revenue) || 0),
                icon: <FileText size={16} />,
              },
              {
                label: "Hoa hồng",
                value: formatVnd(Number(metrics?.commission) || 0),
                icon: <Wallet size={16} />,
                accent: true,
              },
            ].map((k) => (
              <div
                key={k.label}
                className="rounded-2xl border border-[#e4ebe3] bg-white p-4 shadow-sm"
              >
                <div className="flex items-center justify-between text-slate-400">
                  <span className="text-[12px] font-semibold text-slate-500">{k.label}</span>
                  {k.icon}
                </div>
                <p
                  className={`mt-2 mb-0 text-[20px] font-extrabold tracking-tight ${
                    k.accent ? "text-[#2D5A27]" : "text-[#1a2e1a]"
                  }`}
                >
                  {k.value}
                </p>
              </div>
            ))}
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <section className="rounded-2xl border border-[#e4ebe3] bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-center justify-between gap-2">
                <h3 className="m-0 text-[14px] font-extrabold text-[#1a2e1a]">
                  Sản phẩm đang quảng bá
                </h3>
                <button
                  type="button"
                  className="text-[12px] font-bold text-[#2D5A27] hover:underline"
                  onClick={() => setTab("products")}
                >
                  Xem tất cả →
                </button>
              </div>
              {!products.length ? (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chưa có SP trong kỳ" />
              ) : (
                <ul className="m-0 list-none space-y-0 p-0">
                  {products.slice(0, 5).map((p) => (
                    <li
                      key={p.ma}
                      className="flex items-center gap-3 border-b border-[#f0f3ef] py-2.5 last:border-0"
                    >
                      {p.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={p.imageUrl}
                          alt=""
                          className="h-10 w-10 rounded-lg object-cover"
                        />
                      ) : (
                        <div className="h-10 w-10 rounded-lg bg-[#E8EFE4]" />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="m-0 truncate text-[13px] font-semibold text-[#1a2e1a]">
                          {p.name}
                        </p>
                        <p className="m-0 text-[12px] text-slate-500">{formatVnd(p.price)}</p>
                      </div>
                      <span className="shrink-0 text-[12px] font-semibold text-slate-500">
                        Đã bán {p.orderCount} đơn
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="rounded-2xl border border-[#e4ebe3] bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-center justify-between gap-2">
                <h3 className="m-0 text-[14px] font-extrabold text-[#1a2e1a]">
                  Lịch sử gần đây
                </h3>
                <button
                  type="button"
                  className="text-[12px] font-bold text-[#2D5A27] hover:underline"
                  onClick={() => setTab("orders")}
                >
                  Xem tất cả →
                </button>
              </div>
              {!recent.length ? (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chưa có hoạt động" />
              ) : (
                <ul className="m-0 list-none space-y-0 p-0">
                  {recent.map((r) => (
                    <li
                      key={`${r.type}-${r.id}`}
                      className="flex items-center gap-3 border-b border-[#f0f3ef] py-2.5 last:border-0"
                    >
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#E8EFE4] text-[#2D5A27]">
                        {r.type === "commission" ? (
                          <Wallet size={15} />
                        ) : (
                          <ShoppingCart size={15} />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="m-0 truncate text-[13px] font-semibold text-[#1a2e1a]">
                          {r.label}
                        </p>
                        <div className="mt-0.5 flex flex-wrap items-center gap-2">
                          <span className="text-[12px] font-bold text-slate-700">
                            {formatVnd(r.amount)}
                          </span>
                          <span className="rounded-full bg-[#E8EFE4] px-2 py-0.5 text-[10px] font-bold text-[#2D5A27]">
                            {r.badge}
                          </span>
                        </div>
                      </div>
                      <span className="shrink-0 text-[12px] text-slate-400">
                        {fmtDate(r.at)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </div>
      ) : null}

      {tab === "products" ? (
        <section className="rounded-2xl border border-[#e4ebe3] bg-white p-4 shadow-sm">
          {!products.length ? (
            <Empty description="Chưa có sản phẩm gắn đơn CTV trong kỳ" />
          ) : (
            <ul className="m-0 list-none divide-y divide-[#f0f3ef] p-0">
              {products.map((p) => (
                <li key={p.ma} className="flex items-center gap-3 py-3">
                  {p.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.imageUrl} alt="" className="h-12 w-12 rounded-lg object-cover" />
                  ) : (
                    <div className="h-12 w-12 rounded-lg bg-[#E8EFE4]" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="m-0 font-semibold text-[#1a2e1a]">{p.name}</p>
                    <p className="m-0 text-[12px] text-slate-500">
                      {p.ma} · {formatVnd(p.price)}
                    </p>
                  </div>
                  <div className="text-right text-[12px] font-semibold text-slate-600">
                    <div>{p.orderCount} đơn</div>
                    <div className="text-slate-400">{p.qty} SP</div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      {tab === "orders" ? (
        <section className="overflow-hidden rounded-2xl border border-[#e4ebe3] bg-white shadow-sm">
          {!data?.orders?.length ? (
            <div className="p-8">
              <Empty description="Chưa có đơn trong kỳ" />
            </div>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="bg-[#F9FBF9] text-[11px] font-bold uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Mã đơn</th>
                  <th className="px-3 py-3">Trạng thái</th>
                  <th className="px-3 py-3">Ngày</th>
                  <th className="px-3 py-3 text-right">Giá trị</th>
                </tr>
              </thead>
              <tbody>
                {data.orders.map((o) => (
                  <tr key={o.code} className="border-t border-[#f0f3ef]">
                    <td className="px-4 py-3 font-semibold text-[#1a2e1a]">
                      #{o.displayCode || o.code}
                    </td>
                    <td className="px-3 py-3 text-slate-600">{o.orderStatus || "—"}</td>
                    <td className="px-3 py-3 text-slate-500">{fmtDate(o.createdAt)}</td>
                    <td className="px-3 py-3 text-right font-bold text-[#1a2e1a]">
                      {formatVnd(o.total)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      ) : null}

      {tab === "commissions" ? (
        <section className="overflow-hidden rounded-2xl border border-[#e4ebe3] bg-white shadow-sm">
          {!data?.commissions?.length ? (
            <div className="p-8">
              <Empty description="Chưa có hoa hồng trong kỳ" />
            </div>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="bg-[#F9FBF9] text-[11px] font-bold uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Sản phẩm / đơn</th>
                  <th className="px-3 py-3">Trạng thái</th>
                  <th className="px-3 py-3">Ngày</th>
                  <th className="px-3 py-3 text-right">Hoa hồng</th>
                </tr>
              </thead>
              <tbody>
                {data.commissions.map((c) => (
                  <tr key={c.id} className="border-t border-[#f0f3ef]">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-[#1a2e1a]">{c.productName}</div>
                      <div className="text-[12px] text-slate-400">
                        {c.displayOrderCode || c.orderCode
                          ? `#${c.displayOrderCode || c.orderCode}`
                          : c.ma}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-slate-600">
                      {COMMISSION_STATUS_LABEL[c.status] || c.status}
                    </td>
                    <td className="px-3 py-3 text-slate-500">{fmtDate(c.createdAt)}</td>
                    <td className="px-3 py-3 text-right font-bold text-[#2D5A27]">
                      {formatVnd(c.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      ) : null}

      {tab === "payouts" ? (
        <section className="overflow-hidden rounded-2xl border border-[#e4ebe3] bg-white shadow-sm">
          {!data?.payouts?.length ? (
            <div className="p-8">
              <Empty description="Chưa có kỳ thanh toán gắn CTV này" />
            </div>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="bg-[#F9FBF9] text-[11px] font-bold uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Kỳ</th>
                  <th className="px-3 py-3">Trạng thái</th>
                  <th className="px-3 py-3">Đơn</th>
                  <th className="px-3 py-3 text-right">Số tiền</th>
                </tr>
              </thead>
              <tbody>
                {data.payouts.map((p) => (
                  <tr key={p.period} className="border-t border-[#f0f3ef]">
                    <td className="px-4 py-3 font-semibold text-[#1a2e1a]">
                      {formatPeriodLabel(p.period)} ({p.period})
                    </td>
                    <td className="px-3 py-3 text-slate-600">{p.status}</td>
                    <td className="px-3 py-3 text-slate-500">{p.orderCount}</td>
                    <td className="px-3 py-3 text-right font-bold text-[#2D5A27]">
                      {formatVnd(p.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      ) : null}
    </div>
  );
}
