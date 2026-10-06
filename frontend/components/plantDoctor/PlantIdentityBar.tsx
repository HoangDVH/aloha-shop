"use client";

import { Leaf } from "lucide-react";
import type { PlantCandidate, PlantIdentity } from "@/lib/plantDoctor/api";

const pct = (score: number) => `${Math.round(score * 100)}%`;

function sourceLabel(p: PlantIdentity): string {
  if (p.source === "customer") return "Bạn đã chọn";
  if (p.source === "text") return "Theo tên bạn nhập";
  return p.score != null ? `Pl@ntNet nhận diện · ${pct(p.score)}` : "Pl@ntNet nhận diện";
}

/** Tên cây đang khám + nguồn nhận diện, để khách biết hướng dẫn bên dưới dành cho loài nào. */
export function PlantIdentityBar({ plant, plantName, scientificName }: { plant: PlantIdentity | null; plantName: string; scientificName: string }) {
  if (!plantName) return null;
  return (
    <p className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-stone-500">
      <Leaf size={12} className="text-emerald-700" aria-hidden />
      <span className="font-semibold text-stone-700">{plantName}</span>
      {scientificName ? <em className="text-stone-400">{scientificName}</em> : null}
      {plant ? (
        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10.5px] font-semibold text-emerald-800 ring-1 ring-emerald-100">
          {sourceLabel(plant)}
        </span>
      ) : null}
    </p>
  );
}

/** Danh sách cây để khách chọn: từ kết quả Pl@ntNet hoặc khi nhận diện sai. */
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
    <div className="space-y-1.5">
      <p className="text-[12px] font-semibold text-stone-600">{title}</p>
      <div className="flex flex-wrap gap-1.5">
        {candidates.map((c) => (
          <button
            key={`${c.profileId}-${c.scientificName}`}
            type="button"
            disabled={sending}
            onClick={() => onPick(c)}
            className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-white px-3 py-1 text-xs font-semibold text-[#1C4C40] transition hover:border-[#1C4C40] hover:bg-emerald-50 disabled:opacity-50 cursor-pointer"
          >
            <span>{c.name}</span>
            {c.score > 0 ? <span className="text-[10.5px] font-medium text-stone-400">{pct(c.score)}</span> : null}
          </button>
        ))}
      </div>
    </div>
  );
}
