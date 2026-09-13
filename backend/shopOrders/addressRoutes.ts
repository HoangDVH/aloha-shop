import type { Express, Response } from "express";
import {
  requireShopAuth,
  type GetShopDb,
  type ShopAuthRequest,
} from "../shopAuth/routes.js";
import {
  SHOP_ACCOUNTS,
  shopAccountIdQuery,
  toPublicShopAccount,
} from "../shopAuth/models.js";
import { ensureOneDefault, newAddressId, normalizeAddresses } from "./models.js";

const SHOP_ORIGIN_ALLOW = new Set([
  "http://localhost:3002",
  "http://127.0.0.1:3002",
  "https://shop.alohathegioichaucay.com",
  "http://shop.alohathegioichaucay.com",
]);

function setCors(req: { headers: { origin?: string } }, res: Response) {
  const origin = String(req.headers.origin || "");
  if (origin && (SHOP_ORIGIN_ALLOW.has(origin) || /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin))) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Vary", "Origin");
  }
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

export function registerShopAddressRoutes(app: Express, getShopDb: GetShopDb) {
  app.options("/api/shop/auth/addresses", (req, res) => {
    setCors(req, res);
    res.sendStatus(204);
  });
  app.options("/api/shop/auth/addresses/:id", (req, res) => {
    setCors(req, res);
    res.sendStatus(204);
  });

  app.get(
    "/api/shop/auth/addresses",
    (req, res, next) => {
      setCors(req, res);
      next();
    },
    requireShopAuth(getShopDb),
    async (req: ShopAuthRequest, res) => {
      try {
        const db = await getShopDb();
        const user = await db
          .collection(SHOP_ACCOUNTS)
          .findOne(shopAccountIdQuery(req.shopAuth!.userId));
        if (!user) return res.status(401).json({ error: "Không tìm thấy tài khoản" });
        return res.json({ ok: true, addresses: normalizeAddresses(user.addresses) });
      } catch (e: any) {
        return res.status(500).json({ error: e?.message || "Lỗi" });
      }
    }
  );

  app.post(
    "/api/shop/auth/addresses",
    (req, res, next) => {
      setCors(req, res);
      next();
    },
    requireShopAuth(getShopDb),
    async (req: ShopAuthRequest, res) => {
      try {
        const db = await getShopDb();
        const user = await db
          .collection(SHOP_ACCOUNTS)
          .findOne(shopAccountIdQuery(req.shopAuth!.userId));
        if (!user) return res.status(401).json({ error: "Không tìm thấy tài khoản" });

        const fullName = String(req.body?.fullName || "").trim();
        const phone = String(req.body?.phone || "").trim();
        const province = String(req.body?.province || "").trim();
        const district = String(req.body?.district || "").trim();
        const ward = String(req.body?.ward || "").trim();
        const detail = String(req.body?.detail || "").trim();
        const ghnProvinceId = Number(req.body?.ghnProvinceId || 0) || undefined;
        const ghnDistrictId = Number(req.body?.ghnDistrictId || 0) || undefined;
        const ghnWardCode = req.body?.ghnWardCode ? String(req.body.ghnWardCode).trim() : undefined;
        const label = req.body?.label ? String(req.body.label).trim().slice(0, 40) : undefined;
        const wantDefault = Boolean(req.body?.isDefault);

        if (!fullName || !phone || !province || !ward || !detail) {
          return res.status(400).json({ error: "Điền đủ tên, SĐT, tỉnh, phường, địa chỉ" });
        }

        let addresses = normalizeAddresses(user.addresses);
        const isFirst = addresses.length === 0;
        if (wantDefault || isFirst) {
          addresses = addresses.map((a) => ({ ...a, isDefault: false }));
        }
        const addr = {
          id: newAddressId(),
          fullName,
          phone,
          province,
          district: district || undefined,
          ward,
          detail,
          ghnProvinceId,
          ghnDistrictId,
          ghnWardCode,
          label,
          isDefault: wantDefault || isFirst,
        };
        addresses = ensureOneDefault([...addresses, addr]);
        await db
          .collection(SHOP_ACCOUNTS)
          .updateOne({ _id: user._id }, { $set: { addresses, updatedAt: new Date() } });
        return res.status(201).json({
          ok: true,
          addresses,
          user: toPublicShopAccount({ ...user, addresses }),
        });
      } catch (e: any) {
        return res.status(500).json({ error: e?.message || "Lỗi" });
      }
    }
  );

  app.patch(
    "/api/shop/auth/addresses/:id",
    (req, res, next) => {
      setCors(req, res);
      next();
    },
    requireShopAuth(getShopDb),
    async (req: ShopAuthRequest, res) => {
      try {
        const db = await getShopDb();
        const user = await db
          .collection(SHOP_ACCOUNTS)
          .findOne(shopAccountIdQuery(req.shopAuth!.userId));
        if (!user) return res.status(401).json({ error: "Không tìm thấy tài khoản" });
        const id = String(req.params.id || "").trim();
        let addresses = normalizeAddresses(user.addresses);
        const idx = addresses.findIndex((a) => a.id === id);
        if (idx < 0) return res.status(404).json({ error: "Không tìm thấy địa chỉ" });

        const cur = addresses[idx];
        const patched = {
          ...cur,
          fullName:
            req.body?.fullName != null ? String(req.body.fullName).trim() : cur.fullName,
          phone: req.body?.phone != null ? String(req.body.phone).trim() : cur.phone,
          province:
            req.body?.province != null ? String(req.body.province).trim() : cur.province,
          district:
            req.body?.district != null ? String(req.body.district).trim() : cur.district,
          ward: req.body?.ward != null ? String(req.body.ward).trim() : cur.ward,
          detail: req.body?.detail != null ? String(req.body.detail).trim() : cur.detail,
          ghnProvinceId:
            req.body?.ghnProvinceId != null
              ? Number(req.body.ghnProvinceId) || undefined
              : cur.ghnProvinceId,
          ghnDistrictId:
            req.body?.ghnDistrictId != null
              ? Number(req.body.ghnDistrictId) || undefined
              : cur.ghnDistrictId,
          ghnWardCode:
            req.body?.ghnWardCode != null
              ? String(req.body.ghnWardCode).trim() || undefined
              : cur.ghnWardCode,
          label:
            req.body?.label !== undefined
              ? req.body.label
                ? String(req.body.label).trim().slice(0, 40)
                : undefined
              : cur.label,
        };
        if (req.body?.isDefault === true) {
          addresses = addresses.map((a, i) => ({
            ...(i === idx ? patched : a),
            isDefault: i === idx,
          }));
        } else {
          addresses[idx] = patched;
        }
        addresses = ensureOneDefault(addresses);
        await db
          .collection(SHOP_ACCOUNTS)
          .updateOne({ _id: user._id }, { $set: { addresses, updatedAt: new Date() } });
        return res.json({
          ok: true,
          addresses,
          user: toPublicShopAccount({ ...user, addresses }),
        });
      } catch (e: any) {
        return res.status(500).json({ error: e?.message || "Lỗi" });
      }
    }
  );

  app.delete(
    "/api/shop/auth/addresses/:id",
    (req, res, next) => {
      setCors(req, res);
      next();
    },
    requireShopAuth(getShopDb),
    async (req: ShopAuthRequest, res) => {
      try {
        const db = await getShopDb();
        const user = await db
          .collection(SHOP_ACCOUNTS)
          .findOne(shopAccountIdQuery(req.shopAuth!.userId));
        if (!user) return res.status(401).json({ error: "Không tìm thấy tài khoản" });
        const id = String(req.params.id || "").trim();
        let addresses = normalizeAddresses(user.addresses).filter((a) => a.id !== id);
        addresses = ensureOneDefault(addresses);
        await db
          .collection(SHOP_ACCOUNTS)
          .updateOne({ _id: user._id }, { $set: { addresses, updatedAt: new Date() } });
        return res.json({
          ok: true,
          addresses,
          user: toPublicShopAccount({ ...user, addresses }),
        });
      } catch (e: any) {
        return res.status(500).json({ error: e?.message || "Lỗi" });
      }
    }
  );
}
