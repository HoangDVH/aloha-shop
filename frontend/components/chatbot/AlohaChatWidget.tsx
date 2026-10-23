"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bot,
  ExternalLink,
  MessageCircle,
  Package,
  Send,
  Sparkles,
  Truck,
  X,
  ArrowRight,
} from "lucide-react";
import type { ZaloAskProduct } from "@/lib/zaloAsk";
import { ChatMessageRenderer } from "./ChatMessageRenderer";

type ProductCard = {
  ma: string;
  ten: string;
  giaBan: number;
  image?: string;
  url: string;
};

type OrderCard = {
  code: string;
  status: string;
  statusText: string;
  total: number;
  receiver: string;
  createdAt?: string;
};

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  productCards?: ProductCard[];
  orderCard?: OrderCard;
  showZaloAction?: boolean;
};

const DEFAULT_WELCOME_MSG: ChatMessage = {
  id: "welcome-1",
  role: "assistant",
  content:
    "Chào bạn! Em là trợ lý vườn ALOHA 🌿✨\n\nEm có thể hỗ trợ bạn chọn mẫu cây phong thủy hợp góc bàn/ban công, tư vấn dáng chậu xi măng & composite, hoặc kiểm tra tiến độ đơn hàng. Bạn đang quan tâm dòng cây hay mẫu chậu nào để em tư vấn nhé?",
  timestamp: "Vừa xong",
  showZaloAction: true,
};

const DEFAULT_QUICK_ACTIONS = [
  { label: "🪴 Tư vấn chậu đá mài & composite", query: "Tư vấn cho mình các mẫu chậu đá mài và composite bán chạy với" },
  { label: "🌿 Cây phong thủy để bàn", query: "Gợi ý cho mình các mẫu cây phong thủy lọc không khí để bàn làm việc" },
  { label: "📦 Tra cứu đơn hàng của tôi", query: "Mình muốn tra cứu đơn hàng" },
  { label: "🚚 Báo giá sỉ & chính sách CTV", query: "Chính sách mua sỉ và cộng tác viên của Aloha như thế nào?" },
];

const STORAGE_KEY = "aloha_chat_history_v3";
const TEASER_SEEN_KEY = "aloha_chat_teaser_dismissed";

export function AlohaChatWidget({
  zaloHref,
  product,
  overHero = false,
}: {
  zaloHref: string;
  product?: ZaloAskProduct | null;
  overHero?: boolean;
}) {
  const pathname = usePathname() || "/";
  const [isOpen, setIsOpen] = useState(false);
  const [showTeaser, setShowTeaser] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([DEFAULT_WELCOME_MSG]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const lastConsultedProductRef = useRef<string | null>(null);

  // Khôi phục lịch sử chat từ sessionStorage
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setMessages(parsed);
        }
      }
    } catch {
      // bỏ qua lỗi parse
    }
  }, []);

  // Lưu lịch sử chat
  useEffect(() => {
    try {
      if (messages.length > 1) {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-20)));
      }
    } catch {
      // bỏ qua
    }
  }, [messages]);

  // Cuộn xuống tin nhắn mới nhất
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [isOpen, messages, scrollToBottom]);

  // Hiện teaser popup sau 6s nếu chưa tắt
  useEffect(() => {
    if (isOpen) {
      setShowTeaser(false);
      return;
    }
    const dismissed = sessionStorage.getItem(TEASER_SEEN_KEY);
    if (!dismissed) {
      const timer = setTimeout(() => {
        setShowTeaser(true);
      }, 6000);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  const dismissTeaser = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowTeaser(false);
    sessionStorage.setItem(TEASER_SEEN_KEY, "1");
  };

  const sendMessage = useCallback(
    async (textToSend?: string) => {
      const text = (textToSend || input).trim();
      if (!text || loading) return;

      const userMsg: ChatMessage = {
        id: `user-${Date.now()}`,
        role: "user",
        content: text,
        timestamp: new Intl.DateTimeFormat("vi-VN", { hour: "2-digit", minute: "2-digit" }).format(new Date()),
      };

      setMessages((prev) => [...prev, userMsg]);
      setInput("");
      setLoading(true);

      try {
        const res = await fetch("/api/shop/ai-chat/message", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: [...messages, userMsg].map((m) => ({ role: m.role, content: m.content })),
            context: {
              pathname,
              productName: product?.name,
              productPrice: product?.price ?? undefined,
            },
          }),
        });

        const data = await res.json();
        if (data.ok && data.reply) {
          const botMsg: ChatMessage = {
            id: `bot-${Date.now()}`,
            role: "assistant",
            content: data.reply,
            timestamp: new Intl.DateTimeFormat("vi-VN", { hour: "2-digit", minute: "2-digit" }).format(new Date()),
            productCards: data.productCards,
            orderCard: data.orderCard,
            showZaloAction: true,
          };
          setMessages((prev) => [...prev, botMsg]);
        } else {
          throw new Error(data.error || "Lỗi máy chủ");
        }
      } catch {
        const fallbackMsg: ChatMessage = {
          id: `bot-fallback-${Date.now()}`,
          role: "assistant",
          content:
            "Dạ hệ thống tư vấn đang có chút gián đoạn. Bạn vui lòng nhắn trực tiếp qua Zalo 079 490 1233 để nhân viên Aloha hỗ trợ bạn ngay lập tức nhé! 🌿",
          timestamp: "Vừa xong",
          showZaloAction: true,
        };
        setMessages((prev) => [...prev, fallbackMsg]);
      } finally {
        setLoading(false);
      }
    },
    [input, loading, messages, pathname, product]
  );

  // CHUẨN CÔNG TY LỚN (Shopee/Lazada): Khi đang ở trang chi tiết sản phẩm, bấm vào chat sẽ TỰ ĐỘNG KÍCH HOẠT tư vấn ngay cho sản phẩm đó
  useEffect(() => {
    if (isOpen && product?.name && lastConsultedProductRef.current !== product.name) {
      lastConsultedProductRef.current = product.name;
      // Tự động kích hoạt câu hỏi tư vấn về sản phẩm này
      const timer = setTimeout(() => {
        void sendMessage(`Tư vấn chi tiết cho mình về sản phẩm ${product.name}`);
      }, 250);
      return () => clearTimeout(timer);
    }
  }, [isOpen, product, sendMessage]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void sendMessage();
    }
  };

  // Các nút bấm gợi ý nhanh: Tự động đổi theo sản phẩm nếu đang xem trang SP
  const currentQuickActions = product
    ? [
        { label: "📸 Xem ảnh thật tại vườn qua Zalo", query: `Aloha chụp gửi mình ảnh thực tế tại vườn của ${product.name} qua Zalo 079 490 1233 nhé!` },
        { label: "🚚 Phí ship mẫu này bao nhiêu?", query: `Phí ship cho sản phẩm ${product.name} về khu vực của mình tính như thế nào?` },
        { label: "📐 Kích thước & chất liệu", query: `Kích thước và chất liệu chi tiết của ${product.name} như thế nào shop?` },
        { label: "💧 Cách chăm sóc & tưới nước", query: `Cách chăm sóc và tưới nước cho ${product.name} như thế nào?` },
      ]
    : DEFAULT_QUICK_ACTIONS;

  return (
    <>
      {/* 1. NÚT NỔI THÔNG MINH (FLOATING LAUNCHER) */}
      <div
        className={`fixed right-3 z-40 flex items-center lg:right-6 ${
          overHero ? "pointer-events-none translate-y-3 opacity-0" : ""
        } transition-all duration-300`}
        style={{ bottom: "var(--shop-float-bottom)" }}
        aria-hidden={overHero || undefined}
      >
        {/* Bong bóng gợi ý chào mời (Teaser Tooltip) */}
        {showTeaser && !isOpen && (
          <div
            role="status"
            className="animate-in fade-in slide-in-from-right-2 duration-300 relative mr-3 hidden sm:flex max-w-[260px] items-start gap-2.5 rounded-2xl bg-white p-3 text-xs text-slate-800 shadow-[0_8px_30px_rgb(0,0,0,0.12)] ring-1 ring-slate-900/10"
          >
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-[#2D5A27]">
              <Sparkles size={14} className="animate-pulse" />
            </div>
            <div className="flex-1 pr-3 cursor-pointer" onClick={() => setIsOpen(true)}>
              <p className="font-bold text-slate-900">Aloha Trợ lý AI</p>
              <p className="mt-0.5 text-[11px] leading-relaxed text-slate-600">
                {product
                  ? `Bấm để nhận tư vấn chi tiết về "${product.name}" ngay!`
                  : "Cần tư vấn chậu cây phong thủy hay tra cứu đơn hàng không ạ?"}
              </p>
            </div>
            <button
              type="button"
              onClick={dismissTeaser}
              className="absolute right-2 top-2 rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              aria-label="Đóng gợi ý"
            >
              <X size={12} />
            </button>
          </div>
        )}

        {/* Nút bấm tròn mở Chat / Zalo */}
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          aria-expanded={isOpen}
          aria-label={isOpen ? "Đóng khung chat tư vấn" : "Mở khung chat tư vấn Aloha"}
          className={`group relative flex h-12 w-12 items-center justify-center rounded-full shadow-[0_6px_22px_rgba(0,104,255,0.45)] ring-2 ring-white transition-all duration-300 active:scale-95 lg:h-14 lg:w-14 lg:hover:scale-105 ${
            isOpen ? "bg-slate-900 text-white" : "bg-gradient-to-tr from-[#0068FF] to-[#0088FF] text-white"
          }`}
        >
          {isOpen ? (
            <X size={24} className="transition-transform group-hover:rotate-90 duration-200" />
          ) : (
            <>
              {/* Vòng lan tỏa ánh sáng */}
              <span className="pointer-events-none absolute inset-0 animate-ping rounded-full bg-[#0068FF] opacity-25" />
              <div className="relative flex flex-col items-center justify-center">
                <span className="text-[13px] font-black tracking-tight lg:text-[14px]">Zalo</span>
                <span className="text-[9px] font-bold text-white/90 leading-none -mt-0.5 lg:text-[9.5px]">AI Chat</span>
              </div>
            </>
          )}

          {/* Badge trực tuyến */}
          <span className="absolute -top-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-emerald-500 ring-2 ring-white">
            <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
          </span>
        </button>
      </div>

      {/* 2. KHUNG CHAT HIỆN ĐẠI (DESKTOP POPUP & MOBILE BOTTOM SHEET) */}
      {isOpen && (
        <>
          {/* Backdrop tối nhẹ cho mobile */}
          <div
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px] transition-opacity lg:hidden"
            onClick={() => setIsOpen(false)}
            aria-hidden="true"
          />

          <div
            className="fixed z-50 flex flex-col overflow-hidden bg-white shadow-2xl transition-all duration-300 ring-1 ring-black/[0.08]
              inset-x-0 bottom-0 h-[88vh] max-h-[100dvh] rounded-t-3xl
              lg:inset-x-auto lg:right-6 lg:bottom-[5.5rem] lg:h-[590px] lg:max-h-[82vh] lg:w-[410px] lg:rounded-2xl"
            role="dialog"
            aria-label="Khung chat tư vấn ALOHA"
          >
            {/* Header chuyên nghiệp */}
            <header className="relative flex items-center justify-between border-b border-emerald-900/10 bg-gradient-to-r from-[#204E1C] to-[#2D5A27] px-4 py-3.5 text-white shadow-sm">
              <div className="flex items-center gap-2.5">
                <div className="relative flex h-9 w-9 items-center justify-center rounded-full bg-white/15 ring-1 ring-white/30 backdrop-blur-sm">
                  <Bot size={20} className="text-emerald-100" />
                  <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-emerald-400 ring-2 ring-[#2D5A27]" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <h2 className="text-sm font-bold text-white tracking-tight">ALOHA Trợ Lý AI</h2>
                    <span className="rounded bg-white/20 px-1 py-0.2 text-[9px] font-semibold text-emerald-100">24/7</span>
                  </div>
                  <p className="text-[11px] text-emerald-100/80">Tư vấn chậu cây & tra cứu đơn</p>
                </div>
              </div>

              {/* Nhóm nút hành động Header: Nút Zalo & Nút đóng */}
              <div className="flex items-center gap-1.5">
                <a
                  href={zaloHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Mở Zalo nhân viên Aloha"
                  className="inline-flex items-center gap-1 rounded-full bg-[#0068FF] px-2.5 py-1.5 text-xs font-bold text-white shadow hover:bg-[#0057D9] transition-colors"
                >
                  <span>Zalo</span>
                  <ExternalLink size={12} />
                </a>

                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="rounded-full p-1.5 text-white/80 hover:bg-white/15 hover:text-white transition-colors"
                  aria-label="Thu nhỏ khung chat"
                >
                  <X size={18} />
                </button>
              </div>
            </header>

            {/* CHUẨN SHOPEE/LAZADA: Thẻ ghim sản phẩm đang xem (Pinned Product Card) */}
            {product && (
              <div className="flex items-center gap-3 border-b border-emerald-900/10 bg-emerald-50/80 px-3.5 py-2.5 text-xs">
                {product.image ? (
                  <img
                    src={product.image}
                    alt={product.name}
                    className="h-12 w-12 shrink-0 rounded-lg object-cover ring-1 ring-emerald-900/10 bg-white"
                  />
                ) : (
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-lg">
                    🪴
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="rounded bg-emerald-700 px-1.5 py-0.2 text-[9px] font-bold text-white uppercase tracking-wider">
                      Đang xem
                    </span>
                    <h3 className="truncate font-bold text-slate-900 text-xs">{product.name}</h3>
                  </div>
                  <p className="mt-0.5 font-bold text-[#C62828] text-xs">
                    {product.price && product.price > 0 ? `${product.price.toLocaleString("vi-VN")}đ` : "Liên hệ báo giá"}
                  </p>
                </div>
                <a
                  href={zaloHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#0068FF] px-2.5 py-1.5 text-[11px] font-bold text-white shadow-xs hover:bg-[#0057D9] transition-all"
                >
                  <span>Ảnh Zalo</span>
                  <ExternalLink size={11} />
                </a>
              </div>
            )}

            {/* Danh sách tin nhắn (Chat Stream) */}
            <div className="flex-1 space-y-4 overflow-y-auto p-4 text-xs">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex gap-2.5 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  {msg.role === "assistant" && (
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#2D5A27]/10 text-[#2D5A27] mt-0.5">
                      <Bot size={15} />
                    </div>
                  )}

                  <div className="max-w-[88%] space-y-2">
                    <div
                      className={`rounded-2xl px-3.5 py-2.5 leading-relaxed shadow-sm ${
                        msg.role === "user"
                          ? "bg-[#2D5A27] text-white rounded-br-none"
                          : "bg-slate-50 text-slate-800 rounded-bl-none border border-slate-200/70"
                      }`}
                    >
                      {msg.role === "assistant" ? (
                        <ChatMessageRenderer
                          content={msg.content}
                          zaloHref={zaloHref}
                          onFollowUpClick={(q) => void sendMessage(q)}
                        />
                      ) : (
                        <div className="whitespace-pre-line break-words text-[12.5px] leading-relaxed">
                          {msg.content}
                        </div>
                      )}

                      <div
                        className={`mt-1.5 text-[9.5px] ${
                          msg.role === "user" ? "text-emerald-100/70 text-right" : "text-slate-400"
                        }`}
                      >
                        {msg.timestamp}
                      </div>
                    </div>

                    {/* Thẻ hiển thị Đơn Hàng nếu có */}
                    {msg.orderCard && (
                      <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 p-3 shadow-sm">
                        <div className="flex items-center justify-between border-b border-emerald-200/60 pb-2">
                          <span className="font-bold text-emerald-950 flex items-center gap-1.5">
                            <Package size={14} className="text-emerald-700" />
                            Đơn {msg.orderCard.code}
                          </span>
                          <span className="rounded bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                            {msg.orderCard.statusText}
                          </span>
                        </div>
                        <div className="mt-2 text-[11.5px] text-emerald-900 space-y-0.5">
                          <p>👤 Người nhận: <span className="font-medium">{msg.orderCard.receiver}</span></p>
                          <p>💰 Tổng tiền: <span className="font-bold text-[#C62828]">{msg.orderCard.total.toLocaleString("vi-VN")}đ</span></p>
                        </div>
                        <div className="mt-2.5 pt-2 border-t border-emerald-200/50 flex items-center justify-between">
                          <Link
                            href={`/don-hang/${encodeURIComponent(msg.orderCard.code)}`}
                            className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 hover:underline"
                          >
                            <span>Xem chi tiết đơn</span>
                            <ArrowRight size={12} />
                          </Link>
                          <a
                            href={zaloHref}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 rounded bg-[#0068FF] px-2 py-1 text-[10px] font-bold text-white shadow-sm"
                          >
                            <span>Duyệt ảnh Zalo</span>
                            <ExternalLink size={10} />
                          </a>
                        </div>
                      </div>
                    )}

                    {/* Thẻ gợi ý sản phẩm cùng loại dạng trượt ngang (Horizontal Carousel) */}
                    {msg.productCards && msg.productCards.length > 0 && (
                      <div className="space-y-1.5 pt-1.5">
                        <div className="flex items-center justify-between px-0.5">
                          <p className="text-[11.5px] font-bold text-slate-800 flex items-center gap-1.5">
                            <Sparkles size={13} className="text-amber-500 shrink-0" />
                            <span>Gợi ý mẫu phù hợp có sẵn tại vườn ({msg.productCards.length})</span>
                          </p>
                          <span className="text-[10px] text-slate-400 font-medium">Vuốt sang để xem →</span>
                        </div>

                        {/* Thanh trượt ngang snap-x mượt mà */}
                        <div className="no-scrollbar flex gap-2.5 overflow-x-auto pb-2 pt-0.5 snap-x snap-mandatory -mx-1 px-1">
                          {msg.productCards.map((p) => (
                            <div
                              key={p.ma}
                              className="group w-[170px] sm:w-[185px] shrink-0 snap-start flex flex-col justify-between rounded-2xl border border-slate-200/90 bg-white p-2 shadow-2xs hover:border-emerald-600 hover:shadow-md transition-all"
                            >
                              <div>
                                <Link href={p.url} className="block relative aspect-square overflow-hidden rounded-xl bg-slate-50">
                                  {p.image ? (
                                    <img
                                      src={p.image}
                                      alt={p.ten}
                                      className="h-full w-full object-cover transition-transform group-hover:scale-105 duration-200"
                                      loading="lazy"
                                    />
                                  ) : (
                                    <div className="flex h-full w-full items-center justify-center text-2xl bg-emerald-50 text-[#2D5A27]">
                                      🪴
                                    </div>
                                  )}
                                  <span className="absolute bottom-1 left-1 rounded bg-black/60 px-1.5 py-0.2 text-[8px] font-medium text-white backdrop-blur-xs">
                                    {p.ma}
                                  </span>
                                  <span className="absolute top-1 right-1 rounded-full bg-emerald-600/90 px-1.5 py-0.2 text-[8px] font-bold text-white shadow-2xs">
                                    Sẵn hàng
                                  </span>
                                </Link>

                                <Link href={p.url} className="mt-1.5 block">
                                  <h4 className="line-clamp-2 text-[11.5px] font-semibold text-slate-800 group-hover:text-emerald-700 leading-tight">
                                    {p.ten}
                                  </h4>
                                </Link>
                              </div>

                              <div className="mt-2 pt-1.5 border-t border-slate-100">
                                <div className="text-[12px] font-black text-[#C62828]">
                                  {p.giaBan.toLocaleString("vi-VN")}đ
                                </div>

                                <div className="mt-1.5 flex items-center gap-1.5">
                                  <Link
                                    href={p.url}
                                    className="flex-1 text-center rounded-lg bg-emerald-50 hover:bg-emerald-100 py-1 text-[10.5px] font-bold text-emerald-800 transition-colors"
                                  >
                                    Xem chi tiết
                                  </Link>
                                  <a
                                    href={`${zaloHref}?text=${encodeURIComponent(`Chào Aloha, mình cần xem ảnh thực tế tại vườn của mẫu: ${p.ten} (Mã: ${p.ma})`)}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    title="Xem ảnh thực tế trên Zalo"
                                    className="shrink-0 flex items-center justify-center rounded-lg bg-blue-50 hover:bg-blue-100 p-1.5 text-[#0068FF] transition-colors"
                                  >
                                    <ExternalLink size={11} />
                                  </a>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {/* Chỉ báo AI đang soạn câu trả lời */}
              {loading && (
                <div className="flex items-center gap-2 text-slate-500 text-xs">
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#2D5A27]/10 text-[#2D5A27]">
                    <Bot size={15} />
                  </div>
                  <div className="flex items-center gap-1 rounded-2xl bg-slate-100 px-3.5 py-2 text-slate-600">
                    <span className="text-xs">Aloha đang chuẩn bị câu trả lời</span>
                    <span className="inline-flex gap-1 items-center ml-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:-0.3s]" />
                      <span className="h-1.5 w-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:-0.15s]" />
                      <span className="h-1.5 w-1.5 rounded-full bg-slate-400 animate-bounce" />
                    </span>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Khối gợi ý câu hỏi nhanh (Quick Action Chips: Tự động đổi theo SP nếu ở PDP) */}
            <div className="border-t border-slate-200/80 bg-slate-50/80 px-3 py-2">
              <div className="no-scrollbar flex gap-1.5 overflow-x-auto pb-0.5">
                {currentQuickActions.map((action, idx) => (
                  <button
                    key={idx}
                    type="button"
                    disabled={loading}
                    onClick={() => void sendMessage(action.query)}
                    className="shrink-0 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:border-emerald-600 hover:text-emerald-800 active:scale-95 transition-all shadow-2xs"
                  >
                    {action.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Khung nhập tin nhắn */}
            <footer className="border-t border-slate-200 bg-white p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void sendMessage();
                }}
                className="flex items-center gap-2"
              >
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={
                    product
                      ? `Hỏi về ${product.name} hoặc phí ship...`
                      : "Nhập câu hỏi hoặc mã đơn (vd: DH008829)..."
                  }
                  className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-emerald-600 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-600 transition-colors"
                />

                <button
                  type="submit"
                  disabled={!input.trim() || loading}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#2D5A27] text-white shadow-sm transition-all hover:bg-[#244820] disabled:opacity-40 disabled:pointer-events-none active:scale-95"
                  aria-label="Gửi tin nhắn"
                >
                  <Send size={15} />
                </button>
              </form>

              <div className="mt-2 flex items-center justify-between text-[10px] text-slate-400">
                <span>Aloha AI phản hồi tự động</span>
                <a
                  href={zaloHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-bold text-[#0068FF] hover:underline"
                >
                  Cần người thật? Chat Zalo →
                </a>
              </div>
            </footer>
          </div>
        </>
      )}
    </>
  );
}
