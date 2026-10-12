export const VISIT_IDLE_MS = 30 * 60_000;
export const VISIT_STORAGE_KEY = "aloha:visit:v1";
export const VISIT_SEND_MS = 60_000;
export type VisitSession = { visitorId: string; sessionId: string; lastActivity: number; lastSent: number };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function makeVisitId(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  // getRandomValues also works on HTTP LAN origins used by local shop previews.
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 15) | 64;
  bytes[8] = (bytes[8] & 63) | 128;
  const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function readVisitSession(raw: string | null): VisitSession | null {
  try {
    const data = JSON.parse(raw || "null");
    return data && uuid.test(data.visitorId) && uuid.test(data.sessionId)
      && Number.isFinite(data.lastActivity) && Number.isFinite(data.lastSent) ? data : null;
  } catch { return null; }
}

export function nextVisitSession(previous: VisitSession | null, now: number, makeId: () => string): VisitSession {
  if (!previous) return { visitorId: makeId(), sessionId: makeId(), lastActivity: now, lastSent: 0 };
  if (now - previous.lastActivity >= VISIT_IDLE_MS || previous.lastActivity > now) {
    return { visitorId: previous.visitorId, sessionId: makeId(), lastActivity: now, lastSent: 0 };
  }
  return { ...previous, lastActivity: now };
}

export const isVisitPage = (path: string) => !/^\/(admin|api|_next)(\/|$)/i.test(path);
