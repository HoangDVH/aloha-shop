import test from "node:test";
import assert from "node:assert/strict";
import zlib from "node:zlib";
import { cvDownloadName, decodeCvDataUrl, detectCvFormat } from "../backend/shopRecruitment/cvFormat.js";
import {
  applicationInputSchema,
  applicationRequestHash,
  deadlineFromLocalDate,
  deadlineToLocalDate,
  isJobAcceptingApplications,
  jobInputSchema,
  validateJobForOpen,
} from "../backend/shopRecruitment/validation.js";
import { checkStatusTransition } from "../backend/shopRecruitment/transitions.js";

const baseApp = {
  submissionType: "general_interest",
  interestedPosition: "Nhân viên bán hàng",
  locationPreference: { mode: "any" },
  experienceLevel: "no_experience",
  fullName: "Nguyễn Văn A",
  email: "A@Example.com ",
  phone: "+84 912 345 678",
  consent: { accepted: true, purpose: "recruitment_contact", noticeVersion: "v1" },
};

test("hạn nộp: cuối ngày Asia/Saigon, không hết hạn lúc 00:00", () => {
  const d = deadlineFromLocalDate("2026-10-20")!;
  assert.equal(d.toISOString(), "2026-10-20T16:59:59.999Z");
  assert.equal(deadlineToLocalDate(d), "2026-10-20");
  assert.equal(deadlineFromLocalDate("2026-02-30"), null);
  assert.equal(deadlineFromLocalDate("20/10/2026"), null);
});

test("tin open còn hạn mới nhận hồ sơ", () => {
  const deadlineAt = deadlineFromLocalDate("2026-10-20")!;
  const job = { status: "open" as const, publishedAt: new Date("2026-10-01"), deadlineAt };
  assert.equal(isJobAcceptingApplications(job, new Date("2026-10-20T16:00:00Z")), true);
  assert.equal(isJobAcceptingApplications(job, new Date("2026-10-20T17:00:00Z")), false);
  assert.equal(isJobAcceptingApplications({ ...job, status: "closed" }, new Date("2026-10-05")), false);
});

test("quy tắc lương: thỏa thuận / khoảng / từ / đến", () => {
  const parse = (salary: unknown) => jobInputSchema.safeParse({ title: "X", salary });
  const neg = parse({ mode: "negotiated", min: 5, period: "month" });
  assert.ok(neg.success);
  assert.deepEqual(neg.data.salary, { mode: "negotiated" });
  assert.equal(parse({ mode: "range", min: 9_000_000, period: "month" }).success, false);
  assert.equal(parse({ mode: "range", min: 12_000_000, max: 9_000_000, period: "month" }).success, false);
  const range = parse({ mode: "range", min: "9000000", max: 12_000_000, period: "month" });
  assert.ok(range.success);
  assert.deepEqual(range.data.salary, { mode: "range", min: 9_000_000, max: 12_000_000, period: "month" });
  const from = parse({ mode: "from", min: 25_000, max: 99, period: "hour" });
  assert.ok(from.success);
  assert.deepEqual(from.data.salary, { mode: "from", min: 25_000, period: "hour" });
  assert.equal(parse({ mode: "up_to", max: 10_000_000 }).success, false);
  assert.equal(parse({ mode: "from", min: -1, period: "month" }).success, false);
});

test("kinh nghiệm yêu cầu 6 tháng và nhiều địa điểm có key ổn định", () => {
  const r = jobInputSchema.safeParse({
    title: "Kho",
    experienceRequirement: { mode: "required", minMonths: 6 },
    locations: [
      { city: "TP.HCM", address: "12 Lê Lợi" },
      { city: "TP.HCM", address: "12 Lê Lợi" },
      { city: "Bình Dương", address: "" },
    ],
  });
  assert.ok(r.success);
  assert.deepEqual(r.data.experienceRequirement, { mode: "required", minMonths: 6 });
  assert.equal(r.data.locations.length, 2);
  assert.equal(r.data.locations[0].key, "tp-hcm-12-le-loi");
  assert.equal(
    jobInputSchema.safeParse({ title: "x", experienceRequirement: { mode: "required" } }).success,
    false
  );
});

test("mở tin cần đủ trường B và hạn ở tương lai", () => {
  const now = new Date("2026-10-05T00:00:00Z");
  const draft = {
    title: "Bán hàng",
    employmentType: "full_time" as const,
    locations: [],
    description: "",
    requirements: "x",
    benefits: "x",
    salary: { mode: "negotiated" as const },
    deadlineAt: new Date("2026-10-01T00:00:00Z"),
  };
  const fields = validateJobForOpen(draft, { now }).map((e) => e.field);
  assert.deepEqual(fields, ["locations", "description", "deadlineDate"]);
  const ready = {
    ...draft,
    locations: [{ key: "a", city: "HCM", address: "" }],
    description: "x",
    deadlineAt: new Date("2026-11-01T00:00:00Z"),
  };
  assert.deepEqual(validateJobForOpen(ready, { now }), []);
  const expired = { ...ready, deadlineAt: new Date("2026-10-01T00:00:00Z") };
  assert.deepEqual(validateJobForOpen(expired, { now, requireFutureDeadline: false }), []);
});

test("chuyển trạng thái: hired chỉ sau offered; lùi/mở lại cần lý do", () => {
  assert.equal(checkStatusTransition("new", "reviewing").ok, true);
  assert.equal(checkStatusTransition("reviewing", "hired").ok, false);
  assert.equal(checkStatusTransition("offered", "hired").ok, true);
  assert.equal(checkStatusTransition("interviewing", "rejected").ok, true);
  assert.equal(checkStatusTransition("interviewing", "reviewing").ok, false);
  assert.equal(checkStatusTransition("interviewing", "reviewing", "đổi lịch").ok, true);
  assert.equal(checkStatusTransition("rejected", "reviewing").ok, false);
  assert.equal(checkStatusTransition("rejected", "reviewing", "ứng viên quay lại").ok, true);
  assert.equal(checkStatusTransition("rejected", "hired", "x").ok, false);
  assert.equal(checkStatusTransition("new", "new").ok, false);
});

test("form liên hệ chung: chuẩn hóa email/SĐT, không có jobId", () => {
  const r = applicationInputSchema.safeParse(baseApp);
  assert.ok(r.success);
  assert.equal(r.data.email, "a@example.com");
  assert.equal(r.data.phone, "0912345678");
  assert.equal(applicationInputSchema.safeParse({ ...baseApp, jobId: "abc" }).success, false);
  assert.equal(applicationInputSchema.safeParse({ ...baseApp, interestedPosition: "" }).success, false);
});

test("consent sai purpose hoặc chưa tick bị từ chối", () => {
  const wrongPurpose = { ...baseApp, consent: { ...baseApp.consent, purpose: "specific_job" } };
  assert.equal(applicationInputSchema.safeParse(wrongPurpose).success, false);
  const notAccepted = { ...baseApp, consent: { ...baseApp.consent, accepted: false } };
  assert.equal(applicationInputSchema.safeParse(notAccepted).success, false);
  const job = {
    ...baseApp,
    submissionType: "job_application",
    jobId: "65f000000000000000000001",
    consent: { ...baseApp.consent, purpose: "recruitment_contact" },
  };
  assert.equal(applicationInputSchema.safeParse(job).success, false);
  assert.equal(
    applicationInputSchema.safeParse({ ...job, consent: { ...job.consent, purpose: "specific_job" } }).success,
    true
  );
});

test("chọn nơi làm cụ thể phải có ít nhất 1 nơi", () => {
  const r = applicationInputSchema.safeParse({ ...baseApp, locationPreference: { mode: "selected", keys: [] } });
  assert.equal(r.success, false);
});

test("requestHash ổn định theo nội dung, khác khi đổi nội dung", () => {
  const a = applicationInputSchema.parse(baseApp);
  const b = applicationInputSchema.parse({ ...baseApp, email: "a@example.com" });
  const c = applicationInputSchema.parse({ ...baseApp, fullName: "Nguyễn Văn B" });
  assert.equal(applicationRequestHash(a, null), applicationRequestHash(b, null));
  assert.notEqual(applicationRequestHash(a, null), applicationRequestHash(c, null));
  assert.notEqual(applicationRequestHash(a, null), applicationRequestHash(a, "sha"));
});

const dataUrl = (mime: string, buf: Buffer) => `data:${mime};base64,${buf.toString("base64")}`;

/** ZIP tối giản (stored/deflate, không CRC) đủ cho bộ nhận diện DOCX. */
function makeZip(entries: { name: string; text: string; deflate?: boolean }[]): Buffer {
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;
  for (const e of entries) {
    const name = Buffer.from(e.name, "utf8");
    const raw = Buffer.from(e.text, "utf8");
    const data = e.deflate ? zlib.deflateRawSync(raw) : raw;
    const method = e.deflate ? 8 : 0;
    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0);
    lh.writeUInt16LE(method, 8);
    lh.writeUInt32LE(data.length, 18);
    lh.writeUInt32LE(raw.length, 22);
    lh.writeUInt16LE(name.length, 26);
    const ch = Buffer.alloc(46);
    ch.writeUInt32LE(0x02014b50, 0);
    ch.writeUInt16LE(method, 10);
    ch.writeUInt32LE(data.length, 20);
    ch.writeUInt32LE(raw.length, 24);
    ch.writeUInt16LE(name.length, 28);
    ch.writeUInt32LE(offset, 42);
    locals.push(lh, name, data);
    centrals.push(ch, name);
    offset += lh.length + name.length + data.length;
  }
  const cd = Buffer.concat(centrals);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(cd.length, 12);
  eocd.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, cd, eocd]);
}

const DOCX_CT =
  '<Types><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>';
const DOCM_CT =
  '<Types><Override PartName="/word/document.xml" ContentType="application/vnd.ms-word.document.macroEnabled.main+xml"/></Types>';
const OLE = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);

test("CV PDF: nhận PDF thật, từ chối giả mạo / MIME lạ / quá cỡ", () => {
  const pdf = Buffer.from("%PDF-1.4\n%test\n");
  const ok = decodeCvDataUrl(dataUrl("application/pdf", pdf), 1024);
  assert.equal(ok.ok === true ? ok.format : null, "pdf");
  assert.equal(decodeCvDataUrl(dataUrl("application/pdf", Buffer.from("MZ\x90")), 1024).ok, false);
  assert.equal(decodeCvDataUrl(dataUrl("image/png", pdf), 1024).ok, false);
  assert.equal(decodeCvDataUrl(dataUrl("application/pdf", Buffer.alloc(2048, 65)), 1024).ok, false);
});

test("CV DOCX: nhận docx thường, từ chối docm / vbaProject / zip không phải Word", () => {
  const docx = makeZip([
    { name: "[Content_Types].xml", text: DOCX_CT, deflate: true },
    { name: "word/document.xml", text: "<w:document/>" },
  ]);
  const r = decodeCvDataUrl(dataUrl("application/octet-stream", docx), 64 * 1024);
  assert.equal(r.ok === true ? r.format : null, "docx");
  const docm = makeZip([
    { name: "[Content_Types].xml", text: DOCM_CT },
    { name: "word/document.xml", text: "<w:document/>" },
  ]);
  assert.equal(detectCvFormat(docm).ok, false);
  const vba = makeZip([
    { name: "[Content_Types].xml", text: DOCX_CT },
    { name: "word/document.xml", text: "<w:document/>" },
    { name: "word/vbaProject.bin", text: "x" },
  ]);
  assert.equal(detectCvFormat(vba).ok, false);
  const xlsx = makeZip([{ name: "[Content_Types].xml", text: DOCX_CT }, { name: "xl/workbook.xml", text: "" }]);
  assert.equal(detectCvFormat(xlsx).ok, false);
  assert.equal(detectCvFormat(Buffer.from("PK\x03\x04garbage")).ok, false);
});

test("CV DOC: nhận Word 97-2003, từ chối file có macro / OLE không phải Word", () => {
  const doc = Buffer.concat([OLE, Buffer.alloc(64), Buffer.from("WordDocument", "utf16le")]);
  const v = detectCvFormat(doc);
  assert.equal(v.ok === true ? v.format : null, "doc");
  const withMacro = Buffer.concat([doc, Buffer.from("_VBA_PROJECT", "utf16le")]);
  assert.equal(detectCvFormat(withMacro).ok, false);
  const xls = Buffer.concat([OLE, Buffer.alloc(64), Buffer.from("Workbook", "utf16le")]);
  assert.equal(detectCvFormat(xls).ok, false);
});

test("CV: tên tải về luôn mang đuôi theo định dạng thật", () => {
  assert.equal(cvDownloadName("Nguyen Van A.pdf", "docx"), "Nguyen Van A.docx");
  assert.equal(cvDownloadName("cv", "doc"), "cv.doc");
  assert.equal(cvDownloadName("", "pdf"), "CV.pdf");
});

test("source lạ bị bỏ qua thay vì làm hỏng hồ sơ", () => {
  assert.equal(applicationInputSchema.parse({ ...baseApp, source: "hero" }).source, "hero");
  assert.equal(applicationInputSchema.parse({ ...baseApp, source: "evil" }).source, undefined);
});
