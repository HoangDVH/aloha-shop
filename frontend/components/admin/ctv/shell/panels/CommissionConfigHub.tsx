"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Segmented } from "antd";
import ShopCtvAffiliateAdminLegacy from "../../ShopCtvAffiliateAdminLegacy";

export function CommissionConfigHub() {
  const [tab, setTab] = useState<"pct" | "dacbiet">("pct");
  return (
    <div className="overflow-hidden rounded-xl border border-[#e4ebe3] bg-white shadow-sm">
      <div className="border-b border-[#eef2ee] bg-[#faf9f6] px-3 py-2.5">
        <div className="mb-1 text-[11px] font-bold tracking-wide text-slate-400 uppercase">
          Chương trình CTV · cấu hình
        </div>
        <Segmented
          block
          value={tab}
          onChange={(v) => setTab(v as "pct" | "dacbiet")}
          options={[
            { label: "Đặt % hoa hồng", value: "pct" },
            { label: "CTV đặc biệt", value: "dacbiet" },
          ]}
        />
      </div>
      <div className="p-4">
        <p className="mb-3 mt-0 text-[13px] text-slate-500">
          Cấu hình hoa hồng toàn shop (Shop-wide Default Rate) & cho từng sản phẩm theo chuẩn sàn TMĐT (Shopee / TikTok Shop).
          Đối soát tiền và chốt kỳ xem tại{" "}
          <Link href="/admin/ctv/hoa-hong" className="font-semibold text-[#2D5A27] hover:underline">
            Hoa hồng
          </Link>
          .
        </p>
        <ShopCtvAffiliateAdminLegacy
          forcedTab={tab === "pct" ? "dat-phan-tram" : "ctv-dac-biet"}
          hideChrome
        />
      </div>
    </div>
  );
}
