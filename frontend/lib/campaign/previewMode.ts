const KEY = "aloha:campaign-preview";

/** Link xem trước: `?campaignPreview=<token>&campaignPreviewAt=<ISO>`; giữ trong phiên để chuyển trang vẫn xem trước. */
export type PreviewState = { token: string; at: number; startedAt: number };

export function readPreview(): PreviewState | null {
  if (typeof window === "undefined") return null;
  try {
    const q = new URLSearchParams(window.location.search);
    const token = q.get("campaignPreview");
    if (token) {
      const state = { token, at: Date.parse(q.get("campaignPreviewAt") || "") || Date.now(), startedAt: Date.now() };
      sessionStorage.setItem(KEY, JSON.stringify(state));
      return state;
    }
    const raw = sessionStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as PreviewState) : null;
  } catch {
    return null;
  }
}

/** Giờ giả lập chạy tiếp theo giờ thật để đếm ngược / đổi khung vẫn đúng. */
export const previewNow = (p: PreviewState) => p.at + (Date.now() - p.startedAt);

export function exitPreview(): void {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
