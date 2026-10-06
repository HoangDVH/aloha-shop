"use client";

import type { ReactNode } from "react";
import { BookOpen, Camera, ChevronDown, HeartHandshake, MessageCircleQuestion, ShieldCheck, Sprout } from "lucide-react";
import { LIGHT_LEVELS, type DoctorCard, type PlantCandidate } from "@/lib/plantDoctor/api";
import { ALOHA_ZALO } from "@/lib/plantDoctor/presets";
import { CandidatePicker, PlantIdentityBar } from "./PlantIdentityBar";

const SEVERITY = {
  nhe: { label: "Nhẹ", cls: "bg-emerald-50 text-emerald-800 ring-emerald-200" },
  chu_y: { label: "Cần chú ý", cls: "bg-amber-50 text-amber-800 ring-amber-200" },
  nang: { label: "Nặng – xử lý ngay", cls: "bg-rose-50 text-rose-700 ring-rose-200" },
} as const;

const CONFIDENCE = {
  cao: { label: "Khá chắc chắn", hint: "Dấu hiệu trong ảnh khá rõ." },
  vua: { label: "Có thể", hint: "Còn khả năng khác, trả lời câu hỏi bên dưới để chẩn đoán chắc hơn." },
  thap: { label: "Chưa chắc chắn", hint: "Ảnh hoặc thông tin chưa đủ, hãy gửi thêm ảnh rõ hơn hoặc trả lời câu hỏi." },
} as const;

function SectionTitle({ children }: { children: ReactNode }) {
  return <p className="text-[11.5px] font-bold uppercase tracking-wide text-[#1C4C40]">{children}</p>;
}

function Basics({ card }: { card: DoctorCard }) {
  const b = card.basics;
  if (!b) return null;
  const level = b.lightLevel ? LIGHT_LEVELS[b.lightLevel] : "";
  const rows = [
    ["Ánh sáng", level ? `${level}. ${b.light}` : b.light],
    ["Tưới nước", b.water],
    ["Đất / giá thể", b.soil],
    ["Độc tính", b.toxic],
    ["Lưu ý", b.note ?? ""],
  ].filter(([, v]) => v);
  return (
    <details className="group rounded-xl border border-emerald-100 bg-white px-3 py-2">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-xs font-bold text-[#1C4C40]">
        <span className="flex items-center gap-1.5">
          <Sprout size={14} aria-hidden /> Cách chăm {card.plantName}
        </span>
        <ChevronDown size={14} className="transition group-open:rotate-180" aria-hidden />
      </summary>
      <dl className="mt-2 space-y-1.5 text-[13px]">
        {rows.map(([k, v]) => (
          <div key={k}>
            <dt className="font-semibold text-stone-700">{k}</dt>
            <dd className="text-stone-600">{v}</dd>
          </div>
        ))}
      </dl>
    </details>
  );
}

function Footer({ card }: { card: DoctorCard }) {
  const fromProfile = Boolean(card.plant?.profileId) && card.kind !== "unknown_plant";
  return (
    <div className="space-y-1 text-[10.5px] text-stone-400">
      {fromProfile && card.source ? (
        <p className="flex items-start gap-1">
          <BookOpen size={11} className="mt-0.5 shrink-0" aria-hidden />
          <span>
            {card.careByAloha ? "Cách chăm theo hướng dẫn của Aloha; độc tính và sâu bệnh theo " : "Nguồn tham khảo: "}
            <a href={card.source.url} target="_blank" rel="noopener noreferrer" className="underline hover:text-stone-600">
              {card.source.name}
            </a>
          </span>
        </p>
      ) : null}
      {fromProfile && !card.reviewed ? <p className="text-amber-600">Nội dung hồ sơ loài này đang chờ Aloha duyệt.</p> : null}
      <p className="flex items-center gap-1">
        <ShieldCheck size={11} aria-hidden />
        {card.plant?.source === "plantnet" ? "Nhận diện cây bởi Pl@ntNet. " : ""}
        Hướng dẫn theo hồ sơ loài của Aloha, chỉ mang tính tham khảo.
      </p>
    </div>
  );
}

/** Phiếu cho khách: cây gì (nguồn nhận diện) → vấn đề → việc làm ngay → cách chăm đúng loài → hỏi lại / chuyển người. */
export function DiagnosisCard({
  card,
  interactive,
  sending,
  onAnswer,
  onPickPlant,
}: {
  card: DoctorCard;
  interactive: boolean;
  sending: boolean;
  onAnswer: (text: string) => void;
  onPickPlant: (c: PlantCandidate) => void;
}) {
  if (card.offTopic) return <p className="text-stone-700">{card.summary}</p>;
  const sev = SEVERITY[card.severity];
  const conf = CONFIDENCE[card.confidence];
  const pickPlant = card.kind === "pick_plant";
  const otherPlants = (card.plant?.candidates ?? []).filter((c) => c.profileId && c.profileId !== card.plant?.profileId);

  return (
    <div className="space-y-3.5">
      <div className="space-y-1.5">
        {pickPlant ? null : <PlantIdentityBar plant={card.plant} plantName={card.plantName} scientificName={card.scientificName} />}
        {card.title ? <h3 className="text-[15px] sm:text-base font-bold leading-snug text-stone-900">{card.title}</h3> : null}
        {card.kind === "diagnosis" ? (
          <div className="flex flex-wrap gap-1.5">
            <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ring-1 ${sev.cls}`}>Mức độ: {sev.label}</span>
            <span
              className="rounded-full bg-stone-100 px-2.5 py-0.5 text-[11px] font-semibold text-stone-600 ring-1 ring-stone-200"
              title={conf.hint}
            >
              Độ chắc chắn: {conf.label}
            </span>
          </div>
        ) : null}
        <p className="pt-0.5 text-stone-700">{card.summary}</p>
      </div>

      {pickPlant && interactive ? (
        <div className="space-y-2.5 rounded-xl border border-emerald-100 bg-emerald-50/50 p-3">
          <CandidatePicker title="Có phải cây của bạn là:" candidates={card.plant?.candidates ?? []} sending={sending} onPick={onPickPlant} />
          <p className="text-[12px] text-stone-600">Không có trong danh sách? Gõ tên cây vào ô chat bên dưới.</p>
        </div>
      ) : null}

      {card.steps.length ? (
        <div className="space-y-2 rounded-xl bg-emerald-50/60 p-3 ring-1 ring-emerald-100">
          <SectionTitle>{card.kind === "unknown_plant" ? "Việc an toàn nên làm trong lúc chờ" : "Việc nên làm ngay"}</SectionTitle>
          <ol className="space-y-2">
            {card.steps.map((s, i) => (
              <li key={i} className="flex gap-2.5">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#1C4C40] text-[11px] font-bold text-white">
                  {i + 1}
                </span>
                <span className="text-stone-800">{s}</span>
              </li>
            ))}
          </ol>
        </div>
      ) : null}

      {card.care.length ? (
        <div className="space-y-1.5">
          <SectionTitle>
            {pickPlant ? (
              <span className="inline-flex items-center gap-1">
                <Camera size={12} aria-hidden /> Mẹo chụp ảnh để nhận diện đúng cây
              </span>
            ) : card.kind === "healthy" ? (
              "Giữ cách chăm này"
            ) : (
              "Chăm sóc để không tái phát"
            )}
          </SectionTitle>
          <ul className="list-disc space-y-1 pl-5 text-stone-700">
            {card.care.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {card.whyDetail ? (
        <details className="group rounded-xl border border-stone-200/80 bg-stone-50/60 px-3 py-2">
          <summary className="flex cursor-pointer list-none items-center justify-between text-xs font-bold text-stone-600">
            Vì sao cây bị như vậy?
            <ChevronDown size={14} className="transition group-open:rotate-180" aria-hidden />
          </summary>
          <p className="mt-2 text-[13px] text-stone-600">{card.whyDetail}</p>
        </details>
      ) : null}

      {interactive && card.followUps.length ? (
        <div className="space-y-2.5 rounded-xl border border-sky-100 bg-sky-50/50 p-3">
          <p className="flex items-center gap-1.5 text-xs font-bold text-sky-900">
            <MessageCircleQuestion size={14} aria-hidden /> Bấm chọn để bác sĩ hướng dẫn đúng hơn
          </p>
          {card.followUps.map((f, i) => (
            <div key={i} className="space-y-1.5">
              <p className="text-[13px] font-medium text-stone-800">{f.question}</p>
              <div className="flex flex-wrap gap-1.5">
                {f.options.map((o) => (
                  <button
                    key={o}
                    type="button"
                    disabled={sending}
                    onClick={() => onAnswer(`${f.question} → ${o}`)}
                    className="rounded-full border border-sky-200 bg-white px-3 py-1 text-left text-xs font-semibold text-sky-900 transition hover:border-sky-400 hover:bg-sky-50 disabled:opacity-50 cursor-pointer"
                  >
                    {o}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : null}

      <Basics card={card} />

      {interactive && !pickPlant && otherPlants.length ? (
        <CandidatePicker title="Không đúng cây? Chọn lại:" candidates={otherPlants} sending={sending} onPick={onPickPlant} />
      ) : null}

      {card.needHelp ? (
        <div className="flex flex-col gap-2 rounded-xl border border-amber-200 bg-amber-50/70 p-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-start gap-2 text-[13px] text-amber-900">
            <HeartHandshake size={16} className="mt-0.5 shrink-0" aria-hidden />
            <span>
              Không tự tin làm một mình? Nhắn Zalo kèm ảnh để nhân viên Aloha xem giúp, hoặc mang cây ra cửa hàng để được hỗ trợ.
            </span>
          </p>
          <a
            href={ALOHA_ZALO.href}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 rounded-full bg-[#1C4C40] px-3.5 py-1.5 text-center text-xs font-bold text-white hover:bg-[#163c32]"
          >
            Nhắn Zalo {ALOHA_ZALO.label}
          </a>
        </div>
      ) : null}

      <Footer card={card} />
    </div>
  );
}
