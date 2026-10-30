"use client";

import { useState } from "react";

export type QuestionOption = {
  value: string;
  label: string;
  hint?: string;
  badge?: string;
};

export type QuestionGroup = {
  id?: string;
  title: string;
  options: QuestionOption[];
};

/**
 * Widget lựa chọn tương tác chuẩn cơ chế ChatGPT nhưng phối màu sáng đồng bộ nhận diện Aloha:
 * Nền kem sáng nhẹ nhàng, radio tròn có chấm tâm, nút xác nhận màu xanh rừng Aloha `#1C4C40`.
 */
export function ChatGptChoiceCard({
  groups,
  submitLabel = "Xác nhận lựa chọn",
  sending = false,
  initialAnswers,
  onSubmit,
}: {
  groups: QuestionGroup[];
  submitLabel?: string;
  sending?: boolean;
  initialAnswers?: Record<number, string>;
  onSubmit: (answers: Record<number, string>) => void;
}) {
  const [answers, setAnswers] = useState<Record<number, string>>(() => {
    if (initialAnswers) return { ...initialAnswers };
    const def: Record<number, string> = {};
    groups.forEach((g, idx) => {
      if (g.options.length > 0) def[idx] = g.options[0].value;
    });
    return def;
  });

  const allAnswered = groups.length > 0 && groups.every((_, idx) => Boolean(answers[idx]));

  return (
    <div className="rounded-2xl border border-stone-200/90 bg-stone-50/80 p-4.5 sm:p-5 text-stone-900 shadow-2xs space-y-4 my-2.5 animate-in fade-in duration-200">
      {groups.map((group, gIdx) => (
        <div key={group.id || gIdx} className="space-y-2">
          {group.title ? (
            <p className="text-[13.5px] sm:text-sm font-bold text-stone-900 tracking-tight">
              {groups.length > 1 ? `${gIdx + 1}. ` : ""}
              {group.title}
            </p>
          ) : null}

          <div className="space-y-1">
            {group.options.map((opt) => {
              const isSelected = answers[gIdx] === opt.value;
              return (
                <label
                  key={opt.value}
                  onClick={() => setAnswers((prev) => ({ ...prev, [gIdx]: opt.value }))}
                  className={`flex items-center justify-between gap-3 cursor-pointer py-2 px-2.5 rounded-xl transition select-none ${
                    isSelected
                      ? "bg-white shadow-2xs ring-1 ring-[#1C4C40]/25 text-[#1C4C40]"
                      : "hover:bg-white/60 text-stone-700"
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {/* Custom Radio Button chuẩn ChatGPT nhưng phối màu Aloha */}
                    <div
                      className={`h-4.5 w-4.5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${
                        isSelected ? "border-[#1C4C40] bg-white" : "border-stone-300 bg-white"
                      }`}
                    >
                      {isSelected ? <div className="h-2 w-2 rounded-full bg-[#1C4C40]" /> : null}
                    </div>

                    <div className="flex flex-wrap items-baseline gap-1.5 min-w-0">
                      <span
                        className={`text-[13.5px] leading-relaxed transition-colors ${
                          isSelected ? "font-bold text-[#1C4C40]" : "font-medium text-stone-800"
                        }`}
                      >
                        {opt.label}
                      </span>
                      {opt.hint ? <span className="text-[11px] text-stone-400 italic">({opt.hint})</span> : null}
                    </div>
                  </div>

                  {opt.badge ? (
                    <span className="rounded-full bg-emerald-100/80 px-2 py-0.5 text-[10px] font-bold text-[#1C4C40] shrink-0">
                      {opt.badge}
                    </span>
                  ) : null}
                </label>
              );
            })}
          </div>

          {gIdx < groups.length - 1 ? <div className="border-t border-stone-200/80 my-3" /> : null}
        </div>
      ))}

      <button
        type="button"
        disabled={sending || !allAnswered}
        onClick={() => {
          if (allAnswered) onSubmit(answers);
        }}
        className="w-full rounded-full bg-[#1C4C40] py-2.5 px-4 text-center text-xs sm:text-sm font-bold text-white shadow-sm hover:bg-[#163c32] active:scale-[0.99] transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed mt-2"
      >
        {submitLabel}
      </button>
    </div>
  );
}
