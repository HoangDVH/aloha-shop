"use client";

import { useEffect, useState } from "react";
import { AlertCircle, MessageCircle, PanelLeft, Plus, RotateCcw, SquarePen, Stethoscope } from "lucide-react";
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
import { ALOHA_ZALO, WELCOME_TEXT } from "@/lib/plantDoctor/presets";
import {
  deleteSession,
  generateSessionTitle,
  listSessions,
  loadSession,
  renameSession,
  saveSession,
  type PlantDoctorSession,
  type PlantDoctorSessionSummary,
} from "@/lib/plantDoctor/sessionStorage";
import { ClinicChat, MAX_IMAGES } from "./ClinicChat";
import { PlantDoctorSidebar } from "./PlantDoctorSidebar";

const welcome = (): DoctorMessage => ({ id: "welcome", role: "assistant", content: WELCOME_TEXT, time: nowTime() });

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

export function Clinic({ isTester = false }: { isTester?: boolean } = {}) {
  const [messages, setMessages] = useState<DoctorMessage[]>(() => [welcome()]);
  const [input, setInput] = useState("");
  const [images, setImages] = useState<DoctorImage[]>([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [plant, setPlant] = useState<PlantRef | null>(null);
  const [lastImages, setLastImages] = useState<DoctorImage[]>([]);

  // Quản lý phiên hội thoại & Lịch sử chuẩn ChatGPT
  const [sessions, setSessions] = useState<PlantDoctorSessionSummary[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Khởi tạo: đọc lịch sử từ IndexedDB & URL deep-linking
  useEffect(() => {
    let alive = true;

    // Mặc định mở sidebar trên màn hình lớn (Desktop)
    if (typeof window !== "undefined") {
      setSidebarOpen(window.innerWidth >= 1024);
    }

    listSessions().then((list) => {
      if (!alive) return;
      setSessions(list);

      // Đọc URL search param ?session=...
      const urlParams = new URLSearchParams(window.location.search);
      const urlSessionId = urlParams.get("session");
      if (urlSessionId) {
        loadSession(urlSessionId).then((sess) => {
          if (!alive || !sess) return;
          setActiveSessionId(sess.id);
          setMessages(sess.messages && sess.messages.length ? sess.messages : [welcome()]);
          setPlant(sess.plant);
        });
      }
    });

    return () => {
      alive = false;
      window.speechSynthesis?.cancel();
    };
  }, []);

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
  };

  /**
   * Gửi tin nhắn và tự động ghi vào phiên IndexedDB (Lazy Session Creation)
   */
  const send = async (text: string, opts: { plant?: PlantRef | null; images?: DoctorImage[] } = {}) => {
    const content = text.trim() || "Nhờ bác sĩ xem giúp tình trạng cây trong ảnh.";
    const attached = opts.images ?? images;
    const ref = opts.plant !== undefined ? opts.plant : plant;
    const newPhotos = !opts.images && opts.plant === undefined && attached.length > 0;
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
      newPhotos,
    });
    setSending(false);
    if (!r.ok) return setError(r.error);

    const next = refFromCard(r.card);
    if (next || newPhotos) setPlant(next);

    const assistantMsg: DoctorMessage = {
      id: newId("a"),
      role: "assistant",
      content: r.reply,
      time: nowTime(),
      card: r.card,
    };
    const updatedMessages = [...messages, userMsg, assistantMsg];
    setMessages((prev) => [...prev, assistantMsg]);

    // Lưu vào phiên IndexedDB & Cập nhật URL Deep-linking
    try {
      let targetId = activeSessionId;
      if (!targetId) {
        // Tạo phiên mới khi có tin nhắn đầu tiên (Lazy Creation)
        targetId = `sess_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        setActiveSessionId(targetId);
        window.history.pushState(null, "", `?session=${targetId}`);

        const newSession: PlantDoctorSession = {
          id: targetId,
          title: generateSessionTitle(r.card, content),
          createdAt: Date.now(),
          updatedAt: Date.now(),
          plant: next || ref,
          messages: updatedMessages,
        };
        await saveSession(newSession);
      } else {
        // Cập nhật phiên sẵn có
        const current = await loadSession(targetId);
        if (current) {
          current.messages = updatedMessages;
          current.updatedAt = Date.now();
          if (next) current.plant = next;
          if (current.title === "Ca khám cây mới" && r.card) {
            current.title = generateSessionTitle(r.card, content);
          }
          await saveSession(current);
        }
      }
      setSessions(await listSessions());
    } catch (e) {
      console.warn("[plant-doctor] Lưu phiên lỗi:", (e as Error)?.message);
    }
  };

  const pickPlant = (c: PlantCandidate) => {
    void send(`Cây của tôi là ${c.name}.`, { plant: pickedRef(c), images: lastImages });
  };

  // Khởi tạo đoạn chat mới (Chuẩn ChatGPT New Chat)
  const startNewChat = () => {
    window.speechSynthesis?.cancel();
    setSpeakingId(null);
    setActiveSessionId(null);
    setMessages([welcome()]);
    setImages([]);
    setInput("");
    setError(null);
    setPlant(null);
    setLastImages([]);
    window.history.pushState(null, "", window.location.pathname);
  };

  // Chọn mở một phiên cũ từ Sidebar
  const selectSession = async (id: string) => {
    if (id === activeSessionId) return;
    const sess = await loadSession(id);
    if (!sess) return;
    window.speechSynthesis?.cancel();
    setSpeakingId(null);
    setActiveSessionId(sess.id);
    setMessages(sess.messages && sess.messages.length ? sess.messages : [welcome()]);
    setPlant(sess.plant);
    setImages([]);
    setInput("");
    setError(null);
    window.history.pushState(null, "", `?session=${sess.id}`);
  };

  // Xóa phiên
  const handleDeleteSession = async (id: string) => {
    await deleteSession(id);
    const updated = await listSessions();
    setSessions(updated);
    if (activeSessionId === id) {
      startNewChat();
    }
  };

  // Đổi tên phiên
  const handleRenameSession = async (id: string, newTitle: string) => {
    await renameSession(id, newTitle);
    setSessions(await listSessions());
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
    <div className="flex flex-1 h-full w-full relative bg-white overflow-hidden">
      {/* 1. Thanh bên lịch sử chat chuẩn ChatGPT */}
      <PlantDoctorSidebar
        sessions={sessions}
        activeSessionId={activeSessionId}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onNewChat={startNewChat}
        onSelectSession={selectSession}
        onDeleteSession={handleDeleteSession}
        onRenameSession={handleRenameSession}
      />

      {/* 2. Vùng nội dung trò chuyện & Header */}
      <div className="flex-1 flex flex-col min-w-0 h-full relative overflow-hidden">
        {/* Top Minimalist Header phong cách ChatGPT / Claude */}
        <header className="sticky top-0 z-30 flex h-12 items-center justify-between gap-2 border-b border-stone-200/60 bg-white/80 px-3 sm:px-5 backdrop-blur-md shrink-0 select-none">
          {/* Cụm trái: Toggle Sidebar + New Chat (khi sidebar đóng) + Tên Bác sĩ */}
          <div className="flex items-center gap-1 sm:gap-2 min-w-0">
            {/* Nút bật/tắt Sidebar ghost button */}
            <button
              type="button"
              onClick={() => setSidebarOpen((prev) => !prev)}
              className="flex h-8.5 w-8.5 items-center justify-center rounded-lg hover:bg-stone-100 text-stone-600 transition cursor-pointer"
              title={sidebarOpen ? "Thu gọn thanh bên" : "Mở lịch sử chat"}
            >
              <PanelLeft size={18} />
            </button>

            {/* Nút Tạo đoạn chat mới hình bút SquarePen (chỉ hiện khi sidebar đóng) */}
            {!sidebarOpen && (
              <button
                type="button"
                onClick={startNewChat}
                className="flex h-8.5 w-8.5 items-center justify-center rounded-lg hover:bg-stone-100 text-stone-600 transition cursor-pointer"
                title="Đoạn chat mới"
              >
                <SquarePen size={17} />
              </button>
            )}

            {/* Tên Bác sĩ & Huy hiệu Beta thanh thoát */}
            <div className="flex items-center gap-2 pl-1 truncate">
              <span className="font-semibold text-sm sm:text-[15px] text-stone-800 truncate">
                Bác sĩ cây cảnh
              </span>
              <span className="inline-flex items-center rounded-md bg-stone-100 px-1.5 py-0.5 text-[10px] font-semibold text-stone-600 border border-stone-200/70 shrink-0">
                AI Aloha
              </span>
              {isTester && (
                <span className="hidden sm:inline-flex items-center rounded-md bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-800 border border-emerald-200/60 shrink-0">
                  Thử nghiệm
                </span>
              )}
            </div>
          </div>

          {/* Cụm phải: Khảo sát + Nút liên hệ Hotline Zalo */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Nút liên hệ Zalo trực tiếp với kỹ thuật viên */}
            <a
              href={ALOHA_ZALO.href}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200/80 bg-emerald-50/70 hover:bg-emerald-100/90 px-2.5 sm:px-3 py-1.5 text-xs font-bold text-[#1C4C40] shadow-2xs transition active:scale-95"
              title={`Hotline Zalo nhà vườn Aloha: ${ALOHA_ZALO.label}`}
            >
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-600" />
              </span>
              <MessageCircle size={13} className="text-[#1C4C40]" />
              <span className="hidden sm:inline">Zalo {ALOHA_ZALO.label}</span>
              <span className="sm:hidden">Zalo</span>
            </a>
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

        {/* Khung trò chuyện Bác sĩ cây cảnh chuẩn ChatGPT */}
        <div className="flex-1 flex flex-col min-h-0 relative w-full h-full">
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
        </div>
      </div>
    </div>
  );
}
