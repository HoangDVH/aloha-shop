"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  ArrowLeft,
  Crop,
  ExternalLink,
  Eye,
  EyeOff,
  FileText,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "@/components/admin/toast";
import { websiteApi } from "../api";
import { uploadAppearanceImage } from "../appearance/ImageUploadField";
import { WbBtn, wbInput, wbSelect } from "../ui";
import { AdminTableSkeleton } from "@/components/admin/ui/AdminSkeleton";
import { ArticleImageCropDialog } from "./ArticleImageCropDialog";
import { ArticleRichEditor } from "./ArticleRichEditor";
import {
  fileToDataUrl,
  isAllowedImageFile,
  normalizeVideoInput,
} from "./articleMediaUtils";

const SHOP_PREVIEW_URL =
  (typeof import.meta !== "undefined" && (import.meta as any).env?.VITE_SHOP_PREVIEW_URL) ||
  "http://localhost:3002";

type Article = {
  id: string;
  title: string;
  slug: string;
  previousSlugs: string[];
  category: string;
  coverUrl: string;
  videoUrl: string;
  excerpt: string;
  bodyHtml: string;
  productMas: string[];
  publishedAt: string;
  visible: boolean;
  createdAt: string;
  updatedAt: string;
  updatedBy: string | null;
};

type ProductSuggest = { ma: string; ten: string; anh?: string };

type FormState = {
  id?: string;
  title: string;
  slug: string;
  previousSlugs?: string[];
  category: string;
  coverUrl: string;
  videoUrl: string;
  excerpt: string;
  bodyHtml: string;
  productMas: string[];
  publishedAt: string;
  visible: boolean;
};

const DEFAULT_CATEGORIES = [
  "Thông tin sản phẩm",
  "Chăm sóc cây",
  "Tin tức",
  "Hướng dẫn",
];

function slugifyVi(input: string): string {
  return (
    String(input || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/đ/g, "d")
      .replace(/Đ/g, "D")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 120) || "bai-viet"
  );
}

function toLocalInput(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromLocalInput(local: string): string {
  if (!local) return new Date().toISOString();
  const t = Date.parse(local);
  return Number.isFinite(t) ? new Date(t).toISOString() : new Date().toISOString();
}

function emptyForm(): FormState {
  return {
    title: "",
    slug: "",
    category: "",
    coverUrl: "",
    videoUrl: "",
    excerpt: "",
    bodyHtml: "",
    productMas: [],
    publishedAt: new Date().toISOString(),
    visible: true,
  };
}

function bodyHtmlForPreview(raw: string): string {
  const s = String(raw || "");
  if (!s.trim()) return "<p class='text-slate-400'>Chưa có nội dung.</p>";
  let html: string;
  if (/<\s*(br|p|div|li|h[1-6]|ul|ol|iframe|figure|img)\b/i.test(s)) {
    html = s;
  } else if (!/<\s*[a-z]/i.test(s)) {
    html = s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n")
      .replace(/\n/g, "<br>\n");
  } else {
    html = s.replace(/\r\n/g, "\n").replace(/\r/g, "\n").replace(/\n/g, "<br>\n");
  }
  const parts = html.split(/(<a\b[^>]*>[\s\S]*?<\/a>|<iframe\b[^>]*>[\s\S]*?<\/iframe>)/gi);
  html = parts
    .map((part) => {
      if (/^<(a|iframe)\b/i.test(part)) return part;
      let out = part.replace(
        /(https?:\/\/[^\s<]+)|(?<![\w@/#])((?:www\.)?[a-z0-9][\w.-]*\.(?:com|vn|net|org|shop|edu|info)(?:\/[^\s<]*)?)/gi,
        (m, https: string, bare: string) => {
          const url = https || bare || m;
          const href = /^https?:\/\//i.test(url) ? url : `https://${url}`;
          return `<a href="${href}" target="_blank" rel="noopener noreferrer" class="font-semibold text-[#0F9D58] underline">${url}</a>`;
        }
      );
      out = out.replace(/#([\p{L}\p{N}_-]{2,40})/gu, (_m, tag: string) => {
        return `<span class="mr-1.5 mb-1 inline-flex rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[12px] font-semibold text-slate-800">#${tag}</span>`;
      });
      return out;
    })
    .join("");
  return html;
}

export function ShopArticlesAdmin() {
  const [q, setQ] = useState("");
  const [visible, setVisible] = useState<"all" | "1" | "0">("all");
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<Article[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editing, setEditing] = useState<FormState | null>(null);
  const [preview, setPreview] = useState<Article | null>(null);
  const [saving, setSaving] = useState(false);
  const [slugManual, setSlugManual] = useState(false);
  const [prodQ, setProdQ] = useState("");
  const [prodSuggest, setProdSuggest] = useState<ProductSuggest[]>([]);
  const [coverBusy, setCoverBusy] = useState(false);
  const [videoBusy, setVideoBusy] = useState(false);
  const [editorBusy, setEditorBusy] = useState(false);
  const [coverCropSrc, setCoverCropSrc] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [categories, setCategories] = useState<string[]>(DEFAULT_CATEGORIES);
  const coverRef = useRef<HTMLInputElement>(null);
  const videoFileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: "40",
        visible,
      });
      if (q.trim()) params.set("q", q.trim());
      const r = await websiteApi<{ items: Article[]; total: number }>(
        `/api/shop/admin/articles?${params}`
      );
      setRows(r.items || []);
      setTotal(r.total || 0);
      const fromRows = Array.from(
        new Set((r.items || []).map((a) => a.category).filter(Boolean))
      );
      setCategories((prev) =>
        Array.from(new Set([...DEFAULT_CATEGORIES, ...prev, ...fromRows])).sort((a, b) =>
          a.localeCompare(b, "vi")
        )
      );
    } catch (e: any) {
      toast.error(e?.message || "Không tải được bài viết");
    } finally {
      setLoading(false);
    }
  }, [page, q, visible]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const term = prodQ.trim();
    if (!term || !editing) {
      setProdSuggest([]);
      return;
    }
    const t = setTimeout(() => {
      const params = new URLSearchParams({
        page: "1",
        limit: "8",
        q: term,
        visible: "1",
      });
      void websiteApi<{ items: ProductSuggest[] }>(`/api/shop/admin/products?${params}`)
        .then((r) => setProdSuggest(r.items || []))
        .catch(() => setProdSuggest([]));
    }, 220);
    return () => clearTimeout(t);
  }, [prodQ, editing]);

  const openNew = () => {
    setPreview(null);
    setSlugManual(false);
    setEditing(emptyForm());
    setDirty(false);
    setSlugManual(false);
    setProdQ("");
  };

  const openPreview = async (row: Article) => {
    setEditing(null);
    try {
      const r = await websiteApi<{ item: Article }>(
        `/api/shop/admin/articles/${row.id}`
      );
      setPreview(r.item || row);
    } catch {
      setPreview(row);
    }
  };

  useEffect(() => {
    if (!preview) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPreview(null);
    };
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [preview]);

  const openEdit = (row: Article) => {
    setPreview(null);
    setSlugManual(true);
    setDirty(false);
    setEditing({
      id: row.id,
      title: row.title,
      slug: row.slug,
      previousSlugs: row.previousSlugs || [],
      category: row.category,
      coverUrl: row.coverUrl,
      videoUrl: row.videoUrl || "",
      excerpt: row.excerpt,
      bodyHtml: row.bodyHtml,
      productMas: row.productMas || [],
      publishedAt: row.publishedAt,
      visible: row.visible,
    });
    setProdQ("");
  };

  const closeEdit = () => {
    if (dirty && !window.confirm("Bạn chưa lưu. Đóng và mất thay đổi?")) return;
    setEditing(null);
    setDirty(false);
    setCoverCropSrc(null);
  };

  const patchEditing = (next: FormState) => {
    setEditing(next);
    setDirty(true);
  };

  const save = async () => {
    if (!editing) return;
    if (coverBusy || videoBusy || editorBusy) {
      toast.error("Đợi tải ảnh/video xong rồi lưu");
      return;
    }
    if (!editing.title.trim()) {
      toast.error("Nhập tiêu đề bài viết");
      return;
    }
    if (!editing.category.trim()) {
      toast.error("Chọn danh mục");
      return;
    }
    const plain = editing.bodyHtml.replace(/<[^>]+>/g, "").trim();
    if (!plain) {
      toast.error("Nhập nội dung bài viết");
      return;
    }
    let videoUrl = editing.videoUrl.trim();
    if (videoUrl) {
      const norm = normalizeVideoInput(videoUrl);
      if (norm.kind === "invalid") {
        toast.error(norm.reason);
        return;
      }
      if (norm.kind === "file") videoUrl = norm.url;
      else videoUrl = norm.embedUrl;
      if (norm.kind === "drive") {
        toast.message("Drive: nhớ chia sẻ file “ai có link” để khách xem được");
      }
    }
    setSaving(true);
    try {
      const body = {
        title: editing.title.trim().slice(0, 225),
        slug: (editing.slug || slugifyVi(editing.title)).trim(),
        category: editing.category.trim(),
        coverUrl: editing.coverUrl.trim(),
        videoUrl,
        excerpt: editing.excerpt.trim(),
        bodyHtml: editing.bodyHtml,
        productMas: editing.productMas,
        publishedAt: editing.publishedAt,
        visible: editing.visible,
      };
      if (editing.id) {
        await websiteApi(`/api/shop/admin/articles/${editing.id}`, {
          method: "PATCH",
          body: JSON.stringify(body),
        });
        toast.success("Đã lưu bài viết");
      } else {
        await websiteApi(`/api/shop/admin/articles`, {
          method: "POST",
          body: JSON.stringify(body),
        });
        toast.success("Đã tạo bài viết");
      }
      setDirty(false);
      setEditing(null);
      await load();
    } catch (e: any) {
      toast.error(e?.message || "Lưu thất bại");
    } finally {
      setSaving(false);
    }
  };

  const toggleVisible = async (row: Article) => {
    setBusyId(row.id);
    try {
      await websiteApi(`/api/shop/admin/articles/${row.id}`, {
        method: "PATCH",
        body: JSON.stringify({ visible: !row.visible }),
      });
      toast.success(!row.visible ? "Đã hiện bài trên web" : "Đã ẩn bài khỏi web");
      await load();
    } catch (e: any) {
      toast.error(e?.message || "Đổi trạng thái thất bại");
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (row: Article) => {
    if (!confirm(`Xóa bài «${row.title}»? Không hoàn tác được.`)) return;
    setBusyId(row.id);
    try {
      await websiteApi(`/api/shop/admin/articles/${row.id}`, { method: "DELETE" });
      toast.success("Đã xóa bài viết");
      await load();
    } catch (e: any) {
      toast.error(e?.message || "Xóa thất bại");
    } finally {
      setBusyId(null);
    }
  };

  const onCoverFile = async (file: File | null | undefined) => {
    if (!file || !editing) return;
    const check = isAllowedImageFile(file);
    if (!check.ok) {
      toast.error(check.message);
      if (coverRef.current) coverRef.current.value = "";
      return;
    }
    try {
      const dataUrl = await fileToDataUrl(file);
      setCoverCropSrc(dataUrl);
    } catch (e: any) {
      toast.error(e?.message || "Không đọc được ảnh");
    } finally {
      if (coverRef.current) coverRef.current.value = "";
    }
  };

  const applyCoverCrop = async (dataUrl: string) => {
    if (!editing) return;
    setCoverBusy(true);
    try {
      try {
        const r = await websiteApi<{ url: string }>("/api/shop/admin/articles/upload", {
          method: "POST",
          body: JSON.stringify({ data: dataUrl }),
        });
        patchEditing({ ...editing, coverUrl: r.url });
      } catch {
        const blob = await (await fetch(dataUrl)).blob();
        const file = new File([blob], "cover.jpg", { type: blob.type || "image/jpeg" });
        const url = await uploadAppearanceImage(file, "banner");
        patchEditing({ ...editing, coverUrl: url });
      }
      setCoverCropSrc(null);
      toast.success("Đã cập nhật ảnh đại diện (vuông 1:1)");
    } catch (e: any) {
      toast.error(e?.message || "Không tải được ảnh");
    } finally {
      setCoverBusy(false);
    }
  };

  const onVideoFile = async (file: File | null | undefined) => {
    if (!file || !editing) return;
    if (!/^video\/(mp4|webm|ogg)$/i.test(file.type)) {
      toast.error("Chỉ nhận MP4, WebM hoặc OGG");
      return;
    }
    if (file.size > 40 * 1024 * 1024) {
      toast.error("Video tối đa 40MB");
      return;
    }
    setVideoBusy(true);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ""));
        reader.onerror = () => reject(new Error("Không đọc được file"));
        reader.readAsDataURL(file);
      });
      const r = await websiteApi<{ url: string }>(
        "/api/shop/admin/articles/upload-video",
        {
          method: "POST",
          body: JSON.stringify({ data: dataUrl }),
        }
      );
      if (!r.url) throw new Error("Upload thất bại");
      patchEditing({ ...editing, videoUrl: r.url });
      toast.success("Đã tải video từ máy");
    } catch (e: any) {
      toast.error(e?.message || "Không tải được video");
    } finally {
      setVideoBusy(false);
      if (videoFileRef.current) videoFileRef.current.value = "";
    }
  };

  const addProduct = (ma: string) => {
    if (!editing || !ma) return;
    if (editing.productMas.includes(ma)) return;
    if (editing.productMas.length >= 12) {
      toast.error("Tối đa 12 sản phẩm trong bài");
      return;
    }
    patchEditing({ ...editing, productMas: [...editing.productMas, ma] });
    setProdQ("");
    setProdSuggest([]);
  };

  const pages = Math.max(1, Math.ceil(total / 40));

  if (editing) {
    const titleLen = editing.title.length;
    const mediaBusy = coverBusy || videoBusy || editorBusy;
    const videoNorm = editing.videoUrl.trim()
      ? normalizeVideoInput(editing.videoUrl.trim())
      : null;
    const videoPreviewSrc =
      videoNorm && videoNorm.kind !== "invalid"
        ? videoNorm.kind === "file"
          ? videoNorm.url
          : videoNorm.embedUrl
        : "";

    return (
      <div className="relative px-4 pb-28 pt-4 sm:px-5 sm:pb-8 sm:pt-20" style={{ background: "#F3F4F6" }}>
        {/* Thanh Lưu cố định viewport — không bị kéo theo khi cuộn (sticky hỏng khi cha có overflow) */}
        {typeof document !== "undefined"
          ? createPortal(
              <>
                <div className="pointer-events-none fixed inset-x-0 top-0 z-[100] hidden sm:block">
                  <div className="pointer-events-auto border-b border-slate-200/90 bg-white/95 shadow-sm backdrop-blur">
                    <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-3 px-5">
                      <button
                        type="button"
                        onClick={closeEdit}
                        className="inline-flex items-center gap-1.5 text-[13px] font-medium text-slate-600 hover:text-slate-900"
                      >
                        <ArrowLeft className="h-4 w-4" />
                        Danh sách
                      </button>
                      <div className="min-w-0 flex-1 text-center">
                        <p className="truncate text-[14px] font-bold text-slate-900">
                          {editing.id ? "Sửa bài viết" : "Tạo bài viết mới"}
                        </p>
                        <p className="text-[11px] text-slate-500">
                          {dirty ? "Chưa lưu" : mediaBusy ? "Đang tải media…" : "Đã đồng bộ"}
                        </p>
                      </div>
                      <WbBtn disabled={saving || mediaBusy} onClick={() => void save()}>
                        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                        Lưu
                      </WbBtn>
                    </div>
                  </div>
                </div>

                <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[100] sm:hidden">
                  <div className="pointer-events-auto border-t border-slate-200 bg-white/95 p-3 shadow-[0_-4px_16px_rgba(15,23,42,0.08)] backdrop-blur">
                    <div className="mx-auto flex max-w-5xl items-center gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-bold text-slate-900">
                          {editing.id ? "Sửa bài" : "Bài mới"}
                        </p>
                        <p className="text-[11px] text-slate-500">
                          {dirty ? "Chưa lưu" : mediaBusy ? "Đang tải…" : "Đã đồng bộ"}
                        </p>
                      </div>
                      <WbBtn variant="ghost" onClick={closeEdit}>
                        Hủy
                      </WbBtn>
                      <WbBtn
                        variant="primary"
                        disabled={saving || mediaBusy}
                        onClick={() => void save()}
                      >
                        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                        Lưu
                      </WbBtn>
                    </div>
                  </div>
                </div>
              </>,
              document.body
            )
          : null}

        <div className="mx-auto w-full max-w-5xl">
          <div className="flex flex-col gap-8 pb-2">
            {/* Thông tin cơ bản */}
            <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
              <h3 className="mb-4 text-[15px] font-bold text-slate-900">Thông tin cơ bản</h3>
              <div className="space-y-5">
            {/* Tiêu đề */}
            <div>
              <label className="mb-1.5 block text-[13px] font-semibold text-slate-800">
                Tiêu đề <span className="text-red-500">*</span>
              </label>
              <input
                className={`${wbInput} h-11`}
                value={editing.title}
                maxLength={225}
                placeholder="Nhập tiêu đề"
                onChange={(e) => {
                  const title = e.target.value.slice(0, 225);
                  patchEditing({
                    ...editing,
                    title,
                    slug: slugManual ? editing.slug : slugifyVi(title),
                  });
                }}
              />
              <p className="mt-1 text-right text-[11px] text-slate-400">
                {titleLen}/225
              </p>
            </div>

            {/* Đường dẫn */}
            <div>
              <label className="mb-1.5 block text-[13px] font-semibold text-slate-800">
                Đường dẫn (slug)
              </label>
              <input
                className={wbInput}
                value={editing.slug}
                placeholder="tu-dong-theo-tieu-de"
                onChange={(e) => {
                  setSlugManual(true);
                  patchEditing({ ...editing, slug: slugifyVi(e.target.value) });
                }}
              />
              <p className="mt-1 text-[11px] text-slate-400">
                {editing.previousSlugs?.length
                  ? `Link cũ vẫn vào được: ${editing.previousSlugs.slice(0, 3).join(", ")}`
                  : "Đổi slug sau này: khách mở link cũ sẽ chuyển sang link mới"}
              </p>
            </div>

            {/* Danh mục */}
            <div>
              <label className="mb-1.5 block text-[13px] font-semibold text-slate-800">
                Danh mục <span className="text-red-500">*</span>
              </label>
              <select
                className={`${wbSelect} h-11`}
                value={editing.category}
                onChange={(e) => patchEditing({ ...editing, category: e.target.value })}
              >
                <option value="">-- Chọn danh mục --</option>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <input
                className={`${wbInput} mt-2`}
                placeholder="Hoặc gõ danh mục mới…"
                value={
                  categories.includes(editing.category) ? "" : editing.category
                }
                onChange={(e) => patchEditing({ ...editing, category: e.target.value })}
              />
            </div>
              </div>
            </section>

            {/* Ảnh bìa */}
            <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
              <h3 className="mb-1 text-[15px] font-bold text-slate-900">Ảnh đại diện (card trang chủ)</h3>
              <p className="mb-4 text-[12px] leading-relaxed text-slate-500">
                Chỉ hiện trên card danh sách — <strong className="text-slate-700">không</strong> hiện trang
                chi tiết. Cắt vuông 1:1 bằng cùng bộ công cụ (kéo / zoom).
              </p>
              <div className="flex flex-wrap items-start gap-4">
                <div className="flex h-36 w-36 items-center justify-center overflow-hidden rounded-xl border border-dashed border-gray-300 bg-[#F7F3EA] shadow-sm">
                  {editing.coverUrl ? (
                    // eslint-disable-next-line jsx-a11y/alt-text
                    <img src={editing.coverUrl} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full flex-col items-center justify-center gap-1 text-slate-300">
                      <FileText className="h-8 w-8" />
                      <span className="text-[11px]">Chưa có ảnh</span>
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  <input
                    ref={coverRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={(e) => void onCoverFile(e.target.files?.[0])}
                  />
                  <WbBtn
                    variant="secondary"
                    disabled={coverBusy}
                    onClick={() => coverRef.current?.click()}
                  >
                    {coverBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    {editing.coverUrl ? "Đổi ảnh" : "Chọn ảnh"}
                  </WbBtn>
                  {editing.coverUrl ? (
                    <>
                      <WbBtn
                        variant="secondary"
                        disabled={coverBusy}
                        onClick={() => setCoverCropSrc(editing.coverUrl)}
                      >
                        <Crop className="h-4 w-4" />
                        Cắt lại
                      </WbBtn>
                      <WbBtn
                        variant="ghost"
                        onClick={() => patchEditing({ ...editing, coverUrl: "" })}
                      >
                        Xóa ảnh
                      </WbBtn>
                    </>
                  ) : null}
                </div>
              </div>
            </section>

            {/* Video trên trang chi tiết */}
            <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
              <h3 className="mb-1 text-[15px] font-bold text-slate-900">Video đầu trang chi tiết</h3>
              <p className="mb-4 text-[12px] leading-relaxed text-slate-500">
                Khác với video chèn trong nội dung bên dưới. YouTube, Google Drive (file đã chia sẻ “ai
                có link”), hoặc MP4 từ máy.
              </p>
              <input
                className={`${wbInput} mb-3`}
                value={editing.videoUrl}
                placeholder="https://youtu.be/… hoặc link Drive file…"
                onChange={(e) => patchEditing({ ...editing, videoUrl: e.target.value })}
                onBlur={() => {
                  const s = editing.videoUrl.trim();
                  if (!s) return;
                  const n = normalizeVideoInput(s);
                  if (n.kind === "invalid") {
                    toast.error(n.reason);
                    return;
                  }
                  const next = n.kind === "file" ? n.url : n.embedUrl;
                  if (next !== s) patchEditing({ ...editing, videoUrl: next });
                }}
              />
              <div className="flex flex-wrap items-center gap-2">
                <input
                  ref={videoFileRef}
                  type="file"
                  accept="video/mp4,video/webm,video/ogg"
                  className="hidden"
                  onChange={(e) => void onVideoFile(e.target.files?.[0])}
                />
                <WbBtn
                  variant="secondary"
                  disabled={videoBusy}
                  onClick={() => videoFileRef.current?.click()}
                >
                  {videoBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Chọn video từ máy
                </WbBtn>
                {editing.videoUrl ? (
                  <WbBtn
                    variant="ghost"
                    onClick={() => patchEditing({ ...editing, videoUrl: "" })}
                  >
                    Xóa video
                  </WbBtn>
                ) : null}
              </div>
              {videoPreviewSrc ? (
                <div className="mt-4 overflow-hidden rounded-xl border border-gray-200 bg-slate-900">
                  {videoNorm?.kind === "file" ? (
                    // eslint-disable-next-line jsx-a11y/media-has-caption
                    <video
                      src={videoPreviewSrc}
                      controls
                      className="aspect-video w-full"
                      preload="metadata"
                    />
                  ) : (
                    <iframe
                      src={videoPreviewSrc}
                      title="Video preview"
                      className="aspect-video w-full border-0"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  )}
                </div>
              ) : null}
            </section>

            {/* Tóm tắt */}
            <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
              <h3 className="mb-1 text-[15px] font-bold text-slate-900">
                Tóm tắt (hiện dưới tiêu đề trên web)
              </h3>
              <p className="mb-4 text-[12px] text-slate-500">Mô tả ngắn giúp khách hiểu bài trước khi đọc.</p>
              <textarea
                className={`${wbInput} min-h-[96px] py-2.5`}
                value={editing.excerpt}
                maxLength={500}
                placeholder="Mô tả ngắn…"
                onChange={(e) => patchEditing({ ...editing, excerpt: e.target.value })}
              />
            </section>

            {/* Nội dung */}
            <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
              <h3 className="mb-1 text-[15px] font-bold text-slate-900">
                Nội dung bài viết <span className="text-red-500">*</span>
              </h3>
              <p className="mb-4 text-[12px] leading-relaxed text-slate-500">
                Chèn ảnh → bấm ảnh để kéo góc / cắt (giữ nét). Có thể chọn nhiều ảnh. Video trong bài:
                YouTube hoặc Drive.
              </p>
              <ArticleRichEditor
                value={editing.bodyHtml}
                onChange={(bodyHtml) => patchEditing({ ...editing, bodyHtml })}
                onBusyChange={setEditorBusy}
              />
            </section>

            {/* SP + xuất bản */}
            <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
              <h3 className="mb-1 text-[15px] font-bold text-slate-900">Sản phẩm &amp; xuất bản</h3>
              <p className="mb-4 text-[12px] text-slate-500">
                Tối đa 12 mã — hiện lưới card giống trang chủ dưới nội dung trên shop
              </p>
              <div className="relative mb-6">
                <input
                  className={wbInput}
                  value={prodQ}
                  onChange={(e) => setProdQ(e.target.value)}
                  placeholder="Gõ mã hoặc tên SP…"
                />
                {prodSuggest.length ? (
                  <ul className="absolute z-10 mt-1 max-h-48 w-full overflow-auto rounded-lg border border-gray-200 bg-white shadow-lg">
                    {prodSuggest.map((p) => (
                      <li key={p.ma}>
                        <button
                          type="button"
                          className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] hover:bg-slate-50"
                          onClick={() => addProduct(p.ma)}
                        >
                          <span className="font-semibold text-[#0F9D58]">{p.ma}</span>
                          <span className="truncate text-gray-600">{p.ten}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
              {editing.productMas.length ? (
                <ul className="mb-6 flex flex-wrap gap-1.5">
                  {editing.productMas.map((ma) => (
                    <li
                      key={ma}
                      className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-[12px] font-medium text-slate-700"
                    >
                      {ma}
                      <button
                        type="button"
                        className="text-slate-400 hover:text-red-500"
                        onClick={() =>
                          patchEditing({
                            ...editing,
                            productMas: editing.productMas.filter((x) => x !== ma),
                          })
                        }
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}

              <div className="grid gap-5 border-t border-slate-100 pt-5 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-[13px] font-semibold text-slate-800">
                  Ngày xuất bản
                </label>
                <input
                  type="datetime-local"
                  className={wbInput}
                  value={toLocalInput(editing.publishedAt)}
                  onChange={(e) =>
                    patchEditing({
                      ...editing,
                      publishedAt: fromLocalInput(e.target.value),
                    })
                  }
                />
              </div>
              <div className="flex items-end pb-1">
                <label className="flex items-center gap-2 text-[13px] font-medium text-gray-700">
                  <input
                    type="checkbox"
                    checked={editing.visible}
                    onChange={(e) =>
                      patchEditing({ ...editing, visible: e.target.checked })
                    }
                  />
                  Hiện trên web
                </label>
              </div>
            </div>

            <div className="mt-6 hidden items-center justify-end gap-2 border-t border-gray-100 pt-4 sm:flex">
              <WbBtn variant="ghost" onClick={closeEdit}>
                Hủy
              </WbBtn>
              <WbBtn variant="primary" disabled={saving || mediaBusy} onClick={() => void save()}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {editing.id ? "Lưu bài" : "Đăng bài"}
              </WbBtn>
            </div>
            </section>
          </div>
        </div>

        <ArticleImageCropDialog
          open={!!coverCropSrc}
          imageSrc={coverCropSrc || ""}
          aspect={1}
          title="Cắt ảnh đại diện (vuông)"
          busy={coverBusy}
          onCancel={() => setCoverCropSrc(null)}
          onApply={applyCoverCrop}
        />
      </div>
    );
  }

  return (
    <div className="px-5 py-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-[15px] font-semibold text-gray-900">Bài viết</h2>
          <p className="text-[12px] text-gray-500">
            Viết bài cho web shop · Hiện/Ẩn · gắn sản phẩm · đổi slug vẫn giữ link cũ
          </p>
        </div>
        <div className="flex items-center gap-2">
          <WbBtn variant="ghost" onClick={() => void load()} title="Tải lại">
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </WbBtn>
          <WbBtn variant="primary" onClick={openNew}>
            <Plus className="h-4 w-4" /> Thêm bài
          </WbBtn>
        </div>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
          <input
            className={`${wbInput} pl-8`}
            placeholder="Tìm tiêu đề / slug…"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <select
          className={`${wbSelect} w-[160px]`}
          value={visible}
          onChange={(e) => {
            setVisible(e.target.value as "all" | "1" | "0");
            setPage(1);
          }}
        >
          <option value="all">Tất cả</option>
          <option value="1">Đang hiện</option>
          <option value="0">Đang ẩn</option>
        </select>
      </div>

      {loading && !rows.length ? (
        <AdminTableSkeleton
          rows={8}
          cols={5}
          headers={["Bài viết", "Danh mục", "Ngày XB", "TT", "Thao tác"]}
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
          <table className="w-full text-left text-[13px]">
            <thead className="bg-[#0F9D58] text-[11px] uppercase tracking-wide text-white">
              <tr>
                <th className="px-3 py-2.5 font-semibold">Bài viết</th>
                <th className="hidden px-3 py-2.5 font-semibold sm:table-cell">Danh mục</th>
                <th className="hidden px-3 py-2.5 font-semibold md:table-cell">Ngày XB</th>
                <th className="px-3 py-2.5 font-semibold">TT</th>
                <th className="px-3 py-2.5 text-right font-semibold">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-t border-gray-100 hover:bg-[#E8F5E9]/60">
                  <td className="px-3 py-2.5">
                    <button
                      type="button"
                      onClick={() => void openPreview(row)}
                      className="flex w-full items-center gap-2.5 border-0 bg-transparent p-0 text-left"
                      style={{ border: "none", background: "transparent" }}
                      title="Xem bài viết"
                    >
                      <div className="h-12 w-16 shrink-0 overflow-hidden rounded-lg bg-slate-100">
                        {row.coverUrl ? (
                          // eslint-disable-next-line jsx-a11y/alt-text
                          <img src={row.coverUrl} className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full items-center justify-center text-slate-300">
                            <FileText className="h-5 w-5" />
                          </div>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-[#1e3a5f] hover:underline">
                          {row.title}
                        </p>
                        <p className="truncate text-[11px] text-gray-400">/{row.slug}</p>
                      </div>
                    </button>
                  </td>
                  <td className="hidden px-3 py-2.5 text-gray-600 sm:table-cell">
                    {row.category || "—"}
                  </td>
                  <td className="hidden px-3 py-2.5 text-gray-600 md:table-cell">
                    {row.publishedAt
                      ? new Date(row.publishedAt).toLocaleString("vi-VN")
                      : "—"}
                  </td>
                  <td className="px-3 py-2.5">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                        row.visible
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {row.visible ? "Hiện" : "Ẩn"}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        type="button"
                        className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-800"
                        title={row.visible ? "Ẩn" : "Hiện"}
                        disabled={busyId === row.id}
                        onClick={() => void toggleVisible(row)}
                      >
                        {row.visible ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                      <button
                        type="button"
                        className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-800"
                        title="Sửa"
                        onClick={() => openEdit(row)}
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        className="rounded-lg p-1.5 text-red-500 hover:bg-red-50"
                        title="Xóa"
                        disabled={busyId === row.id}
                        onClick={() => void remove(row)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!rows.length ? (
                <tr>
                  <td colSpan={5} className="px-3 py-10 text-center text-sm text-gray-400">
                    Chưa có bài viết. Bấm «Thêm bài» để tạo.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      )}

      {preview && typeof document !== "undefined"
        ? createPortal(
            <div
              className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-3 sm:p-6"
              role="dialog"
              aria-modal="true"
              aria-label="Xem trước bài viết"
              onClick={() => setPreview(null)}
            >
              <div
                className="flex max-h-[min(92vh,900px)] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex shrink-0 items-center justify-between gap-3 border-b border-gray-100 bg-white px-5 py-3.5">
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-[#0F9D58]">
                      Xem trước (theo thứ tự form nhập)
                    </p>
                    <p className="truncate text-[13px] text-slate-500">
                      /{preview.slug}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <WbBtn
                      variant="ghost"
                      className="!h-8 !px-2.5 text-[12px]"
                      href={`${SHOP_PREVIEW_URL}/bai-viet/${encodeURIComponent(preview.slug)}`}
                      title="Mở trên shop"
                    >
                      <ExternalLink className="h-3.5 w-3.5" /> Shop
                    </WbBtn>
                    <WbBtn
                      variant="secondary"
                      className="!h-8 !px-2.5 text-[12px]"
                      onClick={() => openEdit(preview)}
                    >
                      <Pencil className="h-3.5 w-3.5" /> Sửa
                    </WbBtn>
                    <button
                      type="button"
                      className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                      onClick={() => setPreview(null)}
                      title="Đóng"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                </div>

                {/* Thứ tự khớp form: tiêu đề → danh mục → ảnh → tóm tắt → nội dung → SP */}
                <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-5">
                  <div>
                    <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                      Tiêu đề
                    </p>
                    <h3 className="text-[22px] font-bold leading-snug text-slate-900">
                      {preview.title}
                    </h3>
                    <p className="mt-2 text-[12px] text-slate-500">
                      {preview.publishedAt
                        ? new Date(preview.publishedAt).toLocaleString("vi-VN")
                        : ""}
                      {preview.visible ? " · Đang hiện trên web" : " · Đang ẩn"}
                    </p>
                  </div>

                  <div>
                    <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                      Danh mục
                    </p>
                    {preview.category ? (
                      <p className="text-[13px] font-bold uppercase tracking-wide text-[#0F9D58]">
                        {preview.category}
                      </p>
                    ) : (
                      <p className="text-[13px] text-slate-400">Chưa chọn</p>
                    )}
                  </div>

                  <div>
                    <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                      Ảnh đại diện (card trang chủ)
                    </p>
                    {preview.coverUrl ? (
                      <div className="overflow-hidden rounded-xl bg-[#F7F3EA]">
                        {/* eslint-disable-next-line jsx-a11y/alt-text */}
                        <img
                          src={preview.coverUrl}
                          className="block h-auto w-full"
                        />
                      </div>
                    ) : (
                      <p className="text-[13px] text-slate-400">Chưa có ảnh</p>
                    )}
                  </div>

                  <div>
                    <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                      Video đại diện
                    </p>
                    {preview.videoUrl ? (
                      <div className="overflow-hidden rounded-xl bg-slate-900">
                        {/\.(mp4|webm|ogg)(\?|$)/i.test(preview.videoUrl) ||
                        preview.videoUrl.includes("/uploads/") ? (
                          // eslint-disable-next-line jsx-a11y/media-has-caption
                          <video
                            src={preview.videoUrl}
                            controls
                            className="aspect-video w-full"
                            preload="metadata"
                          />
                        ) : (
                          <iframe
                            src={
                              /embed\//i.test(preview.videoUrl)
                                ? preview.videoUrl
                                : preview.videoUrl.replace(
                                    /(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]{11})/,
                                    "https://www.youtube.com/embed/$1"
                                  )
                            }
                            title="Video"
                            className="aspect-video w-full border-0"
                            allowFullScreen
                          />
                        )}
                      </div>
                    ) : (
                      <p className="text-[13px] text-slate-400">Chưa có video</p>
                    )}
                  </div>

                  <div>
                    <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                      Tóm tắt
                    </p>
                    {preview.excerpt ? (
                      <p className="text-[15px] font-medium leading-relaxed text-slate-700">
                        {preview.excerpt}
                      </p>
                    ) : (
                      <p className="text-[13px] text-slate-400">Chưa có tóm tắt</p>
                    )}
                  </div>

                  <div>
                    <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                      Nội dung bài viết
                    </p>
                    <div
                      className="article-body max-w-none text-[15px] leading-7 text-slate-800 [&_a]:font-bold [&_a]:text-[#0F9D58] [&_a]:underline [&_h1]:mb-2 [&_h1]:mt-4 [&_h1]:text-xl [&_h1]:font-bold [&_h2]:mb-2 [&_h2]:mt-4 [&_h2]:text-lg [&_h2]:font-bold [&_h3]:mb-2 [&_h3]:mt-3 [&_h3]:text-base [&_h3]:font-bold [&_li]:my-1.5 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:my-3 [&_strong]:tracking-[0.015em] [&_table]:my-3 [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:border-slate-200 [&_td]:px-3 [&_td]:py-2 [&_th]:border [&_th]:border-slate-200 [&_th]:bg-slate-50 [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_.article-video]:relative [&_.article-video]:my-3 [&_.article-video]:aspect-video [&_.article-video]:w-full [&_.article-video]:overflow-hidden [&_.article-video]:rounded-xl [&_.article-video]:bg-slate-900 [&_.article-video_iframe]:absolute [&_.article-video_iframe]:inset-0 [&_.article-video_iframe]:h-full [&_.article-video_iframe]:w-full [&_img]:my-3 [&_img]:h-auto [&_img]:w-full [&_img]:max-w-full [&_img]:rounded-lg [&_img]:border [&_img]:border-slate-200 [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-6"
                      dangerouslySetInnerHTML={{
                        __html: bodyHtmlForPreview(preview.bodyHtml || ""),
                      }}
                    />
                  </div>

                  <div>
                    <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                      Sản phẩm trong bài
                    </p>
                    {preview.productMas?.length ? (
                      <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                        <p className="text-[13px] text-slate-800">
                          {preview.productMas.join(", ")}
                        </p>
                      </div>
                    ) : (
                      <p className="text-[13px] text-slate-400">Chưa gắn sản phẩm</p>
                    )}
                  </div>
                </div>
              </div>
            </div>,
            document.body
          )
        : null}

      {pages > 1 ? (
        <div className="mt-3 flex items-center justify-between text-[12px] text-gray-500">
          <span>
            {total} bài · trang {page}/{pages}
          </span>
          <div className="flex gap-1">
            <WbBtn
              variant="ghost"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Trước
            </WbBtn>
            <WbBtn
              variant="ghost"
              disabled={page >= pages}
              onClick={() => setPage((p) => Math.min(pages, p + 1))}
            >
              Sau
            </WbBtn>
          </div>
        </div>
      ) : null}
    </div>
  );
}
