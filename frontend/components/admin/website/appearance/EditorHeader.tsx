"use client";

import React from "react";
import {
  Check,
  Clock,
  ExternalLink,
  History,
  Loader2,
  Monitor,
  MoreHorizontal,
  Palette,
  RefreshCw,
  RotateCcw,
  Smartphone,
} from "lucide-react";
import type { AppearanceHistoryMeta } from "../api";
import {
  WbBadge,
  WbBtn,
  WbField,
  WbIconSegment,
  wbInput,
  wbSelect,
} from "../ui";
import {
  combineLocalToIso,
  formatScheduleVi,
} from "./editorUtils";

export function EditorHeader({
  primary,
  dirtyFlag,
  scheduledAt,
  device,
  setDevice,
  toolsRef,
  toolsOpen,
  setToolsOpen,
  saving,
  history,
  scheduleDate,
  setScheduleDate,
  scheduleTime,
  setScheduleTime,
  revert,
  restoreHistory,
  saveSchedule,
  clearSchedule,
  syncPreview,
  applyPublish,
  shopPreviewUrl,
}: {
  primary: string;
  dirtyFlag: boolean;
  scheduledAt: string | null;
  device: "desktop" | "mobile";
  setDevice: (d: "desktop" | "mobile") => void;
  toolsRef: React.RefObject<HTMLDivElement | null>;
  toolsOpen: boolean;
  setToolsOpen: React.Dispatch<React.SetStateAction<boolean>>;
  saving: boolean;
  history: AppearanceHistoryMeta[];
  scheduleDate: string;
  setScheduleDate: (d: string) => void;
  scheduleTime: string;
  setScheduleTime: (t: string) => void;
  revert: () => Promise<void>;
  restoreHistory: (id: string) => Promise<void>;
  saveSchedule: () => Promise<void>;
  clearSchedule: () => Promise<void>;
  syncPreview: () => Promise<void>;
  applyPublish: () => Promise<void>;
  shopPreviewUrl: string;
}) {
  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-gray-200 bg-white px-4">
      <div className="flex min-w-0 flex-1 items-center gap-2.5">
        <div
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white"
          style={{ background: primary }}
        >
          <Palette className="h-4 w-4" />
        </div>
        <h2 className="truncate text-[13px] font-semibold text-gray-900">
          Chỉnh sửa giao diện
        </h2>
        {dirtyFlag ? (
          <WbBadge tone="warn">Chưa áp dụng</WbBadge>
        ) : (
          <WbBadge tone="success">Đã đồng bộ</WbBadge>
        )}
        {scheduledAt ? (
          <button
            type="button"
            onClick={() => setToolsOpen(true)}
            className="hidden max-w-[220px] truncate rounded-full border-0 bg-amber-50 px-2.5 py-0.5 text-left text-[11px] font-semibold text-amber-800 hover:bg-amber-100 sm:inline"
            title="Mở hẹn giờ"
          >
            Hẹn {formatScheduleVi(scheduledAt)}
          </button>
        ) : null}
      </div>

      <div className="hidden md:block">
        <WbIconSegment
          value={device}
          onChange={setDevice}
          options={[
            { id: "desktop", title: "Desktop", Icon: Monitor },
            { id: "mobile", title: "Mobile", Icon: Smartphone },
          ]}
        />
      </div>

      <div className="flex flex-1 items-center justify-end gap-1.5">
        <div ref={toolsRef} className="relative">
          <WbBtn
            variant="ghost"
            className="!px-2.5"
            onClick={() => setToolsOpen((o) => !o)}
            title="Lịch sử & hẹn giờ"
          >
            <MoreHorizontal className="h-4 w-4" />
            <span className="hidden xl:inline">Thêm</span>
          </WbBtn>
          {toolsOpen ? (
            <div className="absolute right-0 top-full z-50 mt-1.5 w-[340px] rounded-xl border border-gray-200 bg-white p-3.5 shadow-xl">
              <div className="mb-3 flex items-center justify-between gap-2">
                <p className="text-[12px] font-semibold text-gray-900">
                  Lịch sử & hẹn giờ
                </p>
                <WbBtn
                  variant="ghost"
                  className="!h-7 !px-2 text-[11px]"
                  onClick={() => {
                    setToolsOpen(false);
                    void revert();
                  }}
                >
                  <RotateCcw className="h-3 w-3" /> Hoàn tác XB
                </WbBtn>
              </div>

              <div className="space-y-3">
                <WbField label="Khôi phục bản đã áp dụng">
                  <select
                    className={wbSelect}
                    defaultValue=""
                    disabled={saving || history.length === 0}
                    onChange={(e) => {
                      const id = e.target.value;
                      e.target.value = "";
                      if (id) {
                        setToolsOpen(false);
                        void restoreHistory(id);
                      }
                    }}
                  >
                    <option value="">
                      {history.length
                        ? `${history.length} bản gần đây…`
                        : "Chưa có lịch sử"}
                    </option>
                    {history.map((h) => (
                      <option key={h.id} value={h.id}>
                        {formatScheduleVi(h.at) ||
                          new Date(h.at).toLocaleString("vi-VN")}
                        {h.by ? ` · ${h.by}` : ""}
                        {h.note ? ` · ${h.note}` : ""}
                      </option>
                    ))}
                  </select>
                </WbField>

                <div className="border-t border-gray-100 pt-3">
                  <p className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                    <Clock className="h-3.5 w-3.5" /> Hẹn giờ áp dụng
                  </p>
                  <p className="mb-2 text-[11px] leading-snug text-amber-800/90">
                    Web shop chỉ đổi đúng giờ hẹn. Muốn khách thấy ngay → bấm
                    «Áp dụng». Khung xem trước cũng là bản đang lên web.
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <WbField label="Ngày">
                      <input
                        type="date"
                        className={wbInput}
                        value={scheduleDate}
                        onChange={(e) => setScheduleDate(e.target.value)}
                      />
                    </WbField>
                    <WbField label="Giờ (24h)">
                      <input
                        type="time"
                        step={60}
                        className={wbInput}
                        value={scheduleTime}
                        onChange={(e) => setScheduleTime(e.target.value)}
                      />
                    </WbField>
                  </div>
                  <p className="mt-1.5 text-[11px] text-gray-500">
                    {scheduledAt
                      ? `Đang chờ đến ${formatScheduleVi(scheduledAt)} rồi mới lên web`
                      : scheduleDate
                        ? `Sẽ hẹn: ${formatScheduleVi(combineLocalToIso(scheduleDate, scheduleTime || "00:00") || undefined) || "—"}`
                        : "VD giờ: 14:30 = 2 giờ 30 chiều"}
                  </p>
                  <div className="mt-2.5 flex gap-2">
                    <WbBtn
                      variant="secondary"
                      disabled={saving || !scheduleDate}
                      className="!h-8 flex-1"
                      onClick={() => void saveSchedule()}
                    >
                      <History className="h-3.5 w-3.5" /> Lưu hẹn
                    </WbBtn>
                    {scheduledAt || scheduleDate || scheduleTime ? (
                      <WbBtn
                        variant="ghost"
                        disabled={saving}
                        className="!h-8"
                        onClick={() => void clearSchedule()}
                      >
                        Hủy hẹn
                      </WbBtn>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </div>

        <WbBtn
          variant="ghost"
          disabled={saving}
          onClick={() => void syncPreview()}
          className="!px-2.5"
          title="Lưu nháp & làm mới xem trước"
        >
          {saving ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" />
          )}
          <span className="hidden sm:inline">Đồng bộ</span>
        </WbBtn>
        <WbBtn variant="ghost" href={shopPreviewUrl} className="!px-2.5">
          <ExternalLink className="h-3.5 w-3.5" />
          <span className="hidden lg:inline">Xem trước</span>
        </WbBtn>
        <WbBtn variant="primary" disabled={saving} onClick={() => void applyPublish()}>
          {saving ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Check className="h-3.5 w-3.5" />
          )}
          Áp dụng
        </WbBtn>
      </div>
    </header>
  );
}
