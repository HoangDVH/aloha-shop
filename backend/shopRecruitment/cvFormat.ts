import zlib from "zlib";
import type { CvFormat } from "./types.js";

export const CV_FORMAT_META: Record<CvFormat, { mime: string; ext: string }> = {
  pdf: { mime: "application/pdf", ext: "pdf" },
  doc: { mime: "application/msword", ext: "doc" },
  docx: { mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", ext: "docx" },
};

/** MIME trình duyệt có thể gắn cho file CV hợp lệ (.doc trên một số máy không có MIME). */
const DECLARED_MIMES = new Set([
  ...Object.values(CV_FORMAT_META).map((m) => m.mime),
  "application/octet-stream",
]);

const OLE_MAGIC = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
const utf16 = (s: string) => Buffer.from(s, "utf16le");
const OLE_WORD_STREAM = utf16("WordDocument");
const OLE_VBA_MARKER = utf16("_VBA_PROJECT");

const ZIP_MAX_ENTRIES = 2000;
const ZIP_CONTENT_TYPES_MAX = 512 * 1024;

type Verdict = { ok: true; format: CvFormat } | { ok: false; message: string };

type ZipEntry = { name: string; method: number; compSize: number; localOffset: number };

function readZipEntries(buf: Buffer): ZipEntry[] | null {
  const minEocd = Math.max(0, buf.length - 22 - 0xffff);
  let eocd = -1;
  for (let i = buf.length - 22; i >= minEocd; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) return null;
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  if (count > ZIP_MAX_ENTRIES || p >= buf.length) return null;
  const out: ZipEntry[] = [];
  for (let i = 0; i < count; i++) {
    if (p + 46 > buf.length || buf.readUInt32LE(p) !== 0x02014b50) return null;
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    if (p + 46 + nameLen > buf.length) return null;
    out.push({
      name: buf.subarray(p + 46, p + 46 + nameLen).toString("utf8"),
      method: buf.readUInt16LE(p + 10),
      compSize: buf.readUInt32LE(p + 20),
      localOffset: buf.readUInt32LE(p + 42),
    });
    p += 46 + nameLen + extraLen + commentLen;
  }
  return out;
}

function readZipEntryText(buf: Buffer, e: ZipEntry): string | null {
  const lh = e.localOffset;
  if (lh + 30 > buf.length || buf.readUInt32LE(lh) !== 0x04034b50) return null;
  const start = lh + 30 + buf.readUInt16LE(lh + 26) + buf.readUInt16LE(lh + 28);
  const end = start + e.compSize;
  if (end > buf.length) return null;
  const raw = buf.subarray(start, end);
  try {
    if (e.method === 0) return raw.length <= ZIP_CONTENT_TYPES_MAX ? raw.toString("utf8") : null;
    if (e.method === 8) {
      return zlib.inflateRawSync(raw, { maxOutputLength: ZIP_CONTENT_TYPES_MAX }).toString("utf8");
    }
  } catch {
    return null;
  }
  return null;
}

function checkDocx(buf: Buffer): Verdict {
  const bad: Verdict = { ok: false, message: "File Word không hợp lệ hoặc bị hỏng" };
  const entries = readZipEntries(buf);
  if (!entries) return bad;
  const names = new Set(entries.map((e) => e.name));
  if (!names.has("word/document.xml")) return bad;
  if (entries.some((e) => /vbaproject\.bin$/i.test(e.name))) {
    return { ok: false, message: "File Word chứa macro — lưu lại dạng .docx thường hoặc PDF" };
  }
  const ct = entries.find((e) => e.name === "[Content_Types].xml");
  const xml = ct ? readZipEntryText(buf, ct) : null;
  if (!xml) return bad;
  if (/macroEnabled/i.test(xml)) {
    return { ok: false, message: "File Word chứa macro — lưu lại dạng .docx thường hoặc PDF" };
  }
  if (!xml.includes("wordprocessingml.document.main+xml")) return bad;
  return { ok: true, format: "docx" };
}

function checkDoc(buf: Buffer): Verdict {
  if (!buf.includes(OLE_WORD_STREAM)) return { ok: false, message: "File không phải Word (.doc) hợp lệ" };
  if (buf.includes(OLE_VBA_MARKER)) {
    return { ok: false, message: "File Word chứa macro — lưu lại dạng .docx thường hoặc PDF" };
  }
  return { ok: true, format: "doc" };
}

/** Nhận diện theo nội dung, không tin đuôi file hay MIME trình duyệt gửi. */
export function detectCvFormat(buf: Buffer): Verdict {
  if (buf.length >= 5 && buf.subarray(0, 5).toString("latin1") === "%PDF-") return { ok: true, format: "pdf" };
  if (buf.length >= 8 && buf.subarray(0, 8).equals(OLE_MAGIC)) return checkDoc(buf);
  if (buf.length >= 4 && buf.readUInt32LE(0) === 0x04034b50) return checkDocx(buf);
  return { ok: false, message: "CV chỉ nhận PDF, DOC hoặc DOCX" };
}

export function decodeCvDataUrl(
  data: string,
  maxBytes: number
): { ok: true; buffer: Buffer; format: CvFormat } | { ok: false; message: string } {
  const tooBig = { ok: false as const, message: `CV tối đa ${Math.round(maxBytes / 1048576)}MB` };
  const m = String(data || "").match(/^data:([A-Za-z0-9.+/-]*);base64,([A-Za-z0-9+/=\s]+)$/);
  if (!m) return { ok: false, message: "CV không đọc được" };
  const declared = (m[1] || "application/octet-stream").toLowerCase();
  if (!DECLARED_MIMES.has(declared)) return { ok: false, message: "CV chỉ nhận PDF, DOC hoặc DOCX" };
  if (Math.floor((m[2].length * 3) / 4) > maxBytes + 4) return tooBig;
  const buffer = Buffer.from(m[2], "base64");
  if (!buffer.length) return { ok: false, message: "CV không đọc được" };
  if (buffer.length > maxBytes) return tooBig;
  const verdict = detectCvFormat(buffer);
  if (verdict.ok === false) return verdict;
  return { ok: true, buffer, format: verdict.format };
}

/** Tên tải về luôn mang đuôi đúng định dạng thật. */
export function cvDownloadName(originalName: string, format: CvFormat): string {
  const base = String(originalName || "").replace(/\.[A-Za-z0-9]{1,5}$/, "").trim() || "CV";
  return `${base}.${CV_FORMAT_META[format].ext}`;
}
