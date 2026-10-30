"use client";

import { Leaf, Sparkles } from "lucide-react";
import type { PlantCandidate, PlantIdentity } from "@/lib/plantDoctor/api";
import { ChatGptChoiceCard } from "./ChatGptChoiceCard";

const pct = (score: number) => `${Math.round(score * 100)}%`;

function sourceLabel(p: PlantIdentity): string {
  if (p.source === "customer") return "Bạn đã chọn";
  if (p.source === "text") return "Theo tên bạn nhập";
  if (p.source === "ai_vision") return "Bác sĩ AI Aloha · 95%";
  return p.score != null ? `Nhận diện · ${pct(p.score)}` : "Nhận diện cây";
}

/** Tên cây đang khám + nguồn nhận diện chuẩn ChatGPT pill badges. */
export function PlantIdentityBar({
  plant,
  plantName,
  scientificName,
}: {
  plant: PlantIdentity | null;
  plantName: string;
  scientificName: string;
}) {
  if (!plantName) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-xs">
      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50/90 px-3 py-1 text-xs font-semibold text-emerald-900 border border-emerald-200/70 shadow-2xs">
        <Leaf size={12} className="text-emerald-700" aria-hidden />
        <span>{plantName}</span>
        {scientificName ? <span className="text-emerald-700/60 font-normal italic">({scientificName})</span> : null}
      </span>
      {plant ? (
        <span className="inline-flex items-center gap-1 rounded-full bg-stone-100/90 px-2.5 py-1 text-[11px] font-medium text-stone-600 border border-stone-200/60 shadow-2xs">
          <Sparkles size={11} className="text-emerald-700" aria-hidden />
          <span>{sourceLabel(plant)}</span>
        </span>
      ) : null}
    </div>
  );
}

/** Danh sách cây gợi ý để khách chọn: chuẩn ChatGPT questionnaire widget. */
export function CandidatePicker({
  title,
  candidates,
  sending,
  onPick,
}: {
  title: string;
  candidates: PlantCandidate[];
  sending: boolean;
  onPick: (c: PlantCandidate) => void;
}) {
  if (!candidates.length) return null;
  return (
    <ChatGptChoiceCard
      groups={[
        {
          title,
          options: candidates.map((c) => ({
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
        const val = answers[0];
        const chosen = candidates.find((c) => (c.profileId || c.scientificName) === val);
        if (chosen) onPick(chosen);
      }}
    />
  );
}
