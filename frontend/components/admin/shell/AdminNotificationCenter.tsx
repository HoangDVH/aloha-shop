"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Drawer } from "antd";
import {
  Bell,
  Briefcase,
  CheckCheck,
  ChevronRight,
  Inbox,
  ShoppingBag,
  Store,
  Users,
  Volume2,
  X,
} from "lucide-react";
import { adminFetch } from "@/components/admin/api/adminFetch";

export type AdminNotificationItem = {
  id: string;
  type: "order" | "wholesale" | "ctv" | "recruitment";
  title: string;
  subtitle: string;
  detail?: string;
  createdAt: string;
  link: string;
  tag?: string;
  tagColor?: string;
  needsAction?: boolean;
};

export type AdminNotificationsResponse = {
  ok: boolean;
  items: AdminNotificationItem[];
  counts: {
    total: number;
    orders: number;
    wholesale: number;
    ctv: number;
    recruitment: number;
  };
  at: number;
};

type TabKey = "all" | "orders" | "wholesale_ctv" | "recruitment";

const STORAGE_READ_IDS = "aloha_admin_read_notif_ids";
const STORAGE_READ_ALL_AT = "aloha_admin_read_all_timestamp";

function getReadIds(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(STORAGE_READ_IDS);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

function saveReadIds(set: Set<string>) {
  if (typeof window === "undefined") return;
  try {
    const arr = Array.from(set).slice(-200);
    localStorage.setItem(STORAGE_READ_IDS, JSON.stringify(arr));
  } catch {
    /* ignore */
  }
}

function getReadAllAt(): number {
  if (typeof window === "undefined") return 0;
  try {
    return Number(localStorage.getItem(STORAGE_READ_ALL_AT)) || 0;
  } catch {
    return 0;
  }
}

function formatNotificationTime(iso: string): string {
  try {
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60_000);

    if (diffMins < 1) return "Vừa xong";
    if (diffMins < 60) return `${diffMins} phút trước`;

    const isToday =
      d.getDate() === now.getDate() &&
      d.getMonth() === now.getMonth() &&
      d.getFullYear() === now.getFullYear();

    const timeStr = d.toLocaleTimeString("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });

    if (isToday) return `${timeStr} hôm nay`;

    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const isYesterday =
      d.getDate() === yesterday.getDate() &&
      d.getMonth() === yesterday.getMonth() &&
      d.getFullYear() === yesterday.getFullYear();

    if (isYesterday) return `${timeStr} hôm qua`;

    const dateStr = d.toLocaleDateString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
    return `${timeStr} ${dateStr}`;
  } catch {
    return "";
  }
}

export function AdminNotificationCenter({
  mode = "auto",
}: {
  mode?: "desktop" | "mobile" | "auto";
}) {
  const router = useRouter();
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>("all");
  const [readIds, setReadIds] = useState<Set<string>>(() => getReadIds());
  const [readAllAt, setReadAllAt] = useState<number>(() => getReadAllAt());
  const [internalMobile, setInternalMobile] = useState(false);

  // Responsive mobile determination
  useEffect(() => {
    if (mode === "desktop") {
      setInternalMobile(false);
      return;
    }
    if (mode === "mobile") {
      setInternalMobile(true);
      return;
    }
    const checkMobile = () => {
      setInternalMobile(window.innerWidth < 1024);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, [mode]);

  const isMobile = mode === "mobile" || (mode === "auto" && internalMobile);

  // Close desktop dropdown when clicking outside or pressing Escape
  useEffect(() => {
    if (!open || isMobile) return;

    const onMouseDown = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, isMobile]);

  // Listen to cross-tab storage changes
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_READ_IDS) setReadIds(getReadIds());
      if (e.key === STORAGE_READ_ALL_AT) setReadAllAt(getReadAllAt());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const { data } = useQuery({
    queryKey: ["admin", "ops", "notifications"],
    queryFn: () => adminFetch<AdminNotificationsResponse>("/api/shop/admin/ops/notifications"),
    refetchInterval: 30_000,
    staleTime: 10_000,
  });

  const allItems = data?.items || [];

  const isUnread = (item: AdminNotificationItem) => {
    if (readIds.has(item.id)) return false;
    const itemTime = new Date(item.createdAt).getTime();
    if (readAllAt > 0 && itemTime <= readAllAt) return false;
    return true;
  };

  const markAsRead = (id: string) => {
    setReadIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      saveReadIds(next);
      return next;
    });
  };

  const markAllAsRead = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    const now = Date.now();
    setReadAllAt(now);
    try {
      localStorage.setItem(STORAGE_READ_ALL_AT, String(now));
      const next = new Set(readIds);
      allItems.forEach((item) => next.add(item.id));
      saveReadIds(next);
      setReadIds(next);
    } catch {
      /* ignore */
    }
  };

  // Compute unread per category
  const unreadCounts = useMemo(() => {
    let all = 0;
    let orders = 0;
    let wholesaleCtv = 0;
    let recruitment = 0;

    for (const item of allItems) {
      if (isUnread(item)) {
        all++;
        if (item.type === "order") orders++;
        else if (item.type === "wholesale" || item.type === "ctv") wholesaleCtv++;
        else if (item.type === "recruitment") recruitment++;
      }
    }

    return { all, orders, wholesaleCtv, recruitment };
  }, [allItems, readIds, readAllAt]);

  const filteredItems = useMemo(() => {
    if (activeTab === "orders") {
      return allItems.filter((i) => i.type === "order");
    }
    if (activeTab === "wholesale_ctv") {
      return allItems.filter((i) => i.type === "wholesale" || i.type === "ctv");
    }
    if (activeTab === "recruitment") {
      return allItems.filter((i) => i.type === "recruitment");
    }
    return allItems;
  }, [allItems, activeTab]);

  const handleItemClick = (item: AdminNotificationItem) => {
    markAsRead(item.id);
    setOpen(false);
    router.push(item.link);
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("aloha_open_notification_target", { detail: item })
      );
    }
  };

  const renderItemIcon = (type: AdminNotificationItem["type"]) => {
    switch (type) {
      case "order":
        return (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
            <ShoppingBag className="h-5 w-5" />
          </div>
        );
      case "wholesale":
        return (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-purple-50 text-purple-700">
            <Store className="h-5 w-5" />
          </div>
        );
      case "ctv":
        return (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-700">
            <Users className="h-5 w-5" />
          </div>
        );
      case "recruitment":
        return (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-sky-700">
            <Briefcase className="h-5 w-5" />
          </div>
        );
      default:
        return (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
            <Bell className="h-5 w-5" />
          </div>
        );
    }
  };

  // Content for Popover (Desktop) and Drawer (Mobile)
  const notificationContent = (
    <div className="flex flex-col bg-white">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
        <h2 className="text-base font-bold text-slate-900">Hộp thư đến</h2>
        <div className="flex items-center gap-1.5">
          {unreadCounts.all > 0 && (
            <button
              type="button"
              onClick={markAllAsRead}
              className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-50"
            >
              <CheckCheck className="h-3.5 w-3.5" />
              Đánh dấu đã đọc
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              if (typeof window !== "undefined") {
                window.dispatchEvent(new CustomEvent("aloha_open_chime_settings"));
              }
            }}
            title="Cài đặt âm thanh thông báo"
            className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-emerald-700"
          >
            <Volume2 className="h-4 w-4" />
          </button>
          {isMobile && (
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>
      </div>

      {/* Tabs matching KiotViet UX */}
      <div className="flex border-b border-slate-100 px-3">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setActiveTab("all");
          }}
          className={`relative px-3 py-2 text-xs font-semibold transition ${
            activeTab === "all"
              ? "border-b-2 border-[#2D5A27] text-[#2D5A27]"
              : "text-slate-500 hover:text-slate-900"
          }`}
        >
          <span>Tất cả</span>
          {unreadCounts.all > 0 && (
            <span className="ml-1.5 inline-block h-2 w-2 rounded-full bg-[#E53935]" />
          )}
        </button>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setActiveTab("orders");
          }}
          className={`relative px-3 py-2 text-xs font-semibold transition ${
            activeTab === "orders"
              ? "border-b-2 border-[#2D5A27] text-[#2D5A27]"
              : "text-slate-500 hover:text-slate-900"
          }`}
        >
          <span>Đơn hàng</span>
          {unreadCounts.orders > 0 && (
            <span className="ml-1.5 inline-block h-2 w-2 rounded-full bg-[#E53935]" />
          )}
        </button>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setActiveTab("wholesale_ctv");
          }}
          className={`relative px-3 py-2 text-xs font-semibold transition ${
            activeTab === "wholesale_ctv"
              ? "border-b-2 border-[#2D5A27] text-[#2D5A27]"
              : "text-slate-500 hover:text-slate-900"
          }`}
        >
          <span>Sỉ & CTV</span>
          {unreadCounts.wholesaleCtv > 0 && (
            <span className="ml-1.5 inline-block h-2 w-2 rounded-full bg-[#E53935]" />
          )}
        </button>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setActiveTab("recruitment");
          }}
          className={`relative px-3 py-2 text-xs font-semibold transition ${
            activeTab === "recruitment"
              ? "border-b-2 border-[#2D5A27] text-[#2D5A27]"
              : "text-slate-500 hover:text-slate-900"
          }`}
        >
          <span>Tuyển dụng</span>
          {unreadCounts.recruitment > 0 && (
            <span className="ml-1.5 inline-block h-2 w-2 rounded-full bg-[#E53935]" />
          )}
        </button>
      </div>

      {/* List items */}
      <div className="max-h-[460px] min-h-[180px] overflow-y-auto divide-y divide-slate-100">
        {filteredItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-slate-400">
            <Inbox className="h-10 w-10 stroke-[1.25] text-slate-300" />
            <p className="mt-2 text-xs font-medium text-slate-500">
              Không có thông báo nào trong mục này
            </p>
          </div>
        ) : (
          filteredItems.map((item) => {
            const unread = isUnread(item);
            return (
              <div
                key={item.id}
                onClick={() => handleItemClick(item)}
                className={`group flex items-start gap-3 px-4 py-3 transition cursor-pointer ${
                  unread ? "bg-blue-50/25 hover:bg-blue-50/50" : "hover:bg-slate-50"
                }`}
              >
                {renderItemIcon(item.type)}

                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-1">
                    <p
                      className={`truncate text-[13px] ${
                        unread ? "font-bold text-slate-900" : "font-medium text-slate-700"
                      }`}
                    >
                      {item.title}
                    </p>
                    {unread && (
                      <span
                        className="h-2 w-2 shrink-0 rounded-full bg-[#1890ff] shadow-sm"
                        title="Chưa đọc"
                      />
                    )}
                  </div>

                  <p className="mt-0.5 truncate text-xs text-slate-600">{item.subtitle}</p>

                  <div className="mt-1 flex items-center gap-2 text-[11px] text-slate-400">
                    {item.tag && (
                      <span
                        className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                          item.tagColor === "emerald"
                            ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/10"
                            : item.tagColor === "purple"
                            ? "bg-purple-50 text-purple-700 ring-1 ring-purple-600/10"
                            : item.tagColor === "amber"
                            ? "bg-amber-50 text-amber-700 ring-1 ring-amber-600/10"
                            : item.tagColor === "blue" || item.tagColor === "cyan"
                            ? "bg-sky-50 text-sky-700 ring-1 ring-sky-600/10"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {item.tag}
                      </span>
                    )}
                    <span>{formatNotificationTime(item.createdAt)}</span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer shortcut */}
      <div className="border-t border-slate-100 bg-slate-50/80 px-4 py-2.5 text-center">
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            if (activeTab === "orders") router.push("/admin/don-hang-web");
            else if (activeTab === "wholesale_ctv") router.push("/admin/ctv/khach-hang");
            else if (activeTab === "recruitment") router.push("/admin/tuyen-dung/ho-so");
            else router.push("/admin/don-hang-web");
          }}
          className="inline-flex items-center gap-1 text-xs font-semibold text-[#2D5A27] hover:underline"
        >
          <span>Xem chi tiết danh sách quản lý</span>
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );

  const bellTriggerButton = (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        setOpen((prev) => !prev);
      }}
      aria-label={`Thông báo quản trị${unreadCounts.all > 0 ? `, ${unreadCounts.all} chưa đọc` : ""}`}
      className="relative flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-700 transition hover:bg-slate-200 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#2D5A27]/30"
    >
      <Bell className="h-[18px] w-[18px]" />
      {unreadCounts.all > 0 && (
        <span className="absolute -right-1 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[#E53935] px-1 text-[9.5px] font-bold text-white shadow ring-2 ring-white">
          {unreadCounts.all > 99 ? "99+" : unreadCounts.all}
        </span>
      )}
    </button>
  );

  return (
    <div ref={dropdownRef} className="relative inline-flex items-center">
      {bellTriggerButton}

      {/* Mobile Drawer */}
      {isMobile ? (
        <Drawer
          open={open}
          onClose={() => setOpen(false)}
          placement="bottom"
          closable={false}
          size="85vh"
          styles={{
            body: { padding: 0, borderTopLeftRadius: "1rem", borderTopRightRadius: "1rem" },
            section: { borderTopLeftRadius: "1rem", borderTopRightRadius: "1rem" },
          }}
          destroyOnHidden
        >
          {notificationContent}
        </Drawer>
      ) : (
        /* Desktop Popover Card positioned cleanly under the bell */
        open && (
          <div
            className="absolute right-0 top-full mt-2.5 z-50 w-[410px] overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-2xl ring-1 ring-black/5 animate-in fade-in zoom-in-95 duration-150"
            style={{ filter: "drop-shadow(0 20px 25px rgba(0, 0, 0, 0.12))" }}
          >
            {notificationContent}
          </div>
        )
      )}
    </div>
  );
}
