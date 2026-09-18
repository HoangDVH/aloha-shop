"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  FileType,
  ImagePlus,
  Italic,
  List,
  ListOrdered,
  Loader2,
  Redo2,
  Undo2,
  Video,
} from "lucide-react";
import { toast } from "@/components/admin/toast";
import { websiteApi } from "../api";
import { ArticleImageCropDialog } from "./ArticleImageCropDialog";
import { ArticleInlineImageOverlay } from "./ArticleInlineImageOverlay";
import {
  escapeAttr,
  fileToDataUrl,
  isAllowedImageFile,
  normalizeVideoInput,
} from "./articleMediaUtils";

type Props = {
  value: string;
  onChange: (html: string) => void;
  /** Báo form cha đang upload (khóa Lưu) */
  onBusyChange?: (busy: boolean) => void;
};

function ToolbarBtn({
  title,
  onClick,
  children,
  active,
  disabled,
  wide,
}: {
  title: string;
  onClick: () => void;
  children: React.ReactNode;
  active?: boolean;
  disabled?: boolean;
  wide?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onMouseDown={(e) => {
        e.preventDefault();
        if (!disabled) onClick();
      }}
      className={`inline-flex h-8 items-center justify-center gap-1 rounded-md border-0 text-slate-700 transition hover:bg-white disabled:opacity-50 ${
        wide ? "px-2.5 text-[12px] font-semibold" : "w-8"
      } ${active ? "bg-white shadow-sm" : "bg-transparent"}`}
      style={{ border: "none" }}
    >
      {children}
    </button>
  );
}

function imgHtml(url: string, alt = "", widthPct = 100): string {
  return (
    `<p><br></p>` +
    `<p style="margin:16px 0">` +
    `<img src="${escapeAttr(url)}" alt="${escapeAttr(alt)}" ` +
    `style="display:block;width:${widthPct}%;max-width:100%;height:auto;border-radius:8px;border:1px solid #e5e7eb" />` +
    `</p>` +
    `<p><br></p>`
  );
}

export function ArticleRichEditor({ value, onChange, onBusyChange }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const replaceRef = useRef<HTMLInputElement>(null);
  const docxRef = useRef<HTMLInputElement>(null);
  const lastHtml = useRef(value);
  const savedRange = useRef<Range | null>(null);
  const replaceTarget = useRef<HTMLImageElement | null>(null);
  const longPressTimer = useRef<number | null>(null);

  const [uploading, setUploading] = useState(false);
  const [docxBusy, setDocxBusy] = useState(false);
  const [videoOpen, setVideoOpen] = useState(false);
  const [videoUrl, setVideoUrl] = useState("");
  const [selected, setSelected] = useState<HTMLImageElement[]>([]);
  const [multiMode, setMultiMode] = useState(false);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [cropTarget, setCropTarget] = useState<HTMLImageElement | null>(null);
  const [cropBusy, setCropBusy] = useState(false);
  const [isNarrow, setIsNarrow] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 640px)");
    const apply = () => setIsNarrow(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    onBusyChange?.(uploading || docxBusy || cropBusy);
  }, [uploading, docxBusy, cropBusy, onBusyChange]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (value !== lastHtml.current && document.activeElement !== el) {
      el.innerHTML = value || "";
      lastHtml.current = value;
      setSelected([]);
    }
  }, [value]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!el.innerHTML && value) {
      el.innerHTML = value;
      lastHtml.current = value;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const emit = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const html = el.innerHTML;
    lastHtml.current = html;
    onChange(html === "<br>" ? "" : html);
  }, [onChange]);

  const rememberSelection = () => {
    const el = ref.current;
    const sel = window.getSelection();
    if (!el || !sel || !sel.rangeCount) return;
    const range = sel.getRangeAt(0);
    if (el.contains(range.commonAncestorContainer)) {
      savedRange.current = range.cloneRange();
    }
  };

  const restoreSelection = () => {
    const el = ref.current;
    const range = savedRange.current;
    if (!el) return;
    el.focus();
    const sel = window.getSelection();
    if (!sel) return;
    if (range && el.contains(range.commonAncestorContainer)) {
      sel.removeAllRanges();
      sel.addRange(range);
    } else {
      const end = document.createRange();
      end.selectNodeContents(el);
      end.collapse(false);
      sel.removeAllRanges();
      sel.addRange(end);
    }
  };

  const run = (cmd: string, arg?: string) => {
    ref.current?.focus();
    try {
      document.execCommand(cmd, false, arg);
    } catch {
      /* ignore */
    }
    rememberSelection();
    emit();
  };

  const insertHtmlAtCursor = (html: string) => {
    const el = ref.current;
    if (!el) return;
    restoreSelection();
    try {
      const ok = document.execCommand("insertHTML", false, html);
      if (!ok) throw new Error("insertHTML unsupported");
    } catch {
      el.insertAdjacentHTML("beforeend", html);
    }
    rememberSelection();
    emit();
  };

  const uploadDataUrl = async (dataUrl: string): Promise<string> => {
    const r = await websiteApi<{ url: string }>("/api/shop/admin/articles/upload", {
      method: "POST",
      body: JSON.stringify({ data: dataUrl }),
    });
    if (!r.url) throw new Error("Upload thất bại");
    return r.url;
  };

  const insertOneFile = async (file: File): Promise<boolean> => {
    const check = isAllowedImageFile(file);
    if (!check.ok) {
      toast.error(check.message);
      return false;
    }
    try {
      const dataUrl = await fileToDataUrl(file);
      const url = await uploadDataUrl(dataUrl);
      insertHtmlAtCursor(imgHtml(url));
      return true;
    } catch (e: any) {
      toast.error(e?.message || `Không chèn được ${file.name}`);
      return false;
    }
  };

  const insertImages = async (files: FileList | File[] | null | undefined) => {
    const list = files ? Array.from(files) : [];
    if (!list.length) return;
    rememberSelection();
    setUploading(true);
    let ok = 0;
    try {
      for (let i = 0; i < list.length; i++) {
        const done = await insertOneFile(list[i]);
        if (done) ok += 1;
        if (list.length > 1) toast.message(`Đã chèn ${ok}/${list.length} ảnh…`);
      }
      if (ok === 1 && list.length === 1) toast.success("Đã chèn ảnh — bấm ảnh để chỉnh cỡ / cắt");
      else if (ok > 1) toast.success(`Đã chèn ${ok} ảnh`);
      const el = ref.current;
      if (el && el.querySelectorAll("img").length > 30) {
        toast.warning("Bài có nhiều ảnh — trang shop có thể tải chậm hơn");
      }
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const insertVideoAtCursor = () => {
    const norm = normalizeVideoInput(videoUrl);
    if (norm.kind === "invalid") {
      toast.error(norm.reason);
      return;
    }
    if (norm.kind === "drive") {
      toast.message("Drive: file cần chia sẻ “Bất kỳ ai có đường liên kết” mới xem được trên shop");
    }
    rememberSelection();
    let block: string;
    if (norm.kind === "file") {
      block =
        `<p><br></p>` +
        `<figure class="article-video-file">` +
        `<video src="${escapeAttr(norm.url)}" controls playsinline preload="metadata" style="width:100%;height:auto;border-radius:12px"></video>` +
        `</figure>` +
        `<p><br></p>`;
    } else {
      block =
        `<p><br></p>` +
        `<figure class="article-video">` +
        `<iframe src="${escapeAttr(norm.embedUrl)}" title="Video" ` +
        `allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" ` +
        `allowfullscreen loading="lazy"></iframe>` +
        `</figure>` +
        `<p><br></p>`;
    }
    insertHtmlAtCursor(block);
    setVideoUrl("");
    setVideoOpen(false);
    toast.success("Đã chèn video vào bài");
  };

  const importDocx = async (file: File | null | undefined) => {
    if (!file) return;
    const name = file.name.toLowerCase();
    if (!name.endsWith(".docx")) {
      toast.error("Chỉ nhận file Word .docx (không phải .doc cũ)");
      return;
    }
    if (file.size > 12 * 1024 * 1024) {
      toast.error("File Word tối đa 12MB");
      return;
    }
    setDocxBusy(true);
    try {
      const dataUrl = await fileToDataUrl(file);
      const r = await websiteApi<{ html: string }>("/api/shop/admin/articles/import-docx", {
        method: "POST",
        body: JSON.stringify({ data: dataUrl }),
      });
      const html = String(r.html || "").trim();
      if (!html) throw new Error("File Word trống hoặc không đọc được");
      const el = ref.current;
      if (el) {
        const cur = (el.innerHTML || "").replace(/<br\s*\/?>/gi, "").trim();
        if (cur) {
          const ok = window.confirm(
            "Nội dung hiện tại sẽ được thay bằng nội dung file Word. Tiếp tục?"
          );
          if (!ok) return;
        }
        el.innerHTML = html;
        lastHtml.current = html;
        onChange(html);
        setSelected([]);
      }
      toast.success("Đã chèn nội dung từ Word — bấm ảnh để chỉnh nếu cần");
    } catch (e: any) {
      toast.error(e?.message || "Không nhập được file Word");
    } finally {
      setDocxBusy(false);
      if (docxRef.current) docxRef.current.value = "";
    }
  };

  const selectImage = (img: HTMLImageElement, opts: { toggle?: boolean; additive?: boolean }) => {
    setSelected((prev) => {
      if (opts.toggle || opts.additive || multiMode) {
        const has = prev.includes(img);
        if (has) return prev.filter((x) => x !== img);
        return [...prev, img];
      }
      return [img];
    });
  };

  const onEditorClick = (e: React.MouseEvent) => {
    const t = e.target as HTMLElement | null;
    const img = t?.closest?.("img") as HTMLImageElement | null;
    if (!img || !ref.current?.contains(img)) {
      if (!(e.target as HTMLElement)?.closest?.("[data-img-toolbar]")) setSelected([]);
      setMultiMode(false);
      return;
    }
    e.preventDefault();
    const additive = e.ctrlKey || e.metaKey || multiMode;
    selectImage(img, { additive });
  };

  const onEditorPointerDown = (e: React.PointerEvent) => {
    const t = e.target as HTMLElement | null;
    const img = t?.closest?.("img") as HTMLImageElement | null;
    if (!img || !ref.current?.contains(img)) return;
    if (longPressTimer.current) window.clearTimeout(longPressTimer.current);
    longPressTimer.current = window.setTimeout(() => {
      setMultiMode(true);
      selectImage(img, { additive: true });
      toast.message("Chế độ chọn nhiều — chạm thêm ảnh, rồi Xóa / đổi cỡ");
    }, 500);
  };

  const onEditorPointerUp = () => {
    if (longPressTimer.current) {
      window.clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const deleteSelected = () => {
    for (const img of selected) {
      const p = img.closest("p") || img;
      p.remove();
    }
    setSelected([]);
    setMultiMode(false);
    emit();
  };

  const openCrop = (img: HTMLImageElement) => {
    setCropTarget(img);
    setCropSrc(img.currentSrc || img.src);
  };

  const applyCrop = async (dataUrl: string) => {
    if (!cropTarget) return;
    setCropBusy(true);
    try {
      const url = await uploadDataUrl(dataUrl);
      cropTarget.src = url;
      emit();
      setCropSrc(null);
      setCropTarget(null);
      toast.success("Đã cắt ảnh (giữ độ nét)");
    } catch (e: any) {
      toast.error(e?.message || "Không lưu được ảnh cắt");
    } finally {
      setCropBusy(false);
    }
  };

  const openReplace = (img: HTMLImageElement) => {
    replaceTarget.current = img;
    replaceRef.current?.click();
  };

  const onReplaceFile = async (file: File | null | undefined) => {
    const img = replaceTarget.current;
    replaceTarget.current = null;
    if (!file || !img) return;
    const check = isAllowedImageFile(file);
    if (!check.ok) {
      toast.error(check.message);
      return;
    }
    setUploading(true);
    try {
      const dataUrl = await fileToDataUrl(file);
      const url = await uploadDataUrl(dataUrl);
      img.src = url;
      emit();
      toast.success("Đã thay ảnh");
    } catch (e: any) {
      toast.error(e?.message || "Không thay được ảnh");
    } finally {
      setUploading(false);
      if (replaceRef.current) replaceRef.current.value = "";
    }
  };

  const onPaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    const files: File[] = [];
    for (const item of Array.from(items)) {
      if (item.type.startsWith("image/")) {
        const f = item.getAsFile();
        if (f) files.push(f);
      }
    }
    if (files.length) {
      e.preventDefault();
      void insertImages(files);
    }
  };

  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    const files = e.dataTransfer?.files;
    if (!files?.length) return;
    const images = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (!images.length) return;
    e.preventDefault();
    void insertImages(images);
  };

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
      <div className="flex flex-wrap items-center gap-0.5 border-b border-gray-200 bg-slate-50 px-2 py-1.5">
        <ToolbarBtn title="Hoàn tác" onClick={() => run("undo")}>
          <Undo2 className="h-4 w-4" />
        </ToolbarBtn>
        <ToolbarBtn title="Làm lại" onClick={() => run("redo")}>
          <Redo2 className="h-4 w-4" />
        </ToolbarBtn>
        <span className="mx-1 h-5 w-px bg-gray-200" />
        <select
          className="h-8 rounded-md border-0 bg-transparent px-2 text-[13px] font-medium text-slate-700 outline-none hover:bg-white"
          defaultValue="p"
          onChange={(e) => {
            const v = e.target.value;
            run("formatBlock", v === "p" ? "p" : v);
          }}
          title="Kiểu đoạn"
        >
          <option value="p">Paragraph</option>
          <option value="h2">Tiêu đề lớn</option>
          <option value="h3">Tiêu đề vừa</option>
          <option value="h4">Tiêu đề nhỏ</option>
        </select>
        <span className="mx-1 h-5 w-px bg-gray-200" />
        <ToolbarBtn title="In đậm" onClick={() => run("bold")}>
          <Bold className="h-4 w-4" />
        </ToolbarBtn>
        <ToolbarBtn title="In nghiêng" onClick={() => run("italic")}>
          <Italic className="h-4 w-4" />
        </ToolbarBtn>
        <span className="mx-1 h-5 w-px bg-gray-200" />
        <ToolbarBtn title="Danh sách" onClick={() => run("insertUnorderedList")}>
          <List className="h-4 w-4" />
        </ToolbarBtn>
        <ToolbarBtn title="Đánh số" onClick={() => run("insertOrderedList")}>
          <ListOrdered className="h-4 w-4" />
        </ToolbarBtn>
        <span className="mx-1 h-5 w-px bg-gray-200" />
        <ToolbarBtn title="Căn trái" onClick={() => run("justifyLeft")}>
          <AlignLeft className="h-4 w-4" />
        </ToolbarBtn>
        <ToolbarBtn title="Căn giữa" onClick={() => run("justifyCenter")}>
          <AlignCenter className="h-4 w-4" />
        </ToolbarBtn>
        <ToolbarBtn title="Căn phải" onClick={() => run("justifyRight")}>
          <AlignRight className="h-4 w-4" />
        </ToolbarBtn>
        <ToolbarBtn title="Căn đều" onClick={() => run("justifyFull")}>
          <AlignJustify className="h-4 w-4" />
        </ToolbarBtn>
        <span className="mx-1 h-5 w-px bg-gray-200" />
        <ToolbarBtn
          title="Chèn một hoặc nhiều ảnh — bấm ảnh để kéo góc / cắt"
          wide
          disabled={uploading}
          onClick={() => {
            rememberSelection();
            fileRef.current?.click();
          }}
        >
          {uploading ? (
            <Loader2 className="h-4 w-4 animate-spin text-[#0F9D58]" />
          ) : (
            <ImagePlus className="h-4 w-4 text-[#0F9D58]" />
          )}
          Chèn ảnh
        </ToolbarBtn>
        <ToolbarBtn
          title="Chèn video YouTube hoặc Google Drive"
          wide
          onClick={() => {
            rememberSelection();
            setVideoOpen((v) => !v);
          }}
        >
          <Video className="h-4 w-4 text-[#0F9D58]" />
          Chèn video
        </ToolbarBtn>
        <ToolbarBtn
          title="Chèn nội dung từ file Word (.docx)"
          wide
          disabled={docxBusy}
          onClick={() => docxRef.current?.click()}
        >
          {docxBusy ? (
            <Loader2 className="h-4 w-4 animate-spin text-[#0F9D58]" />
          ) : (
            <FileType className="h-4 w-4 text-[#0F9D58]" />
          )}
          Chèn Word
        </ToolbarBtn>
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          className="hidden"
          onChange={(e) => void insertImages(e.target.files)}
        />
        <input
          ref={replaceRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => void onReplaceFile(e.target.files?.[0])}
        />
        <input
          ref={docxRef}
          type="file"
          accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          className="hidden"
          onChange={(e) => void importDocx(e.target.files?.[0])}
        />
      </div>

      {videoOpen ? (
        <div className="flex flex-wrap items-center gap-2 border-b border-gray-100 bg-white px-3 py-2">
          <input
            className="min-w-[220px] flex-1 rounded-lg border border-gray-200 px-3 py-1.5 text-[13px] outline-none focus:border-[#0F9D58]"
            placeholder="YouTube hoặc Google Drive (file đã chia sẻ)…"
            value={videoUrl}
            onChange={(e) => setVideoUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                insertVideoAtCursor();
              }
            }}
          />
          <button
            type="button"
            className="rounded-lg bg-[#0F9D58] px-3 py-1.5 text-[12px] font-bold text-white"
            onClick={insertVideoAtCursor}
          >
            Chèn
          </button>
          <button
            type="button"
            className="rounded-lg px-2 py-1.5 text-[12px] font-semibold text-slate-500 hover:bg-slate-100"
            onClick={() => {
              setVideoOpen(false);
              setVideoUrl("");
            }}
          >
            Hủy
          </button>
        </div>
      ) : null}

      <p className="border-b border-gray-100 bg-[#F7F3EA]/80 px-3 py-1.5 text-[11px] leading-snug text-slate-600">
        Bấm ảnh → kéo 4 góc (giữ nét) · Cắt / Thay / Xóa. Nhiều ảnh: Ctrl+bấm hoặc giữ lâu trên
        điện thoại. Video: YouTube hoặc Drive. Hashtag{" "}
        <code className="rounded bg-white px-1">#caycanh</code> → nút lọc trên shop.
      </p>
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-multiline
        data-placeholder="Nhập nội dung — chữ → ảnh/video → chữ tiếp…"
        onInput={() => {
          rememberSelection();
          emit();
        }}
        onBlur={emit}
        onKeyUp={rememberSelection}
        onMouseUp={rememberSelection}
        onClick={onEditorClick}
        onPointerDown={onEditorPointerDown}
        onPointerUp={onEditorPointerUp}
        onPointerCancel={onEditorPointerUp}
        onPaste={onPaste}
        onDrop={onDrop}
        onDragOver={(e) => {
          if (e.dataTransfer?.types?.includes("Files")) e.preventDefault();
        }}
        className="article-rte min-h-[280px] max-h-[520px] overflow-y-auto px-4 py-3 text-[14px] leading-7 text-slate-800 outline-none empty:before:pointer-events-none empty:before:text-slate-400 empty:before:content-[attr(data-placeholder)] [&_.article-video]:relative [&_.article-video]:my-3 [&_.article-video]:aspect-video [&_.article-video]:w-full [&_.article-video]:overflow-hidden [&_.article-video]:rounded-xl [&_.article-video]:bg-slate-900 [&_.article-video_iframe]:absolute [&_.article-video_iframe]:inset-0 [&_.article-video_iframe]:h-full [&_.article-video_iframe]:w-full [&_h2]:mb-2 [&_h2]:mt-3 [&_h2]:text-xl [&_h2]:font-bold [&_h3]:mb-2 [&_h3]:mt-3 [&_h3]:text-lg [&_h3]:font-bold [&_img]:my-2 [&_img]:max-w-full [&_img]:rounded-lg [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-6 [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-6"
      />

      {selected.length ? (
        <ArticleInlineImageOverlay
          images={selected}
          editorEl={ref.current}
          isNarrow={isNarrow}
          onClear={() => {
            setSelected([]);
            setMultiMode(false);
          }}
          onDelete={deleteSelected}
          onCrop={openCrop}
          onReplace={openReplace}
          onAltChange={(img, alt) => {
            img.alt = alt;
            emit();
          }}
          onWidthChange={emit}
        />
      ) : null}

      <ArticleImageCropDialog
        open={!!cropSrc}
        imageSrc={cropSrc || ""}
        aspect={null}
        busy={cropBusy}
        onCancel={() => {
          setCropSrc(null);
          setCropTarget(null);
        }}
        onApply={applyCrop}
      />
    </div>
  );
}
