"use client";

import { useEffect, useRef } from "react";
import { ArrowLeft, ArrowRight, CheckCircle2, ImagePlus, Loader2, Sparkles } from "lucide-react";
import type { DoctorImage, PlantCandidate } from "@/lib/plantDoctor/api";
import { GUIDED_QUESTIONS, type GUIDED_DEFAULTS } from "@/lib/plantDoctor/presets";

export type GuidedState = {
  step: 0 | 1 | 2;
  plants: PlantCandidate[];
  identified: boolean;
  /** Chỉ số trong `plants`, hoặc "unknown" / "custom". */
  choice: string;
  custom: string;
  answers: typeof GUIDED_DEFAULTS;
};

const STEPS = [
  { step: 0, title: "Chụp ảnh cây", desc: "AI nhận diện" },
  { step: 1, title: "Xác nhận loài cây", desc: "Tên cây" },
  { step: 2, title: "Khảo sát nhanh", desc: "3 thông số" },
] as const;

/** Chế độ hỏi từng bước chuẩn phòng khám cây cảnh hiện đại (như PictureThis / Bloomscape). */
export function GuidedWizard({
  state,
  setState,
  images,
  identifying,
  sending,
  onPickFiles,
  onSubmit,
}: {
  state: GuidedState;
  setState: (s: GuidedState) => void;
  images: DoctorImage[];
  identifying: boolean;
  sending: boolean;
  onPickFiles: (files: FileList | File[]) => void;
  onSubmit: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const go = (step: GuidedState["step"]) => setState({ ...state, step });

  const lastPasteTimeRef = useRef<number>(0);

  // Hỗ trợ dán ảnh qua phím tắt Ctrl + V ở bước tải ảnh
  useEffect(() => {
    if (state.step !== 0) return;
    const handlePaste = (e: ClipboardEvent) => {
      const clipboardData = e.clipboardData;
      if (!clipboardData) return;
      const rawFiles: File[] = [];
      if (clipboardData.items) {
        for (let i = 0; i < clipboardData.items.length; i++) {
          const item = clipboardData.items[i];
          if (item.type.startsWith("image/")) {
            const file = item.getAsFile();
            if (file) rawFiles.push(file);
          }
        }
      }
      if (rawFiles.length === 0 && clipboardData.files?.length) {
        for (let i = 0; i < clipboardData.files.length; i++) {
          const f = clipboardData.files[i];
          if (f.type.startsWith("image/")) rawFiles.push(f);
        }
      }
      if (rawFiles.length === 0) return;

      const now = Date.now();
      if (now - lastPasteTimeRef.current < 500) {
        e.preventDefault();
        return;
      }
      lastPasteTimeRef.current = now;

      const uniqueFiles: File[] = [];
      const seen = new Set<string>();
      for (const f of rawFiles) {
        const key = `${f.name}_${f.size}_${f.type}`;
        if (!seen.has(key)) {
          seen.add(key);
          uniqueFiles.push(f);
        }
      }

      if (uniqueFiles.length > 0) {
        e.preventDefault();
        e.stopImmediatePropagation();
        onPickFiles(uniqueFiles);
      }
    };

    window.addEventListener("paste", handlePaste, true);
    return () => window.removeEventListener("paste", handlePaste, true);
  }, [state.step, onPickFiles]);
  const plantOptions = [
    ...state.plants.map((p, i) => ({ id: String(i), label: p.name, hint: p.scientificName, score: p.score as number | null })),
    { id: "unknown", label: "Tôi không rõ là cây gì", hint: "", score: null },
    { id: "custom", label: "Cây khác (tự nhập tên)", hint: "", score: null },
  ];

  return (
    <div className="rounded-3xl border border-[#e4dcce] bg-white p-5 sm:p-7 shadow-sm">
      {/* Visual Stepper */}
      <div className="mb-6 border-b border-stone-100 pb-5">
        <div className="grid grid-cols-3 gap-2 sm:gap-4">
          {STEPS.map((s) => {
            const isDone = state.step > s.step;
            const isCurrent = state.step === s.step;
            return (
              <button
                key={s.step}
                type="button"
                onClick={() => {
                  if (s.step < state.step) go(s.step as GuidedState["step"]);
                }}
                disabled={s.step > state.step}
                className={`flex flex-col items-center text-center transition ${
                  isCurrent
                    ? "text-[#1C4C40]"
                    : isDone
                    ? "cursor-pointer text-stone-700 hover:text-[#1C4C40]"
                    : "cursor-not-allowed text-stone-300"
                }`}
              >
                <div
                  className={`mb-1.5 flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition ${
                    isCurrent
                      ? "bg-[#1C4C40] text-white shadow-sm ring-4 ring-emerald-100"
                      : isDone
                      ? "bg-emerald-100 text-[#1C4C40]"
                      : "bg-stone-100 text-stone-400"
                  }`}
                >
                  {isDone ? "✓" : s.step + 1}
                </div>
                <span className="text-[11px] sm:text-xs font-bold">{s.title}</span>
                <span className="hidden sm:inline text-[10px] text-stone-400">{s.desc}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Step 0: Upload / Take Photo */}
      {state.step === 0 ? (
        <div className="mx-auto max-w-lg space-y-4 text-center">
          <div>
            <h3 className="text-base font-bold text-stone-800">Chụp hoặc tải ảnh cây cần khám</h3>
            <p className="mt-1 text-xs text-stone-500">
              Chụp toàn thân cây và thêm một ảnh cận chỗ bị bệnh. Pl@ntNet sẽ nhận diện loài cây.
            </p>
          </div>

          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={(e) => {
              if (e.target.files) onPickFiles(e.target.files);
              e.target.value = "";
            }}
          />

          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={identifying}
            className="group relative mx-auto flex w-full flex-col items-center justify-center gap-2.5 rounded-2xl border-2 border-dashed border-emerald-300 bg-linear-to-b from-emerald-50/60 to-white px-6 py-10 text-[#1C4C40] transition hover:border-[#1C4C40] hover:bg-emerald-50/80"
          >
            {identifying ? (
              <div className="flex flex-col items-center gap-2">
                <Loader2 size={32} className="animate-spin text-[#1C4C40]" aria-hidden />
                <span className="text-sm font-bold text-[#1C4C40]">Đang quét và nhận diện loài cây…</span>
              </div>
            ) : (
              <>
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-[#1C4C40] group-hover:scale-110 transition-transform">
                  <ImagePlus size={24} aria-hidden />
                </div>
                <div className="text-center">
                  <span className="block text-sm font-bold">Bấm để chọn, chụp hoặc dán ảnh (Ctrl + V)</span>
                  <span className="block text-[11px] text-stone-500 mt-0.5">Hỗ trợ tối đa 4 ảnh JPG, PNG</span>
                </div>
              </>
            )}
          </button>

          {images.length ? (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-stone-600">Đã chọn {images.length} ảnh:</p>
              <div className="flex flex-wrap justify-center gap-2">
                {images.map((img) => (
                  <div key={img.id} className="relative h-16 w-16 overflow-hidden rounded-xl border border-stone-200">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={img.previewUrl} alt="Ảnh cây đã chọn" className="h-full w-full object-cover" />
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={() => go(1)}
                className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-[#1C4C40] px-5 py-2 text-xs font-bold text-white shadow-sm hover:bg-[#235f50]"
              >
                Tiếp tục với ảnh này <ArrowRight size={14} aria-hidden />
              </button>
            </div>
          ) : (
            <div className="pt-2">
              <button
                type="button"
                onClick={() => go(1)}
                className="text-xs font-semibold text-stone-500 hover:text-stone-800 underline underline-offset-4"
              >
                Không có ảnh, tự chọn cây bằng tay →
              </button>
            </div>
          )}
        </div>
      ) : null}

      {/* Step 1: Plant Selection */}
      {state.step === 1 ? (
        <div className="mx-auto max-w-lg space-y-4">
          <div>
            <h3 className="text-base font-bold text-stone-800">Cây của bạn thuộc loại nào?</h3>
            <p className="mt-1 text-xs text-stone-500">
              Chọn đúng loài để hướng dẫn chữa và chăm sóc dành riêng cho cây đó.
            </p>
            {state.identified && !state.plants.length ? (
              <p className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800 ring-1 ring-amber-100">
                Chưa nhận ra cây trong ảnh. Bạn chọn &quot;Cây khác&quot; và nhập tên, hoặc quay lại chụp rõ cả cây.
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            {plantOptions.map((o) => {
              const isSelected = state.choice === o.id;
              return (
                <label
                  key={o.id}
                  className={`flex cursor-pointer items-center justify-between gap-3 rounded-2xl border p-3 text-sm transition ${
                    isSelected
                      ? "border-[#1C4C40] bg-emerald-50/50 text-[#1C4C40] ring-1 ring-[#1C4C40]"
                      : "border-stone-200 bg-white text-stone-700 hover:border-stone-300"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <input
                      type="radio"
                      name="plant"
                      checked={isSelected}
                      onChange={() => setState({ ...state, choice: o.id })}
                      className="accent-[#1C4C40]"
                    />
                    <span className="font-semibold">{o.label}</span>
                    {o.hint ? <em className="text-[11px] text-stone-400">{o.hint}</em> : null}
                  </div>
                  {o.score != null ? (
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-[#1C4C40]">
                      <Sparkles size={11} aria-hidden /> Pl@ntNet {Math.round(o.score * 100)}%
                    </span>
                  ) : null}
                </label>
              );
            })}
          </div>

          {state.choice === "custom" ? (
            <div className="rounded-xl border border-stone-200 bg-stone-50/50 p-3">
              <label htmlFor="custom-plant" className="block text-xs font-semibold text-stone-600 mb-1">
                Tên cây của bạn:
              </label>
              <input
                id="custom-plant"
                value={state.custom}
                onChange={(e) => setState({ ...state, custom: e.target.value })}
                maxLength={80}
                placeholder="Ví dụ: Sen đá hồng mập, Trầu bà lá xẻ, Kim tiền..."
                className="w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm outline-none focus:border-[#1C4C40] focus:ring-1 focus:ring-[#1C4C40]"
              />
            </div>
          ) : null}

          <div className="flex items-center justify-between pt-4 border-t border-stone-100">
            <button
              type="button"
              onClick={() => go(0)}
              className="inline-flex items-center gap-1 text-xs font-semibold text-stone-600 hover:text-stone-900"
            >
              <ArrowLeft size={14} aria-hidden /> Chọn lại ảnh
            </button>
            <button
              type="button"
              onClick={() => go(2)}
              className="inline-flex items-center gap-1 rounded-full bg-[#1C4C40] px-5 py-2 text-xs font-bold text-white shadow-sm hover:bg-[#235f50]"
            >
              Tiếp tục khảo sát <ArrowRight size={14} aria-hidden />
            </button>
          </div>
        </div>
      ) : null}

      {/* Step 2: 3 Questions */}
      {state.step === 2 ? (
        <div className="mx-auto max-w-lg space-y-5">
          <div>
            <h3 className="text-base font-bold text-stone-800">3 câu hỏi nhanh về tình trạng chăm sóc</h3>
            <p className="mt-1 text-xs text-stone-500">
              Chọn điều kiện thực tế gần đúng nhất để bác sĩ chẩn đoán chính xác nguyên nhân gây bệnh.
            </p>
          </div>

          <div className="space-y-4">
            {GUIDED_QUESTIONS.map((q, idx) => {
              const icons = ["💧", "☀️", "⚠️"];
              return (
                <div key={q.id} className="rounded-2xl border border-stone-200 bg-white p-3.5 shadow-2xs">
                  <span className="flex items-center gap-1.5 text-xs font-bold text-[#1C4C40] mb-2.5">
                    <span>{icons[idx] || "🌱"}</span>
                    <span>Câu {idx + 1}: {q.title}</span>
                  </span>
                  <div className="grid gap-1.5">
                    {q.options.map((o) => {
                      const isSelected = state.answers[q.id] === o.value;
                      return (
                        <button
                          key={o.value}
                          type="button"
                          onClick={() =>
                            setState({
                              ...state,
                              answers: { ...state.answers, [q.id]: o.value },
                            })
                          }
                          className={`flex items-center justify-between rounded-xl px-3 py-2 text-left text-xs transition ${
                            isSelected
                              ? "border border-[#1C4C40] bg-emerald-50 text-[#1C4C40] font-bold shadow-2xs"
                              : "border border-stone-200/80 bg-stone-50/40 text-stone-700 hover:border-stone-300 hover:bg-stone-50"
                          }`}
                        >
                          <span>{o.label}</span>
                          {isSelected ? <CheckCircle2 size={14} className="shrink-0 text-[#1C4C40]" /> : null}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-stone-100">
            <button
              type="button"
              onClick={() => go(1)}
              className="inline-flex items-center gap-1 text-xs font-semibold text-stone-600 hover:text-stone-900"
            >
              <ArrowLeft size={14} aria-hidden /> Đổi loài cây
            </button>
            <button
              type="button"
              disabled={sending}
              onClick={onSubmit}
              className="inline-flex items-center gap-1.5 rounded-full bg-[#1C4C40] px-6 py-2.5 text-xs font-bold text-white shadow-md transition hover:bg-[#235f50] disabled:opacity-50"
            >
              {sending ? <Loader2 size={15} className="animate-spin" aria-hidden /> : <Sparkles size={15} aria-hidden />}
              Bắt bệnh & Kê đơn ngay ⚡
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
