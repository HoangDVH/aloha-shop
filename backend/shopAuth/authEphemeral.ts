/**
 * Auth ephemeral — OAuth Google state + password reset/invite tokens.
 * Redis TTL (chuẩn production); local không REDIS_URL → memory.
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

const OAUTH_TTL_SEC = 10 * 60;
const PASSWORD_TTL_SEC = 30 * 60;

export type GoogleOauthState = {
  next: string;
  returnOrigin: string;
};

export type PasswordTokenRecord = {
  accountId: string;
  kind: string;
};

const oauthKey = (state: string) => `aloha:oauth:google:${state}`;
const pwdTokenKey = (hash: string) => `aloha:pwd:token:${hash}`;
const pwdAcctKey = (accountId: string) => `aloha:pwd:acct:${accountId}`;

export async function putGoogleOauthState(
  state: string,
  data: GoogleOauthState
): Promise<void> {
  await storeSet(oauthKey(state), data, OAUTH_TTL_SEC);
}

/** One-time consume. */
export async function takeGoogleOauthState(
  state: string
): Promise<GoogleOauthState | null> {
  const key = oauthKey(state);
  const data = await storeGet<GoogleOauthState>(key);
  if (!data) return null;
  await storeDel(key);
  return data;
}

export async function putPasswordToken(
  hash: string,
  data: PasswordTokenRecord
): Promise<void> {
  await storeSet(pwdTokenKey(hash), data, PASSWORD_TTL_SEC);
  const acctKey = pwdAcctKey(data.accountId);
  const list = (await storeGet<string[]>(acctKey)) || [];
  if (!list.includes(hash)) list.push(hash);
  await storeSet(acctKey, list, PASSWORD_TTL_SEC);
}

export async function getPasswordToken(
  hash: string
): Promise<PasswordTokenRecord | null> {
  return storeGet<PasswordTokenRecord>(pwdTokenKey(hash));
}

export async function takePasswordToken(
  hash: string
): Promise<PasswordTokenRecord | null> {
  const key = pwdTokenKey(hash);
  const data = await storeGet<PasswordTokenRecord>(key);
  if (!data) return null;
  await storeDel(key);
  const acctKey = pwdAcctKey(data.accountId);
  const list = ((await storeGet<string[]>(acctKey)) || []).filter((h) => h !== hash);
  if (list.length) await storeSet(acctKey, list, PASSWORD_TTL_SEC);
  else await storeDel(acctKey);
  return data;
}

/** Vô hiệu mọi token reset/invite còn lại của account. */
export async function clearPasswordTokensForAccount(accountId: string): Promise<void> {
  const acctKey = pwdAcctKey(accountId);
  const list = (await storeGet<string[]>(acctKey)) || [];
  for (const h of list) await storeDel(pwdTokenKey(h));
  await storeDel(acctKey);
}
