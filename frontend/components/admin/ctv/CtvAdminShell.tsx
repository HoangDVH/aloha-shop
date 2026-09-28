"use client";

/**
 * Hub CTV — UI sát mockup sage/Antd, chỉ số liệu thật từ API.
 */
import { usePathname } from "next/navigation";
import React, { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import ShopCtvAffiliateAdminLegacy from "./ShopCtvAffiliateAdminLegacy";
import ShopAccountsAdmin from "./ShopAccountsAdmin";
import CtvDetailPanel from "./CtvDetailPanel";
import { useCtvUiStore } from "./ctvUiStore";
import {
  AdminDateRangePicker,
  defaultThisMonthRange,
} from "@/components/admin/ui/AdminDateRangePicker";
import {
  TITLE,
  SUBTITLE,
  subFromPath,
  detailCodeFromPath,
} from "./shell/routing";
import { OverviewPanel } from "./shell/panels/OverviewPanel";
import { OrdersPanel } from "./shell/panels/OrdersPanel";
import { CommissionsHub } from "./shell/panels/CommissionsHub";
import { CommissionConfigHub } from "./shell/panels/CommissionConfigHub";
import { FraudPanel } from "./shell/panels/FraudPanel";

export default function CtvAdminShell() {
  const pathname = usePathname() || "/admin/ctv";
  const activeSub = subFromPath(pathname);
  const detailCode = detailCodeFromPath(pathname);
  const { periodKey, dateRange, setDateRange, setActiveSub } =
    useCtvUiStore();
  const [legacyTick, setLegacyTick] = useState(0);

  useEffect(() => {
    setActiveSub(activeSub);
  }, [activeSub, setActiveSub]);

  return (
    <div className="ctv-admin-shell flex min-h-[70vh] flex-col gap-5">
      {!detailCode ? (
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <h1 className="m-0 text-[22px] font-extrabold tracking-tight text-[#1a2e1a] sm:text-[24px]">
              {TITLE[activeSub]}
            </h1>
            <p className="mt-1 mb-0 text-[13px] text-slate-500">
              {SUBTITLE[activeSub]}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {activeSub === "overview" || activeSub === "commissions" ? (
              <AdminDateRangePicker
                value={dateRange || defaultThisMonthRange()}
                onChange={(r) => {
                  if (r) setDateRange(r);
                }}
              />
            ) : null}
            {activeSub !== "list" && activeSub !== "customers" ? (
              <button
                type="button"
                onClick={() => setLegacyTick((n) => n + 1)}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#dce6da] bg-white px-3 text-[13px] font-semibold text-slate-700 shadow-sm transition hover:bg-[#f5f8f4]"
              >
                <RefreshCw size={14} />
                Làm mới
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      {detailCode ? (
        <CtvDetailPanel
          key={`detail-${detailCode}-${legacyTick}`}
          ctvCode={detailCode}
          period={periodKey}
          dateRange={dateRange}
        />
      ) : null}
      {!detailCode && activeSub === "overview" ? (
        <OverviewPanel
          key={`ov-${dateRange?.from}-${dateRange?.to}-${legacyTick}`}
          dateRange={dateRange || defaultThisMonthRange()}
        />
      ) : null}
      {!detailCode && activeSub === "orders" ? <OrdersPanel /> : null}
      {!detailCode && activeSub === "commissions" ? (
        <CommissionsHub
          key={`hh-${periodKey}-${dateRange?.from}-${dateRange?.to}-${legacyTick}`}
          period={periodKey}
          dateRange={dateRange || defaultThisMonthRange()}
          onExported={() => setLegacyTick((n) => n + 1)}
        />
      ) : null}
      {!detailCode && activeSub === "commissionConfig" ? (
        <CommissionConfigHub key={`cfg-${legacyTick}`} />
      ) : null}
      {!detailCode && activeSub === "list" ? (
        <ShopCtvAffiliateAdminLegacy
          key={`list-${legacyTick}`}
          forcedTab="duyet-ctv"
          hideChrome
        />
      ) : null}
      {!detailCode && activeSub === "customers" ? (
        <ShopAccountsAdmin
          key={`customers-${legacyTick}`}
          embedded
          scope="customers"
          defaultTab="customer"
        />
      ) : null}
      {!detailCode && activeSub === "fraud" ? (
        <FraudPanel key={`fraud-${legacyTick}`} />
      ) : null}
    </div>
  );
}
