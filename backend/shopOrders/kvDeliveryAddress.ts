import { kvApiBase, type KvCreds } from "../services/kvApiClient.js";

export type KvDeliveryAddress = { province: string; district?: string; ward: string };
type Location = { id: number; name: string };
type DeliveryRegion = { locationId?: number; locationName: string; wardName: string };
const caches = new Map<string, { expires: number; pending: Promise<Location[]> }>();
const normalize = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/gi, "d")
  .toLowerCase().replace(/^(tinh|thanh pho|tp\.?|quan|huyen|thi xa)\s+/, "").replace(/\s+/g, " ").trim();

export function kvDeliveryAddressForOrder(order: Record<string, unknown>): KvDeliveryAddress | undefined {
  if (order.deliveryMethod === "nhan_cua_hang") return undefined;
  const province = String(order.province || "").trim(), ward = String(order.ward || "").trim();
  if (!province || !ward) return undefined;
  return { province, district: String(order.district || "").trim(), ward };
}

/** Match both legacy province + district; never guess a district from its name alone. */
export function matchKvDeliveryRegion(address: KvDeliveryAddress, locations: Location[]): DeliveryRegion {
  const province = address.province.trim(), district = address.district?.trim();
  const matches = locations.filter(l => {
    const parts = l.name.split(/\s+-\s+/);
    return normalize(parts[0]) === normalize(province)
      && (district ? parts.length === 2 && normalize(parts[1]) === normalize(district) : parts.length === 1);
  });
  const found = matches.length === 1 ? matches[0] : undefined;
  return { ...(found ? { locationId: found.id } : {}), locationName: found?.name || [province, district].filter(Boolean).join(" - "), wardName: address.ward.trim() };
}

async function loadLocations(creds: KvCreds, token: string): Promise<Location[]> {
  const key = `${kvApiBase()}|${creds.retailer}`;
  const cached = caches.get(key);
  if (cached && cached.expires > Date.now()) return cached.pending;
  const pending = (async () => {
    const rows: Location[] = [];
    for (let offset = 0; offset < 10000;) {
      const res = await fetch(`${kvApiBase()}/locations?pageSize=100&currentItem=${offset}`, {
        headers: { Authorization: `Bearer ${token}`, Retailer: creds.retailer }, signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) throw new Error(`KiotViet locations HTTP ${res.status}`);
      const json = await res.json() as { data?: Location[]; total?: number };
      if (!Array.isArray(json.data)) throw new Error("Invalid KiotViet locations");
      rows.push(...json.data);
      offset += json.data.length;
      if (!json.data.length || offset >= Number(json.total || 0)) return rows;
    }
    throw new Error("KiotViet locations exceeded limit");
  })();
  caches.set(key, { expires: Date.now() + 6 * 60 * 60 * 1000, pending });
  try { return await pending; } catch (error) { caches.delete(key); throw error; }
}

export async function resolveKvDeliveryRegion(creds: KvCreds, token: string, address?: KvDeliveryAddress): Promise<Partial<DeliveryRegion>> {
  if (!address) return {};
  try { return matchKvDeliveryRegion(address, await loadLocations(creds, token)); }
  catch (e) {
    // Preserve the exact old/new address format if the directory is temporarily unavailable.
    console.warn("[kv-delivery] location lookup unavailable", e instanceof Error ? e.message : "unknown error");
    return matchKvDeliveryRegion(address, []);
  }
}
