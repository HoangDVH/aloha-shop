import { randomUUID } from "node:crypto";
import type { Db } from "mongodb";
import { SHOP_COMMISSIONS, SHOP_COMMISSION_BILLS, getCtvSettings } from "./commissionModels.js";
import { SHOP_ACCOUNTS, normalizeCtvCode } from "../shopAuth/models.js";
import { withCommissionFinanceLock } from "./commissionFinanceGuard.js";
import { syncBus } from "../syncBus.js";

const money = (value: unknown) => Math.round(Number(value) || 0);
const LEDGER = "aloha_shop_ctv_ledger";
const ids = (rows: any[]) => rows.map(row => row._id);

async function finishPayment(db: Db, bill: any) {
  const op = bill.paymentPending;
  if (!op) return;
  await db.collection(SHOP_COMMISSIONS).updateMany(
    { _id: { $in: op.commissionIds }, billingPeriod: bill.period, status: "billed" },
    { $set: { status: "paid_out", paidOutAt: op.at, paidOutBy: op.by, paymentOperationId: op.id, updatedAt: op.at } },
  );
  const paidRows = await db.collection(SHOP_COMMISSIONS).countDocuments({
    _id: { $in: op.commissionIds }, billingPeriod: bill.period, status: "paid_out", paymentOperationId: op.id,
  });
  if (paidRows !== op.commissionIds.length) throw new Error("bill_payment_conflict");
  for (const line of op.lines) {
    if (line.debtOffset > 0) {
      const account = await db.collection(SHOP_ACCOUNTS).findOne({ ctvCode: line.ctvCode });
      if (!account) throw new Error("ctv_account_missing");
      // One atomic account update makes crash/retry safe across ledger/account writes.
      const applied = await db.collection(SHOP_ACCOUNTS).updateOne(
        { _id: account._id, ctvDebtSettlements: { $ne: op.id }, ctvBalanceDebt: { $gte: line.debtOffset } },
        { $inc: { ctvBalanceDebt: -line.debtOffset }, $addToSet: { ctvDebtSettlements: op.id }, $set: { updatedAt: op.at } },
      );
      if (!applied.matchedCount) {
        const current = await db.collection(SHOP_ACCOUNTS).findOne({ _id: account._id });
        if (!current?.ctvDebtSettlements?.includes(op.id)) throw new Error("ctv_debt_changed");
      }
      await db.collection(LEDGER).updateOne(
        { _id: `${op.id}:${line.ctvCode}` as any },
        { $setOnInsert: { type: "debt_offset", ctvCode: line.ctvCode, amount: line.debtOffset, period: bill.period, paymentOperationId: op.id, createdAt: op.at } },
        { upsert: true },
      );
      for (const recovery of line.debtAllocations || []) {
        await db.collection(LEDGER).updateOne({ _id: recovery.entryId }, {
          $max: { recoveredAmount: recovery.recoveredTo },
          $set: { recovered: recovery.complete, recoveredAt: op.at, updatedAt: op.at },
        });
      }
    }
  }
  const selected = new Map<string, any>(op.lines.map((line: any) => [line.ctvCode, line]));
  const next = bill.ctvLines.map((line: any) => {
    const paid = selected.get(line.ctvCode);
    return paid ? { ...line, paidAt: op.at, paidBy: op.by, paidAmount: paid.net, debtOffset: paid.debtOffset, paymentOperationId: op.id } : line;
  });
  const closed = next.every((line: any) => line.paidAt || line.voidedAt);
  await db.collection(SHOP_COMMISSION_BILLS).updateOne(
    { _id: bill._id, "paymentPending.id": op.id },
    { $set: { ctvLines: next, ...(closed ? { status: "paid", paidAt: op.at, paidBy: op.by } : {}), updatedAt: op.at }, $unset: { paymentPending: "" }, $inc: { revision: 1 } },
  );
}

async function recover(db: Db) {
  const recoveries = await db.collection(LEDGER).find({ type: "clawback", debtApplied: false }).toArray();
  for (const entry of recoveries) {
    const account = await db.collection(SHOP_ACCOUNTS).findOne({ ctvCode: entry.ctvCode });
    if (!account) throw new Error("ctv_account_missing");
    await db.collection(SHOP_ACCOUNTS).updateOne(
      { _id: account._id, ctvDebtEntries: { $ne: String(entry._id) } },
      { $inc: { ctvBalanceDebt: Math.abs(money(entry.amount)) }, $addToSet: { ctvDebtEntries: String(entry._id) } },
    );
    await db.collection(LEDGER).updateOne({ _id: entry._id }, { $set: { debtApplied: true } });
    if (entry.commissionId) await db.collection(SHOP_COMMISSIONS).updateOne({ _id: entry.commissionId },
      { $set: { clawbackAt: entry.createdAt, clawbackAmount: Math.abs(money(entry.amount)), clawbackReason: entry.reason, needsManualCommissionReview: true } });
  }
  const pending = await db.collection(SHOP_COMMISSION_BILLS).find({ paymentPending: { $exists: true } }).toArray();
  for (const bill of pending) await finishPayment(db, bill);
  const locking = await db.collection(SHOP_COMMISSION_BILLS).find({ status: "locking" }).toArray();
  for (const bill of locking) {
    await db.collection(SHOP_COMMISSIONS).updateMany(
      { _id: { $in: bill.commissionIds || [] }, status: "eligible", billingPeriod: { $in: [null, ""] } },
      { $set: { status: "billed", billId: bill.id, billingPeriod: bill.period, billedAt: bill.lockedAt, updatedAt: bill.lockedAt } },
    );
    await db.collection(SHOP_COMMISSION_BILLS).updateOne({ _id: bill._id, status: "locking" }, { $set: { status: "locked" } });
  }
}

async function reconcileAll(db: Db) {
  let changed = false;
  const returnedPeriods = await db.collection(LEDGER).distinct("period", { type: "clawback" });
  const bills = await db.collection(SHOP_COMMISSION_BILLS).find({ $or: [
    { status: { $in: ["locked", "cancelled"] } }, { status: "paid", period: { $in: returnedPeriods } },
  ] }).sort({ lockedAt: 1, period: 1 }).toArray();
  const reservedDebt = new Map<string, number>();
  for (const bill of bills) {
    const [rows, accounts, returns] = await Promise.all([
      db.collection(SHOP_COMMISSIONS).find({ billingPeriod: bill.period }).toArray(),
      db.collection(SHOP_ACCOUNTS).find({ ctvCode: { $in: (bill.ctvLines || []).map((line: any) => line.ctvCode) } }).toArray(),
      db.collection(LEDGER).find({ type: "clawback", period: bill.period }).toArray(),
    ]);
    const debts = new Map(accounts.map(account => [String(account.ctvCode), Math.max(0, money(account.ctvBalanceDebt))]));
    const lines = (bill.ctvLines || []).map((line: any) => {
      // Never rewrite a payment that already happened, including in a partially paid bill.
      if (line.paidAt) return { ...line, postPaymentAdjustments: returns.filter(entry => entry.ctvCode === line.ctvCode).map(entry => ({
        id: String(entry._id), orderCode: String(entry.orderCode || ""), ma: String(entry.ma || ""), amount: money(entry.amount), reason: String(entry.reason || "return"), at: entry.createdAt,
      })) };
      const mine = rows.filter(row => row.ctvCode === line.ctvCode);
      const valid = mine.filter(row => row.status === "billed" || row.status === "paid_out");
      const effective = valid.reduce((sum, row) => sum + money(row.amount), 0);
      const gross = money(line.gross ?? line.net);
      const adjustments = effective - gross;
      const availableDebt = Math.max(0, (debts.get(line.ctvCode) || 0) - (reservedDebt.get(line.ctvCode) || 0));
      const debtOffset = Math.min(Math.max(0, effective), availableDebt);
      reservedDebt.set(line.ctvCode, (reservedDebt.get(line.ctvCode) || 0) + debtOffset);
      const entries = mine.filter(row => row.status === "cancelled").map(row => ({
        id: String(row._id), orderCode: String(row.orderCode || ""), ma: String(row.ma || ""),
        amount: -money(row.amount), reason: String(row.cancelReason || "order_void"), at: row.cancelledAt || null,
      }));
      const { voidedAt: _voided, ...base } = line;
      return { ...base, gross, adjustments, net: Math.max(0, effective - debtOffset), debtOffset,
        adjustmentEntries: entries, ...(valid.length && effective > 0 ? {} : { voidedAt: line.voidedAt || new Date().toISOString() }) };
    });
    const allClosed = lines.length > 0 && lines.every((line: any) => line.paidAt || line.voidedAt);
    const status = allClosed ? (lines.some((line: any) => line.paidAt) ? "paid" : "cancelled") : bill.status === "paid" ? "paid" : "locked";
    const totals = { ...bill.totals, commission: lines.reduce((sum: number, line: any) => sum + money(line.net), 0),
      adjustments: lines.reduce((sum: number, line: any) => sum + money(line.adjustments), 0), debtOffset: lines.reduce((sum: number, line: any) => sum + money(line.debtOffset), 0) };
    if (JSON.stringify(lines) !== JSON.stringify(bill.ctvLines) || JSON.stringify(totals) !== JSON.stringify(bill.totals) || status !== bill.status) {
      await db.collection(SHOP_COMMISSION_BILLS).updateOne({ _id: bill._id },
        { $set: { ctvLines: lines, totals, status, updatedAt: new Date().toISOString() }, $inc: { revision: 1 } });
      changed = true;
    }
  }
  return changed;
}

export async function runCommissionFinance<T>(db: Db, work: () => Promise<T>): Promise<T> {
  return withCommissionFinanceLock(db, async () => {
    await recover(db);
    const changedBefore = await reconcileAll(db);
    const result = await work();
    const changedAfter = await reconcileAll(db);
    if (changedBefore || changedAfter) syncBus.publish([SHOP_COMMISSIONS, SHOP_COMMISSION_BILLS], "ctv-settlement");
    return result;
  });
}

/** Also repairs legacy unpaid snapshots and writes left incomplete by a failed request. */
export async function reconcileCommissionBills(db: Db): Promise<void> {
  await runCommissionFinance(db, async () => undefined);
}

export async function cancelCommissionRows(db: Db, filter: Record<string, unknown>, reason: string): Promise<number> {
  return runCommissionFinance(db, async () => {
    const now = new Date().toISOString();
    const result = await db.collection(SHOP_COMMISSIONS).updateMany(
      { ...filter, status: { $in: ["held", "eligible", "flagged", "billed"] } },
      { $set: { status: "cancelled", cancelledAt: now, cancelReason: reason, updatedAt: now } },
    );
    return result.modifiedCount;
  });
}

export async function createLockedCommissionBill(db: Db, period: string, lockedBy: string, build: () => Promise<any>) {
  return runCommissionFinance(db, async () => {
    const existing = await db.collection(SHOP_COMMISSION_BILLS).findOne({ period });
    if (existing) return { ok: false, error: existing.status === "paid" ? "already_paid" : "already_locked" };
    const built = await build();
    if (!built.ok) return { ok: false, error: built.error };
    if (!built.preview.commissionIds.length) return { ok: false, error: "bill_empty" };
    const settings = await getCtvSettings(db), now = new Date().toISOString();
    const bill = { id: `BILL-${period}`, period, status: "locking", settleDay: settings.settleDay,
      lockedAt: now, lockedBy, createdAt: now, updatedAt: now, revision: 0,
      totals: built.preview.totals, ctvLines: built.preview.ctvLines, commissionIds: built.preview.commissionIds };
    await db.collection(SHOP_COMMISSION_BILLS).insertOne(bill);
    await recover(db);
    await reconcileAll(db);
    syncBus.publish([SHOP_COMMISSIONS, SHOP_COMMISSION_BILLS], "ctv-bill-lock");
    return { ok: true, bill: await db.collection(SHOP_COMMISSION_BILLS).findOne({ period }) as Record<string, unknown> };
  });
}

export type BillPaymentConfirmation = { ctvCode?: string; paidBy?: string; expectedRevision?: number; expectedAmount?: number };
export async function confirmCommissionBillPaid(db: Db, period: string, opts: BillPaymentConfirmation = {}) {
  return runCommissionFinance(db, async () => {
    const bill = await db.collection(SHOP_COMMISSION_BILLS).findOne({ period });
    if (!bill) return { ok: false, error: "bill_not_found" };
    if (bill.status !== "locked") return { ok: false, error: bill.status === "paid" ? "already_paid" : "bill_not_locked" };
    const code = opts.ctvCode ? normalizeCtvCode(opts.ctvCode) : "";
    const selected = bill.ctvLines.filter((line: any) => !line.paidAt && !line.voidedAt && (!code || line.ctvCode === code));
    if (!selected.length) return { ok: false, error: "bill_nothing_to_pay" };
    const amount = selected.reduce((sum: number, line: any) => sum + money(line.net), 0);
    if (!Number.isSafeInteger(opts.expectedRevision) || !Number.isSafeInteger(opts.expectedAmount)) return { ok: false, error: "bill_confirmation_required" };
    if (opts.expectedRevision !== money(bill.revision) || opts.expectedAmount !== amount) return { ok: false, error: "bill_changed" };
    const rows = await db.collection(SHOP_COMMISSIONS).find({ billingPeriod: period, status: "billed", ctvCode: { $in: selected.map((line: any) => line.ctvCode) } }).toArray();
    if (!rows.length) return { ok: false, error: "bill_nothing_to_pay" };
    for (const line of selected) if (line.debtOffset > 0 && !await db.collection(SHOP_ACCOUNTS).findOne({ ctvCode: line.ctvCode })) return { ok: false, error: "ctv_account_missing" };
    const paymentLines = await Promise.all(selected.map(async (line: any) => {
      let remaining = money(line.debtOffset);
      const debtAllocations: any[] = [];
      if (remaining > 0) {
        const debts = await db.collection(LEDGER).find({ type: "clawback", ctvCode: line.ctvCode, recovered: { $ne: true }, debtApplied: { $ne: false } }).sort({ createdAt: 1 }).toArray();
        for (const debt of debts) {
          if (remaining <= 0) break;
          const original = Math.abs(money(debt.amount)), prior = money(debt.recoveredAmount);
          const portion = Math.min(remaining, Math.max(0, original - prior));
          if (portion <= 0) continue;
          debtAllocations.push({ entryId: debt._id, recoveredTo: prior + portion, complete: prior + portion >= original });
          remaining -= portion;
        }
      }
      return { ctvCode: line.ctvCode, net: money(line.net), debtOffset: money(line.debtOffset), debtAllocations };
    }));
    const op = { id: randomUUID(), at: new Date().toISOString(), by: opts.paidBy || "admin", commissionIds: ids(rows), lines: paymentLines };
    const claimed = await db.collection(SHOP_COMMISSION_BILLS).updateOne(
      { _id: bill._id, status: "locked", revision: bill.revision, paymentPending: { $exists: false } },
      { $set: { paymentPending: op } },
    );
    if (!claimed.matchedCount) return { ok: false, error: "bill_changed" };
    await finishPayment(db, { ...bill, paymentPending: op });
    syncBus.publish([SHOP_COMMISSIONS, SHOP_COMMISSION_BILLS], "ctv-bill-paid");
    return { ok: true, modified: rows.length, paidAmount: amount };
  });
}
