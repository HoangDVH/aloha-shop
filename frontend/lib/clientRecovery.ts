export function isChunkFailure(error: { name?: string; message?: string }): boolean {
  return error.name === "ChunkLoadError" || /Loading (?:CSS )?chunk [\s\S]*failed|Failed to fetch dynamically imported module|Importing a module script failed/i.test(error.message || "");
}

export function claimRecovery(storage: Pick<Storage, "getItem" | "setItem">, now = Date.now()): boolean {
  const key = "aloha_chunk_recovery_at";
  try {
    const last = Number(storage.getItem(key));
    if (last > 0 && now - last < 10 * 60_000) return false;
    storage.setItem(key, String(now));
    return true;
  } catch {
    // Without persistent protection, an automatic reload could loop.
    return false;
  }
}

export function recoverChunk(error: { name?: string; message?: string }): boolean {
  if (process.env.NODE_ENV !== "production" || !isChunkFailure(error)) return false;
  try {
    if (!claimRecovery(window.sessionStorage)) return false;
    window.location.reload();
    return true;
  } catch { return false; }
}

let reports = 0;
const seen = new Set<string>();
export function reportClientError(error: unknown, source: string) {
  try {
    const e = error instanceof Error ? error : new Error(typeof error === "string" ? error : "Unknown client error");
    const key = `${e.name}:${e.message}`;
    if (seen.has(key) || reports >= 5) return;
    seen.add(key);
    reports++;
    // Never send cookies, query parameters, form data or local storage.
    const body = JSON.stringify({ name: e.name.slice(0, 100), message: e.message.slice(0, 1000),
      stack: e.stack?.slice(0, 3000), path: window.location.pathname.slice(0, 300),
      release: process.env.NEXT_PUBLIC_RELEASE_ID || "local", source });
    void fetch("/api/shop/client-errors", { method: "POST", headers: { "Content-Type": "application/json" },
      body, credentials: "omit", keepalive: true }).catch(() => {});
  } catch { /* Error reporting must never break the page. */ }
}
