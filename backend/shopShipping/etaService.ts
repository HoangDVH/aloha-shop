export type CarrierSpeed = "standard" | "express";

export type DeliveryEta = {
  leadDaysMin: number;
  leadDaysMax: number;
  etaFrom: string;
  etaTo: string;
  etaLabel: string;
  source: "api" | "estimate";
};

const VN_DAYS = ["Chủ Nhật", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy"];

function normProvinceKey(s: string): string {
  return String(s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/^(tinh|thanh pho|tp\.?)\s+/i, "")
    .trim();
}

function isHcm(province: string): boolean {
  return /ho chi minh|hồ chí minh/i.test(normProvinceKey(province));
}

function isMetro(province: string): boolean {
  const k = normProvinceKey(province);
  return /ha noi|hà nội|da nang|đà nẵng|can tho|cần thơ/.test(k);
}

function isRemote(province: string): boolean {
  const k = normProvinceKey(province);
  return /lao cai|lai chau|dien bien|son la|caobang|cao bang|lang son|ha giang/.test(k);
}

function zoneLeadDays(province: string, pickProvince: string): { min: number; max: number } {
  if (isHcm(province) && isHcm(pickProvince)) return { min: 1, max: 2 };
  if (isMetro(province)) return { min: 2, max: 3 };
  if (isRemote(province)) return { min: 4, max: 6 };
  return { min: 3, max: 4 };
}

function vnNow(): Date {
  return new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Ho_Chi_Minh" })
  );
}

function addBusinessDays(from: Date, days: number): Date {
  const d = new Date(from);
  let left = Math.max(0, Math.ceil(days));
  while (left > 0) {
    d.setDate(d.getDate() + 1);
    if (d.getDay() !== 0) left--;
  }
  return d;
}

function fmtDate(d: Date): string {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${VN_DAYS[d.getDay()]}, ${dd}/${mm}`;
}

function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function estimateDeliveryEta(
  province: string,
  speed: CarrierSpeed = "standard"
): DeliveryEta {
  const pick = String(process.env.GHTK_PICK_PROVINCE || "Hồ Chí Minh").trim();
  const cutoffHour = Number(process.env.SHOP_SHIP_CUTOFF_HOUR || 15);
  const now = vnNow();
  let processingDays = 0;
  if (now.getHours() >= cutoffHour) processingDays = 1;

  const zone = zoneLeadDays(province, pick);
  let min = zone.min + processingDays;
  let max = zone.max + processingDays;
  if (speed === "express") {
    min = Math.max(1, min - 1);
    max = Math.max(min, max - 1);
  }

  const shipStart = addBusinessDays(now, processingDays);
  const etaFrom = addBusinessDays(shipStart, min);
  const etaTo = addBusinessDays(shipStart, max);
  const etaLabel =
    min === max
      ? `Dự kiến nhận ${fmtDate(etaFrom)}`
      : `Dự kiến nhận ${fmtDate(etaFrom)} – ${fmtDate(etaTo)}`;

  return {
    leadDaysMin: min,
    leadDaysMax: max,
    etaFrom: toIsoDate(etaFrom),
    etaTo: toIsoDate(etaTo),
    etaLabel,
    source: "estimate",
  };
}

export function attachEta<T extends object>(
  result: T,
  province: string,
  speed: CarrierSpeed = "standard"
): T & DeliveryEta {
  const eta = estimateDeliveryEta(province, speed);
  return {
    ...result,
    eta: `${eta.leadDaysMin}–${eta.leadDaysMax} ngày`,
    ...eta,
  };
}
