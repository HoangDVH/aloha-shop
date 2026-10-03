"use client";

import React, { useState, useEffect, useMemo } from "react";
import dayjs, { Dayjs } from "dayjs";
import { Popover } from "antd";
import { Calendar, ChevronLeft, ChevronRight, Clock, RotateCcw } from "lucide-react";

export type AlohaDateRangeValue = [Dayjs | null, Dayjs | null] | null;

export interface AlohaDateRangePickerProps {
  value?: AlohaDateRangeValue;
  onChange?: (dates: [Dayjs | null, Dayjs | null] | null, dateStrings: [string, string]) => void;
  format?: string;
  showTime?: boolean | { format?: string };
  placeholder?: [string, string];
  disabled?: boolean;
  disabledDate?: (current: Dayjs) => boolean;
  className?: string;
  inline?: boolean;
}

const WEEKDAYS = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];

function MonthGrid({
  month,
  pendingStart,
  pendingEnd,
  hoverDate,
  onSelectDate,
  onHoverDate,
  disabledDate,
}: {
  month: Dayjs;
  pendingStart: Dayjs | null;
  pendingEnd: Dayjs | null;
  hoverDate: Dayjs | null;
  onSelectDate: (d: Dayjs) => void;
  onHoverDate: (d: Dayjs | null) => void;
  disabledDate?: (current: Dayjs) => boolean;
}) {
  const daysInMonth = month.daysInMonth();
  // dayjs: 0=Sun, 1=Mon, ..., 6=Sat. Vietnamese week starts on Mon (T2) -> Sun (CN)
  const firstDayOfWeek = (month.startOf("month").day() + 6) % 7;

  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  return (
    <div className="w-full select-none">
      {/* Weekday headers */}
      <div className="grid grid-cols-7 mb-2 text-center">
        {WEEKDAYS.map((wd) => (
          <div key={wd} className="text-xs sm:text-sm font-semibold text-slate-500 py-1">
            {wd}
          </div>
        ))}
      </div>

      {/* Days grid */}
      <div className="grid grid-cols-7 gap-y-1.5 text-center">
        {/* Leading empty slots */}
        {Array.from({ length: firstDayOfWeek }).map((_, i) => (
          <div key={`blank-${i}`} className="w-9 h-9 sm:w-10 sm:h-10 mx-auto" />
        ))}

        {/* Days */}
        {days.map((dayNum) => {
          const date = month.date(dayNum);
          const isDisabled = disabledDate ? disabledDate(date) : false;

          const isStart = pendingStart && date.isSame(pendingStart, "day");
          const isEnd = pendingEnd && date.isSame(pendingEnd, "day");
          const isInRange =
            pendingStart && pendingEnd && date.isAfter(pendingStart, "day") && date.isBefore(pendingEnd, "day");
          const isInHover =
            pendingStart &&
            !pendingEnd &&
            hoverDate &&
            date.isAfter(pendingStart, "day") &&
            (date.isBefore(hoverDate, "day") || date.isSame(hoverDate, "day"));

          let cellStyle = "text-slate-700 hover:bg-slate-100 rounded-full font-medium";

          if (isDisabled) {
            cellStyle = "text-slate-300 cursor-not-allowed";
          } else if (isStart || isEnd) {
            cellStyle = "bg-[#254E29] text-white font-bold rounded-full shadow-sm hover:bg-[#1e3f21]";
          } else if (isInRange) {
            cellStyle = "bg-[#E8F2E6] text-slate-800 font-semibold rounded-full hover:bg-[#dcebda]";
          } else if (isInHover) {
            cellStyle = "bg-[#E8F2E6]/75 text-slate-800 font-medium rounded-full";
          }

          return (
            <div key={dayNum} className="flex items-center justify-center p-0.5">
              <button
                type="button"
                disabled={isDisabled}
                onClick={() => onSelectDate(date)}
                onMouseEnter={() => !isDisabled && onHoverDate(date)}
                className={`w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center text-sm transition-all ${cellStyle}`}
              >
                {dayNum}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function AlohaDateRangePicker({
  value,
  onChange,
  format = "DD/MM/YYYY",
  showTime = false,
  placeholder = ["Bắt đầu", "Kết thúc"],
  disabled = false,
  disabledDate,
  className = "",
  inline = false,
}: AlohaDateRangePickerProps) {
  const [open, setOpen] = useState(false);

  // Committed state
  const valStart = value?.[0] ? dayjs(value[0]) : null;
  const valEnd = value?.[1] ? dayjs(value[1]) : null;

  // Pending temporary states during selection
  const [pendingStart, setPendingStart] = useState<Dayjs | null>(valStart);
  const [pendingEnd, setPendingEnd] = useState<Dayjs | null>(valEnd);
  const [hoverDate, setHoverDate] = useState<Dayjs | null>(null);

  // Time state if showTime is active
  const [startTime, setStartTime] = useState<string>(valStart ? valStart.format("HH:mm") : "00:00");
  const [endTime, setEndTime] = useState<string>(valEnd ? valEnd.format("HH:mm") : "23:59");

  // Calendar view month (left month)
  const [viewMonth, setViewMonth] = useState<Dayjs>(() => {
    return valStart || dayjs().startOf("month");
  });

  // Sync when value prop changes externally
  useEffect(() => {
    setPendingStart(valStart);
    setPendingEnd(valEnd);
    if (valStart) {
      setViewMonth(valStart.startOf("month"));
      setStartTime(valStart.format("HH:mm"));
    }
    if (valEnd) {
      setEndTime(valEnd.format("HH:mm"));
    }
  }, [value]);

  const month1 = viewMonth;
  const month2 = viewMonth.add(1, "month");

  const handlePrevMonth = () => {
    setViewMonth((m) => m.subtract(1, "month"));
  };

  const handleNextMonth = () => {
    setViewMonth((m) => m.add(1, "month"));
  };

  const handleSelectDate = (date: Dayjs) => {
    if (!pendingStart || (pendingStart && pendingEnd)) {
      // Start fresh
      setPendingStart(date);
      setPendingEnd(null);
    } else {
      // We have pendingStart, now picking pendingEnd
      if (date.isBefore(pendingStart, "day")) {
        // Clicked before start -> make it new start
        setPendingStart(date);
        setPendingEnd(null);
      } else {
        setPendingEnd(date);
      }
    }
  };

  const handleApply = () => {
    if (!pendingStart) {
      onChange?.(null, ["", ""]);
      setOpen(false);
      return;
    }

    const end = pendingEnd || pendingStart;

    let finalStart = pendingStart;
    let finalEnd = end;

    if (showTime) {
      const [sh, sm] = startTime.split(":").map(Number);
      const [eh, em] = endTime.split(":").map(Number);
      finalStart = finalStart.hour(sh || 0).minute(sm || 0).second(0).millisecond(0);
      finalEnd = finalEnd.hour(eh || 23).minute(em || 59).second(59).millisecond(999);
    } else {
      finalStart = finalStart.startOf("day");
      finalEnd = finalEnd.endOf("day");
    }

    const formatStr = typeof showTime === "object" && showTime.format ? showTime.format : showTime ? `${format} HH:mm` : format;
    onChange?.([finalStart, finalEnd], [finalStart.format(formatStr), finalEnd.format(formatStr)]);
    setOpen(false);
  };

  const handleCancel = () => {
    setPendingStart(valStart);
    setPendingEnd(valEnd);
    if (valStart) setStartTime(valStart.format("HH:mm"));
    if (valEnd) setEndTime(valEnd.format("HH:mm"));
    setOpen(false);
  };

  const handleReset = () => {
    setPendingStart(null);
    setPendingEnd(null);
  };

  const formatStr = typeof showTime === "object" && showTime.format ? showTime.format : showTime ? `${format} HH:mm` : format;

  const displayStartText = valStart ? valStart.format(formatStr) : "";
  const displayEndText = valEnd ? valEnd.format(formatStr) : "";

  const pendingStartFormatted = pendingStart
    ? showTime
      ? `${pendingStart.format(format)} ${startTime}`
      : pendingStart.format(format)
    : "";

  const pendingEndFormatted = pendingEnd
    ? showTime
      ? `${pendingEnd.format(format)} ${endTime}`
      : pendingEnd.format(format)
    : "";

  // The complete panel content matching media_1790757639541.png
  const panelContent = (
    <div
      className="bg-white rounded-2xl p-4 sm:p-5 max-w-[620px] w-full"
      onMouseLeave={() => setHoverDate(null)}
    >
      {/* Top Range Inputs */}
      <div className="flex items-center gap-2">
        <div className="flex-1 flex items-center justify-between px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl transition-all shadow-xs">
          <Calendar className="w-4 h-4 text-slate-400 shrink-0 mr-2" />
          <span className={`flex-1 text-sm font-semibold truncate ${pendingStartFormatted ? "text-slate-800" : "text-slate-400"}`}>
            {pendingStartFormatted || placeholder[0]}
          </span>
          <Calendar className="w-4 h-4 text-slate-700 shrink-0 ml-2" />
        </div>

        <span className="text-slate-400 font-semibold px-1 select-none">-</span>

        <div className="flex-1 flex items-center justify-between px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl transition-all shadow-xs">
          <Calendar className="w-4 h-4 text-slate-400 shrink-0 mr-2" />
          <span className={`flex-1 text-sm font-semibold truncate ${pendingEndFormatted ? "text-slate-800" : "text-slate-400"}`}>
            {pendingEndFormatted || placeholder[1]}
          </span>
          <Calendar className="w-4 h-4 text-slate-700 shrink-0 ml-2" />
        </div>
      </div>

      {/* Month Navigation & Headers */}
      <div className="flex items-center justify-between mt-5 mb-3 px-1">
        <button
          type="button"
          onClick={handlePrevMonth}
          className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-600 transition-colors cursor-pointer"
          title="Tháng trước"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-8 text-center">
          <div className="font-bold text-slate-800 text-sm sm:text-base">
            Tháng {month1.month() + 1} - {month1.year()}
          </div>
          <div className="hidden sm:block font-bold text-slate-800 text-sm sm:text-base">
            Tháng {month2.month() + 1} - {month2.year()}
          </div>
        </div>

        <button
          type="button"
          onClick={handleNextMonth}
          className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-600 transition-colors cursor-pointer"
          title="Tháng sau"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* Calendars side-by-side */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
        {/* Month 1 */}
        <MonthGrid
          month={month1}
          pendingStart={pendingStart}
          pendingEnd={pendingEnd}
          hoverDate={hoverDate}
          onSelectDate={handleSelectDate}
          onHoverDate={setHoverDate}
          disabledDate={disabledDate}
        />

        {/* Month 2 */}
        <div className="hidden sm:block">
          <MonthGrid
            month={month2}
            pendingStart={pendingStart}
            pendingEnd={pendingEnd}
            hoverDate={hoverDate}
            onSelectDate={handleSelectDate}
            onHoverDate={setHoverDate}
            disabledDate={disabledDate}
          />
        </div>
      </div>

      {/* Optional Time selection bar */}
      {showTime ? (
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3.5 mt-4 border-t border-slate-100 text-xs">
          <div className="flex items-center gap-2">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-slate-500 font-medium">Giờ hiệu lực:</span>
            <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1">
              <span className="text-slate-400 text-[11px]">Từ</span>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="bg-transparent font-semibold text-slate-800 text-xs focus:outline-none cursor-pointer"
              />
            </div>
            <span className="text-slate-300">—</span>
            <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1">
              <span className="text-slate-400 text-[11px]">Đến</span>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="bg-transparent font-semibold text-slate-800 text-xs focus:outline-none cursor-pointer"
              />
            </div>
          </div>

          <button
            type="button"
            onClick={handleReset}
            className="inline-flex items-center gap-1 text-slate-400 hover:text-slate-600 transition-colors text-xs font-medium cursor-pointer"
          >
            <RotateCcw className="w-3 h-3" /> Xóa chọn
          </button>
        </div>
      ) : null}

      {/* Footer Actions */}
      <div className="flex items-center justify-end gap-3 pt-4 mt-4 border-t border-slate-100">
        <button
          type="button"
          onClick={handleCancel}
          className="px-5 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 text-sm font-medium hover:bg-slate-50 hover:border-slate-300 transition-colors cursor-pointer"
        >
          Hủy
        </button>
        <button
          type="button"
          onClick={handleApply}
          className="px-6 py-2 rounded-xl bg-[#254E29] text-white text-sm font-medium hover:bg-[#1e3f21] shadow-sm transition-all cursor-pointer"
        >
          Áp dụng
        </button>
      </div>
    </div>
  );

  // If inline mode requested, render directly
  if (inline) {
    return (
      <div className={`border border-slate-200/90 rounded-2xl shadow-sm overflow-hidden ${className}`}>
        {panelContent}
      </div>
    );
  }

  // Popover Trigger Mode
  return (
    <Popover
      open={open}
      onOpenChange={(v) => !disabled && setOpen(v)}
      trigger="click"
      placement="bottomLeft"
      arrow={false}
      overlayInnerStyle={{
        padding: 0,
        borderRadius: 16,
        backgroundColor: "#fff",
        border: "1px solid #E2E8F0",
        boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)",
      }}
      content={panelContent}
    >
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        className={`group flex items-center gap-2 cursor-pointer ${
          disabled ? "opacity-60 cursor-not-allowed pointer-events-none" : ""
        } ${className}`}
      >
        {/* Left Trigger Box */}
        <div
          className={`flex-1 flex items-center justify-between px-3.5 py-2.5 bg-white border rounded-xl transition-all shadow-xs ${
            open ? "border-[#254E29] ring-2 ring-[#254E29]/20" : "border-slate-200 group-hover:border-[#254E29]/60"
          }`}
        >
          <Calendar className="w-4 h-4 text-slate-400 shrink-0 mr-2" />
          <span className={`flex-1 text-sm font-medium truncate ${displayStartText ? "text-slate-800" : "text-slate-400"}`}>
            {displayStartText || placeholder[0]}
          </span>
          <Calendar className="w-4 h-4 text-slate-700 shrink-0 ml-2" />
        </div>

        <span className="text-slate-400 font-semibold px-1 select-none">-</span>

        {/* Right Trigger Box */}
        <div
          className={`flex-1 flex items-center justify-between px-3.5 py-2.5 bg-white border rounded-xl transition-all shadow-xs ${
            open ? "border-[#254E29] ring-2 ring-[#254E29]/20" : "border-slate-200 group-hover:border-[#254E29]/60"
          }`}
        >
          <Calendar className="w-4 h-4 text-slate-400 shrink-0 mr-2" />
          <span className={`flex-1 text-sm font-medium truncate ${displayEndText ? "text-slate-800" : "text-slate-400"}`}>
            {displayEndText || placeholder[1]}
          </span>
          <Calendar className="w-4 h-4 text-slate-700 shrink-0 ml-2" />
        </div>
      </div>
    </Popover>
  );
}
