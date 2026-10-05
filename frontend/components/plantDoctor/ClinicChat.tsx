"use client";

import { useEffect, useRef } from "react";
import { Camera, ImagePlus, Loader2, Send, Sparkles, Square, Stethoscope, Volume2, X } from "lucide-react";
import type { DoctorImage, DoctorMessage } from "@/lib/plantDoctor/api";
import { SYMPTOM_PRESETS } from "@/lib/plantDoctor/presets";
import { AiText } from "./AiText";
import { SuggestedProducts } from "./SuggestedProducts";

export const MAX_IMAGES = 4;

const SYMPTOM_ICONS: Record<string, string> = {
  rep: "🐛",
  rot: "💧",
  long: "🌿",
  shock: "☀️",
};

const SEVERITY_STYLES = {
  high: "bg-rose-50 text-rose-700 border-rose-200/60",
  warning: "bg-amber-50 text-amber-800 border-amber-200/60",
  info: "bg-sky-50 text-sky-700 border-sky-200/60",
};

function MessageBubble({
  m,
  speaking,
  onSpeak,
}: {
  m: DoctorMessage;
  speaking: boolean;
  onSpeak: (m: DoctorMessage) => void;
}) {
  if (m.role === "user") {
    return (
      <div className="flex justify-end animate-in fade-in slide-in-from-bottom-2 duration-200">
        <div className="max-w-[85%] sm:max-w-[80%] rounded-2xl rounded-br-xs bg-[#1C4C40] px-4 py-3 text-sm text-white shadow-sm space-y-2">
          {m.images?.length ? (
            <div className="flex flex-wrap gap-2">
              {m.images.map((src, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={i}
                  src={src}
                  alt="Ảnh cây đã gửi"
                  className="h-20 w-20 sm:h-24 sm:w-24 rounded-xl object-cover ring-1 ring-white/20 shadow-xs"
                />
              ))}
            </div>
          ) : null}
          <div className="whitespace-pre-line leading-relaxed font-medium">
            <AiText text={m.content} />
          </div>
          <p className="text-right text-[10px] text-white/60">{m.time}</p>
        </div>
      </div>
    );
  }
  return (
    <div className="flex gap-2.5 sm:gap-3 items-start animate-in fade-in slide-in-from-bottom-2 duration-200">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-[#1C4C40] text-white shadow-2xs mt-0.5">
        <Stethoscope size={18} strokeWidth={2.2} aria-hidden />
      </div>
      <div className="min-w-0 max-w-[94%] flex-1 space-y-2">
        <div className="rounded-2xl rounded-tl-xs border border-stone-200/90 bg-white p-4 sm:p-5 text-sm leading-relaxed text-stone-800 shadow-sm space-y-2.5">
          {/* Header Bác Sĩ */}
          <div className="flex items-center justify-between border-b border-stone-100 pb-2.5">
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-[#1C4C40] text-xs sm:text-sm">Bác sĩ cây cảnh Aloha</span>
              <span className="rounded-full bg-emerald-100 text-emerald-800 px-2 py-0.2 text-[9.5px] font-bold">
                AI Chuyên Gia
              </span>
            </div>
            {m.id !== "welcome" ? (
              <button
                type="button"
                onClick={() => onSpeak(m)}
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold transition cursor-pointer ${
                  speaking
                    ? "bg-rose-100 text-rose-700 ring-1 ring-rose-200 animate-pulse"
                    : "bg-emerald-50 text-[#1C4C40] hover:bg-emerald-100 ring-1 ring-emerald-200/60"
                }`}
              >
                {speaking ? <Square size={11} aria-hidden /> : <Volume2 size={12} aria-hidden />}
                <span>{speaking ? "Dừng đọc" : "Nghe đọc"}</span>
              </button>
            ) : null}
          </div>

          <div className="text-stone-700 leading-relaxed">
            <AiText text={m.content} />
          </div>

          <div className="flex items-center justify-end text-[10px] text-stone-400 pt-1">
            <span>{m.time}</span>
          </div>
        </div>
        {m.suggest?.length ? <SuggestedProducts keywords={m.suggest} /> : null}
      </div>
    </div>
  );
}

export function ClinicChat({
  messages,
  sending,
  input,
  setInput,
  images,
  onPickFiles,
  onRemoveImage,
  onSend,
  onQuickSymptom,
  speakingId,
  onSpeak,
}: {
  messages: DoctorMessage[];
  sending: boolean;
  input: string;
  setInput: (v: string) => void;
  images: DoctorImage[];
  onPickFiles: (files: FileList | File[]) => void;
  onRemoveImage: (id: string) => void;
  onSend: () => void;
  onQuickSymptom: (prompt: string) => void;
  speakingId: string | null;
  onSpeak: (m: DoctorMessage) => void;
}) {
  const listRef = useRef<HTMLDivElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length, sending]);

  const canSend = !sending && (input.trim().length > 0 || images.length > 0);
  const full = images.length >= MAX_IMAGES;

  return (
    <div className="flex min-h-[560px] flex-col overflow-hidden rounded-3xl border border-stone-200/90 bg-[#FAF9F6] shadow-sm">
      <div ref={listRef} className="flex-1 space-y-4 overflow-y-auto p-3.5 sm:p-5" style={{ maxHeight: "64vh" }}>
        {/* Vùng chẩn đoán trọng tâm (Action-First Hero) khi mới mở trang */}
        {messages.length <= 1 && (
          <div className="rounded-2xl border-2 border-dashed border-[#1C4C40]/25 bg-gradient-to-b from-emerald-50/70 via-white to-white p-4 sm:p-6 text-center transition hover:border-[#1C4C40]/50 shadow-2xs">
            <div className="mx-auto flex h-13 w-13 items-center justify-center rounded-2xl bg-[#1C4C40] text-white shadow-md">
              <Camera size={24} strokeWidth={2.2} />
            </div>
            <h3 className="mt-3 text-base sm:text-lg font-bold text-[#1C4C40]">
              Chụp hoặc Tải lên ảnh cây đang bệnh
            </h3>
            <p className="mx-auto mt-1 max-w-lg text-xs sm:text-sm text-stone-600 leading-relaxed">
              Chụp cận cảnh vết lá úng, đốm trắng, rệp hoặc toàn thân chậu cây để Bác sĩ AI chẩn đoán chính xác trong 3 giây.
            </p>

            <div className="mt-4 flex flex-wrap justify-center gap-2.5">
              <button
                type="button"
                onClick={() => cameraRef.current?.click()}
                className="inline-flex items-center gap-2 rounded-xl bg-[#1C4C40] hover:bg-[#163c32] active:scale-95 px-5 py-2.5 text-xs sm:text-sm font-bold text-white shadow-xs transition cursor-pointer"
              >
                <Camera size={16} />
                Chụp ảnh cây ngay
              </button>
              <button
                type="button"
                onClick={() => galleryRef.current?.click()}
                className="inline-flex items-center gap-2 rounded-xl border border-stone-300 bg-white hover:bg-stone-50 active:scale-95 px-5 py-2.5 text-xs sm:text-sm font-bold text-stone-700 shadow-2xs transition cursor-pointer"
              >
                <ImagePlus size={16} className="text-[#1C4C40]" />
                Chọn ảnh từ máy
              </button>
            </div>

            <p className="mt-2.5 text-[11px] text-stone-400">
              💡 Hỗ trợ tối đa 4 ảnh JPG, PNG · Hệ thống tự động tối ưu hóa dung lượng
            </p>

            {/* Triệu chứng thường gặp được nhúng TRỰC TIẾP vào Hero - KHÔNG tách rời thành cột khác */}
            <div className="mt-5 border-t border-emerald-100/90 pt-4 text-left">
              <div className="mb-2.5 flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-xs font-bold text-stone-700">
                  <Sparkles size={13} className="text-emerald-700" />
                  <span>Hoặc bấm khám nhanh theo triệu chứng phổ biến:</span>
                </span>
                <span className="rounded-full bg-emerald-100/80 px-2 py-0.5 text-[10px] font-bold text-[#1C4C40]">
                  1-Chạm khám ngay
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                {SYMPTOM_PRESETS.map((p) => {
                  const icon = SYMPTOM_ICONS[p.id] || "🌱";
                  const badgeTone = SEVERITY_STYLES[p.severity] || "bg-stone-50 text-stone-700";
                  return (
                    <button
                      key={p.id}
                      type="button"
                      disabled={sending}
                      onClick={() => onQuickSymptom(p.prompt)}
                      className="group flex flex-col justify-between rounded-xl border border-stone-200/90 bg-white p-3 text-left transition hover:border-[#1C4C40] hover:bg-emerald-50/40 hover:shadow-2xs active:scale-[0.98] disabled:opacity-50 cursor-pointer"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-1 mb-1">
                          <span className="text-base select-none" aria-hidden>{icon}</span>
                          <span className={`rounded px-1.5 py-0.2 text-[9.5px] font-bold border ${badgeTone}`}>
                            {p.label}
                          </span>
                        </div>
                        <p className="text-xs font-bold text-stone-800 group-hover:text-[#1C4C40] transition">
                          {p.name}
                        </p>
                        <p className="mt-1 line-clamp-2 text-[11px] text-stone-500 leading-tight">
                          {p.description}
                        </p>
                      </div>
                      <div className="mt-2.5 flex items-center justify-end text-[10.5px] font-bold text-[#1C4C40] group-hover:underline">
                        <span>Khám ngay ⚡</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {messages.map((m) => (
          <MessageBubble key={m.id} m={m} speaking={speakingId === m.id} onSpeak={onSpeak} />
        ))}

        {sending ? (
          <div className="flex items-center gap-2.5 pl-11 text-xs text-stone-500 animate-pulse">
            <Loader2 size={15} className="animate-spin text-[#1C4C40]" aria-hidden />
            <span>Bác sĩ đang quan sát triệu chứng và kê đơn thuốc cho cây của bạn…</span>
          </div>
        ) : null}
      </div>

      <form
        className="border-t border-stone-200/90 bg-white p-3 sm:p-3.5"
        onSubmit={(e) => {
          e.preventDefault();
          if (canSend) onSend();
        }}
      >
        {/* Khi đã chat, hiển thị hàng chip cuộn ngang nhỏ gọn để hỏi thêm nhanh */}
        {messages.length > 1 && (
          <div className="mb-2 flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 px-0.5">
            <span className="shrink-0 text-[11px] font-bold text-stone-400">Khám nhanh:</span>
            {SYMPTOM_PRESETS.map((p) => {
              const icon = SYMPTOM_ICONS[p.id] || "🌱";
              return (
                <button
                  key={p.id}
                  type="button"
                  disabled={sending}
                  onClick={() => onQuickSymptom(p.prompt)}
                  className="shrink-0 inline-flex items-center gap-1 rounded-full border border-stone-200/90 bg-[#FAF9F6] px-2.5 py-1 text-[11px] font-medium text-stone-600 hover:border-[#1C4C40] hover:bg-emerald-50 hover:text-[#1C4C40] transition cursor-pointer disabled:opacity-50"
                >
                  <span>{icon}</span>
                  <span>{p.name}</span>
                </button>
              );
            })}
          </div>
        )}
        {images.length ? (
          <div className="mb-2.5 flex flex-wrap items-center gap-2 rounded-xl bg-stone-50 p-2 border border-stone-200/60">
            {images.map((img) => (
              <div key={img.id} className="relative group">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img.previewUrl} alt="Ảnh sẽ gửi" className="h-16 w-16 rounded-xl object-cover ring-1 ring-stone-200 shadow-2xs" />
                <button
                  type="button"
                  onClick={() => onRemoveImage(img.id)}
                  className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-rose-600 text-white shadow-xs hover:bg-rose-700 transition cursor-pointer"
                  aria-label="Bỏ ảnh"
                >
                  <X size={12} aria-hidden />
                </button>
              </div>
            ))}
            <span className="text-xs text-stone-500 font-medium ml-1">
              {images.length}/{MAX_IMAGES} ảnh đã đính kèm
            </span>
          </div>
        ) : null}

        <div className="flex items-end gap-2">
          <input ref={cameraRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => {
            if (e.target.files) onPickFiles(e.target.files);
            e.target.value = "";
          }} />
          <input ref={galleryRef} type="file" accept="image/*" multiple hidden onChange={(e) => {
            if (e.target.files) onPickFiles(e.target.files);
            e.target.value = "";
          }} />
          <button
            type="button"
            disabled={full}
            onClick={() => cameraRef.current?.click()}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-[#1C4C40] hover:bg-emerald-100 disabled:opacity-40 shadow-2xs transition cursor-pointer"
            aria-label="Chụp ảnh cây"
            title="Chụp ảnh"
          >
            <Camera size={20} aria-hidden />
          </button>
          <button
            type="button"
            disabled={full}
            onClick={() => galleryRef.current?.click()}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-[#1C4C40] hover:bg-emerald-100 disabled:opacity-40 shadow-2xs transition cursor-pointer"
            aria-label="Chọn ảnh từ máy"
            title={`Chọn ảnh (tối đa ${MAX_IMAGES})`}
          >
            <ImagePlus size={20} aria-hidden />
          </button>

          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onPaste={(e) => {
              const files = [...(e.clipboardData?.files || [])].filter((f) => f.type.startsWith("image/"));
              if (files.length) {
                e.preventDefault();
                onPickFiles(files);
              }
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                if (canSend) onSend();
              }
            }}
            rows={1}
            maxLength={2000}
            placeholder="Mô tả thêm tình trạng (lá úng, rệp trắng, rụng lá...)"
            className="max-h-32 min-h-11 flex-1 resize-none rounded-2xl border border-stone-200/90 bg-[#FAF9F6] px-4 py-2.5 text-sm outline-none focus:border-[#1C4C40] focus:ring-2 focus:ring-[#1C4C40]/15 transition"
          />

          <button
            type="submit"
            disabled={!canSend}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#1C4C40] text-white shadow-sm hover:bg-[#163c32] active:scale-95 disabled:opacity-40 transition cursor-pointer"
            aria-label="Gửi cho bác sĩ"
            title="Gửi câu hỏi"
          >
            {sending ? <Loader2 size={18} className="animate-spin" aria-hidden /> : <Send size={18} aria-hidden />}
          </button>
        </div>
      </form>
    </div>
  );
}
