"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowUp,
  Camera,
  ImagePlus,
  Loader2,
  Sparkles,
  Square,
  Stethoscope,
  Volume2,
  X,
} from "lucide-react";
import type { DoctorImage, DoctorMessage, PlantCandidate } from "@/lib/plantDoctor/api";
import { SYMPTOM_PRESETS } from "@/lib/plantDoctor/presets";
import { AiText } from "./AiText";
import { CareKit } from "./CareKit";
import { DiagnosisCard } from "./DiagnosisCard";

export const MAX_IMAGES = 4;

const SYMPTOM_ICONS: Record<string, string> = {
  rep: "🐛",
  rot: "💧",
  long: "🌿",
  shock: "☀️",
};

function MessageBubble({
  m,
  speaking,
  onSpeak,
  latest,
  sending,
  onAnswer,
  onPickPlant,
}: {
  m: DoctorMessage;
  speaking: boolean;
  onSpeak: (m: DoctorMessage) => void;
  latest: boolean;
  sending: boolean;
  onAnswer: (text: string) => void;
  onPickPlant: (c: PlantCandidate) => void;
}) {
  if (m.role === "user") {
    return (
      <div className="flex justify-end animate-in fade-in slide-in-from-bottom-2 duration-200">
        <div className="max-w-[88%] sm:max-w-[80%] rounded-2xl sm:rounded-3xl rounded-br-xs sm:rounded-br-xs bg-[#1C4C40] px-4 py-3 sm:px-5 sm:py-3.5 text-white shadow-sm space-y-2.5">
          {m.images?.length ? (
            <div className="flex flex-wrap gap-2">
              {m.images.map((src, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={i}
                  src={src}
                  alt="Ảnh cây đã gửi"
                  className="h-24 w-24 sm:h-32 sm:w-32 rounded-xl sm:rounded-2xl object-cover ring-1 ring-white/20 shadow-xs"
                />
              ))}
            </div>
          ) : null}
          <div className="whitespace-pre-line leading-relaxed text-[14.5px] sm:text-[15.5px] font-medium">
            <AiText text={m.content} />
          </div>
          <p className="text-right text-[10px] text-white/70">{m.time}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-2.5 sm:gap-3.5 items-start animate-in fade-in slide-in-from-bottom-2 duration-200">
      <div className="flex h-8 w-8 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-xl bg-[#1C4C40] text-white shadow-2xs mt-0.5 ring-2 ring-emerald-50">
        <Stethoscope size={17} strokeWidth={2.2} aria-hidden />
      </div>
      <div className="min-w-0 max-w-[94%] flex-1 space-y-2.5">
        <div className="rounded-2xl sm:rounded-3xl bg-white p-4 sm:p-5 text-[14.5px] sm:text-[15.5px] leading-relaxed text-stone-800 shadow-2xs border border-stone-200/60 space-y-3">
          {/* Header Bác Sĩ */}
          <div className="flex items-center justify-between border-b border-stone-100 pb-2.5">
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-[#1C4C40] text-xs sm:text-sm">Bác sĩ cây cảnh Aloha</span>
              <span className="rounded-full bg-emerald-100 text-emerald-800 px-2 py-0.2 text-[9.5px] font-bold">
                Trợ lý AI
              </span>
            </div>
            {m.id !== "welcome" ? (
              <button
                type="button"
                onClick={() => onSpeak(m)}
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold transition cursor-pointer ${
                  speaking
                    ? "bg-rose-100 text-rose-700 ring-1 ring-rose-200 animate-pulse"
                    : "bg-stone-100 text-stone-600 hover:bg-emerald-50 hover:text-[#1C4C40] ring-1 ring-stone-200/60"
                }`}
              >
                {speaking ? <Square size={11} aria-hidden /> : <Volume2 size={12} aria-hidden />}
                <span>{speaking ? "Dừng đọc" : "Nghe đọc"}</span>
              </button>
            ) : null}
          </div>

          <div className="text-stone-700 leading-relaxed">
            {m.card ? (
              <DiagnosisCard card={m.card} interactive={latest} sending={sending} onAnswer={onAnswer} onPickPlant={onPickPlant} />
            ) : (
              <AiText text={m.content} />
            )}
          </div>

          <div className="flex items-center justify-end text-[10px] text-stone-400 pt-1">
            <span>{m.time}</span>
          </div>
        </div>
        {m.card && (m.card.kind === "diagnosis" || m.card.kind === "healthy") ? (
          <CareKit condition={m.card.condition} plantGroup={m.card.plantGroup} />
        ) : null}
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
  onPickPlant,
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
  onPickPlant: (c: PlantCandidate) => void;
  speakingId: string | null;
  onSpeak: (m: DoctorMessage) => void;
}) {
  const listRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Lọc bỏ tin nhắn welcome kỹ thuật để giao diện khởi đầu tinh gọn tuyệt đối như Google Gemini
  const chatMessages = messages.filter((m) => m.id !== "welcome");
  const isInitial = chatMessages.length === 0;

  // Ref chống kích hoạt trùng lặp sự kiện dán ảnh
  const lastPasteTimeRef = useRef<number>(0);

  // Lắng nghe phím tắt Ctrl + V dán ảnh DUY NHẤT 1 LẦN (triệt tiêu tình trạng nhân 3 do event bubbling)
  useEffect(() => {
    const handleGlobalPaste = (e: ClipboardEvent) => {
      const clipboardData = e.clipboardData;
      if (!clipboardData) return;

      const rawFiles: File[] = [];

      // 1. Quét clipboardData.items (chụp màn hình Win+Shift+S, copy ảnh từ trình duyệt)
      if (clipboardData.items) {
        for (let i = 0; i < clipboardData.items.length; i++) {
          const item = clipboardData.items[i];
          if (item.type.startsWith("image/")) {
            const file = item.getAsFile();
            if (file) rawFiles.push(file);
          }
        }
      }

      // 2. Quét clipboardData.files (copy file ảnh từ File Explorer)
      if (rawFiles.length === 0 && clipboardData.files?.length) {
        for (let i = 0; i < clipboardData.files.length; i++) {
          const f = clipboardData.files[i];
          if (f.type.startsWith("image/")) rawFiles.push(f);
        }
      }

      if (rawFiles.length === 0) return;

      // Chặn tình trạng trình duyệt kích hoạt paste nhiều lần trong khoảng < 500ms
      const now = Date.now();
      if (now - lastPasteTimeRef.current < 500) {
        e.preventDefault();
        return;
      }
      lastPasteTimeRef.current = now;

      // Lọc trùng lặp file ảnh trong cùng một lần dán
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
        textareaRef.current?.focus();
      }
    };

    window.addEventListener("paste", handleGlobalPaste, true);
    return () => {
      window.removeEventListener("paste", handleGlobalPaste, true);
    };
  }, [onPickFiles]);

  // Cuộn tự động khi có tin nhắn mới trong chế độ chat
  useEffect(() => {
    if (!isInitial) {
      const el = listRef.current;
      if (el) {
        el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
      }
    }
  }, [chatMessages.length, sending, isInitial]);

  // Tự động co giãn textarea theo nội dung gõ
  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  };

  useEffect(() => {
    if (!input && textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }, [input]);

  const canSend = !sending && (input.trim().length > 0 || images.length > 0);
  const full = images.length >= MAX_IMAGES;

  return (
    <div
      tabIndex={0}
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={(e) => {
        e.preventDefault();
        setIsDragging(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragging(false);
        if (e.dataTransfer.files?.length) {
          onPickFiles(e.dataTransfer.files);
        }
      }}
      className="flex flex-1 flex-col min-h-0 relative w-full h-full bg-[#FAF9F6] overflow-hidden outline-none"
    >
      {/* File input ẩn cho camera và thư viện ảnh */}
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={(e) => {
          if (e.target.files) onPickFiles(e.target.files);
          e.target.value = "";
        }}
      />
      <input
        ref={galleryRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => {
          if (e.target.files) onPickFiles(e.target.files);
          e.target.value = "";
        }}
      />

      {/* Overlay kéo thả ảnh chuẩn desktop AI app */}
      {isDragging ? (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-white/85 backdrop-blur-md border-2 border-dashed border-[#1C4C40] p-6 text-center animate-in fade-in duration-150">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#1C4C40] text-white shadow-lg mb-3">
            <Camera size={28} />
          </div>
          <h4 className="text-lg font-bold text-[#1C4C40]">Thả ảnh vào đây</h4>
          <p className="text-sm text-stone-600 mt-1">Bác sĩ AI sẽ tiếp nhận ảnh và tiến hành chẩn đoán</p>
        </div>
      ) : null}

      {/* VÙNG CUỘN NỘI DUNG (SCROLLABLE CONTENT AREA): CHỨA LỜI CHÀO / TIN NHẮN, CUỘN ĐỘC LẬP */}
      <div
        ref={listRef}
        className="flex-1 overflow-y-auto px-3.5 sm:px-6 min-h-0 relative w-full scroll-smooth"
      >
        {isInitial ? (
          /* TRANG CHÀO ĐẦU GEMINI: Nằm cân đối trong vùng cuộn phía trên ô chat */
          <div className="flex flex-col items-center justify-center min-h-full py-6 sm:py-10 max-w-2xl mx-auto w-full animate-in fade-in duration-200">
            {/* Lời chào & Logo trung tâm */}
            <div className="text-center mb-5 sm:mb-7">
              <div className="mx-auto flex h-13 w-13 sm:h-15 sm:w-15 items-center justify-center rounded-2xl bg-gradient-to-br from-[#1C4C40] to-[#286b5b] text-white shadow-md ring-4 ring-emerald-50 mb-3">
                <Stethoscope size={26} strokeWidth={2.2} />
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-stone-900 tracking-tight">
                Bác sĩ cây cảnh Aloha
              </h2>
              <p className="mt-1.5 text-xs sm:text-sm text-stone-500 max-w-md mx-auto leading-relaxed px-2">
                Chụp ảnh cây hoặc chọn triệu chứng thường gặp để Bác sĩ AI chẩn đoán và hướng dẫn điều trị trong 3 giây.
              </p>
            </div>

            {/* Gợi ý khám nhanh 1 chạm (Tối giản chuẩn Google Gemini) */}
            <div className="w-full">
              <p className="text-[11px] font-bold text-stone-400 mb-2.5 px-1 flex items-center justify-center gap-1">
                <Sparkles size={11} className="text-emerald-700" />
                <span>Gợi ý khám nhanh triệu chứng phổ biến:</span>
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {SYMPTOM_PRESETS.map((p) => {
                  const icon = SYMPTOM_ICONS[p.id] || "🌱";
                  return (
                    <button
                      key={p.id}
                      type="button"
                      disabled={sending}
                      onClick={() => onQuickSymptom(p.prompt)}
                      className="group flex flex-col sm:flex-row items-start sm:items-center gap-1.5 sm:gap-2 rounded-xl border border-stone-200/90 bg-white p-2.5 text-left shadow-2xs hover:border-[#1C4C40] hover:bg-emerald-50/60 transition cursor-pointer disabled:opacity-50 min-w-0"
                    >
                      <span className="text-lg shrink-0 select-none">{icon}</span>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-stone-800 group-hover:text-[#1C4C40] truncate">
                          {p.name}
                        </p>
                        <p className="text-[10px] text-stone-400 truncate">{p.label}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          /* DANH SÁCH TIN NHẮN KHI ĐÃ CÓ HỘI THOẠI */
          <div className="mx-auto max-w-3xl space-y-5 pt-4 pb-4">
            {chatMessages.map((m, i) => (
              <MessageBubble
                key={m.id}
                m={m}
                speaking={speakingId === m.id}
                onSpeak={onSpeak}
                latest={i === chatMessages.length - 1}
                sending={sending}
                onAnswer={onQuickSymptom}
                onPickPlant={onPickPlant}
              />
            ))}

            {sending ? (
              <div className="flex items-center gap-2.5 pl-11 text-xs text-stone-500 animate-pulse">
                <Loader2 size={16} className="animate-spin text-[#1C4C40]" />
                <span>Bác sĩ đang nhận diện cây và xem triệu chứng…</span>
              </div>
            ) : null}
          </div>
        )}
      </div>

      {/* THANH NHẬP LIỆU CỐ ĐỊNH Ở ĐÁY (FIXED DOCKED BOTTOM CAPSULE CHUẨN GOOGLE GEMINI) */}
      {/* Nằm mặc định một chỗ duy nhất, không bao giờ bị cuộn trôi khi kéo lên kéo xuống */}
      <div className="shrink-0 z-20 pb-3 pt-2 bg-gradient-to-t from-[#FAF9F6] via-[#FAF9F6]/95 to-transparent px-3.5 sm:px-6 w-full">
        <div className="mx-auto max-w-3xl w-full space-y-2">
          {/* Ảnh đính kèm chờ gửi (nếu có) */}
          {images.length ? (
            <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-white p-2 border border-stone-200/80 shadow-xs">
              {images.map((img) => (
                <div key={img.id} className="relative group">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={img.previewUrl}
                    alt="Ảnh sẽ gửi"
                    className="h-14 w-14 rounded-xl object-cover ring-1 ring-stone-200 shadow-2xs"
                  />
                  <button
                    type="button"
                    onClick={() => onRemoveImage(img.id)}
                    className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-rose-600 text-white shadow-xs hover:bg-rose-700 transition cursor-pointer"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
              <span className="text-xs text-stone-500 font-medium ml-1">
                {images.length}/{MAX_IMAGES} ảnh đã đính kèm
              </span>
            </div>
          ) : null}

          {/* Hàng chip cuộn ngang hỏi tiếp trong chế độ hội thoại */}
          {!isInitial ? (
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 px-0.5">
              <span className="shrink-0 text-[11px] font-bold text-stone-400">Hỏi tiếp:</span>
              {SYMPTOM_PRESETS.map((p) => {
                const icon = SYMPTOM_ICONS[p.id] || "🌱";
                return (
                  <button
                    key={p.id}
                    type="button"
                    disabled={sending}
                    onClick={() => onQuickSymptom(p.prompt)}
                    className="shrink-0 inline-flex items-center gap-1 rounded-full border border-stone-200/90 bg-white/90 px-3 py-1 text-[11.5px] font-medium text-stone-700 shadow-2xs hover:border-[#1C4C40] hover:bg-emerald-50 hover:text-[#1C4C40] transition cursor-pointer disabled:opacity-50"
                  >
                    <span>{icon}</span>
                    <span>{p.name}</span>
                  </button>
                );
              })}
            </div>
          ) : null}

          {/* The Gemini Capsule Bar - Ô chat nằm mặc định 1 chỗ ở đáy */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (canSend) onSend();
            }}
            className="relative flex items-center gap-1.5 sm:gap-2 rounded-2xl sm:rounded-3xl border border-stone-300 bg-white p-1.5 sm:p-2 shadow-md transition focus-within:border-[#1C4C40] focus-within:ring-2 focus-within:ring-[#1C4C40]/15"
          >
            {/* Nút chụp ảnh / chọn ảnh */}
            <div className="flex items-center gap-0.5 shrink-0 pl-1">
              <button
                type="button"
                onClick={() => cameraRef.current?.click()}
                disabled={full}
                className="flex h-9 w-9 items-center justify-center rounded-full text-stone-500 hover:text-[#1C4C40] hover:bg-emerald-50 transition cursor-pointer disabled:opacity-40"
                title="Chụp ảnh cây ngay"
              >
                <Camera size={19} />
              </button>
              <button
                type="button"
                onClick={() => galleryRef.current?.click()}
                disabled={full}
                className="flex h-9 w-9 items-center justify-center rounded-full text-stone-500 hover:text-[#1C4C40] hover:bg-emerald-50 transition cursor-pointer disabled:opacity-40"
                title="Chọn ảnh từ máy"
              >
                <ImagePlus size={19} />
              </button>
            </div>

            {/* Ô gõ câu hỏi & nhận dán ảnh trực tiếp Ctrl+V */}
            <textarea
              ref={textareaRef}
              value={input}
              rows={1}
              onChange={handleTextChange}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  if (canSend) onSend();
                }
              }}
              placeholder="Hỏi Bác sĩ cây cảnh hoặc dán ảnh cây (Ctrl + V)..."
              className="w-full flex-1 border-0 bg-transparent py-1.5 px-2 text-[14.5px] sm:text-[15px] text-stone-800 placeholder-stone-400 outline-none focus:outline-none resize-none max-h-32 leading-relaxed"
            />

            {/* Nút gửi */}
            <button
              type="submit"
              disabled={!canSend}
              className={`flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-full transition ${
                canSend
                  ? "bg-[#1C4C40] text-white shadow-sm hover:bg-[#163c32] active:scale-95 cursor-pointer"
                  : "bg-stone-100 text-stone-300 cursor-not-allowed"
              }`}
              title="Gửi câu hỏi"
            >
              <ArrowUp size={18} strokeWidth={2.5} />
            </button>
          </form>

          <p className="text-center text-[10.5px] sm:text-[11px] text-stone-400 select-none leading-relaxed">
            <span>Dán ảnh (Ctrl + V) · Kéo thả · Chụp ảnh trực tiếp</span>
            <span className="hidden sm:inline"> · Aloha AI có thể mắc lỗi. Với ca nguy kịch, liên hệ Hotline Zalo nhà vườn.</span>
          </p>
        </div>
      </div>
    </div>
  );
}
