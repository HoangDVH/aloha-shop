import type { Express } from "express";
import type { CommissionAdminCtx, AuthRequest } from "./shared.js";
import { SHOP_COMMISSION_BILLS } from "../commissionModels.js";
import { SHOP_ACCOUNTS, normalizeCtvCode } from "../../shopAuth/models.js";
import { reconcileCommissionBills } from "../billSettlement.js";
import { z } from "zod";

const paymentInput = z.object({ ctvCode: z.string().min(3).max(20).optional(), expectedRevision: z.number().int().nonnegative(), expectedAmount: z.number().int().nonnegative() }).strict();
const paymentErrors: Record<string, string> = {
  bill_changed: "Số tiền hoặc phiên bản kỳ chi đã thay đổi. Tải lại, kiểm tra số tiền mới rồi xác nhận lại.",
  bill_confirmation_required: "Tải lại kỳ chi để xác nhận phiên bản và số tiền hiện tại.",
  bill_nothing_to_pay: "Không còn khoản hoa hồng cần chi trong kỳ này.",
};
import {
  buildEligiblePeriodPreview,
  lockMonthlyBill,
  markBillPaid,
} from "../commission.js";

export function registerBills(app: Express, ctx: CommissionAdminCtx) {
  const { getShopDb, gate, ensure } = ctx;

  app.get("/api/shop/admin/ctv/bills", ...gate, async (req: AuthRequest, res) => {
    try {
      const shopDb = await getShopDb();
      await ensure(shopDb);
      await reconcileCommissionBills(shopDb);
      const period = String(req.query.period || "").trim();
      if (period) {
        const bill = await shopDb.collection(SHOP_COMMISSION_BILLS).findOne({ period });
        const built = await buildEligiblePeriodPreview(shopDb, period);
        let preview =
          built.ok
            ? {
                period: built.preview.period,
                ctvLines: built.preview.ctvLines,
                totals: built.preview.totals,
              }
            : null;
        const enrichLines = async (lines: any[]) => {
          const codes = [
            ...new Set(
              lines
                .map((l) => normalizeCtvCode(String(l?.ctvCode || "")))
                .filter(Boolean)
            ),
          ];
          if (!codes.length) return lines;
          const accs = await shopDb
            .collection(SHOP_ACCOUNTS)
            .find({ ctvCode: { $in: codes } })
            .project({ ctvCode: 1, fullName: 1, displayName: 1 })
            .toArray();
          const map = new Map<string, string>();
          for (const a of accs) {
            const c = normalizeCtvCode(String((a as any).ctvCode || ""));
            const n =
              String((a as any).fullName || "").trim() ||
              String((a as any).displayName || "").trim();
            if (c && n) map.set(c, n);
          }
          return lines.map((l) => ({
            ...l,
            ctvName: map.get(normalizeCtvCode(String(l?.ctvCode || ""))) || "",
          }));
        };
        if (preview?.ctvLines) {
          preview = {
            ...preview,
            ctvLines: await enrichLines(preview.ctvLines as any[]),
          };
        }
        if (!bill) {
          return res.json({ ok: true, bill: null, preview });
        }
        const { _id, ...rest } = bill as any;
        if (Array.isArray(rest.ctvLines)) {
          rest.ctvLines = await enrichLines(rest.ctvLines);
        }
        return res.json({ ok: true, bill: rest, preview });
      }
      const rows = await shopDb
        .collection(SHOP_COMMISSION_BILLS)
        .find({})
        .sort({ period: -1 })
        .limit(24)
        .toArray();
      return res.json({
        ok: true,
        data: rows.map((r) => {
          const { _id, ...rest } = r as any;
          return rest;
        }),
      });
    } catch (e: any) {
      return res.status(500).json({ error: e?.message || "bills_failed" });
    }
  });

  app.post("/api/shop/admin/ctv/bills/lock", ...gate, async (req: AuthRequest, res) => {
    try {
      const shopDb = await getShopDb();
      await ensure(shopDb);
      const period = String(req.body?.period || "").trim();
      const result = await lockMonthlyBill(
        shopDb,
        period,
        req.auth?.username || "admin"
      );
      if (!result.ok) {
        return res.status(400).json({ ok: false, error: result.error });
      }
      return res.json({ ok: true, bill: result.bill });
    } catch (e: any) {
      return res.status(500).json({ error: e?.message || "lock_failed" });
    }
  });

  app.post("/api/shop/admin/ctv/bills/:period/mark-paid", ...gate, async (req: AuthRequest, res) => {
    try {
      const shopDb = await getShopDb();
      await ensure(shopDb);
      const period = String(req.params.period || "").trim();
      const parsed = paymentInput.safeParse(req.body);
      if (!parsed.success) return res.status(409).json({ error: "bill_confirmation_required", message: paymentErrors.bill_confirmation_required });
      const ctvCode = req.body?.ctvCode
        ? normalizeCtvCode(String(req.body.ctvCode))
        : undefined;
      const result = await markBillPaid(shopDb, period, {
        ctvCode,
        expectedRevision: parsed.data.expectedRevision,
        expectedAmount: parsed.data.expectedAmount,
        paidBy: req.auth?.username || "admin",
      });
      if (!result.ok) return res.status(result.error === "bill_changed" ? 409 : 400).json({ ...result, message: paymentErrors[result.error || ""] || result.error });
      return res.json(result);
    } catch (e: any) {
      return res.status(500).json({ error: e?.message || "mark_paid_failed" });
    }
  });
}
