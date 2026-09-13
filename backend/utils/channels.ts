/**
 * Kênh đăng bài — identity theo tên logic, không theo index mảng.
 * Giữ nguyên spelling hiện có (vd. FAEBOOK); chỉ trim + uppercase.
 */

export function normalizeChannelName(name: unknown): string {
  return String(name ?? '')
    .trim()
    .toUpperCase();
}

/** Giữ thứ tự lần đầu xuất hiện; bỏ trùng sau normalize. */
export function dedupeChannelNames(list: unknown): string[] {
  if (!Array.isArray(list)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of list) {
    const n =
      typeof item === 'string'
        ? normalizeChannelName(item)
        : normalizeChannelName(
            item && typeof item === 'object' ? (item as { name?: unknown }).name : ''
          );
    if (!n || seen.has(n)) continue;
    seen.add(n);
    out.push(n);
  }
  return out;
}

/** ID Mongo ổn định theo tên — không dùng ch_${index}. */
export function channelDocId(name: unknown): string {
  const n = normalizeChannelName(name);
  return n ? `ch_${n}` : '';
}

export function canonicalizeChannelsList(raw: unknown): string[] {
  return dedupeChannelNames(raw);
}

/** JSON ổn định để so sánh content (không dựa reference). */
export function canonicalizeChannelsJson(raw: unknown): string {
  if (typeof raw === 'string') {
    try {
      return JSON.stringify(canonicalizeChannelsList(JSON.parse(raw)));
    } catch {
      return JSON.stringify(canonicalizeChannelsList(raw));
    }
  }
  return JSON.stringify(canonicalizeChannelsList(raw));
}

export function isLegacyIndexChannelId(id: unknown): boolean {
  return /^ch_\d+$/.test(String(id || ''));
}
