import type { Express, Request, Response } from "express";
import { applyShopCors } from "../shopCors.js";
import { requireShopAuth, type GetShopDb, type ShopAuthRequest } from "../shopAuth/routes.js";
import type { GetMainDb } from "../shopOrders/routes.js";
import {
  listGhnDistricts,
  listGhnProvinces,
  listGhnWards,
} from "./locationCache.js";
import { getShippingQuote } from "./quoteService.js";
import type { ShippingCarrier } from "./quoteToken.js";
import { shopRateLimitOrReject } from "../shopRateLimit.js";

function parseQuoteItems(raw: unknown) {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((it: any) => ({
      productCode: String(it?.productCode || it?.ma || "").trim(),
      productName: String(it?.productName || it?.ten || it?.name || "").trim(),
      trongLuong: Math.max(0, Number(it?.trongLuong ?? it?.weightGram ?? 0) || 0),
      quantity: Math.max(1, Math.floor(Number(it?.quantity ?? it?.qty ?? 1) || 1)),
      price: Math.max(0, Number(it?.price ?? it?.gia ?? 0) || 0),
    }))
    .filter((it) => it.productCode);
}

function locCors(req: Request, res: Response, next: () => void) {
  applyShopCors(req, res);
  next();
}

export function registerShopShippingRoutes(
  app: Express,
  _getShopDb: GetShopDb,
  getMainDb: GetMainDb
) {
  const locOpts = ["/api/shop/shipping/locations/provinces", "/api/shop/shipping/locations/districts", "/api/shop/shipping/locations/wards"];
  for (const p of locOpts) {
    app.options(p, (req, res) => {
      applyShopCors(req, res);
      res.sendStatus(204);
    });
  }

  app.get("/api/shop/shipping/locations/provinces", locCors, async (_req, res) => {
    try {
      const items = await listGhnProvinces();
      return res.json({
        ok: true,
        source: "ghn",
        items: items.map((p) => ({ id: p.ProvinceID, name: p.ProvinceName })),
      });
    } catch (e: any) {
      return res.status(503).json({ ok: false, error: e?.message || "Chưa cấu hình GHN_TOKEN", items: [] });
    }
  });

  app.get("/api/shop/shipping/locations/districts", locCors, async (req, res) => {
    try {
      const provinceId = Number(req.query.provinceId || 0);
      if (!provinceId) return res.status(400).json({ error: "Thiếu provinceId" });
      const items = await listGhnDistricts(provinceId);
      return res.json({
        ok: true,
        items: items.map((d) => ({ id: d.DistrictID, provinceId: d.ProvinceID, name: d.DistrictName })),
      });
    } catch (e: any) {
      return res.status(503).json({ error: e?.message || "Lỗi tải quận/huyện" });
    }
  });

  app.get("/api/shop/shipping/locations/wards", locCors, async (req, res) => {
    try {
      const districtId = Number(req.query.districtId || 0);
      if (!districtId) return res.status(400).json({ error: "Thiếu districtId" });
      const items = await listGhnWards(districtId);
      return res.json({
        ok: true,
        items: items.map((w) => ({ code: w.WardCode, districtId: w.DistrictID, name: w.WardName })),
      });
    } catch (e: any) {
      return res.status(503).json({ error: e?.message || "Lỗi tải phường/xã" });
    }
  });

  app.options("/api/shop/shipping/quote", (req, res) => {
    applyShopCors(req, res);
    res.sendStatus(204);
  });

  app.post(
    "/api/shop/shipping/quote",
    (req, res, next) => {
      applyShopCors(req, res);
      next();
    },
    requireShopAuth(_getShopDb),
    async (req: ShopAuthRequest, res) => {
      try {
        if (!shopRateLimitOrReject(req, res, "shop_ship_quote", 40, 60_000)) {
          return;
        }
        const body = req.body || {};
        const items = parseQuoteItems(body.items || body.orderDetails);
        const province = String(body.province || "").trim();
        const district = String(body.district || "").trim();
        const ward = String(body.ward || "").trim();
        const ghnDistrictId = Number(body.ghnDistrictId || 0) || undefined;
        const ghnWardCode = String(body.ghnWardCode || "").trim() || undefined;
        const deliveryMethod = body.deliveryMethod === "nhan_cua_hang" ? "nhan_cua_hang" : "giao_tan_noi";

        if (deliveryMethod === "nhan_cua_hang") {
          const subtotal = items.reduce((n, i) => n + i.price * i.quantity, 0);
          return res.json({
            ok: true,
            subtotal,
            totalWeightGram: 0,
            quotes: [],
            cheapest: null,
            selected: null,
            quoteToken: "",
            shippingFee: 0,
          });
        }

        if (!items.length) {
          return res.status(400).json({ error: "Thiếu sản phẩm để báo giá ship" });
        }
        if (!province || !ward) {
          return res.status(400).json({ error: "Chọn đủ tỉnh, quận/huyện và phường/xã" });
        }

        const preferred =
          body.carrier === "ghtk" || body.carrier === "ghn" || body.carrier === "spx"
            ? (body.carrier as ShippingCarrier)
            : undefined;
        const db = await getMainDb();
        const quote = await getShippingQuote(db, {
          items,
          province,
          district,
          ward,
          ghnDistrictId,
          ghnWardCode,
          preferredCarrier: preferred,
        });
        return res.json(quote);
      } catch (e: any) {
        return res.status(500).json({ error: e?.message || "Báo giá ship thất bại" });
      }
    }
  );
}
