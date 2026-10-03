"use client";

import { useEffect, useMemo, useState } from "react";
import type { ShopProduct } from "@/lib/api";
import { fetchLivePrices, type LivePriceRow } from "@/lib/livePrices";
import { liveRowToProduct } from "@/components/campaign/deals/DealsProducts";
import { useCampaignView } from "./useCampaignView";

/**
 * Danh sách SSR được tải không kèm phiên đăng nhập, nên thiếu chiến dịch chỉ tài khoản thử thấy (hoặc vừa
 * bật sau lần render). Bổ sung SP chiến dịch theo đúng người xem — cùng nguồn với trang /uu-dai —
 * xếp theo thứ tự admin, rồi tới các SP gắn nhãn tay còn lại.
 */
export function useHomeDealProducts(ssr: ShopProduct[], limit: number): ShopProduct[] {
  const { campaign } = useCampaignView();
  const campaignMas = useMemo(
    () => [...new Set((campaign?.products || []).map((p) => p.ma.toUpperCase()))].slice(0, limit),
    [campaign, limit]
  );
  const [rows, setRows] = useState<Record<string, LivePriceRow>>({});
  const ssrByMa = useMemo(() => new Map(ssr.map((p) => [p.ma.toUpperCase(), p])), [ssr]);
  const missingKey = campaignMas.filter((m) => !ssrByMa.has(m) && !rows[m]).join(",");

  useEffect(() => {
    if (!missingKey) return;
    let alive = true;
    fetchLivePrices(missingKey.split(","))
      .then((list) => {
        if (!alive) return;
        setRows((prev) => {
          const next = { ...prev };
          for (const r of list) next[String(r.ma).toUpperCase()] = r;
          return next;
        });
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [missingKey]);

  return useMemo(() => {
    const first = campaignMas
      .map((m) => {
        const r = rows[m];
        return ssrByMa.get(m) || (r && r.isActive !== false ? liveRowToProduct(r) : null);
      })
      .filter((p): p is ShopProduct => Boolean(p));
    const seen = new Set(first.map((p) => p.ma.toUpperCase()));
    // SSR không thấy chiến dịch chỉ-tài-khoản-thử → tự bù SP «bán chạy»; có chiến dịch thì chỉ giữ SP gắn nhãn tay.
    const rest = ssr.filter(
      (p) => !seen.has(p.ma.toUpperCase()) && (!campaignMas.length || p.webBadge === "uu_dai")
    );
    return placeDealPins([...first, ...rest]).slice(0, limit);
  }, [campaignMas, rows, ssr, ssrByMa, limit]);
}

/** Ghim nhãn «Ưu đãi» (webPin = vị trí tuyệt đối) — cùng quy tắc với server; còn lại giữ nguyên thứ tự. */
function placeDealPins(list: ShopProduct[]): ShopProduct[] {
  const pinned = new Map<number, ShopProduct>();
  const rest: ShopProduct[] = [];
  for (const p of list) {
    const n = p.webBadge === "uu_dai" ? Math.round(Number(p.webPin) || 0) : 0;
    if (n > 0 && !pinned.has(n)) pinned.set(n, p);
    else rest.push(p);
  }
  if (!pinned.size) return list;
  const out: ShopProduct[] = [];
  const maxPin = Math.max(...pinned.keys());
  let u = 0;
  for (let slot = 1; slot <= maxPin; slot++) {
    const hit = pinned.get(slot);
    if (hit) out.push(hit);
    else if (u < rest.length) out.push(rest[u++]);
  }
  return [...out, ...rest.slice(u)];
}
