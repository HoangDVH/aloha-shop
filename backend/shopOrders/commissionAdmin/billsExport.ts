import type { Express } from "express";
import type { CommissionAdminCtx, AuthRequest } from "./shared.js";
import { SHOP_COMMISSION_BILLS } from "../commissionModels.js";
import { SHOP_ACCOUNTS, normalizeCtvCode } from "../../shopAuth/models.js";

export function registerBillsExport(app: Express, ctx: CommissionAdminCtx) {
  const { getShopDb, gate, ensure } = ctx;

  /** Xuất Excel chi kỳ — sheet ChiHH + ThieuSTK */
  app.get(
    "/api/shop/admin/ctv/bills/:period/export.xlsx",
    ...gate,
    async (req: AuthRequest, res) => {
      try {
        const shopDb = await getShopDb();
        await ensure(shopDb);
        const period = String(req.params.period || "").trim();
        if (!/^\d{4}-\d{2}(-K[12])?$/.test(period)) {
          return res.status(400).json({ error: "invalid_period" });
        }
        const bill = await shopDb.collection(SHOP_COMMISSION_BILLS).findOne({
          period,
        });
        if (!bill) return res.status(404).json({ error: "bill_not_found" });
        const status = String((bill as any).status || "");
        if (status !== "locked" && status !== "paid") {
          return res.status(400).json({ error: "bill_not_locked" });
        }

        const lines = Array.isArray((bill as any).ctvLines)
          ? (bill as any).ctvLines
          : [];
        const codes = lines
          .map((l: any) => normalizeCtvCode(String(l.ctvCode || "")))
          .filter(Boolean);
        const accounts = await shopDb
          .collection(SHOP_ACCOUNTS)
          .find({ ctvCode: { $in: codes } })
          .project({
            ctvCode: 1,
            fullName: 1,
            phone: 1,
            payoutBank: 1,
            ctvBalanceDebt: 1,
          })
          .toArray();
        const byCode = new Map(
          accounts.map((a) => [normalizeCtvCode(String((a as any).ctvCode)), a])
        );

        const ExcelJS = (await import("exceljs")).default;
        const wb = new ExcelJS.Workbook();
        wb.creator = "ALOHA Shop";
        const sheet = wb.addWorksheet("ChiHH");
        sheet.columns = [
          { header: "ctvCode", key: "ctvCode", width: 16 },
          { header: "fullName", key: "fullName", width: 24 },
          { header: "phone", key: "phone", width: 14 },
          { header: "bankName", key: "bankName", width: 22 },
          { header: "bankBin", key: "bankBin", width: 12 },
          { header: "accountNumber", key: "accountNumber", width: 18 },
          { header: "accountName", key: "accountName", width: 24 },
          { header: "gross", key: "gross", width: 14 },
          { header: "adjustments", key: "adjustments", width: 14 },
          { header: "net", key: "net", width: 14 },
          { header: "orderCount", key: "orderCount", width: 12 },
          { header: "debt", key: "debt", width: 12 },
          { header: "missingStk", key: "missingStk", width: 12 },
        ];
        const missing: any[] = [];
        for (const line of lines) {
          const code = normalizeCtvCode(String(line.ctvCode || ""));
          const acc = byCode.get(code) as any;
          const pb = acc?.payoutBank || {};
          const hasStk = Boolean(String(pb.accountNumber || "").trim());
          const row = {
            ctvCode: code,
            fullName: String(acc?.fullName || ""),
            phone: String(acc?.phone || ""),
            bankName: String(pb.bankName || ""),
            bankBin: String(pb.bankBin || ""),
            accountNumber: String(pb.accountNumber || ""),
            accountName: String(pb.accountName || ""),
            gross: Number(line.gross) || 0,
            adjustments: Number(line.adjustments) || 0,
            net: Number(line.net) || 0,
            orderCount: Number(line.orderCount) || 0,
            debt: Number(acc?.ctvBalanceDebt) || 0,
            missingStk: hasStk ? "" : "1",
          };
          sheet.addRow(row);
          if (!hasStk) missing.push(row);
        }
        const missSheet = wb.addWorksheet("ThieuSTK");
        missSheet.columns = sheet.columns;
        for (const row of missing) missSheet.addRow(row);

        await shopDb.collection(SHOP_COMMISSION_BILLS).updateOne(
          { period },
          {
            $set: {
              exportedAt: new Date().toISOString(),
              exportedBy: req.auth?.username || "admin",
              updatedAt: new Date().toISOString(),
            },
          }
        );

        res.setHeader(
          "Content-Type",
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        );
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="ChiHH-${period}.xlsx"`
        );
        await wb.xlsx.write(res);
        res.end();
      } catch (e: any) {
        return res.status(500).json({ error: e?.message || "export_failed" });
      }
    }
  );
}
