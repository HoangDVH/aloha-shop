"use client";

import { useEffect, useState } from "react";
import { AlertCircle, ListChecks, MessagesSquare, RotateCcw } from "lucide-react";
import {
  askPlantDoctor,
  newId,
  nowTime,
  type DoctorCard,
  type DoctorImage,
  type DoctorMessage,
  type PlantCandidate,
  type PlantRef,
} from "@/lib/plantDoctor/api";
import { prepareImage } from "@/lib/plantDoctor/image";
import { ALOHA_ZALO, GUIDED_DEFAULTS, WELCOME_TEXT, guidedPrompt } from "@/lib/plantDoctor/presets";
import { ClinicChat, MAX_IMAGES } from "./ClinicChat";
import { GuidedWizard, type GuidedState } from "./GuidedWizard";

const welcome = (): DoctorMessage => ({ id: "welcome", role: "assistant", content: WELCOME_TEXT, time: nowTime() });
const freshGuided = (): GuidedState => ({
  step: 0,
  plants: [],
  identified: false,
  choice: "unknown",
  custom: "",
  answers: { ...GUIDED_DEFAULTS },
});

const pickedRef = (c: { profileId: string | null; name: string }): PlantRef => ({
  profileId: c.profileId,
  name: c.name,
  confirmed: true,
  source: "customer",
  score: null,
});

/** Cây của phiếu vừa trả về; null nếu phiếu chưa xác định được cây (giữ cây cũ). */
function refFromCard(card: DoctorCard | null | undefined): PlantRef | null {
  const p = card?.plant;
  if (!p || (!p.profileId && !p.name)) return null;
  return { profileId: p.profileId, name: p.name, confirmed: p.source === "customer", source: p.source, score: p.score };
}

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
  const [plant, setPlant] = useState<PlantRef | null>(null);
  const [lastImages, setLastImages] = useState<DoctorImage[]>([]);

  useEffect(() => () => window.speechSynthesis?.cancel(), []);

  const identify = async (imgs: DoctorImage[]) => {
    setIdentifying(true);
    const r = await askPlantDoctor({
      mode: "identify",
      messages: [],
      images: imgs.map((i) => ({ mimeType: i.mimeType, data: i.base64 })),
    });
    setIdentifying(false);
    const plants = r.ok ? (r.candidates ?? []).filter((c) => c.profileId).slice(0, 3) : [];
    setGuided((g) => ({ ...g, step: 1, plants, identified: true, choice: plants.length ? "0" : "unknown" }));
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
    if (mode === "guided" && guided.step === 0) void identify(prepared);
  };

  /** `opts.images`: gửi lại ảnh lượt trước khi khách chọn lại cây, để AI vẫn xem được ảnh. */
  const send = async (text: string, opts: { plant?: PlantRef | null; images?: DoctorImage[] } = {}) => {
    const content = text.trim() || "Nhờ bác sĩ xem giúp tình trạng cây trong ảnh.";
    const attached = opts.images ?? images;
    const ref = opts.plant !== undefined ? opts.plant : plant;
    const userMsg: DoctorMessage = {
      id: newId("u"),
      role: "user",
      content,
      time: nowTime(),
      images: opts.images ? [] : attached.map((i) => i.previewUrl),
    };
    const history = [...messages, userMsg].filter((m) => m.id !== "welcome");
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    if (!opts.images) setImages([]);
    if (attached.length) setLastImages(attached);
    setError(null);
    setSending(true);
    const r = await askPlantDoctor({
      messages: history.map((m) => ({ role: m.role, content: m.content })),
      images: attached.map((i) => ({ mimeType: i.mimeType, data: i.base64 })),
      plant: ref,
    });
    setSending(false);
    if (!r.ok) return setError(r.error);
    const next = refFromCard(r.card);
    if (next) setPlant(next);
    setMessages((prev) => [...prev, { id: newId("a"), role: "assistant", content: r.reply, time: nowTime(), card: r.card }]);
  };

  const pickPlant = (c: PlantCandidate) => {
    void send(`Cây của tôi là ${c.name}.`, { plant: pickedRef(c), images: lastImages });
  };

  const submitGuided = () => {
    const chosen = guided.plants[Number(guided.choice)];
    const custom = guided.custom.trim();
    const ref = chosen ? pickedRef(chosen) : guided.choice === "custom" && custom ? pickedRef({ profileId: null, name: custom }) : null;
    const label = ref?.name ?? "Tôi không rõ là cây gì";
    setMode("chat");
    setGuided(freshGuided());
    void send(guidedPrompt(label, guided.answers), { plant: ref ?? plant });
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
    setPlant(null);
    setLastImages([]);
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
    <div className="flex flex-col flex-1 h-full w-full relative bg-[#FAF9F6] overflow-hidden">
      {/* Top Gemini-Style Sub-Navbar */}
      <header className="sticky top-0 z-30 flex items-center justify-between gap-2 sm:gap-3 border-b border-stone-200/70 bg-white/80 px-3 sm:px-6 py-2 sm:py-2.5 backdrop-blur-md shrink-0">
        {/* Brand & Assistant Title */}
        <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
          <div className="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-xl bg-[#1C4C40] text-white shadow-xs shrink-0 ring-2 ring-emerald-50">
            <span className="text-base select-none">🩺</span>
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-sm sm:text-base text-stone-900 truncate">Bác sĩ cây cảnh</span>
              <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-100/80 px-2 py-0.5 text-[10px] font-bold text-[#1C4C40] shrink-0">
                AI Chuyên gia
              </span>
            </div>
          </div>
        </div>

        {/* Center/Right: Chế độ khám & Action buttons */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
          {/* Segmented Mode Switcher */}
          <div className="inline-flex rounded-full bg-stone-100/90 p-0.5 text-xs font-semibold">
            {(
              [
                { id: "chat", label: "Hỏi đáp", icon: MessagesSquare },
                { id: "guided", label: "Khảo sát", icon: ListChecks },
              ] as const
            ).map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setMode(id)}
                className={`inline-flex items-center gap-1 rounded-full px-2.5 sm:px-3 py-1 transition cursor-pointer text-xs ${
                  mode === id ? "bg-[#1C4C40] text-white shadow-xs font-bold" : "text-stone-600 hover:text-stone-900"
                }`}
              >
                <Icon size={12} aria-hidden />
                <span>{label}</span>
              </button>
            ))}
          </div>

          {/* Hotline Zalo */}
          <a
            href={ALOHA_ZALO.href}
            target="_blank"
            rel="noopener noreferrer"
            className="hidden md:inline-flex items-center gap-1.5 rounded-full border border-emerald-200/90 bg-emerald-50/80 px-3 py-1 text-xs font-bold text-[#1C4C40] hover:bg-emerald-100 transition shadow-2xs"
            title="Chat Zalo nghệ nhân Aloha hỗ trợ trực tiếp"
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            <span>Hotline Zalo: {ALOHA_ZALO.label}</span>
          </a>

          {/* Nút Khám mới */}
          <button
            type="button"
            onClick={restart}
            className="inline-flex items-center gap-1 rounded-full border border-stone-200 bg-white hover:bg-stone-50 px-2.5 sm:px-3 py-1 text-xs font-medium text-stone-600 hover:text-[#1C4C40] transition cursor-pointer shadow-2xs"
            title="Bắt đầu phiên khám mới"
          >
            <RotateCcw size={12} aria-hidden />
            <span className="hidden sm:inline">Khám mới</span>
          </button>
        </div>
      </header>

      {/* Thông báo lỗi nếu có */}
      {error ? (
        <div className="mx-auto max-w-3xl w-full px-4 pt-2 shrink-0">
          <p className="flex items-center gap-2 rounded-xl border border-rose-100 bg-rose-50 px-3 py-2 text-xs text-rose-700">
            <AlertCircle size={14} aria-hidden /> {error}
          </p>
        </div>
      ) : null}

      {/* Main Content Viewport */}
      <div className="flex-1 flex flex-col min-h-0 relative w-full h-full">
        {mode === "guided" ? (
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 pb-20">
            <div className="mx-auto max-w-2xl">
              <GuidedWizard
                state={guided}
                setState={setGuided}
                images={images}
                identifying={identifying}
                sending={sending}
                onPickFiles={pickFiles}
                onSubmit={submitGuided}
              />
            </div>
          </div>
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
            onPickPlant={pickPlant}
            speakingId={speakingId}
            onSpeak={speak}
          />
        )}
      </div>
    </div>
  );
}
