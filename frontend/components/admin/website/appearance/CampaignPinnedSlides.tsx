"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Pin } from "lucide-react";
import { campaignAdminApi } from "@/lib/campaign/campaignAdminApi";

type Pinned = { campaignId: string; campaignName: string; bannerId: string; imageUrl: string; href?: string };

/** Banner chính của chiến dịch đang chạy (đã bật, không tạm dừng), theo đúng thứ tự khách thấy. */
async function loadPinned(): Promise<Pinned[]> {
  const { items } = await campaignAdminApi.list();
  const live = items.filter((c) => c.status === "published" && c.statusView.running);
  const docs = await Promise.all(live.map((c) => campaignAdminApi.get(c.id)));
  return docs.flatMap(({ item }) =>
    (item.published?.display.banners || [])
      .filter((b) => b.kind === "main" && b.imageUrl)
      .map((b) => ({ campaignId: item._id, campaignName: item.published!.info.name, bannerId: b.id, imageUrl: b.imageUrl, href: b.href }))
  );
}

/** Dòng ghim đầu danh sách slide: chỉ xem, sửa trong chiến dịch. Không có quyền xem chiến dịch thì ẩn. */
export function CampaignPinnedSlides() {
  const [rows, setRows] = useState<Pinned[]>([]);
  useEffect(() => {
    let alive = true;
    loadPinned()
      .then((r) => alive && setRows(r))
      .catch(() => alive && setRows([]));
    return () => {
      alive = false;
    };
  }, []);
  if (!rows.length) return null;

  return (
    <div className="space-y-2">
      {rows.map((r, i) => (
        <div key={`${r.campaignId}-${r.bannerId}`} className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50/60 p-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={r.imageUrl} alt="" className="h-12 w-32 shrink-0 rounded-md object-cover ring-1 ring-black/5" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1 text-[12px] font-semibold text-emerald-800">
              <Pin className="h-3 w-3" /> Slide {i + 1} · ghim bởi chiến dịch
            </div>
            <div className="truncate text-[12px] text-gray-700">{r.campaignName}</div>
            <div className="text-[11px] text-gray-500">Chỉ xem — hết chiến dịch hoặc tạm dừng sẽ tự gỡ.</div>
          </div>
          <Link
            href={`/admin/uu-dai?campaign=${encodeURIComponent(r.campaignId)}&step=display`}
            className="shrink-0 rounded-md border border-emerald-300 bg-white px-2 py-1 text-[11px] font-semibold text-emerald-800 hover:bg-emerald-100"
          >
            Sửa trong chiến dịch
          </Link>
        </div>
      ))}
      <p className="text-[11px] text-gray-500">Các slide bên dưới hiện sau banner chiến dịch.</p>
    </div>
  );
}
