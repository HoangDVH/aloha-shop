import type { Express } from "express";
import type { CommissionAdminCtx, AuthRequest } from "./shared.js";
import { SHOP_COMMISSION_BILLS } from "../commissionModels.js";
import { SHOP_ACCOUNTS, normalizeCtvCode } from "../../shopAuth/models.js";
import { reconcileCommissionBills } from "../billSettlement.js";

/**
 * Bản đồ nhận diện ngân hàng -> Mã BIN Napas 247 chuẩn 6 chữ số
 */
function resolveBankBinOrCode(bankBin?: string, bankName?: string): string {
  if (bankBin && /^\d{6}$/.test(String(bankBin).trim())) {
    return String(bankBin).trim();
  }
  const raw = String(bankName || bankBin || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();

  const map: Record<string, string> = {
    vietcombank: "970436",
    vcb: "970436",
    techcombank: "970407",
    tcb: "970407",
    mbbank: "970422",
    mb: "970422",
    vietinbank: "970415",
    icb: "970415",
    bidv: "970418",
    agribank: "970405",
    vba: "970405",
    vpbank: "970432",
    vpb: "970432",
    tpbank: "970423",
    tpb: "970423",
    acb: "970416",
    sacombank: "970403",
    stb: "970403",
    hdbank: "970437",
    hdb: "970437",
    vib: "970441",
    shb: "970443",
    eximbank: "970431",
    eib: "970431",
    msb: "970426",
    ocb: "970448",
    timo: "963388",
    cake: "546034",
    seabank: "970440",
    lpbank: "970449",
    pvcombank: "970412",
    bacabank: "970409",
    abbank: "970425",
    ncb: "970419",
    baovietbank: "970438",
    saigonbank: "970400",
    coopbank: "970446",
    kienlongbank: "970452",
    namabank: "970428",
    pgbank: "970430",
    vietabank: "970427",
    gpbank: "970408",
    oceanbank: "970414",
    wooribank: "970457",
    shinhanbank: "970424",
    bvbank: "970454",
  };

  for (const [key, code] of Object.entries(map)) {
    if (raw.includes(key)) return code;
  }
  return raw.replace(/[^a-z0-9]/g, "") || "vietcombank";
}

function formatPeriodLabel(period: string): string {
  const m = /^(\d{4})-(\d{2})(?:-(K[12]))?$/.exec(period);
  if (!m) return period;
  const [, y, mo, k] = m;
  if (k === "K1") return `Tháng ${mo}/${y} · Đợt 1 (01–15)`;
  if (k === "K2") return `Tháng ${mo}/${y} · Đợt 2 (16–hết tháng)`;
  return `Tháng ${mo}/${y} (Cả tháng)`;
}

export function registerBillsExport(app: Express, ctx: CommissionAdminCtx) {
  const { getShopDb, gate, ensure } = ctx;

  /** Xuất Excel chi kỳ chuẩn doanh nghiệp lớn — có VietQR và tiêu đề tiếng Việt */
  app.get(
    "/api/shop/admin/ctv/bills/:period/export.xlsx",
    ...gate,
    async (req: AuthRequest, res) => {
      try {
        const shopDb = await getShopDb();
        await ensure(shopDb);
        await reconcileCommissionBills(shopDb);
        const period = String(req.params.period || "").trim();
        if (!/^\d{4}-\d{2}(-K[12])?$/.test(period)) {
          return res.status(400).json({ error: "invalid_period" });
        }
        const bill = await shopDb.collection(SHOP_COMMISSION_BILLS).findOne({
          period,
        });
        if (!bill) return res.status(404).json({ error: "bill_not_found" });
        const billStatus = String((bill as any).status || "");
        if (billStatus !== "locked" && billStatus !== "paid") {
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

        const cleanPeriod = period.replace(/[^0-9]/g, "");
        const periodLabel = formatPeriodLabel(period);
        const nowVn = new Date().toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });
        const exportedBy = req.auth?.username || "Admin Aloha";

        const ExcelJS = (await import("exceljs")).default;
        const wb = new ExcelJS.Workbook();
        wb.creator = "ALOHA Shop";
        wb.lastModifiedBy = exportedBy;
        wb.created = new Date();
        wb.modified = new Date();

        const thinBorder = {
          top: { style: "thin" as const, color: { argb: "FFD0D7DE" } },
          left: { style: "thin" as const, color: { argb: "FFD0D7DE" } },
          bottom: { style: "thin" as const, color: { argb: "FFD0D7DE" } },
          right: { style: "thin" as const, color: { argb: "FFD0D7DE" } },
        };

        const columnsDef = [
          { header: "STT", key: "stt", width: 6 },
          { header: "Mã CTV", key: "ctvCode", width: 16 },
          { header: "Họ và tên CTV", key: "fullName", width: 24 },
          { header: "Số điện thoại", key: "phone", width: 14 },
          { header: "Ngân hàng thụ hưởng", key: "bankName", width: 22 },
          { header: "Số tài khoản", key: "accountNumber", width: 18 },
          { header: "Tên chủ tài khoản", key: "accountName", width: 24 },
          { header: "Hoa hồng được tính", key: "gross", width: 18 },
          { header: "Cấn trừ nợ hoàn hàng", key: "debtOffset", width: 18 },
          { header: "SỐ TIỀN THỰC CHI", key: "net", width: 20 },
          { header: "Nội dung chuyển khoản", key: "transferContent", width: 26 },
          { header: "Mã QR Quét Nhanh", key: "qrFormula", width: 20 },
          { header: "Link Mở QR", key: "qrLink", width: 14 },
          { header: "Trạng thái", key: "paymentStatus", width: 15 },
          { header: "Mã giao dịch / FT", key: "bankRef", width: 18 },
          { header: "Chi tiết cấn trừ nợ", key: "adjustmentReason", width: 40 },
        ];

        // Chuẩn bị danh sách dữ liệu phong phú
        const processedRows: any[] = [];
        const missingStkRows: any[] = [];

        lines.forEach((line: any, idx: number) => {
          const code = normalizeCtvCode(String(line.ctvCode || ""));
          const acc = byCode.get(code) as any;
          const pb = acc?.payoutBank || {};
          const hasStk = Boolean(String(pb.accountNumber || "").trim());
          const net = Number(line.net) || 0;
          const gross = line.gross != null ? Number(line.gross) : net + (Number(line.debtOffset) || 0);
          const debtOffset = Number(line.debtOffset) || 0;

          const cleanCode = code.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
          const transferContent = `ALOHA HH ${cleanCode} ${cleanPeriod}`.slice(0, 25);

          let qrUrl: string | null = null;
          if (hasStk && net > 0) {
            const binOrCode = resolveBankBinOrCode(pb.bankBin, pb.bankName);
            const accNum = String(pb.accountNumber || "").trim();
            const accName = encodeURIComponent(String(pb.accountName || acc?.fullName || "").trim());
            const addInfo = encodeURIComponent(transferContent);
            qrUrl = `https://img.vietqr.io/image/${binOrCode}-${accNum}-compact2.png?amount=${net}&addInfo=${addInfo}&accountName=${accName}`;
          }

          const statusText = line.voidedAt
            ? "Đã hủy"
            : line.paidAt || billStatus === "paid"
            ? "Đã chi"
            : "Chờ chi";

          const item = {
            stt: idx + 1,
            ctvCode: code,
            fullName: String(acc?.fullName || line.ctvName || ""),
            phone: String(acc?.phone || line.phone || ""),
            bankName: String(pb.bankName || ""),
            accountNumber: String(pb.accountNumber || ""),
            accountName: String(pb.accountName || ""),
            gross,
            debtOffset,
            net,
            transferContent,
            qrUrl,
            hasStk,
            paymentStatus: statusText,
            bankRef: String(line.bankRef || ""),
            adjustmentReason: (line.adjustmentEntries || [])
              .map((e: any) => `${e.orderCode}: ${e.reason || "Thu hồi nợ"} (${Number(e.amount || 0).toLocaleString("vi-VN")} đ)`)
              .join("; "),
          };

          processedRows.push(item);
          if (net > 0 && !hasStk) {
            missingStkRows.push(item);
          }
        });

        // Hàm helper vẽ Sheet theo chuẩn tài chính chuyên nghiệp
        const buildStyledSheet = (
          wsName: string,
          dataItems: any[],
          titleSub: string
        ) => {
          const ws = wb.addWorksheet(wsName, {
            views: [{ showGridLines: true }],
          });

          // 1. Header chứng từ công ty
          ws.mergeCells("A1:P1");
          const r1 = ws.getCell("A1");
          r1.value = "CÔNG TY TNHH ALOHA THẾ GIỚI CHẬU CÂY";
          r1.font = { name: "Calibri", size: 10, bold: true, color: { argb: "FF2D5A27" } };
          r1.alignment = { vertical: "middle" };

          ws.mergeCells("A2:P2");
          const r2 = ws.getCell("A2");
          r2.value = `BẢNG KÊ QUYẾT TOÁN & CHI TRẢ HOA HỒNG CTV — ${titleSub.toUpperCase()}`;
          r2.font = { name: "Calibri", size: 14, bold: true, color: { argb: "FF1E3E1A" } };
          r2.alignment = { vertical: "middle" };

          ws.mergeCells("A3:P3");
          const r3 = ws.getCell("A3");
          const totalNetVal = dataItems.reduce((s, r) => s + (Number(r.net) || 0), 0);
          r3.value = `Kỳ đối soát: ${periodLabel} (${period})   |   Ngày xuất: ${nowVn}   |   Người lập: ${exportedBy}   |   Tổng thực chi: ${totalNetVal.toLocaleString("vi-VN")} đ (${dataItems.length} CTV)`;
          r3.font = { name: "Calibri", size: 10, italic: true, color: { argb: "FF555555" } };
          r3.alignment = { vertical: "middle" };

          ws.addRow([]); // Dòng 4 trống
          ws.getRow(1).height = 18;
          ws.getRow(2).height = 26;
          ws.getRow(3).height = 18;
          ws.getRow(4).height = 8;

          // 2. Dòng Tiêu đề cột (Bắt đầu từ Dòng 5)
          const headerRowIdx = 5;
          const headerRow = ws.getRow(headerRowIdx);
          headerRow.height = 28;

          columnsDef.forEach((col, cIdx) => {
            const colLetter = String.fromCharCode(65 + cIdx); // A, B, C...
            ws.getColumn(cIdx + 1).width = col.width;
            const cell = headerRow.getCell(cIdx + 1);
            cell.value = col.header;
            cell.font = { name: "Calibri", size: 10, bold: true, color: { argb: "FFFFFFFF" } };
            cell.fill = {
              type: "pattern",
              pattern: "solid",
              fgColor: { argb: "FF2D5A27" },
            };
            cell.alignment = {
              vertical: "middle",
              horizontal: "center",
              wrapText: true,
            };
            cell.border = thinBorder;
          });

          // 3. Dữ liệu các dòng
          let curRowIdx = headerRowIdx + 1;
          dataItems.forEach((item, idx) => {
            const row = ws.getRow(curRowIdx);
            row.height = item.qrUrl ? 75 : 24;

            // 1. STT
            const cStt = row.getCell(1);
            cStt.value = idx + 1;
            cStt.alignment = { vertical: "middle", horizontal: "center" };

            // 2. Mã CTV
            const cCode = row.getCell(2);
            cCode.value = item.ctvCode;
            cCode.font = { bold: true, color: { argb: "FF1E3E1A" } };
            cCode.alignment = { vertical: "middle", horizontal: "center" };

            // 3. Họ và tên
            const cName = row.getCell(3);
            cName.value = item.fullName;
            cName.alignment = { vertical: "middle", horizontal: "left" };

            // 4. Số điện thoại
            const cPhone = row.getCell(4);
            cPhone.value = item.phone || "—";
            cPhone.alignment = { vertical: "middle", horizontal: "center" };

            // 5. Ngân hàng
            const cBank = row.getCell(5);
            cBank.value = item.bankName || (item.hasStk ? "Ngân hàng" : "Chưa có STK");
            cBank.alignment = { vertical: "middle", horizontal: "left" };

            // 6. Số tài khoản (luôn định dạng text)
            const cAccNum = row.getCell(6);
            cAccNum.value = item.accountNumber || "—";
            cAccNum.font = { name: "Consolas", bold: Boolean(item.accountNumber) };
            cAccNum.alignment = { vertical: "middle", horizontal: "center" };

            // 7. Tên chủ TK
            const cAccName = row.getCell(7);
            cAccName.value = item.accountName ? String(item.accountName).toUpperCase() : "—";
            cAccName.alignment = { vertical: "middle", horizontal: "left" };

            // 8. Hoa hồng gốc
            const cGross = row.getCell(8);
            cGross.value = item.gross;
            cGross.numFmt = '#,##0 "đ"';
            cGross.alignment = { vertical: "middle", horizontal: "right" };

            // 9. Cấn trừ nợ
            const cDebt = row.getCell(9);
            cDebt.value = item.debtOffset;
            cDebt.numFmt = '#,##0 "đ"';
            if (item.debtOffset > 0) {
              cDebt.font = { color: { argb: "FFD32F2F" }, bold: true };
            }
            cDebt.alignment = { vertical: "middle", horizontal: "right" };

            // 10. SỐ TIỀN THỰC CHI (Nổi bật nhất)
            const cNet = row.getCell(10);
            cNet.value = item.net;
            cNet.numFmt = '#,##0 "đ"';
            cNet.font = { name: "Calibri", size: 11, bold: true, color: { argb: "FF144A1B" } };
            cNet.fill = {
              type: "pattern",
              pattern: "solid",
              fgColor: { argb: "FFEBF7ED" }, // Xanh nhạt mint
            };
            cNet.alignment = { vertical: "middle", horizontal: "right" };

            // 11. Nội dung chuyển khoản
            const cContent = row.getCell(11);
            cContent.value = item.transferContent;
            cContent.font = { name: "Consolas", bold: true, color: { argb: "FF0D47A1" } };
            cContent.alignment = { vertical: "middle", horizontal: "center" };

            // 12. Mã QR (Hàm =IMAGE cho Excel 365 / Online / Google Sheets)
            const cQr = row.getCell(12);
            if (item.qrUrl) {
              cQr.value = { formula: `IMAGE("${item.qrUrl}")` };
            } else {
              cQr.value = "Chưa có STK";
              cQr.font = { italic: true, color: { argb: "FF888888" }, size: 9 };
            }
            cQr.alignment = { vertical: "middle", horizontal: "center" };

            // 13. Link mở QR (Tương thích 100% mọi phiên bản Excel)
            const cLink = row.getCell(13);
            if (item.qrUrl) {
              cLink.value = { text: "Mở mã QR", hyperlink: item.qrUrl };
              cLink.font = { color: { argb: "FF0D6EFD" }, underline: true };
            } else {
              cLink.value = "—";
            }
            cLink.alignment = { vertical: "middle", horizontal: "center" };

            // 14. Trạng thái
            const cStatus = row.getCell(14);
            cStatus.value = item.paymentStatus;
            cStatus.alignment = { vertical: "middle", horizontal: "center" };
            if (item.paymentStatus === "Đã chi") {
              cStatus.font = { color: { argb: "FF0F5132" }, bold: true };
              cStatus.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD1E7DD" } };
            } else if (item.paymentStatus === "Chờ chi") {
              cStatus.font = { color: { argb: "FF664D03" }, bold: true };
              cStatus.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFF3CD" } };
            }

            // 15. Mã FT / Giao dịch
            const cRef = row.getCell(15);
            cRef.value = item.bankRef || "—";
            cRef.font = { name: "Consolas" };
            cRef.alignment = { vertical: "middle", horizontal: "center" };

            // 16. Chi tiết cấn trừ nợ
            const cReason = row.getCell(16);
            cReason.value = item.adjustmentReason || "—";
            cReason.alignment = { vertical: "middle", horizontal: "left" };

            // Kẻ viền toàn bộ ô
            for (let c = 1; c <= columnsDef.length; c++) {
              row.getCell(c).border = thinBorder;
            }

            curRowIdx++;
          });

          // 4. Dòng Tổng cộng cuối bảng (SUM)
          if (dataItems.length > 0) {
            const totalRow = ws.getRow(curRowIdx);
            totalRow.height = 24;
            totalRow.getCell(1).value = "";
            totalRow.getCell(2).value = "TỔNG CỘNG";
            totalRow.getCell(2).font = { name: "Calibri", size: 11, bold: true, color: { argb: "FF1E3E1A" } };
            totalRow.getCell(2).alignment = { vertical: "middle", horizontal: "center" };

            const grossSum = `=SUM(H${headerRowIdx + 1}:H${curRowIdx - 1})`;
            const debtSum = `=SUM(I${headerRowIdx + 1}:I${curRowIdx - 1})`;
            const netSum = `=SUM(J${headerRowIdx + 1}:J${curRowIdx - 1})`;

            const cGrossTot = totalRow.getCell(8);
            cGrossTot.value = { formula: grossSum };
            cGrossTot.numFmt = '#,##0 "đ"';
            cGrossTot.font = { bold: true };
            cGrossTot.alignment = { vertical: "middle", horizontal: "right" };

            const cDebtTot = totalRow.getCell(9);
            cDebtTot.value = { formula: debtSum };
            cDebtTot.numFmt = '#,##0 "đ"';
            cDebtTot.font = { bold: true, color: { argb: "FFD32F2F" } };
            cDebtTot.alignment = { vertical: "middle", horizontal: "right" };

            const cNetTot = totalRow.getCell(10);
            cNetTot.value = { formula: netSum };
            cNetTot.numFmt = '#,##0 "đ"';
            cNetTot.font = { bold: true, size: 12, color: { argb: "FF144A1B" } };
            cNetTot.alignment = { vertical: "middle", horizontal: "right" };

            for (let c = 1; c <= columnsDef.length; c++) {
              const cell = totalRow.getCell(c);
              cell.fill = {
                type: "pattern",
                pattern: "solid",
                fgColor: { argb: "FFEAF2E8" },
              };
              cell.border = {
                top: { style: "thin" as const, color: { argb: "FF2D5A27" } },
                bottom: { style: "double" as const, color: { argb: "FF2D5A27" } },
                left: thinBorder.left,
                right: thinBorder.right,
              };
            }
          }
        };

        // 1. Sheet chính: Danh sách chi tiền (Chứa tất cả CTV có phát sinh thực chi net > 0)
        const payableItems = processedRows.filter((r) => r.net > 0);
        buildStyledSheet("Chi Trả Hoa Hồng", payableItems, "Danh sách chi tiền");

        // 2. Sheet 2: Danh sách CTV thiếu số tài khoản (để kế toán gọi nhắc)
        buildStyledSheet("Thiếu STK Ngân Hàng", missingStkRows, "Cần bổ sung STK");

        // 3. Sheet 3: Lịch sử & Toàn bộ kỳ đối soát (đầy đủ mọi dòng để lưu trữ kế toán)
        buildStyledSheet("Lịch Sử Toàn Bộ Kỳ", processedRows, "Toàn bộ sao kê kỳ");

        // Cập nhật audit trail vào DB
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
          `attachment; filename="BangKeChiHoaHong-${period}.xlsx"`
        );
        await wb.xlsx.write(res);
        res.end();
      } catch (e: any) {
        return res.status(500).json({ error: e?.message || "export_failed" });
      }
    }
  );
}
