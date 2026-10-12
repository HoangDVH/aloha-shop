import { randomUUID } from "node:crypto";
import type { Db } from "mongodb";
import { hostname } from "node:os";

/** Fail closed on process death: an abandoned financial lock is never stolen. */
export async function withCommissionFinanceLock<T>(db: Db, work: () => Promise<T>): Promise<T> {
  const collection = db.collection("aloha_shop_finance_locks");
  const owner = randomUUID(), start = Date.now();
  while (true) {
    try {
      await collection.insertOne({ _id: "ctv_settlement" as any, owner, pid: process.pid, host: hostname(), acquiredAt: new Date() });
      break;
    } catch (error: any) {
      if (error?.code !== 11000) throw error;
      if (Date.now() - start > 8000) throw new Error("finance_busy");
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  try { return await work(); }
  finally { await collection.deleteOne({ _id: "ctv_settlement" as any, owner }); }
}
