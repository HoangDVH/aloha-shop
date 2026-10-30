"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Camera,
  Check,
  Copy,
  ImagePlus,
  Loader2,
  Plus,
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
  copiedId,
  onCopy,
}: {
  m: DoctorMessage;
  speaking: boolean;
  onSpeak: (m: DoctorMessage) => void;
  latest: boolean;
  sending: boolean;
  onAnswer: (text: string) => void;
  onPickPlant: (c: PlantCandidate) => void;
  copiedId: string | null;
  onCopy: (m: DoctorMessage) => void;
}) {
  if (m.role === "user") {
    return (
      <div className="flex flex-col items-end gap-2 animate-in fade-in slide-in-from-bottom-2 duration-200">
        {m.images?.length ? (
          <div className="flex flex-wrap justify-end gap-2 max-w-[90%] sm:max-w-[75%]">
            {m.images.map((src, i) => (
              <div key={i} className="relative group overflow-hidden rounded-2xl border border-stone-200/80 shadow-xs bg-white">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={src}
                  alt="Ảnh cây đã gửi"
                  className="h-28 w-28 sm:h-40 sm:w-40 object-cover transition-transform duration-200 group-hover:scale-105"
                />
              </div>
            ))}
          </div>
        ) : null}
        <div className="max-w-[88%] sm:max-w-[75%] rounded-3xl bg-[#f4f4f4] px-4.5 py-3 text-stone-900 shadow-2xs space-y-1">
          <div className="whitespace-pre-line leading-relaxed text-[14.5px] sm:text-[15px] font-normal">
            <AiText text={m.content} />
          </div>
          <p className="text-right text-[10px] text-stone-400 select-none">{m.time}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-3 sm:gap-4 items-start animate-in fade-in slide-in-from-bottom-2 duration-200 py-1">
      {/* Avatar Bác sĩ AI phong cách ChatGPT */}
      <div className="flex h-8 w-8 sm:h-8.5 sm:w-8.5 shrink-0 items-center justify-center rounded-full bg-[#1C4C40] text-white shadow-2xs mt-0.5 ring-2 ring-emerald-50">
        <Sparkles size={15} strokeWidth={2.2} aria-hidden />
      </div>

      {/* Vùng nội dung không viền hộp (Borderless ChatGPT Canvas) */}
      <div className="min-w-0 flex-1 space-y-3">
        <div className="flex items-center justify-between text-xs pb-0.5 border-b border-stone-100">
          <div className="flex items-center gap-1.5 font-bold text-stone-900">
            <span>Bác sĩ cây cảnh Aloha</span>
            <span className="rounded-full bg-emerald-50 text-emerald-800 px-2 py-0.5 text-[9.5px] font-semibold border border-emerald-200/60">
              AI Chuyên gia
            </span>
          </div>
          <span className="text-[10.5px] text-stone-400">{m.time}</span>
        </div>

        {/* Nội dung chẩn đoán */}
        <div className="text-stone-800 leading-relaxed text-[15px]">
          {m.card ? (
            <DiagnosisCard card={m.card} interactive={latest} sending={sending} onAnswer={onAnswer} onPickPlant={onPickPlant} />
          ) : (
            <AiText text={m.content} />
          )}
        </div>

        {/* Vật tư gợi ý */}
        {m.card && (m.card.kind === "diagnosis" || m.card.kind === "healthy") ? (
          <CareKit condition={m.card.condition} plantGroup={m.card.plantGroup} />
        ) : null}

        {/* ChatGPT Action Bar at bottom: Sao chép, Đọc thành tiếng */}
        {m.id !== "welcome" ? (
          <div className="flex items-center gap-1.5 pt-1 text-stone-400">
            <button
              type="button"
              onClick={() => onCopy(m)}
              className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs text-stone-500 hover:text-stone-800 hover:bg-stone-100 transition cursor-pointer"
              title="Sao chép nội dung"
            >
              {copiedId === m.id ? (
                <>
                  <Check size={13} className="text-emerald-700" />
                  <span className="text-emerald-700 text-[11px] font-medium">Đã chép</span>
                </>
              ) : (
                <>
                  <Copy size={13} />
                  <span className="text-[11px]">Sao chép</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => onSpeak(m)}
              className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs transition cursor-pointer ${
                speaking
                  ? "bg-rose-50 text-rose-700 font-medium animate-pulse"
                  : "text-stone-500 hover:text-stone-800 hover:bg-stone-100"
              }`}
              title="Đọc thành tiếng"
            >
              {speaking ? <Square size={12} /> : <Volume2 size={13} />}
              <span className="text-[11px]">{speaking ? "Dừng đọc" : "Nghe đọc"}</span>
            </button>
          </div>
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
  const latestMessageRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showScrollBottom, setShowScrollBottom] = useState(false);

  const chatMessages = messages.filter((m) => m.id !== "welcome");
  const isInitial = chatMessages.length === 0;

  const lastPasteTimeRef = useRef<number>(0);
  const prevMessagesLengthRef = useRef<number>(chatMessages.length);

  // Copy helper
  const handleCopy = (m: DoctorMessage) => {
    const textToCopy = m.content || "";
    if (!textToCopy) return;
    navigator.clipboard.writeText(textToCopy).then(() => {
      setCopiedId(m.id);
      setTimeout(() => setCopiedId(null), 2000);
    }).catch(() => null);
  };

  // Lắng nghe phím tắt Ctrl + V dán ảnh
  useEffect(() => {
    const handleGlobalPaste = (e: ClipboardEvent) => {
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
        textareaRef.current?.focus();
      }
    };

    window.addEventListener("paste", handleGlobalPaste, true);
    return () => {
      window.removeEventListener("paste", handleGlobalPaste, true);
    };
  }, [onPickFiles]);

  // Lắng nghe vị trí cuộn: hiện nút [Cuộn xuống dưới] khi cuộn lên xa đáy > 160px
  const handleScroll = () => {
    const el = listRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    setShowScrollBottom(distanceFromBottom > 160);
  };

  const scrollToBottom = () => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  };

  // Cuộn thông minh chuẩn ChatGPT:
  // 1. Khi đang gửi/chờ phân tích: cuộn xuống đáy để thấy trạng thái đang xử lý.
  // 2. Khi Bác sĩ AI trả lời xong: cuộn mượt đến ĐẦU phiếu chẩn đoán mới để người dùng đọc ngay tên bệnh & phác đồ, không bị giật xuống tận chân trang.
  useEffect(() => {
    if (isInitial) return;

    const prevLen = prevMessagesLengthRef.current;
    const currLen = chatMessages.length;
    prevMessagesLengthRef.current = currLen;

    if (currLen > prevLen) {
      const lastMsg = chatMessages[currLen - 1];
      if (lastMsg?.role === "assistant") {
        const timer = setTimeout(() => {
          latestMessageRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 60);
        return () => clearTimeout(timer);
      }
    }

    if (sending) {
      const el = listRef.current;
      if (el) {
        el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
      }
    }
  }, [chatMessages, sending, isInitial]);

  // Tự động co giãn textarea theo nội dung gõ
  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 140)}px`;
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
      className="flex flex-1 flex-col min-h-0 relative w-full h-full bg-white overflow-hidden outline-none"
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
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-white/90 backdrop-blur-md border-2 border-dashed border-[#1C4C40] p-6 text-center animate-in fade-in duration-150">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#1C4C40] text-white shadow-lg mb-3">
            <Camera size={28} />
          </div>
          <h4 className="text-lg font-bold text-[#1C4C40]">Thả ảnh vào đây</h4>
          <p className="text-sm text-stone-600 mt-1">Bác sĩ AI sẽ nhận ảnh và chẩn đoán tình trạng cây ngay</p>
        </div>
      ) : null}

      {/* VÙNG CUỘN HỘI THOẠI (CHAT STREAM CANVAS CHUẨN CHATGPT) */}
      <div
        ref={listRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-4 sm:px-6 min-h-0 relative w-full scroll-smooth"
      >
        {isInitial ? (
          /* TRANG CHÀO ĐẦU PHONG CÁCH CHATGPT */
          <div className="flex flex-col items-center justify-center min-h-full py-8 sm:py-14 max-w-2xl mx-auto w-full animate-in fade-in duration-200">
            {/* Logo trung tâm & Lời chào */}
            <div className="text-center mb-6 sm:mb-8">
              <div className="mx-auto flex h-14 w-14 sm:h-16 sm:w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-[#1C4C40] to-emerald-700 text-white shadow-md ring-4 ring-emerald-50 mb-3.5">
                <Stethoscope size={28} strokeWidth={2.2} />
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold text-stone-900 tracking-tight">
                Bác sĩ cây cảnh Aloha
              </h2>
              <p className="mt-2 text-sm text-stone-500 max-w-md mx-auto leading-relaxed px-2">
                Gửi ảnh chụp cây hoặc mô tả triệu chứng để nhận diện loài cây và phác đồ điều trị 4 bước chuẩn chuyên gia trong 3 giây.
              </p>
            </div>

            {/* Gợi ý khám nhanh 1 chạm (ChatGPT Quick Prompt Cards) */}
            <div className="w-full">
              <p className="text-xs font-semibold text-stone-400 mb-3 text-center flex items-center justify-center gap-1.5">
                <Sparkles size={12} className="text-emerald-700" />
                <span>Gợi ý chẩn đoán nhanh triệu chứng thường gặp:</span>
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {SYMPTOM_PRESETS.map((p) => {
                  const icon = SYMPTOM_ICONS[p.id] || "🌱";
                  return (
                    <button
                      key={p.id}
                      type="button"
                      disabled={sending}
                      onClick={() => onQuickSymptom(p.prompt)}
                      className="group flex flex-col items-start gap-1 rounded-2xl border border-stone-200/90 bg-white p-3 text-left shadow-2xs hover:border-[#1C4C40] hover:bg-emerald-50/50 hover:shadow-xs transition active:scale-98 cursor-pointer disabled:opacity-50 min-w-0"
                    >
                      <span className="text-xl shrink-0 select-none">{icon}</span>
                      <p className="text-xs font-bold text-stone-800 group-hover:text-[#1C4C40] truncate w-full">
                        {p.name}
                      </p>
                      <p className="text-[10.5px] text-stone-400 line-clamp-1">{p.label}</p>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          /* DANH SÁCH TIN NHẮN TRẢI DÀI CHUẨN CHATGPT CANVAS */
          <div className="mx-auto max-w-3xl space-y-6 pt-5 pb-6">
            {chatMessages.map((m, i) => (
              <div
                key={m.id}
                ref={i === chatMessages.length - 1 ? latestMessageRef : null}
                className="scroll-mt-4"
              >
                <MessageBubble
                  m={m}
                  speaking={speakingId === m.id}
                  onSpeak={onSpeak}
                  latest={i === chatMessages.length - 1}
                  sending={sending}
                  onAnswer={onQuickSymptom}
                  onPickPlant={onPickPlant}
                  copiedId={copiedId}
                  onCopy={handleCopy}
                />
              </div>
            ))}

            {sending ? (
              <div className="flex items-center gap-3 pl-1 text-xs text-stone-500 animate-pulse py-2">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-[#1C4C40]">
                  <Loader2 size={16} className="animate-spin" />
                </div>
                <span>Bác sĩ AI đang phân tích ảnh và lập phác đồ điều trị…</span>
              </div>
            ) : null}
          </div>
        )}
      </div>

      {/* THANH NHẬP LIỆU NỔI DOCKED Ở ĐÁY (100% CHATGPT PROMPT CAPSULE) */}
      <div className="shrink-0 z-20 pb-3 sm:pb-4 pt-1 bg-gradient-to-t from-white via-white/95 to-transparent px-3 sm:px-6 w-full">
        <div className="mx-auto max-w-3xl w-full space-y-2">
          {/* Nút cuộn xuống tin nhắn mới nổi chuẩn ChatGPT */}
          {!isInitial && showScrollBottom ? (
            <div className="flex justify-center -mb-1 animate-in fade-in slide-in-from-bottom-2 duration-150">
              <button
                type="button"
                onClick={scrollToBottom}
                className="group inline-flex items-center gap-1.5 rounded-full border border-stone-200/90 bg-white/95 px-3.5 py-1.5 text-xs font-medium text-stone-600 shadow-md backdrop-blur-sm hover:bg-stone-50 hover:text-stone-900 active:scale-95 transition cursor-pointer"
                title="Cuộn xuống tin nhắn mới nhất"
              >
                <ArrowDown size={13} className="transition-transform group-hover:translate-y-0.5 text-stone-500 group-hover:text-stone-800" />
                <span>Cuộn xuống dưới</span>
              </button>
            </div>
          ) : null}
          {/* Ảnh đính kèm chờ gửi */}
          {images.length ? (
            <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-stone-50 p-2.5 border border-stone-200 shadow-2xs">
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
                    className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-stone-700 text-white shadow-xs hover:bg-rose-600 transition cursor-pointer"
                  >
                    <X size={11} />
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
              <span className="shrink-0 text-[11px] font-semibold text-stone-400">Gợi ý khám:</span>
              {SYMPTOM_PRESETS.map((p) => {
                const icon = SYMPTOM_ICONS[p.id] || "🌱";
                return (
                  <button
                    key={p.id}
                    type="button"
                    disabled={sending}
                    onClick={() => onQuickSymptom(p.prompt)}
                    className="shrink-0 inline-flex items-center gap-1 rounded-full border border-stone-200/90 bg-white px-3 py-1 text-xs font-medium text-stone-700 shadow-2xs hover:border-[#1C4C40] hover:bg-emerald-50/70 hover:text-[#1C4C40] active:scale-95 transition cursor-pointer disabled:opacity-50"
                  >
                    <span>{icon}</span>
                    <span>{p.name}</span>
                  </button>
                );
              })}
            </div>
          ) : null}

          {/* The ChatGPT Floating Capsule Bar */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (canSend) onSend();
            }}
            className="relative flex items-center gap-1.5 sm:gap-2 rounded-3xl border border-stone-300/80 bg-white p-1.5 sm:p-2 shadow-md hover:border-stone-400 focus-within:border-stone-500 focus-within:shadow-lg focus-within:ring-2 focus-within:ring-black/5 transition-all"
          >
            {/* Nút chụp ảnh / chọn ảnh */}
            <div className="flex items-center gap-0.5 shrink-0 pl-0.5 sm:pl-1">
              <button
                type="button"
                onClick={() => galleryRef.current?.click()}
                disabled={full}
                className="flex h-9.5 w-9.5 sm:h-9 sm:w-9 items-center justify-center rounded-full text-stone-500 hover:text-stone-900 hover:bg-stone-100 transition cursor-pointer disabled:opacity-40"
                title="Tải ảnh cây từ máy"
              >
                <Plus size={19} />
              </button>
              <button
                type="button"
                onClick={() => cameraRef.current?.click()}
                disabled={full}
                className="flex h-9.5 w-9.5 sm:h-9 sm:w-9 items-center justify-center rounded-full text-stone-500 hover:text-stone-900 hover:bg-stone-100 transition cursor-pointer disabled:opacity-40"
                title="Chụp ảnh cây trực tiếp"
              >
                <Camera size={18} />
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
              placeholder="Hỏi Bác sĩ cây hoặc dán/chụp ảnh..."
              className="w-full flex-1 border-0 bg-transparent py-1.5 px-1.5 sm:px-2 text-base sm:text-[15px] text-stone-900 placeholder-stone-400 outline-none focus:outline-none resize-none max-h-36 leading-relaxed"
            />

            {/* Nút gửi ChatGPT up-arrow */}
            <button
              type="submit"
              disabled={!canSend}
              className={`flex h-9.5 w-9.5 sm:h-9.5 sm:w-9.5 shrink-0 items-center justify-center rounded-full transition ${
                canSend
                  ? "bg-stone-900 text-white shadow-sm hover:bg-black active:scale-95 cursor-pointer"
                  : "bg-stone-100 text-stone-300 cursor-not-allowed"
              }`}
              title="Gửi câu hỏi"
            >
              <ArrowUp size={18} strokeWidth={2.4} />
            </button>
          </form>

          {/* Dòng ghi chú chân trang */}
          <p className="text-center text-[11px] text-stone-400 select-none">
            Aloha AI có thể mắc lỗi. Hãy kiểm tra các thông tin chăm sóc quan trọng.
          </p>
        </div>
      </div>
    </div>
  );
}
