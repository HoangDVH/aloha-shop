"use client";

import type { ReactNode } from "react";
import {
  ArrowRight,
  Camera,
  CheckCircle2,
  ChevronDown,
  HeartHandshake,
  HelpCircle,
  Sparkles,
  Sprout,
  Zap,
} from "lucide-react";
import { LIGHT_LEVELS, type DoctorCard, type PlantCandidate } from "@/lib/plantDoctor/api";
import { ALOHA_ZALO } from "@/lib/plantDoctor/presets";
import { ChatGptChoiceCard } from "./ChatGptChoiceCard";
import { CandidatePicker, PlantIdentityBar } from "./PlantIdentityBar";

const SEVERITY = {
  nhe: { label: "Nhẹ", cls: "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200/80" },
  chu_y: { label: "Cần chú ý", cls: "bg-amber-50 text-amber-800 ring-1 ring-amber-200/80" },
  nang: { label: "Nặng – cần xử lý ngay", cls: "bg-rose-50 text-rose-700 ring-1 ring-rose-200/80" },
} as const;

const CONFIDENCE = {
  cao: { label: "Khá chắc chắn", hint: "Dấu hiệu trong ảnh khá rõ." },
  vua: { label: "Có thể", hint: "Còn khả năng khác, trả lời câu hỏi bên dưới để chẩn đoán chắc hơn." },
  thap: { label: "Chưa chắc chắn", hint: "Ảnh hoặc thông tin chưa đủ, hãy gửi thêm ảnh rõ hơn hoặc trả lời câu hỏi." },
} as const;

function SectionHeader({ icon: Icon, children }: { icon?: typeof Zap; children: ReactNode }) {
  return (
    <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-stone-500 pt-1">
      {Icon ? <Icon size={13} className="text-emerald-700" aria-hidden /> : null}
      <span>{children}</span>
    </div>
  );
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
    <details className="group rounded-2xl border border-stone-200/80 bg-stone-50/60 p-3.5 transition-all hover:bg-stone-50">
      <summary className="flex cursor-pointer list-none items-center justify-between text-xs font-bold text-stone-800 select-none">
        <span className="flex items-center gap-2">
          <Sprout size={15} className="text-emerald-700" aria-hidden />
          <span>Cách chăm sóc cây {card.plantName}</span>
        </span>
        <ChevronDown size={15} className="text-stone-400 transition-transform duration-200 group-open:rotate-180" aria-hidden />
      </summary>
      <dl className="mt-3 space-y-2 border-t border-stone-200/60 pt-3 text-[13px]">
        {rows.map(([k, v]) => (
          <div key={k} className="flex flex-col sm:flex-row sm:gap-4">
            <dt className="w-28 shrink-0 font-semibold text-stone-700">{k}:</dt>
            <dd className="text-stone-600 flex-1 leading-relaxed">{v}</dd>
          </div>
        ))}
      </dl>
    </details>
  );
}

/**
 * Phiếu chẩn đoán chuẩn phong cách ChatGPT:
 * Thoát khỏi định dạng "hộp lồng trong hộp", hiển thị trực tiếp với Typography cao cấp,
 * bước làm rõ ràng, câu hỏi tương tác dạng Prompt Chips mượt mà.
 */
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
  if (card.offTopic) {
    return <p className="text-stone-800 leading-relaxed text-[15px]">{card.summary}</p>;
  }

  const sev = SEVERITY[card.severity];
  const conf = CONFIDENCE[card.confidence];
  const pickPlant = card.kind === "pick_plant";
  const otherPlants = (card.plant?.candidates ?? []).filter((c) => c.profileId && c.profileId !== card.plant?.profileId);

  return (
    <div className="space-y-4 text-stone-800">
      {/* 1. Header & Title: Bác sĩ AI Aloha + Tên bệnh + Huy hiệu */}
      <div className="space-y-2">
        {pickPlant ? null : <PlantIdentityBar plant={card.plant} plantName={card.plantName} scientificName={card.scientificName} />}

        {card.title ? (
          <h3 className="text-lg sm:text-xl font-bold text-stone-900 leading-snug tracking-tight">
            {card.title}
          </h3>
        ) : null}

        {card.kind === "diagnosis" ? (
          <div className="flex flex-wrap items-center gap-2 pt-0.5">
            <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${sev.cls}`}>
              Mức độ: {sev.label}
            </span>
            <span
              className="rounded-full bg-stone-100 px-2.5 py-0.5 text-[11px] font-medium text-stone-600 ring-1 ring-stone-200/80"
              title={conf.hint}
            >
              Độ chắc chắn: {conf.label}
            </span>
          </div>
        ) : null}

        {/* Đoạn mô tả quan sát thực tế & chẩn đoán bệnh */}
        <p className="text-[14.5px] sm:text-[15px] leading-relaxed text-stone-700 whitespace-pre-line pt-1">
          {card.summary}
        </p>
      </div>

      {/* Khi cần xác nhận lại cây (Card lựa chọn chuẩn ảnh ChatGPT) */}
      {pickPlant && interactive && card.plant?.candidates?.length ? (
        <ChatGptChoiceCard
          groups={[
            {
              title: "Có phải cây của bạn là một trong các loài dưới đây?",
              options: card.plant.candidates.map((c) => ({
                value: c.profileId || c.scientificName,
                label: c.name,
                hint: c.scientificName,
                badge: c.byAi ? "Bác sĩ AI" : c.score > 0 ? `${Math.round(c.score * 100)}%` : undefined,
              })),
            },
          ]}
          submitLabel="Xác nhận loài cây"
          sending={sending}
          onSubmit={(answers) => {
            const chosen = answers[0];
            const candidate = card.plant?.candidates.find((c) => (c.profileId || c.scientificName) === chosen);
            if (candidate) onPickPlant(candidate);
          }}
        />
      ) : null}

      {/* 2. Việc nên làm ngay (Phác đồ xử lý cấp cứu) - Chuẩn Step Timeline hiện đại */}
      {card.steps.length ? (
        <div className="space-y-2.5 pt-1">
          <SectionHeader icon={Zap}>
            {card.kind === "unknown_plant" ? "Việc an toàn nên làm trong lúc chờ" : "Việc nên làm ngay"}
          </SectionHeader>
          <div className="space-y-2 rounded-2xl border border-emerald-100/80 bg-emerald-50/40 p-4 sm:p-4.5">
            <ol className="space-y-3">
              {card.steps.map((step, idx) => (
                <li key={idx} className="flex items-start gap-3">
                  <span className="flex h-5.5 w-5.5 shrink-0 items-center justify-center rounded-full bg-[#1C4C40] text-white text-[11.5px] font-bold mt-0.5 shadow-2xs">
                    {idx + 1}
                  </span>
                  <span className="text-[14.5px] text-stone-800 leading-relaxed flex-1">
                    {step}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      ) : null}

      {/* 3. Chăm sóc để không tái phát */}
      {card.care.length ? (
        <div className="space-y-2 pt-1">
          <SectionHeader icon={CheckCircle2}>
            {pickPlant ? (
              <span className="inline-flex items-center gap-1">
                <Camera size={13} aria-hidden /> Mẹo chụp ảnh để nhận diện chuẩn xác
              </span>
            ) : card.kind === "healthy" ? (
              "Lưu ý giữ cây khoẻ mạnh"
            ) : (
              "Chăm sóc phòng ngừa tái phát"
            )}
          </SectionHeader>
          <ul className="space-y-2 pl-1">
            {card.care.map((item, idx) => (
              <li key={idx} className="flex items-start gap-2.5 text-[14px] sm:text-[14.5px] text-stone-700 leading-relaxed">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 mt-2 shrink-0" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {/* 4. Giải thích nguyên nhân gốc rễ (Vì sao cây bị như vậy?) - Minimalist Accordion */}
      {card.whyDetail ? (
        <details className="group rounded-2xl border border-stone-200/80 bg-stone-50/50 p-3.5 transition-all hover:bg-stone-50">
          <summary className="flex cursor-pointer list-none items-center justify-between text-xs font-bold text-stone-700 select-none">
            <span className="flex items-center gap-2">
              <HelpCircle size={14} className="text-stone-500" aria-hidden />
              <span>Vì sao cây bị như vậy?</span>
            </span>
            <ChevronDown size={14} className="text-stone-400 transition-transform duration-200 group-open:rotate-180" aria-hidden />
          </summary>
          <p className="mt-2.5 text-[13.5px] text-stone-600 leading-relaxed border-t border-stone-200/50 pt-2.5">
            {card.whyDetail}
          </p>
        </details>
      ) : null}

      {/* 5. Câu hỏi tương tác phản hồi nhanh (Widget card lựa chọn chuẩn 100% ảnh ChatGPT) */}
      {interactive && card.followUps.length ? (
        <ChatGptChoiceCard
          groups={card.followUps.map((f, i) => ({
            id: String(i),
            title: f.question,
            options: f.options.map((opt) => ({ value: opt, label: opt })),
          }))}
          submitLabel="Xác nhận câu trả lời"
          sending={sending}
          onSubmit={(answers) => {
            const lines = card.followUps
              .map((f, i) => (answers[i] ? `${f.question} → ${answers[i]}` : null))
              .filter(Boolean);
            if (lines.length > 0) onAnswer(lines.join(". "));
          }}
        />
      ) : null}

      {/* 6. Chi tiết cách chăm sóc theo loài */}
      <Basics card={card} />

      {/* 7. Chọn lại cây nếu sai loài */}
      {interactive && !pickPlant && otherPlants.length ? (
        <CandidatePicker title="Không đúng cây? Chọn lại loài:" candidates={otherPlants} sending={sending} onPick={onPickPlant} />
      ) : null}

      {/* 8. Hotline Zalo nhà vườn hỗ trợ khi cây nguy kịch hoặc ca khó */}
      {card.needHelp || card.severity === "nang" ? (
        <div className="flex flex-col gap-2.5 rounded-2xl border border-emerald-200 bg-emerald-50/70 p-3.5 sm:flex-row sm:items-center sm:justify-between shadow-2xs">
          <p className="flex items-start gap-2 text-xs text-emerald-950 leading-relaxed">
            <HeartHandshake size={16} className="mt-0.5 shrink-0 text-[#1C4C40]" aria-hidden />
            <span>
              Nếu ca khó hoặc bạn chưa tự tin tự xử lý, hãy gửi ảnh qua Zalo để kỹ thuật viên nhà vườn Aloha hướng dẫn 1-1 miễn phí.
            </span>
          </p>
          <a
            href={ALOHA_ZALO.href}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 rounded-full bg-[#1C4C40] px-4 py-2 text-center text-xs font-bold text-white hover:bg-[#163c32] shadow-2xs transition inline-flex items-center justify-center gap-1.5 active:scale-98"
          >
            <span>Nhắn Zalo hỗ trợ 1-1</span>
            <ArrowRight size={13} />
          </a>
        </div>
      ) : null}
    </div>
  );
}
