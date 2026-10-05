"use client";

import { useEffect, useState } from "react";
import { AlertCircle, ListChecks, MessagesSquare, RotateCcw } from "lucide-react";
import { askPlantDoctor, newId, nowTime, type DoctorImage, type DoctorMessage } from "@/lib/plantDoctor/api";
import { prepareImage } from "@/lib/plantDoctor/image";
import { GUIDED_DEFAULTS, WELCOME_TEXT, guidedPrompt } from "@/lib/plantDoctor/presets";
import { ClinicChat, MAX_IMAGES } from "./ClinicChat";
import { GuidedWizard, type GuidedState } from "./GuidedWizard";

const welcome = (): DoctorMessage => ({ id: "welcome", role: "assistant", content: WELCOME_TEXT, time: nowTime() });
const freshGuided = (): GuidedState => ({ step: 0, plants: [], choice: "unknown", custom: "", answers: { ...GUIDED_DEFAULTS } });

function speakableText(text: string): string {
  return text.replace(/[*#`_]/g, "").replace(/[🩺💊⚠️]/gu, "").replace(/\n+/g, ". ");
}

export function Clinic() {
  const [messages, setMessages] = useState<DoctorMessage[]>(() => [welcome()]);
  const [input, setInput] = useState("");
  const [images, setImages] = useState<DoctorImage[]>([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"chat" | "guided">("chat");
  const [guided, setGuided] = useState<GuidedState>(freshGuided);
  const [identifying, setIdentifying] = useState(false);
  const [speakingId, setSpeakingId] = useState<string | null>(null);

  useEffect(() => () => window.speechSynthesis?.cancel(), []);

  const identify = async (img: DoctorImage) => {
    setIdentifying(true);
    const r = await askPlantDoctor({ mode: "identify", messages: [], images: [{ mimeType: img.mimeType, data: img.base64 }] });
    setIdentifying(false);
    const plants = r.ok
      ? r.reply.split("\n").map((l) => l.replace(/^[-*•\d.\s]+/, "").trim()).filter((l) => l.length > 1 && l.length < 60).slice(0, 3)
      : [];
    setGuided((g) => ({ ...g, step: 1, plants, choice: plants[0] || "unknown" }));
  };

  const pickFiles = async (files: FileList | File[]) => {
    setError(null);
    const room = MAX_IMAGES - images.length;
    const list = [...files].slice(0, Math.max(0, room));
    if (!list.length) return setError(`Chỉ gửi tối đa ${MAX_IMAGES} ảnh mỗi lần.`);
    const prepared = (await Promise.all(list.map((f) => prepareImage(f).catch(() => null)))).filter(
      (x): x is DoctorImage => Boolean(x)
    );
    if (!prepared.length) return setError("Không đọc được ảnh, vui lòng chọn ảnh JPG hoặc PNG.");
    setImages((prev) => [...prev, ...prepared].slice(0, MAX_IMAGES));
    if (mode === "guided" && guided.step === 0) void identify(prepared[0]);
  };

  const send = async (text: string) => {
    const content = text.trim() || "Nhờ bác sĩ xem giúp tình trạng cây trong ảnh.";
    const attached = images;
    const userMsg: DoctorMessage = { id: newId("u"), role: "user", content, time: nowTime(), images: attached.map((i) => i.previewUrl) };
    const history = [...messages, userMsg].filter((m) => m.id !== "welcome");
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setImages([]);
    setError(null);
    setSending(true);
    const r = await askPlantDoctor({
      messages: history.map((m) => ({ role: m.role, content: m.content })),
      images: attached.map((i) => ({ mimeType: i.mimeType, data: i.base64 })),
    });
    setSending(false);
    if (!r.ok) return setError(r.error);
    setMessages((prev) => [
      ...prev,
      { id: newId("a"), role: "assistant", content: r.reply, time: nowTime(), suggest: r.suggest, demo: r.demo },
    ]);
  };

  const submitGuided = () => {
    const plant =
      guided.choice === "custom" ? guided.custom.trim() || "Cây khác" : guided.choice === "unknown" ? "Tôi không rõ là cây gì" : guided.choice;
    setMode("chat");
    setGuided(freshGuided());
    void send(guidedPrompt(plant, guided.answers));
  };

  const restart = () => {
    if (!window.confirm("Bắt đầu lượt khám mới? Cuộc trò chuyện hiện tại sẽ bị xoá.")) return;
    window.speechSynthesis?.cancel();
    setSpeakingId(null);
    setMessages([welcome()]);
    setImages([]);
    setInput("");
    setError(null);
    setGuided(freshGuided());
  };

  const speak = (m: DoctorMessage) => {
    const synth = window.speechSynthesis;
    if (!synth) return setError("Trình duyệt này chưa hỗ trợ đọc thành tiếng.");
    synth.cancel();
    if (speakingId === m.id) return setSpeakingId(null);
    const u = new SpeechSynthesisUtterance(speakableText(m.content));
    u.lang = "vi-VN";
    u.rate = 1;
    u.onend = () => setSpeakingId(null);
    u.onerror = () => setSpeakingId(null);
    setSpeakingId(m.id);
    synth.speak(u);
  };

  return (
    <div className="w-full space-y-3">
      {/* Thanh công cụ Studio */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-stone-200/90 bg-white p-2 sm:px-4 sm:py-2.5 shadow-2xs">
        {/* Bộ chuyển chế độ khám */}
        <div className="inline-flex rounded-full bg-stone-100 p-1 text-xs font-bold">
          {(
            [
              { id: "chat", label: "Hỏi trực tiếp", icon: MessagesSquare },
              { id: "guided", label: "Khảo sát 3 bước", icon: ListChecks },
            ] as const
          ).map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setMode(id)}
              className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 transition cursor-pointer ${
                mode === id ? "bg-[#1C4C40] text-white shadow-xs font-bold" : "text-stone-600 hover:text-stone-900 font-medium"
              }`}
            >
              <Icon size={14} aria-hidden />
              {label}
            </button>
          ))}
        </div>

        {/* Nút Khám mới & Hotline Zalo Nhà Vườn */}
        <div className="flex items-center gap-2 sm:gap-3">
          <a
            href="https://zalo.me/0794901233"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200/90 bg-emerald-50 px-3 py-1 text-[11px] sm:text-xs font-bold text-[#1C4C40] hover:bg-emerald-100 transition shadow-2xs"
            title="Chat Zalo nghệ nhân Aloha hỗ trợ ca nguy kịch"
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            <span>Hotline Zalo: 079 490 1233</span>
          </a>

          <button
            type="button"
            onClick={restart}
            className="inline-flex items-center gap-1 text-xs font-semibold text-stone-500 hover:text-[#1C4C40] transition cursor-pointer"
          >
            <RotateCcw size={13} aria-hidden /> Khám lượt mới
          </button>
        </div>
      </div>

      {error ? (
        <p className="flex items-center gap-2 rounded-xl border border-rose-100 bg-rose-50 px-3 py-2 text-xs text-rose-700">
          <AlertCircle size={14} aria-hidden /> {error}
        </p>
      ) : null}

      {mode === "guided" ? (
        <GuidedWizard
          state={guided}
          setState={setGuided}
          images={images}
          identifying={identifying}
          sending={sending}
          onPickFiles={pickFiles}
          onSubmit={submitGuided}
        />
      ) : (
        <ClinicChat
          messages={messages}
          sending={sending}
          input={input}
          setInput={setInput}
          images={images}
          onPickFiles={pickFiles}
          onRemoveImage={(id) => setImages((prev) => prev.filter((i) => i.id !== id))}
          onSend={() => void send(input)}
          onQuickSymptom={(prompt) => void send(prompt)}
          speakingId={speakingId}
          onSpeak={speak}
        />
      )}

      {/* Mẹo chụp ảnh & nhắc nhở tinh tế */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-[11px] text-stone-500">
        <p className="flex items-center gap-1.5">
          <span>📸</span>
          <span>
            <strong>Mẹo chụp ảnh:</strong> Chụp cận cảnh lá bị đốm/mốc & gốc thoát nước dưới ánh sáng tự nhiên để AI chẩn đoán chuẩn 99%.
          </span>
        </p>
        {messages.some((m) => m.demo) ? (
          <span className="text-amber-700 font-medium">Chế độ demo: câu trả lời là mẫu, chưa kết nối AI thật.</span>
        ) : null}
      </div>
    </div>
  );
}
