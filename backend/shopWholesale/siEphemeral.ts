/**
 * SI onboarding ephemeral store — Redis (TTL) như chuẩn production;
 * local không REDIS_URL → memory cùng TTL.
 */
import { redisDel, redisGet, redisReady, redisSet } from "../redis.js";

const mem = new Map<string, { value: string; expiresAt: number }>();

function memGet(key: string): string | null {
  const cur = mem.get(key);
  if (!cur) return null;
  if (cur.expiresAt <= Date.now()) {
    mem.delete(key);
    return null;
  }
  return cur.value;
}

function memSet(key: string, value: string, ttlSec: number): void {
  mem.set(key, { value, expiresAt: Date.now() + Math.max(1, ttlSec) * 1000 });
}

function memDel(key: string): void {
  mem.delete(key);
}

async function storeSet(key: string, value: unknown, ttlSec: number): Promise<void> {
  const str = JSON.stringify(value);
  const ttl = Math.max(5, Math.floor(ttlSec));
  if (await redisReady()) {
    const ok = await redisSet(key, str, ttl);
    if (ok) {
      memDel(key);
      return;
    }
  }
  memSet(key, str, ttl);
}

async function storeGet<T>(key: string): Promise<T | null> {
  let str: string | null = null;
  if (await redisReady()) {
    str = await redisGet(key);
  } else {
    str = memGet(key);
  }
  if (!str) return null;
  try {
    return JSON.parse(str) as T;
  } catch {
    return null;
  }
}

async function storeDel(key: string): Promise<void> {
  memDel(key);
  await redisDel(key);
}

export type SiOauthSession = {
  kind: "oauth";
  stateHash: string;
  verifier: string;
  accountId: string | null;
};

export type SiIdentitySession = {
  kind: "identity";
  zaloId: string;
  accountId: string | null;
  tokenHash: string;
};

export type SiLookupRecord = {
  lookupId: string;
  owner: string;
  address: string;
  phone: string;
  result: string;
  candidate: unknown;
  retailer: string | null;
};

const oauthKey = (tokenHash: string) => `aloha:si:oauth:${tokenHash}`;
const identityKey = (tokenHash: string) => `aloha:si:identity:${tokenHash}`;
const lookupKey = (lookupId: string) => `aloha:si:lookup:${lookupId}`;

const OAUTH_TTL_SEC = 10 * 60;
const IDENTITY_TTL_SEC = 30 * 60;
const LOOKUP_TTL_SEC = 30 * 60;

export async function putSiOauthSession(
  tokenHash: string,
  data: Omit<SiOauthSession, "kind">
): Promise<void> {
  await storeSet(oauthKey(tokenHash), { kind: "oauth", ...data }, OAUTH_TTL_SEC);
}

/** One-time consume (giống findOneAndDelete). */
export async function takeSiOauthSession(
  tokenHash: string,
  stateHash: string
): Promise<SiOauthSession | null> {
  const key = oauthKey(tokenHash);
  const session = await storeGet<SiOauthSession>(key);
  if (!session || session.kind !== "oauth" || session.stateHash !== stateHash) return null;
  await storeDel(key);
  return session;
}

export async function putSiIdentitySession(
  tokenHash: string,
  data: Omit<SiIdentitySession, "kind" | "tokenHash">
): Promise<void> {
  await storeSet(
    identityKey(tokenHash),
    { kind: "identity", tokenHash, ...data },
    IDENTITY_TTL_SEC
  );
}

export async function getSiIdentitySession(
  tokenHash: string
): Promise<SiIdentitySession | null> {
  const session = await storeGet<SiIdentitySession>(identityKey(tokenHash));
  if (!session || session.kind !== "identity") return null;
  return session;
}

export async function putSiLookup(data: SiLookupRecord): Promise<void> {
  await storeSet(lookupKey(data.lookupId), data, LOOKUP_TTL_SEC);
}

export async function getSiLookup(lookupId: string): Promise<SiLookupRecord | null> {
  return storeGet<SiLookupRecord>(lookupKey(lookupId));
}
