"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  Italic,
  List,
  ListOrdered,
  Indent,
  Outdent,
  Redo2,
  RemoveFormatting,
  Undo2,
} from "lucide-react";

type Props = {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: string;
  disabled?: boolean;
};

function ToolbarBtn({
  title,
  onClick,
  disabled,
  active,
  children,
}: {
  title: string;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onMouseDown={(e) => {
        e.preventDefault(); // Giữ selection trong editor
        if (!disabled) onClick();
      }}
      className={`inline-flex h-7.5 w-7.5 sm:h-8 sm:w-8 items-center justify-center rounded border-0 text-slate-700 transition hover:bg-slate-200 active:bg-slate-300 disabled:opacity-40 ${
        active ? "bg-slate-200 font-bold text-slate-900 shadow-inner" : "bg-transparent"
      }`}
    >
      {children}
    </button>
  );
}

/** Chuyển văn bản thuần cũ (nếu có \n mà chưa có thẻ HTML) sang cấu trúc <p> để soạn thảo mượt mà */
function normalizeInitialContent(raw: string): string {
  const s = String(raw || "").trim();
  if (!s) return "";
  // Đã có thẻ HTML cơ bản
  if (/<\s*(p|div|ul|ol|li|h[1-6]|br)\b/i.test(s)) {
    return s;
  }
  // Văn bản thuần: phân tách từng dòng thành các thẻ <p>
  const lines = s.split(/\r?\n/);
  return lines
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed) return "<p><br></p>";
      return `<p>${trimmed.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>`;
    })
    .join("");
}

export function JobRichEditor({
  value,
  onChange,
  placeholder = "Nhập nội dung...",
  minHeight = "150px",
  disabled = false,
}: Props) {
  const editorRef = useRef<HTMLDivElement>(null);
  const lastHtml = useRef<string | null>(null);
  const isInitialized = useRef(false);
  const [blockFormat, setBlockFormat] = useState("p");
  const [charCount, setCharCount] = useState(0);

  const updateCharCount = useCallback(() => {
    if (!editorRef.current) return;
    const txt = editorRef.current.innerText || "";
    const cleaned = txt.replace(/\r?\n$/g, "");
    setCharCount(cleaned.length);
  }, []);

  // Khởi tạo nội dung lần đầu khi mount (sửa tin hoặc tải tin)
  useEffect(() => {
    const el = editorRef.current;
    if (!el) return;
    if (!isInitialized.current) {
      const normalized = normalizeInitialContent(value);
      el.innerHTML = normalized;
      lastHtml.current = value;
      isInitialized.current = true;
      updateCharCount();
    }
  }, [value, updateCharCount]);

  // Cập nhật khi prop value từ bên ngoài thay đổi (ví dụ: chuyển qua sửa tin khác hoặc reset)
  useEffect(() => {
    const el = editorRef.current;
    if (!el || !isInitialized.current) return;
    if (value !== lastHtml.current && document.activeElement !== el) {
      const normalized = normalizeInitialContent(value);
      el.innerHTML = normalized;
      lastHtml.current = value;
      updateCharCount();
    }
  }, [value, updateCharCount]);

  const triggerChange = useCallback(() => {
    if (!editorRef.current) return;
    let html = editorRef.current.innerHTML;
    // Chuẩn hóa rỗng
    if (html === "<p><br></p>" || html === "<br>" || !editorRef.current.innerText.trim()) {
      html = "";
    }
    lastHtml.current = html;
    updateCharCount();
    onChange(html);
  }, [onChange, updateCharCount]);

  const syncFormatState = useCallback(() => {
    if (!editorRef.current) return;
    try {
      const block = document.queryCommandValue("formatBlock");
      if (block) {
        const lower = String(block).toLowerCase();
        if (lower.includes("h3")) setBlockFormat("h3");
        else if (lower.includes("h4")) setBlockFormat("h4");
        else setBlockFormat("p");
      }
    } catch {
      // ignore
    }
  }, []);

  const run = (cmd: string, val: string | undefined = undefined) => {
    if (disabled || !editorRef.current) return;
    editorRef.current.focus();
    document.execCommand(cmd, false, val);
    triggerChange();
  };

  const handleFormatBlock = (val: string) => {
    if (disabled || !editorRef.current) return;
    editorRef.current.focus();
    document.execCommand("formatBlock", false, val);
    setBlockFormat(val);
    triggerChange();
  };

  // Làm sạch khi dán từ Word/Website ngoài (giữ in đậm, in nghiêng, danh sách, bỏ style màu nền quái dị)
  const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    e.preventDefault();
    const text = e.clipboardData.getData("text/plain");
    // Chèn text thuần hoặc nội dung sạch
    document.execCommand("insertText", false, text);
    triggerChange();
  };

  return (
    <div className={`rounded-xl border border-slate-300 bg-white shadow-sm transition focus-within:border-[var(--aloha-green)] focus-within:ring-2 focus-within:ring-[var(--aloha-green)]/15 ${disabled ? "opacity-60 bg-slate-50 pointer-events-none" : ""}`}>
      {/* Toolbar WYSIWYG theo chuẩn thiết kế ảnh mẫu */}
      <div className="flex flex-wrap items-center gap-0.5 border-b border-slate-200 bg-slate-50/90 px-2 py-1.5 sm:gap-1">
        {/* Hoàn tác / Làm lại */}
        <ToolbarBtn title="Hoàn tác (Ctrl+Z)" onClick={() => run("undo")} disabled={disabled}>
          <Undo2 className="h-4 w-4" />
        </ToolbarBtn>
        <ToolbarBtn title="Làm lại (Ctrl+Y)" onClick={() => run("redo")} disabled={disabled}>
          <Redo2 className="h-4 w-4" />
        </ToolbarBtn>

        <span className="mx-1 h-5 w-px bg-slate-300" />

        {/* Khối định dạng đoạn văn */}
        <select
          className="h-8 rounded border border-slate-200 bg-white px-2 text-[13px] font-medium text-slate-700 outline-none hover:border-slate-300"
          value={blockFormat}
          onChange={(e) => handleFormatBlock(e.target.value)}
          disabled={disabled}
          title="Kiểu khối văn bản"
        >
          <option value="p">Đoạn văn</option>
          <option value="h3">Tiêu đề lớn</option>
          <option value="h4">Tiêu đề vừa</option>
        </select>

        <span className="mx-1 h-5 w-px bg-slate-300" />

        {/* In đậm / In nghiêng */}
        <ToolbarBtn title="In đậm (Ctrl+B)" onClick={() => run("bold")} disabled={disabled}>
          <Bold className="h-4 w-4" />
        </ToolbarBtn>
        <ToolbarBtn title="In nghiêng (Ctrl+I)" onClick={() => run("italic")} disabled={disabled}>
          <Italic className="h-4 w-4" />
        </ToolbarBtn>

        <span className="mx-1 h-5 w-px bg-slate-300" />

        {/* Căn lề */}
        <ToolbarBtn title="Căn trái" onClick={() => run("justifyLeft")} disabled={disabled}>
          <AlignLeft className="h-4 w-4" />
        </ToolbarBtn>
        <ToolbarBtn title="Căn giữa" onClick={() => run("justifyCenter")} disabled={disabled}>
          <AlignCenter className="h-4 w-4" />
        </ToolbarBtn>
        <ToolbarBtn title="Căn phải" onClick={() => run("justifyRight")} disabled={disabled}>
          <AlignRight className="h-4 w-4" />
        </ToolbarBtn>
        <ToolbarBtn title="Căn đều hai bên" onClick={() => run("justifyFull")} disabled={disabled}>
          <AlignJustify className="h-4 w-4" />
        </ToolbarBtn>

        <span className="mx-1 h-5 w-px bg-slate-300" />

        {/* Danh sách */}
        <ToolbarBtn title="Danh sách dấu chấm" onClick={() => run("insertUnorderedList")} disabled={disabled}>
          <List className="h-4 w-4" />
        </ToolbarBtn>
        <ToolbarBtn title="Danh sách số" onClick={() => run("insertOrderedList")} disabled={disabled}>
          <ListOrdered className="h-4 w-4" />
        </ToolbarBtn>
        <ToolbarBtn title="Giảm lề" onClick={() => run("outdent")} disabled={disabled}>
          <Outdent className="h-4 w-4" />
        </ToolbarBtn>
        <ToolbarBtn title="Tăng lề" onClick={() => run("indent")} disabled={disabled}>
          <Indent className="h-4 w-4" />
        </ToolbarBtn>

        <span className="mx-1 h-5 w-px bg-slate-300" />

        {/* Xóa định dạng */}
        <ToolbarBtn title="Xóa định dạng (Remove format)" onClick={() => run("removeFormat")} disabled={disabled}>
          <RemoveFormatting className="h-4 w-4" />
        </ToolbarBtn>
      </div>

      {/* Vùng soạn thảo contentEditable */}
      <div className="relative">
        <div
          ref={editorRef}
          contentEditable={!disabled}
          onInput={triggerChange}
          onBlur={triggerChange}
          onPaste={handlePaste}
          onKeyUp={syncFormatState}
          onMouseUp={syncFormatState}
          style={{ minHeight }}
          className="prose prose-sm max-w-none p-3.5 text-[14.5px] leading-relaxed text-slate-800 outline-none focus:outline-none empty:before:pointer-events-none empty:before:text-slate-400 empty:before:content-[attr(data-placeholder)] [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_h3]:font-bold [&_h3]:text-[var(--aloha-green-dark)] [&_h4]:font-bold [&_h4]:text-slate-900"
          data-placeholder={placeholder}
        />
        {/* Đếm ký tự góc dưới */}
        <div className="flex justify-end px-3 py-1 text-[11px] font-medium text-slate-400 border-t border-slate-100 bg-slate-50/40">
          <span>{charCount.toLocaleString("vi-VN")} / 8.000 ký tự</span>
        </div>
      </div>
    </div>
  );
}
