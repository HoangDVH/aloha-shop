"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Plus, RefreshCw, Search } from "lucide-react";
import { toast } from "@/components/admin/toast";
import { websiteApi } from "../api";
import { uploadAppearanceImage } from "../appearance/ImageUploadField";
import { WbBtn, wbInput, wbSelect } from "../ui";
import {
  fileToDataUrl,
  isAllowedImageFile,
  normalizeVideoInput,
} from "./articleMediaUtils";
import {
  DEFAULT_CATEGORIES,
  emptyForm,
  slugifyVi,
  type Article,
  type FormState,
} from "./articleUtils";
import { ArticleEditView } from "./ArticleEditView";
import { ArticleTable } from "./ArticleTable";
import { ArticlePreview } from "./ArticlePreview";

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

  const openNew = () => {
    setPreview(null);
    setSlugManual(false);
    setEditing(emptyForm());
    setDirty(false);
    setSlugManual(false);
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
  };

  const pages = Math.max(1, Math.ceil(total / 40));

  if (editing) {
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
      <ArticleEditView
        editing={editing}
        patchEditing={patchEditing}
        dirty={dirty}
        mediaBusy={mediaBusy}
        saving={saving}
        closeEdit={closeEdit}
        save={save}
        slugManual={slugManual}
        setSlugManual={setSlugManual}
        categories={categories}
        coverRef={coverRef}
        coverBusy={coverBusy}
        onCoverFile={onCoverFile}
        coverCropSrc={coverCropSrc}
        setCoverCropSrc={setCoverCropSrc}
        applyCoverCrop={applyCoverCrop}
        videoFileRef={videoFileRef}
        videoBusy={videoBusy}
        onVideoFile={onVideoFile}
        videoNorm={videoNorm}
        videoPreviewSrc={videoPreviewSrc}
        setEditorBusy={setEditorBusy}
        addProduct={addProduct}
      />
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

      <ArticleTable
        loading={loading}
        rows={rows}
        busyId={busyId}
        openPreview={openPreview}
        openEdit={openEdit}
        toggleVisible={toggleVisible}
        remove={remove}
      />

      <ArticlePreview
        preview={preview}
        onClose={() => setPreview(null)}
        onEdit={openEdit}
      />

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
