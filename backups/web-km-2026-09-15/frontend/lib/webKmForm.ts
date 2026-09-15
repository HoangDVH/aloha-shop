import { z } from "zod";

/** Form admin KM — đồng bộ rule BE (giá < tham chiếu). */
export const webKmFormSchema = z
  .object({
    gia: z.coerce.number().finite().positive("Nhập giá khách trả"),
    phanTram: z.preprocess(
      (v) => (v === "" || v == null || Number.isNaN(Number(v)) ? undefined : Number(v)),
      z.number().finite().min(1).max(99).optional()
    ),
    tu: z.string().optional(),
    den: z.string().optional(),
  })
  .superRefine((v, ctx) => {
    const tu = String(v.tu || "").trim();
    const den = String(v.den || "").trim();
    if (tu && den) {
      const a = Date.parse(tu);
      const b = Date.parse(den);
      if (Number.isFinite(a) && Number.isFinite(b) && a >= b) {
        ctx.addIssue({
          code: "custom",
          path: ["den"],
          message: "Thời gian bắt đầu phải trước kết thúc",
        });
      }
    }
  });

export type WebKmFormValues = z.infer<typeof webKmFormSchema>;

export function computePhanTramGiam(giaGoc: number, giaBan: number): number {
  if (!(giaGoc > 0) || !(giaBan >= 0) || giaBan >= giaGoc) return 0;
  return Math.max(1, Math.min(99, Math.round((1 - giaBan / giaGoc) * 100)));
}

export function priceFromPercent(giaGoc: number, phanTram: number): number {
  const p = Math.max(1, Math.min(99, Math.round(phanTram)));
  return Math.max(0, Math.round(giaGoc * (1 - p / 100)));
}

/** datetime-local ↔ ISO */
export function isoToDatetimeLocal(iso?: string | null): string {
  if (!iso) return "";
  const t = Date.parse(String(iso));
  if (!Number.isFinite(t)) return "";
  const d = new Date(t);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function datetimeLocalToIso(v?: string | null): string | undefined {
  const s = String(v || "").trim();
  if (!s) return undefined;
  const t = Date.parse(s);
  if (!Number.isFinite(t)) return undefined;
  return new Date(t).toISOString();
}

export function kmStatusChip(opts: {
  webKm: { gia?: number; tu?: string; den?: string } | null | undefined;
  dangKm?: boolean;
  nowMs?: number;
}): { label: string; tone: "muted" | "green" | "amber" | "slate" } {
  const now = opts.nowMs ?? Date.now();
  const km = opts.webKm;
  if (!km || !(Number(km.gia) > 0)) {
    return { label: "Không KM", tone: "muted" };
  }
  if (opts.dangKm) return { label: "Đang giảm", tone: "green" };
  const tu = km.tu ? Date.parse(km.tu) : NaN;
  const den = km.den ? Date.parse(km.den) : NaN;
  if (Number.isFinite(tu) && now < tu) {
    return { label: "Sắp diễn ra", tone: "amber" };
  }
  if (Number.isFinite(den) && now > den) {
    return { label: "Đã hết", tone: "slate" };
  }
  return { label: "Chưa hiệu lực", tone: "slate" };
}
