import { MongoClient, type Db } from "mongodb";

const FORBIDDEN_DBS = ["aloha_shop_db", "aloha_thumua"];
const PREFIX = "aloha_shop_test_";

/** Chặn tuyệt đối việc test trỏ vào DB thật. */
export function assertTestDbName(name: string): void {
  if (FORBIDDEN_DBS.includes(name)) throw new Error(`[test] Từ chối chạy trên DB thật: ${name}`);
  if (!name.startsWith(PREFIX)) throw new Error(`[test] Tên DB thử phải bắt đầu bằng ${PREFIX}: ${name}`);
}

export const TEST_MONGO_SKIP = process.env.TEST_MONGO_URI
  ? false
  : "Cần TEST_MONGO_URI (Mongo thật) cho ca tích hợp / tranh chấp";

export type TestDb = { db: Db; close: () => Promise<void> };

/** Mở DB thử riêng cho từng file test; xoá sạch khi đóng. */
export async function openTestDb(suffix: string): Promise<TestDb> {
  const uri = String(process.env.TEST_MONGO_URI || "");
  if (!uri) throw new Error("TEST_MONGO_URI chưa đặt");
  const name = `${PREFIX}${suffix}_${process.pid}`;
  assertTestDbName(name);
  const client = await new MongoClient(uri, { serverSelectionTimeoutMS: 5000 }).connect();
  const db = client.db(name);
  assertTestDbName(db.databaseName);
  return {
    db,
    close: async () => {
      assertTestDbName(db.databaseName);
      await db.dropDatabase().catch(() => undefined);
      await client.close();
    },
  };
}

/** Chặn mọi request ra ngoài (KiotViet, GHN…) trong lúc test; chỉ cho localhost. */
export function blockOutboundFetch(): () => void {
  const original = globalThis.fetch;
  globalThis.fetch = (async (input: any, init?: any) => {
    const url = new URL(typeof input === "string" ? input : input?.url || String(input));
    if (["127.0.0.1", "localhost", "::1"].includes(url.hostname)) return original(input, init);
    throw new Error(`[test] Chặn request ra ngoài: ${url.hostname}`);
  }) as typeof fetch;
  return () => {
    globalThis.fetch = original;
  };
}
