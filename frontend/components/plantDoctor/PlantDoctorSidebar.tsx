"use client";

import { useState } from "react";
import {
  Check,
  Edit2,
  MessageCircle,
  MessageSquare,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { ALOHA_ZALO } from "@/lib/plantDoctor/presets";
import {
  getSessionTimeGroup,
  TIME_GROUP_LABELS,
  type PlantDoctorSessionSummary,
} from "@/lib/plantDoctor/sessionStorage";

export function PlantDoctorSidebar({
  sessions,
  activeSessionId,
  isOpen,
  onClose,
  onNewChat,
  onSelectSession,
  onDeleteSession,
  onRenameSession,
}: {
  sessions: PlantDoctorSessionSummary[];
  activeSessionId: string | null;
  isOpen: boolean;
  onClose: () => void;
  onNewChat: () => void;
  onSelectSession: (id: string) => void;
  onDeleteSession: (id: string) => void;
  onRenameSession: (id: string, newTitle: string) => void;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const startEdit = (s: PlantDoctorSessionSummary, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(s.id);
    setEditTitle(s.title);
  };

  const saveEdit = (id: string, e: React.MouseEvent | React.FormEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (editTitle.trim()) {
      onRenameSession(id, editTitle.trim());
    }
    setEditingId(null);
  };

  const confirmDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onDeleteSession(id);
    setDeletingId(null);
  };

  // Nhóm các phiên theo thời gian chuẩn ChatGPT
  const groupedSessions: Record<string, PlantDoctorSessionSummary[]> = {
    today: [],
    yesterday: [],
    last7Days: [],
    last30Days: [],
    older: [],
  };

  sessions.forEach((s) => {
    const grp = getSessionTimeGroup(s.updatedAt);
    groupedSessions[grp]?.push(s);
  });

  const groupKeys = ["today", "yesterday", "last7Days", "last30Days", "older"].filter(
    (k) => (groupedSessions[k]?.length ?? 0) > 0
  );

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {isOpen ? (
        <div
          onClick={onClose}
          className="fixed inset-0 z-40 bg-black/30 backdrop-blur-xs transition-opacity lg:hidden"
          aria-hidden="true"
        />
      ) : null}

      {/* Sidebar Container (Responsive: Sliding Drawer on Mobile, Docked on Desktop) */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-72 flex-col bg-[#F9F9F9] border-r border-stone-200/80 transition-transform duration-300 ease-in-out lg:static lg:z-auto ${
          isOpen ? "translate-x-0" : "-translate-x-full lg:hidden"
        }`}
      >
        {/* Top Action Header: New Chat Button */}
        <div className="flex items-center justify-between p-3.5 border-b border-stone-200/70 gap-2 shrink-0">
          <button
            type="button"
            onClick={() => {
              onNewChat();
              if (window.innerWidth < 1024) onClose();
            }}
            className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-white border border-stone-200/90 py-2.5 px-3.5 text-xs font-bold text-stone-800 shadow-2xs hover:border-[#1C4C40] hover:bg-emerald-50/60 hover:text-[#1C4C40] active:scale-98 transition cursor-pointer"
          >
            <Plus size={16} strokeWidth={2.5} className="text-[#1C4C40]" />
            <span>Đoạn chat mới</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-xl text-stone-400 hover:text-stone-700 hover:bg-stone-200/60 transition cursor-pointer lg:hidden"
            title="Đóng thanh bên"
          >
            <X size={18} />
          </button>
        </div>

        {/* Sessions List (Scrollable Area) */}
        <div className="flex-1 overflow-y-auto px-2.5 py-2 space-y-4 min-h-0 select-none">
          {sessions.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-center px-4 text-stone-400 space-y-2">
              <MessageSquare size={24} className="opacity-40" />
              <p className="text-xs">Chưa có lịch sử khám cây nào.</p>
              <p className="text-[11px] text-stone-400">Các ca khám cây sẽ tự động lưu lại tại đây.</p>
            </div>
          ) : (
            groupKeys.map((key) => {
              const list = groupedSessions[key];
              return (
                <div key={key} className="space-y-1">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-stone-400 px-2.5 py-1">
                    {TIME_GROUP_LABELS[key]}
                  </p>
                  <div className="space-y-0.5">
                    {list.map((s) => {
                      const isActive = s.id === activeSessionId;
                      const isEditing = s.id === editingId;
                      const isDeleting = s.id === deletingId;

                      if (isEditing) {
                        return (
                          <form
                            key={s.id}
                            onSubmit={(e) => saveEdit(s.id, e)}
                            className="flex items-center gap-1.5 rounded-xl bg-white p-1.5 border border-[#1C4C40] shadow-xs"
                          >
                            <input
                              type="text"
                              autoFocus
                              value={editTitle}
                              onChange={(e) => setEditTitle(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Escape") setEditingId(null);
                              }}
                              className="w-full text-xs font-semibold text-stone-900 px-1.5 py-1 outline-none bg-transparent"
                            />
                            <button
                              type="submit"
                              className="p-1 text-emerald-700 hover:bg-emerald-50 rounded-lg"
                              title="Lưu"
                            >
                              <Check size={14} />
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingId(null)}
                              className="p-1 text-stone-400 hover:bg-stone-100 rounded-lg"
                              title="Hủy"
                            >
                              <X size={14} />
                            </button>
                          </form>
                        );
                      }

                      if (isDeleting) {
                        return (
                          <div
                            key={s.id}
                            className="flex items-center justify-between rounded-xl bg-rose-50 p-2 border border-rose-200 text-xs text-rose-800 animate-in fade-in duration-150"
                          >
                            <span className="font-semibold truncate">Xóa ca khám này?</span>
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={(e) => confirmDelete(s.id, e)}
                                className="px-2 py-0.5 rounded-lg bg-rose-600 text-white font-bold hover:bg-rose-700 text-[11px]"
                              >
                                Xóa
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDeletingId(null);
                                }}
                                className="px-1.5 py-0.5 rounded-lg text-stone-500 hover:bg-stone-200 text-[11px]"
                              >
                                Hủy
                              </button>
                            </div>
                          </div>
                        );
                      }

                      return (
                        <div
                          key={s.id}
                          onClick={() => {
                            onSelectSession(s.id);
                            if (window.innerWidth < 1024) onClose();
                          }}
                          className={`group relative flex items-center justify-between rounded-xl px-2.5 py-2 text-xs transition cursor-pointer ${
                            isActive
                              ? "bg-stone-200/80 font-bold text-stone-900 shadow-2xs"
                              : "text-stone-700 hover:bg-stone-200/50 hover:text-stone-900 font-medium"
                          }`}
                        >
                          <span className="truncate pr-2 select-none flex-1">
                            {s.title}
                          </span>

                          {/* Hover Actions: Đổi tên, Xóa */}
                          <div className="hidden group-hover:flex items-center gap-0.5 shrink-0 bg-stone-200/90 rounded-lg px-1 py-0.5 shadow-2xs">
                            <button
                              type="button"
                              onClick={(e) => startEdit(s, e)}
                              className="p-1 text-stone-500 hover:text-stone-900 hover:bg-white rounded transition"
                              title="Đổi tên"
                            >
                              <Edit2 size={12} />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeletingId(s.id);
                              }}
                              className="p-1 text-stone-500 hover:text-rose-600 hover:bg-white rounded transition"
                              title="Xóa"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer Support Card & Brand */}
        <div className="p-3 border-t border-stone-200/70 shrink-0 space-y-2">
          <div className="rounded-xl bg-emerald-50/70 border border-emerald-200/60 p-2.5 text-xs text-stone-700 shadow-2xs">
            <p className="font-bold text-stone-900 flex items-center gap-1.5 mb-1">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-600" />
              </span>
              <span>Cần trợ giúp trực tiếp?</span>
            </p>
            <p className="text-[11px] text-stone-500 mb-2 leading-relaxed">
              Gửi ảnh cây qua Zalo để Bác sĩ Aloha tư vấn 1-1 miễn phí.
            </p>
            <a
              href={ALOHA_ZALO.href}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-1.5 w-full rounded-lg bg-[#1C4C40] py-1.5 text-[11.5px] font-bold text-white shadow-2xs hover:bg-[#163c32] active:scale-98 transition"
            >
              <MessageCircle size={13} />
              <span>Nhắn Zalo {ALOHA_ZALO.label}</span>
            </a>
          </div>
          <div className="text-[11px] text-stone-400 text-center select-none pt-0.5">
            <span>🌿 Bác sĩ cây cảnh Aloha</span>
          </div>
        </div>
      </aside>
    </>
  );
}
