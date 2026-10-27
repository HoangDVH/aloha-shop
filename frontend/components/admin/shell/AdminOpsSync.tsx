"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Select, Switch } from "antd";
import {
  Bell,
  Briefcase,
  Play,
  ShoppingBag,
  Store,
  Users,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { adminFetch } from "@/components/admin/api/adminFetch";
import { AdminPushSettingsCard } from "@/components/admin/shell/AdminPushSettingsCard";
import { subscribeToWebPush } from "@/components/admin/shell/adminWebPush";

export type AdminOpsCounts = {
  ordersNeedAction: number;
  ctvPending: number;
  fraudOpen: number;
  at?: number;
};

export type NotificationCategory = "order" | "wholesale" | "ctv" | "recruitment";

export type ChimeStyle = "voice" | "chaching" | "marimba" | "bell" | "ping";

export type CategorySoundConfig = {
  enabled: boolean;
  style: ChimeStyle;
};

export type SoundSettings = {
  masterEnabled: boolean;
  volume: number; // 0 -> 100
  categories: {
    order: CategorySoundConfig;
    wholesale: CategorySoundConfig;
    ctv: CategorySoundConfig;
    recruitment: CategorySoundConfig;
  };
};

export const DEFAULT_SOUND_SETTINGS: SoundSettings = {
  masterEnabled: true,
  volume: 85,
  categories: {
    order: { enabled: true, style: "voice" },
    wholesale: { enabled: true, style: "voice" },
    ctv: { enabled: true, style: "voice" },
    recruitment: { enabled: true, style: "voice" },
  },
};

const SOUND_STORAGE_KEY = "aloha_admin_sound_settings_v2";
const LEGACY_STORAGE_KEY = "aloha_admin_chime_style";

export const NOTIFICATION_VOICE_TEXTS: Record<NotificationCategory, string> = {
  order: "Bạn có đơn hàng mới!",
  wholesale: "Có khách sỉ mới đăng ký!",
  ctv: "Có cộng tác viên mới đăng ký!",
  recruitment: "Có hồ sơ ứng viên mới nộp!",
};

export const SOUND_SELECT_OPTIONS = [
  { value: "voice", label: "Giọng đọc tiếng Việt (Mặc định)" },
  { value: "chaching", label: "Két tiền (Shopify)" },
  { value: "marimba", label: "Chuông Shopee (Marimba)" },
  { value: "bell", label: "Chuông Ding-Dong" },
  { value: "ping", label: "Ting nhẹ nhàng" },
];

const NOTIFICATION_ROWS: Array<{
  id: NotificationCategory;
  title: string;
  desc: string;
  Icon: typeof ShoppingBag;
}> = [
  {
    id: "order",
    title: "Đơn hàng mới",
    desc: "Khách đặt đơn web hoặc sỉ",
    Icon: ShoppingBag,
  },
  {
    id: "wholesale",
    title: "Khách sỉ đăng ký",
    desc: "Đại lý gửi hồ sơ yêu cầu giá sỉ",
    Icon: Store,
  },
  {
    id: "ctv",
    title: "Cộng tác viên (CTV)",
    desc: "Thành viên đăng ký tham gia CTV",
    Icon: Users,
  },
  {
    id: "recruitment",
    title: "Hồ sơ tuyển dụng",
    desc: "Ứng viên nộp hồ sơ xin việc",
    Icon: Briefcase,
  },
];

export function getStoredSoundSettings(): SoundSettings {
  if (typeof window === "undefined") return DEFAULT_SOUND_SETTINGS;
  try {
    const raw = window.localStorage?.getItem(SOUND_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        masterEnabled: typeof parsed.masterEnabled === "boolean" ? parsed.masterEnabled : true,
        volume: typeof parsed.volume === "number" ? Math.max(0, Math.min(100, parsed.volume)) : 85,
        categories: {
          order: {
            enabled: parsed.categories?.order?.enabled !== false,
            style: parsed.categories?.order?.style || "voice",
          },
          wholesale: {
            enabled: parsed.categories?.wholesale?.enabled !== false,
            style: parsed.categories?.wholesale?.style || "voice",
          },
          ctv: {
            enabled: parsed.categories?.ctv?.enabled !== false,
            style: parsed.categories?.ctv?.style || "voice",
          },
          recruitment: {
            enabled: parsed.categories?.recruitment?.enabled !== false,
            style: parsed.categories?.recruitment?.style || "voice",
          },
        },
      };
    }
    const legacy = window.localStorage?.getItem(LEGACY_STORAGE_KEY) as ChimeStyle;
    if (legacy && ["voice", "marimba", "chaching", "bell", "ping"].includes(legacy)) {
      return {
        ...DEFAULT_SOUND_SETTINGS,
        categories: {
          ...DEFAULT_SOUND_SETTINGS.categories,
          order: { enabled: true, style: legacy },
        },
      };
    }
  } catch {
    /* fallback default */
  }
  return DEFAULT_SOUND_SETTINGS;
}

export function saveStoredSoundSettings(settings: SoundSettings) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage?.setItem(SOUND_STORAGE_KEY, JSON.stringify(settings));
    window.localStorage?.setItem(LEGACY_STORAGE_KEY, settings.categories.order.style);
  } catch {
    /* ignore */
  }
}

// ─── TỔNG HỢP ÂM THANH (Web Audio API) ───────────────────────────────────

function createGainMaster(ctx: AudioContext, volFactor: number): GainNode {
  const master = ctx.createGain();
  const safeVol = Math.max(0, Math.min(1, volFactor));
  master.gain.setValueAtTime(safeVol, ctx.currentTime);
  master.connect(ctx.destination);
  return master;
}

function playMarimbaChime(ctx: AudioContext, dest: AudioNode) {
  const notes = [
    { freq: 523.25, time: 0, duration: 0.26 },
    { freq: 659.25, time: 0.08, duration: 0.26 },
    { freq: 783.99, time: 0.16, duration: 0.3 },
    { freq: 1046.5, time: 0.24, duration: 0.6 },
  ];

  for (const n of notes) {
    const t = ctx.currentTime + n.time;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(n.freq, t);

    const oscH = ctx.createOscillator();
    const gainH = ctx.createGain();
    oscH.type = "triangle";
    oscH.frequency.setValueAtTime(n.freq * 2, t);

    gain.gain.setValueAtTime(0.35, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + n.duration);

    gainH.gain.setValueAtTime(0.12, t);
    gainH.gain.exponentialRampToValueAtTime(0.001, t + n.duration * 0.7);

    osc.connect(gain);
    gain.connect(dest);
    oscH.connect(gainH);
    gainH.connect(dest);

    osc.start(t);
    osc.stop(t + n.duration);
    oscH.start(t);
    oscH.stop(t + n.duration);
  }
}

function playCashRegisterChime(ctx: AudioContext, dest: AudioNode) {
  const t = ctx.currentTime;

  const bell = ctx.createOscillator();
  const bellGain = ctx.createGain();
  bell.type = "sine";
  bell.frequency.setValueAtTime(2093, t + 0.02);
  bellGain.gain.setValueAtTime(0.4, t + 0.02);
  bellGain.gain.exponentialRampToValueAtTime(0.001, t + 0.65);
  bell.connect(bellGain);
  bellGain.connect(dest);
  bell.start(t + 0.02);
  bell.stop(t + 0.65);

  const thud = ctx.createOscillator();
  const thudGain = ctx.createGain();
  thud.type = "triangle";
  thud.frequency.setValueAtTime(160, t);
  thud.frequency.exponentialRampToValueAtTime(45, t + 0.1);
  thudGain.gain.setValueAtTime(0.4, t);
  thudGain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
  thud.connect(thudGain);
  thudGain.connect(dest);
  thud.start(t);
  thud.stop(t + 0.1);

  const coins = [
    { freq: 3100, delay: 0.09, dur: 0.15 },
    { freq: 3950, delay: 0.14, dur: 0.18 },
    { freq: 4700, delay: 0.2, dur: 0.22 },
  ];
  for (const c of coins) {
    const coinOsc = ctx.createOscillator();
    const coinGain = ctx.createGain();
    coinOsc.type = "sine";
    coinOsc.frequency.setValueAtTime(c.freq, t + c.delay);
    coinGain.gain.setValueAtTime(0.25, t + c.delay);
    coinGain.gain.exponentialRampToValueAtTime(0.001, t + c.delay + c.dur);
    coinOsc.connect(coinGain);
    coinGain.connect(dest);
    coinOsc.start(t + c.delay);
    coinOsc.stop(t + c.delay + c.dur);
  }
}

function playClassicBell(ctx: AudioContext, dest: AudioNode) {
  const t = ctx.currentTime;
  const osc1 = ctx.createOscillator();
  const gain1 = ctx.createGain();
  osc1.type = "sine";
  osc1.frequency.setValueAtTime(587.33, t);
  gain1.gain.setValueAtTime(0.35, t);
  gain1.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
  osc1.connect(gain1);
  gain1.connect(dest);
  osc1.start(t);
  osc1.stop(t + 0.35);

  const osc2 = ctx.createOscillator();
  const gain2 = ctx.createGain();
  osc2.type = "sine";
  osc2.frequency.setValueAtTime(880, t + 0.15);
  gain2.gain.setValueAtTime(0.4, t + 0.15);
  gain2.gain.exponentialRampToValueAtTime(0.001, t + 0.7);
  osc2.connect(gain2);
  gain2.connect(dest);
  osc2.start(t + 0.15);
  osc2.stop(t + 0.7);
}

function playSoftPing(ctx: AudioContext, dest: AudioNode) {
  const t = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(880, t);
  osc.frequency.exponentialRampToValueAtTime(1760, t + 0.12);
  gain.gain.setValueAtTime(0.3, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
  osc.connect(gain);
  gain.connect(dest);
  osc.start(t);
  osc.stop(t + 0.5);
}

function getBestVietnameseVoice(): SpeechSynthesisVoice | null {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return null;
  const voices = window.speechSynthesis.getVoices();
  if (!voices || !voices.length) return null;

  const natural = voices.find(
    (v) =>
      v.lang.replace("_", "-").toLowerCase().startsWith("vi") &&
      (v.name.includes("Natural") ||
        v.name.includes("Online") ||
        v.name.includes("Google") ||
        v.name.includes("HoaiMy") ||
        v.name.includes("NamMinh"))
  );
  if (natural) return natural;

  return voices.find((v) => v.lang.replace("_", "-").toLowerCase().startsWith("vi")) || null;
}

function speakVoiceNotice(text: string, volFactor = 0.85) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  try {
    const synth = window.speechSynthesis;
    synth.cancel();

    setTimeout(() => {
      try {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = "vi-VN";
        utterance.rate = 0.98;
        utterance.pitch = 1.0;
        utterance.volume = Math.max(0, Math.min(1, volFactor));

        const bestVoice = getBestVietnameseVoice();
        if (bestVoice) {
          utterance.voice = bestVoice;
        }

        synth.speak(utterance);
      } catch {
        /* safely ignore */
      }
    }, 80);
  } catch {
    /* safely ignore */
  }
}

/**
 * Phát âm thanh cho từng loại sự kiện thông báo
 */
export function playNotificationSound(
  category: NotificationCategory = "order",
  previewStyle?: ChimeStyle,
  previewVolume?: number
) {
  try {
    const AudioContextClass =
      window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;

    const settings = getStoredSoundSettings();

    if (!previewStyle) {
      if (!settings.masterEnabled) return;
      if (!settings.categories[category]?.enabled) return;
    }

    const vol = typeof previewVolume === "number" ? previewVolume : settings.volume;
    const volFactor = vol / 100;
    if (volFactor <= 0) return;

    const style: ChimeStyle = previewStyle || settings.categories[category]?.style || "voice";

    const ctx = new AudioContextClass();
    if (ctx.state === "suspended") {
      ctx.resume().catch(() => {});
    }

    const master = createGainMaster(ctx, volFactor);

    if (style === "chaching") {
      playCashRegisterChime(ctx, master);
    } else if (style === "marimba") {
      playMarimbaChime(ctx, master);
    } else if (style === "bell") {
      playClassicBell(ctx, master);
    } else if (style === "ping") {
      playSoftPing(ctx, master);
    } else {
      playClassicBell(ctx, master);
      setTimeout(() => {
        speakVoiceNotice(NOTIFICATION_VOICE_TEXTS[category], volFactor);
      }, 550);
    }
  } catch {
    /* safely ignore */
  }
}

/** Tương thích ngược */
export function playOrderChime(explicitStyle?: ChimeStyle) {
  playNotificationSound("order", explicitStyle);
}

function showBrowserNotification(title: string, body: string, targetUrl?: string) {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission === "granted") {
    try {
      const notif = new Notification(title, {
        body,
        icon: "/brand/logo-icon.png",
        badge: "/brand/logo-icon.png",
        tag: "aloha-admin-alert",
      });
      notif.onclick = () => {
        window.focus();
        if (targetUrl) {
          window.location.href = targetUrl;
        }
        notif.close();
      };
    } catch {
      /* ignore */
    }
  }
}

export function useAdminOpsCounts(enabled: boolean) {
  return useQuery({
    queryKey: ["admin", "ops", "counts"],
    queryFn: () =>
      adminFetch<AdminOpsCounts & { ok?: boolean }>("/api/shop/admin/ops/counts"),
    enabled,
    refetchInterval: () =>
      typeof document !== "undefined" && document.visibilityState === "visible"
        ? 60_000
        : false,
    staleTime: 10_000,
  });
}

/**
 * Component lắng nghe SSE thời gian thực và quản lý cài đặt âm thanh thông báo
 */
export function AdminOpsSync({ enabled }: { enabled: boolean }) {
  const qc = useQueryClient();
  const lastToastAt = useRef(0);
  const pendingOrderIds = useRef<Set<string>>(new Set());
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const invalidateTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingInvalidationCols = useRef<Set<string>>(new Set());
  const originalTitleRef = useRef<string>("");
  const titleFlashInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  const [showPermPrompt, setShowPermPrompt] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [soundSettings, setSoundSettings] = useState<SoundSettings>(DEFAULT_SOUND_SETTINGS);
  const [playingPreview, setPlayingPreview] = useState<string | null>(null);

  useEffect(() => {
    setSoundSettings(getStoredSoundSettings());
  }, []);

  useEffect(() => {
    const handleOpen = () => {
      setSoundSettings(getStoredSoundSettings());
      setShowSettingsModal(true);
    };
    window.addEventListener("aloha_open_chime_settings", handleOpen);
    return () => window.removeEventListener("aloha_open_chime_settings", handleOpen);
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").then(async (reg) => {
        if ("Notification" in window && Notification.permission === "granted" && reg.pushManager) {
          const sub = await reg.pushManager.getSubscription();
          if (!sub) {
            void subscribeToWebPush();
          }
        }
      }).catch(() => {});
    }

    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.getVoices();
      window.speechSynthesis.onvoiceschanged = () => {
        window.speechSynthesis.getVoices();
      };
    }

    if (
      typeof window !== "undefined" &&
      "Notification" in window &&
      Notification.permission === "default"
    ) {
      setShowPermPrompt(true);
    }
  }, []);

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible" && titleFlashInterval.current) {
        clearInterval(titleFlashInterval.current);
        titleFlashInterval.current = null;
        if (originalTitleRef.current) {
          document.title = originalTitleRef.current;
        }
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("focus", onVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("focus", onVisibilityChange);
    };
  }, []);

  useEffect(() => {
    if (!enabled || typeof EventSource === "undefined") return;

    let es: EventSource | null = null;
    let stopped = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let attempt = 0;

    const triggerEventAlert = (
      category: NotificationCategory,
      title: string,
      body: string,
      targetUrl?: string
    ) => {
      playNotificationSound(category);

      if (typeof document !== "undefined" && document.visibilityState !== "visible") {
        showBrowserNotification(title, body, targetUrl);

        if (!originalTitleRef.current) {
          originalTitleRef.current = document.title;
        }
        if (!titleFlashInterval.current) {
          let toggle = false;
          titleFlashInterval.current = setInterval(() => {
            toggle = !toggle;
            document.title = toggle ? `🔴 THÔNG BÁO MỚI! · ALOHA` : originalTitleRef.current;
          }, 1000);
        }
      }

      const now = Date.now();
      if (now - lastToastAt.current >= 1500) {
        lastToastAt.current = now;
        toast.success(title, {
          duration: 6000,
          description: body,
        });
      }
    };

    const flushOrderToast = () => {
      toastTimer.current = null;
      const n = pendingOrderIds.current.size;
      if (!n) return;

      const sample = [...pendingOrderIds.current].slice(0, 3).join(", ");
      const firstId = [...pendingOrderIds.current][0];
      pendingOrderIds.current.clear();

      playNotificationSound("order");

      const notifTitle = "🔔 ALOHA - Có đơn hàng mới!";
      const notifBody =
        n === 1
          ? `Đơn mới: ${sample || "—"}`
          : `+${n} đơn mới vừa được tạo (${sample}…)`;

      const targetUrl =
        n === 1 && firstId && firstId !== "Đơn mới"
          ? `/admin/don-hang-web?code=${encodeURIComponent(firstId)}`
          : `/admin/don-hang-web`;

      if (typeof document !== "undefined" && document.visibilityState !== "visible") {
        showBrowserNotification(notifTitle, notifBody, targetUrl);

        if (!originalTitleRef.current) {
          originalTitleRef.current = document.title;
        }
        if (!titleFlashInterval.current) {
          let toggle = false;
          titleFlashInterval.current = setInterval(() => {
            toggle = !toggle;
            document.title = toggle
              ? `🔴 (${n}) ĐƠN HÀNG MỚI! · ALOHA`
              : originalTitleRef.current;
          }, 1000);
        }
      }

      const now = Date.now();
      if (now - lastToastAt.current >= 1500) {
        lastToastAt.current = now;
        toast.success(notifBody, {
          duration: 6000,
          description: "Bảng đơn hàng đã tự động làm mới tức thì.",
        });
      }
    };

    const flushInvalidation = () => {
      invalidateTimer.current = null;
      const cols = [...pendingInvalidationCols.current];
      pendingInvalidationCols.current.clear();

      void qc.invalidateQueries({ queryKey: ["admin", "ops", "counts"] });
      void qc.invalidateQueries({ queryKey: ["admin", "ops", "notifications"] });

      if (cols.some((c) => c.includes("order"))) {
        void qc.invalidateQueries({ queryKey: ["admin", "orders"] });
        void qc.invalidateQueries({ queryKey: ["admin", "web-orders"] });
        void qc.invalidateQueries({ queryKey: ["admin", "ctv", "commissions"] });
      }
      if (cols.some((c) => c.includes("ctv") || c.includes("affiliate"))) {
        void qc.invalidateQueries({ queryKey: ["admin", "ctv"] });
      }
      if (cols.some((c) => c.includes("product") || c.includes("catalog"))) {
        void qc.invalidateQueries({ queryKey: ["admin", "products"] });
      }
      if (cols.some((c) => c.includes("account"))) {
        void qc.invalidateQueries({ queryKey: ["admin", "accounts"] });
      }
      if (cols.some((c) => c.includes("recruitment") || c.includes("application"))) {
        void qc.invalidateQueries({ queryKey: ["admin", "recruitment"] });
      }
    };

    const invalidate = (payload: {
      collections?: string[];
      ids?: string[];
      source?: string;
    }) => {
      const cols = payload.collections || [];
      const src = String(payload.source || "");

      const isOrder = cols.some((c) => c.includes("order")) || src.includes("order");
      const isWholesale = src.includes("si_register") || src.includes("si_status") || src.includes("si_");
      const isCtv = src.includes("ctv_register") || src.includes("ctv_apply");
      const isRecruitment =
        src.includes("recruitment_apply") ||
        cols.some((c) => c.includes("recruitment") || c.includes("application"));

      if (!cols.length) {
        pendingInvalidationCols.current.add("order");
      } else {
        for (const c of cols) pendingInvalidationCols.current.add(c);
      }

      if (!invalidateTimer.current) {
        invalidateTimer.current = setTimeout(flushInvalidation, 250);
      }

      if (isOrder) {
        const ids = payload.ids || [];
        for (const id of ids) pendingOrderIds.current.add(id);
        if (!ids.length && payload.source?.includes("create")) {
          pendingOrderIds.current.add("Đơn mới");
        }
        if (!toastTimer.current) {
          toastTimer.current = setTimeout(flushOrderToast, 350);
        }
      } else if (isWholesale) {
        triggerEventAlert("wholesale", "🏢 ALOHA - Khách sỉ mới đăng ký!", "Có khách sỉ mới gửi hồ sơ đăng ký.", "/admin/ctv/khach-hang");
      } else if (isCtv) {
        triggerEventAlert("ctv", "🤝 ALOHA - CTV mới đăng ký!", "Có cộng tác viên mới đăng ký tài khoản CTV.", "/admin/ctv/danh-sach");
      } else if (isRecruitment) {
        triggerEventAlert("recruitment", "📄 ALOHA - Có ứng viên nộp hồ sơ!", "Ứng viên vừa nộp hồ sơ ứng tuyển.", "/admin/tuyen-dung/ho-so");
      }
    };

    const connect = () => {
      if (stopped) return;
      try {
        es = new EventSource("/api/shop/admin/ops/stream", { withCredentials: true });
      } catch {
        schedule();
        return;
      }
      es.addEventListener("hello", () => { attempt = 0; });
      es.addEventListener("ops", (ev) => {
        attempt = 0;
        try {
          const data = JSON.parse(String((ev as MessageEvent).data || "{}"));
          invalidate(data);
        } catch {
          invalidate({});
        }
      });
      es.onerror = () => {
        try { es?.close(); } catch {}
        es = null;
        schedule();
      };
    };

    const schedule = () => {
      if (stopped || reconnectTimer) return;
      const delay = Math.min(30_000, 2000 * Math.pow(2, attempt)) + Math.floor(Math.random() * 500);
      attempt += 1;
      reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        connect();
      }, delay);
    };

    connect();

    return () => {
      stopped = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (es) {
        try { es.close(); } catch {}
      }
    };
  }, [enabled, qc]);

  const requestPermission = async () => {
    setShowPermPrompt(false);
    if (typeof window !== "undefined" && "Notification" in window) {
      try {
        const perm = await Notification.requestPermission();
        if (perm === "granted") {
          void subscribeToWebPush();
          toast.success("Đã bật thông báo", {
            description: "Hệ thống sẽ thông báo ngay cả khi đóng trình duyệt hoặc khoá màn hình.",
          });
        }
      } catch {
        /* ignore */
      }
    }
  };

  const handleUpdateMaster = (enabledVal: boolean) => {
    const updated = { ...soundSettings, masterEnabled: enabledVal };
    setSoundSettings(updated);
    saveStoredSoundSettings(updated);
  };

  const handleUpdateVolume = (vol: number) => {
    const updated = { ...soundSettings, volume: vol };
    setSoundSettings(updated);
    saveStoredSoundSettings(updated);
  };

  const handleUpdateCategory = (
    cat: NotificationCategory,
    patch: Partial<CategorySoundConfig>
  ) => {
    const updated = {
      ...soundSettings,
      categories: {
        ...soundSettings.categories,
        [cat]: {
          ...soundSettings.categories[cat],
          ...patch,
        },
      },
    };
    setSoundSettings(updated);
    saveStoredSoundSettings(updated);
  };

  const handlePreview = (cat: NotificationCategory) => {
    setPlayingPreview(cat);
    playNotificationSound(cat, soundSettings.categories[cat].style, soundSettings.volume);
    setTimeout(() => {
      setPlayingPreview(null);
    }, 1800);
  };

  return (
    <>
      {/* 1. Prompt xin quyền Desktop Notification */}
      {showPermPrompt && (
        <div className="fixed bottom-4 right-4 z-50 flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3.5 shadow-xl transition-all animate-in fade-in slide-in-from-bottom-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
            <Bell className="h-4 w-4" />
          </div>
          <div className="text-xs">
            <p className="font-semibold text-slate-800">Bật thông báo chuông và màn hình?</p>
            <p className="text-slate-500">Nhận chuông và tin báo tức thì cho đơn mới, khách sỉ, CTV và tuyển dụng.</p>
          </div>
          <div className="flex items-center gap-1.5 pl-2">
            <button
              type="button"
              onClick={requestPermission}
              className="rounded-lg bg-[#2D5A27] px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-[#23481f]"
            >
              Bật ngay
            </button>
            <button
              type="button"
              onClick={() => setShowPermPrompt(false)}
              className="rounded-lg px-2 py-1.5 text-xs text-slate-400 hover:text-slate-600"
            >
              Để sau
            </button>
          </div>
        </div>
      )}

      {/* 2. Modal Cài đặt âm thanh thông báo chuẩn Apple / Slack / Shopify (Tối giản, trang nhã, không rối mắt) */}
      {showSettingsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs animate-in fade-in">
          <div className="relative flex flex-col w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-2xl animate-in zoom-in-95 overflow-hidden">
            {/* Header tối giản */}
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div className="flex items-center gap-2.5">
                <Volume2 className="h-5 w-5 text-slate-700" />
                <div>
                  <h3 className="text-base font-bold text-slate-800 leading-snug">
                    Âm thanh thông báo
                  </h3>
                  <p className="text-xs text-slate-500">
                    Tùy chỉnh chuông báo và giọng đọc tiếng Việt khi có hoạt động mới.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowSettingsModal(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Body */}
            <div className="p-5 space-y-4 text-slate-800 max-h-[80vh] overflow-y-auto">
              {/* Box Cài đặt Web Push Notification (Màn hình khóa & Đóng trình duyệt) */}
              <AdminPushSettingsCard />

              {/* Box Cài đặt chung: Bật/Tắt âm thanh + Âm lượng */}
              <div className="rounded-xl border border-slate-200/90 bg-slate-50/60 p-3.5 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-800">
                      Bật âm thanh hệ thống
                    </p>
                    <p className="text-xs text-slate-500">
                      {soundSettings.masterEnabled
                        ? "Đang phát chuông khi có sự kiện mới"
                        : "Đã tắt toàn bộ âm thanh"}
                    </p>
                  </div>
                  <Switch
                    checked={soundSettings.masterEnabled}
                    onChange={handleUpdateMaster}
                  />
                </div>

                {soundSettings.masterEnabled && (
                  <div className="pt-2.5 border-t border-slate-200/60 flex items-center gap-3">
                    <span className="text-xs font-medium text-slate-600 shrink-0">
                      Âm lượng
                    </span>
                    <input
                      type="range"
                      min="10"
                      max="100"
                      step="5"
                      value={soundSettings.volume}
                      onChange={(e) => handleUpdateVolume(Number(e.target.value))}
                      className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-[#2D5A27]"
                    />
                    <span className="text-xs font-semibold tabular-nums text-slate-600 w-9 text-right shrink-0">
                      {soundSettings.volume}%
                    </span>
                    <button
                      type="button"
                      onClick={() => playNotificationSound("order", "ping", soundSettings.volume)}
                      className="shrink-0 rounded-md border border-slate-200 bg-white px-2 py-0.5 text-xs text-slate-600 hover:border-slate-300 hover:text-slate-800 transition"
                    >
                      Thử loa
                    </button>
                  </div>
                )}
              </div>

              {/* Danh sách 4 sự kiện chuẩn bảng phẳng (Flat List) */}
              <div>
                <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Âm thanh theo sự kiện
                </p>
                <div className="rounded-xl border border-slate-200/90 bg-white divide-y divide-slate-100 overflow-hidden">
                  {NOTIFICATION_ROWS.map(({ id, title, desc, Icon }) => {
                    const catConfig = soundSettings.categories[id];
                    const isEnabled = soundSettings.masterEnabled && catConfig.enabled;
                    const isPlaying = playingPreview === id;

                    return (
                      <div
                        key={id}
                        className={`flex items-center justify-between gap-3 px-3.5 py-3 transition ${
                          isEnabled ? "bg-white" : "bg-slate-50/40 opacity-55"
                        }`}
                      >
                        {/* Cột trái: Icon + Tên */}
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
                            <Icon className="h-3.5 w-3.5" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-slate-800 truncate">
                              {title}
                            </p>
                            <p className="text-[11px] text-slate-400 truncate">
                              {desc}
                            </p>
                          </div>
                        </div>

                        {/* Cột phải: Dropdown chọn âm thanh + Nút Play + Switch */}
                        <div className="flex items-center gap-2 shrink-0">
                          <Select
                            size="middle"
                            value={catConfig.style}
                            disabled={!isEnabled}
                            onChange={(val) => handleUpdateCategory(id, { style: val as ChimeStyle })}
                            options={SOUND_SELECT_OPTIONS}
                            className="w-44 !text-xs"
                          />

                          <button
                            type="button"
                            onClick={() => handlePreview(id)}
                            disabled={!isEnabled}
                            title="Nghe thử âm thanh"
                            className={`flex h-8 w-8 items-center justify-center rounded-lg border transition ${
                              isPlaying
                                ? "border-[#2D5A27] bg-emerald-50 text-[#2D5A27] ring-1 ring-[#2D5A27]/20"
                                : "border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:text-slate-800"
                            }`}
                          >
                            <Play className="h-3 w-3 fill-current" />
                          </button>

                          <Switch
                            size="small"
                            checked={catConfig.enabled && soundSettings.masterEnabled}
                            disabled={!soundSettings.masterEnabled}
                            onChange={(val) => handleUpdateCategory(id, { enabled: val })}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3.5 bg-slate-50/50">
              <span className="text-xs text-slate-400">
                Tự động lưu thay đổi trên thiết bị này.
              </span>
              <button
                type="button"
                onClick={() => setShowSettingsModal(false)}
                className="rounded-xl bg-[#2D5A27] px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-[#23481f] transition active:scale-95"
              >
                Hoàn tất
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export function useAdminBadgeCounts(enabled: boolean) {
  const q = useAdminOpsCounts(enabled);
  return {
    ordersNeedAction: Number(q.data?.ordersNeedAction) || 0,
    ctvPending: Number(q.data?.ctvPending) || 0,
    fraudOpen: Number(q.data?.fraudOpen) || 0,
    isLoading: q.isLoading,
  };
}
