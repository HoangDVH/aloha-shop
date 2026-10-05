import { Fragment, type ReactNode } from "react";

/** **đậm** và *nghiêng* → React node (không dùng HTML thô để tránh XSS). */
function inline(text: string, keyBase: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|\*[^*\s][^*]*\*)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const tok = m[0];
    out.push(
      tok.startsWith("**") ? (
        <strong key={`${keyBase}-${i++}`} className="font-bold text-stone-900">
          {tok.slice(2, -2)}
        </strong>
      ) : (
        <em key={`${keyBase}-${i++}`}>{tok.slice(1, -1)}</em>
      )
    );
    last = m.index + tok.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

const HEADING = /^(🩺|💊|⚠️|Tên Cây\s*:|#{1,4}\s)/;

/** Hiển thị câu trả lời AI: tiêu đề mục, gạch đầu dòng, đoạn văn. */
export function AiText({ text }: { text: string }) {
  const lines = text.replace(/\r/g, "").split("\n");
  const blocks: ReactNode[] = [];
  let bullets: string[] = [];
  const flush = (key: string) => {
    if (!bullets.length) return;
    blocks.push(
      <ul key={key} className="my-1.5 list-disc space-y-1 pl-5">
        {bullets.map((b, i) => (
          <li key={i}>{inline(b, `${key}-${i}`)}</li>
        ))}
      </ul>
    );
    bullets = [];
  };

  lines.forEach((raw, idx) => {
    const line = raw.trim();
    if (!line) return flush(`ul-${idx}`);
    const bullet = line.match(/^[-*•]\s+(.*)$/);
    if (bullet) return void bullets.push(bullet[1]);
    flush(`ul-${idx}`);
    if (HEADING.test(line)) {
      const clean = line.replace(/^#{1,4}\s*/, "");
      const isRx = clean.startsWith("💊");
      const isWarn = clean.startsWith("⚠️");
      const isDx = clean.startsWith("🩺") || clean.toLowerCase().startsWith("tên cây");
      const badgeCls = isRx
        ? "bg-teal-50 text-teal-900 border-teal-200/80"
        : isWarn
        ? "bg-amber-50 text-amber-900 border-amber-200"
        : isDx
        ? "bg-emerald-50 text-[#1C4C40] border-emerald-200"
        : "text-[#1C4C40]";
      blocks.push(
        <div key={idx} className={`mt-3.5 first:mt-0 font-bold text-xs sm:text-sm inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border ${badgeCls}`}>
          {inline(clean, `h-${idx}`)}
        </div>
      );
      return;
    }
    blocks.push(
      <p key={idx} className="mt-1.5 first:mt-0">
        {inline(line, `p-${idx}`)}
      </p>
    );
  });
  flush("ul-end");
  return <Fragment>{blocks}</Fragment>;
}
