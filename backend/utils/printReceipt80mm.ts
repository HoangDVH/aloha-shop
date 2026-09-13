/**
 * Tem hóa đơn 80mm — xem trước trong app, in RAW ESC/POS + cắt từng tem (XP-80C).
 */
import QRCode from "qrcode";
import type { Product } from "../services/database";
import { formatVndDot } from "./helpers";
import { thermalPosQrPayload } from "./printBarcodeLabels";

/** Khổ cuộn XP-80C: ngang 80mm (trái → phải) */
export const RECEIPT80_W_MM = 80;
/** Chiều cao tem trên cuộn (khổ in 80×40 mm, nằm ngang) */
export const RECEIPT80_H_MM = 40;
/** Một tem / một hàng (full 80mm) */
export const RECEIPT80_COL_MM = 80;
export const RECEIPT80_TICKET_W_MM = RECEIPT80_W_MM;
export const RECEIPT80_TICKET_L_MM = RECEIPT80_H_MM;
export const RECEIPT80_PRINT_W_MM = 80;

const GOLD = "#c9a227";
const RED = "#e30613";
const BG = "#f7f3e8";

function siShort(n: number) {
  return formatVndDot(Math.round((n || 0) / 1000));
}

function pricesOf(p: Product) {
  const giaChung = Number((p as any).giaChung) > 0 ? Number((p as any).giaChung) : 0;
  const giaBanField = Number(p.giaBan) > 0 ? Number(p.giaBan) : 0;
  const giaWeb = Number(p.giaWeb) > 0 ? Number(p.giaWeb) : 0;
  const giaBanDo = giaChung || giaBanField || giaWeb || 0;
  const giaGoc = giaWeb > 0 && giaWeb > giaBanDo ? giaWeb : 0;
  const giaSi = Number(p.giaSi) > 0 ? Number(p.giaSi) : giaBanDo;
  return { giaBanDo, giaGoc, giaSi };
}

async function loadLogoDataUrl(): Promise<string> {
  try {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const res = await fetch(`${origin}/logo-tem-header.png?v=10`);
    if (!res.ok) return "";
    const blob = await res.blob();
    return await new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result || ""));
      r.onerror = () => reject(r.error);
      r.readAsDataURL(blob);
    });
  } catch {
    return "";
  }
}

const ESCPOS_DOTS_W = 576;
const ESCPOS_DPI = 203;

function mmToPx(mm: number) {
  return Math.max(8, Math.round((mm * ESCPOS_DPI) / 25.4));
}

function loadImg(src: string): Promise<HTMLImageElement | null> {
  if (!src || typeof Image === "undefined") return Promise.resolve(null);
  return new Promise((resolve) => {
    const im = new Image();
    im.onload = () => resolve(im);
    im.onerror = () => resolve(null);
    im.src = src;
  });
}

async function drawTemCell(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  p: Product | null,
  logo: HTMLImageElement | null,
  qrMap: Map<string, string>,
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, w, h);
  if (!p) {
    ctx.restore();
    return;
  }
  const inset = 4;
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 3;
  ctx.strokeRect(inset, inset, w - inset * 2, h - inset * 2);
  const { giaBanDo, giaGoc, giaSi } = pricesOf(p);
  const ten = String(p.ten || p.ma || "").toUpperCase();
  const ma = String(p.ma || "").toUpperCase();
  ctx.fillStyle = "#111";
  const pad = Math.round(w * 0.03);
  const headerH = Math.round(h * 0.18);
  const bodyH = Math.round(h * 0.4);
  const nameH = h - headerH - bodyH - inset * 2;
  ctx.textAlign = "center";
  if (logo) {
    const lw = Math.round(w * 0.72);
    const lh = headerH - 8;
    ctx.drawImage(logo, (w - lw) / 2, inset + 4, lw, lh);
  } else {
    ctx.fillStyle = GOLD;
    ctx.font = `bold ${Math.round(h * 0.1)}px Georgia, serif`;
    ctx.fillText("ALOHA", w / 2, inset + headerH * 0.55);
    ctx.font = `bold ${Math.round(h * 0.055)}px Arial`;
    ctx.fillText("THẾ GIỚI CHẬU CÂY", w / 2, inset + headerH * 0.88);
    ctx.fillStyle = "#111";
  }
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(inset, inset + headerH);
  ctx.lineTo(w - inset, inset + headerH);
  ctx.stroke();
  const nameTop = inset + headerH;
  ctx.textAlign = "left";
  ctx.fillStyle = "#111";
  ctx.font = `bold ${Math.round(h * 0.055)}px Arial`;
  ctx.fillText("TÊN SẢN PHẨM:", pad, nameTop + Math.round(nameH * 0.28));
  ctx.font = `bold ${Math.round(h * 0.12)}px Arial`;
  wrapLeft(ctx, ten, pad, nameTop + Math.round(nameH * 0.52), w - pad * 2, Math.round(h * 0.13));
  const bodyTop = h - inset - bodyH;
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(inset, bodyTop);
  ctx.lineTo(w - inset, bodyTop);
  ctx.stroke();
  const mid = Math.round(w * 0.58);
  ctx.beginPath();
  ctx.moveTo(mid, bodyTop);
  ctx.lineTo(mid, h - inset);
  ctx.stroke();
  ctx.textAlign = "center";
  const gx = inset + (mid - inset) / 2;
  if (giaGoc > 0) {
    ctx.font = `bold ${Math.round(h * 0.065)}px Arial`;
    ctx.fillText(`GIÁ GỐC: ${formatVndDot(giaGoc)}đ`, gx, bodyTop + Math.round(bodyH * 0.22));
  }
  ctx.fillStyle = RED;
  ctx.font = `bold ${Math.round(h * 0.16)}px Arial`;
  ctx.fillText(`${formatVndDot(giaBanDo)}đ`, gx, bodyTop + Math.round(bodyH * 0.55));
  ctx.fillStyle = "#111";
  ctx.font = `bold ${Math.round(h * 0.065)}px Arial`;
  ctx.fillText(`S.${siShort(giaSi)}    ĐVT: ${p.dvt || "Cái"}`, gx, h - inset - 8);
  const payload = thermalPosQrPayload(p);
  const qr = await loadImg(qrMap.get(payload) || "");
  const qs = Math.round(Math.min(w - mid - pad * 2, bodyH - 22));
  const qx = mid + (w - inset - mid - qs) / 2;
  const qy = bodyTop + 6;
  if (qr) ctx.drawImage(qr, qx, qy, qs, qs);
  ctx.font = `bold ${Math.round(h * 0.06)}px Arial`;
  ctx.fillText(`MÃ SP: ${ma}`, mid + (w - inset - mid) / 2, h - inset - 6);
  ctx.restore();
}

function wrapLeft(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxW: number,
  lineH: number,
) {
  ctx.textAlign = "left";
  const words = text.split(/\s+/).filter(Boolean);
  let line = "";
  let yy = y;
  let lines = 0;
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, x, yy);
      line = word;
      yy += lineH;
      lines += 1;
      if (lines >= 2) break;
    } else line = test;
  }
  if (line && lines < 2) ctx.fillText(line, x, yy);
}

async function rasterEscposRows(
  expanded: Product[],
  logoUrl: string,
  qrMap: Map<string, string>,
): Promise<string[]> {
  if (typeof document === "undefined") return [];
  const logo = await loadImg(logoUrl);
  const W = ESCPOS_DOTS_W;
  const H = mmToPx(RECEIPT80_H_MM);
  const out: string[] = [];
  for (const p of expanded) {
    const c = document.createElement("canvas");
    c.width = W;
    c.height = H;
    const ctx = c.getContext("2d");
    if (!ctx) continue;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, W, H);
    await drawTemCell(ctx, 0, 0, W, H, p, logo, qrMap);
    out.push(c.toDataURL("image/jpeg", 0.82));
  }
  return out;
}

async function tryPrintEscpos80(images: string[]): Promise<{ ok: boolean; error?: string }> {
  if (!images.length) return { ok: false, error: "no-images" };
  try {
    const r = await fetch("/api/printer/print-escpos-80", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ images }),
    });
    const j = (await r.json().catch(() => ({}))) as {
      ok?: boolean;
      error?: string;
      parsed?: { error?: string; hint?: string };
      stderr?: string;
      reason?: string;
    };
    if (j.ok === true) return { ok: true };
    const hint = typeof j.parsed?.hint === "string" ? j.parsed.hint : "";
    const err = String(j.error || j.parsed?.error || `http-${r.status}`);
    if (err === "no-xprinter") {
      return {
        ok: false,
        error: hint
          ? `Không thấy máy Xprinter XP-80C. Máy đang có: ${hint}`
          : "Không thấy máy in Xprinter XP-80C (cắm USB, bật máy, tên có XP-80C).",
      };
    }
    if (err === "missing-script") {
      return { ok: false, error: "Thiếu file in RAW trên máy chủ. Khởi động lại app (MO-APP-ALOHA)." };
    }
    if (err === "not-windows" || j.reason === "not-windows") {
      return { ok: false, error: "In 80mm RAW chỉ chạy trên máy Windows gắn XP-80C." };
    }
    const stderr = typeof j.stderr === "string" && j.stderr.trim() ? j.stderr.trim() : "";
    const parts = [err !== "print-failed" ? err : "", hint, stderr].filter(Boolean);
    return {
      ok: false,
      error: parts.join(" — ") || "Máy in không nhận lệnh RAW. Kiểm tra XP-80C USB và driver RAW.",
    };
  } catch (e: any) {
    return { ok: false, error: e?.message || String(e) };
  }
}

export type PrintReceipt80Options = {
  copiesPerProduct?: number;
  onProgress?: (done: number, total: number) => void;
};

export async function printReceipt80mmLabels(
  products: Product[],
  options: PrintReceipt80Options = {},
): Promise<{ ok: boolean; error?: string }> {
  if (!products.length) return { ok: false, error: "empty" };
  const copies = Math.max(1, Math.min(50, options.copiesPerProduct ?? 1));
  const expanded: Product[] = [];
  products.forEach((p) => {
    for (let i = 0; i < copies; i++) expanded.push(p);
  });

  const logoUrl = await loadLogoDataUrl();
  const qrMap = new Map<string, string>();
  const payloads = [...new Set(expanded.map((p) => thermalPosQrPayload(p)).filter(Boolean))];
  await Promise.all(
    payloads.map(async (payload) => {
      try {
        qrMap.set(
          payload,
          await QRCode.toDataURL(payload, {
            width: 140,
            margin: 1,
            errorCorrectionLevel: "M",
            color: { dark: "#000000", light: "#ffffff" },
          }),
        );
      } catch {
        qrMap.set(payload, "");
      }
    }),
  );

  try {
    const pngs = await rasterEscposRows(expanded, logoUrl, qrMap);
    if (!pngs.length) return { ok: false, error: "Không vẽ được tem." };
    return await tryPrintEscpos80(pngs);
  } catch (e: any) {
    return { ok: false, error: e?.message || String(e) };
  }
}
