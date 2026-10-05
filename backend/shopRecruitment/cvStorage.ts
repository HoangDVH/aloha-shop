import crypto from "crypto";
import fs from "fs";
import path from "path";
import { recruitmentCvDir } from "./config.js";
import { CV_FORMAT_META } from "./cvFormat.js";
import type { CvFormat } from "./types.js";

const KEY_RE = /^[a-f0-9]{48}\.(pdf|doc|docx)$/;

function resolveKey(storageKey: string): string {
  if (!KEY_RE.test(storageKey)) throw new Error("invalid_storage_key");
  const dir = recruitmentCvDir();
  const full = path.resolve(dir, storageKey);
  if (!full.startsWith(path.resolve(dir) + path.sep)) throw new Error("invalid_storage_key");
  return full;
}

export async function saveCv(buffer: Buffer, format: CvFormat): Promise<{ storageKey: string; sha256: string }> {
  const storageKey = `${crypto.randomBytes(24).toString("hex")}.${CV_FORMAT_META[format].ext}`;
  await fs.promises.writeFile(resolveKey(storageKey), buffer, { flag: "wx", mode: 0o600 });
  return { storageKey, sha256: crypto.createHash("sha256").update(buffer).digest("hex") };
}

export function cvPath(storageKey: string): string {
  return resolveKey(storageKey);
}

/** Idempotent: file không còn coi như đã xóa. */
export async function deleteCv(storageKey: string): Promise<void> {
  try {
    await fs.promises.unlink(resolveKey(storageKey));
  } catch (e) {
    if ((e as NodeJS.ErrnoException)?.code !== "ENOENT") throw e;
  }
}

/** Liệt kê file CV cũ hơn ngưỡng an toàn (phục vụ dọn file mồ côi). */
export async function listCvFilesOlderThan(ms: number): Promise<string[]> {
  const dir = recruitmentCvDir();
  const names = await fs.promises.readdir(dir).catch(() => [] as string[]);
  const cutoff = Date.now() - ms;
  const out: string[] = [];
  for (const name of names) {
    if (!KEY_RE.test(name)) continue;
    const st = await fs.promises.stat(path.join(dir, name)).catch(() => null);
    if (st && st.mtimeMs < cutoff) out.push(name);
  }
  return out;
}
