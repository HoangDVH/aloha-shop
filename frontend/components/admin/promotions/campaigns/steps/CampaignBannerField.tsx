"use client";

import { useEffect, useRef, useState } from "react";
import { Button, App } from "antd";
import { ImagePlus, Trash2 } from "lucide-react";
import { ArticleImageCropDialog } from "@/components/admin/website/articles/ArticleImageCropDialog";
import { websiteApi } from "@/components/admin/website/api";

const MAX_BYTES = 4 * 1024 * 1024;
const ACCEPT = "image/jpeg,image/png,image/webp";

type Props = {
  value?: string;
  onChange: (url: string) => void;
  /** Tỉ lệ khoá khi cắt, ví dụ 8/3 cho banner chính. */
  aspect: number;
  ratioLabel: string;
};

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result || ""));
    r.onerror = () => reject(new Error("Không đọc được file"));
    r.readAsDataURL(file);
  });
}

const RETRY_MS = [600, 1500, 3000];

/** Ảnh vừa tải lên đôi khi chưa đọc được ở lần đầu: thử lại vài lần thay vì để icon ảnh vỡ. */
function BannerPreview({ url }: { url: string }) {
  const [attempt, setAttempt] = useState(0);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    setAttempt(0);
    setFailed(false);
  }, [url]);
  const onError = () => {
    if (attempt >= RETRY_MS.length) return setFailed(true);
    setTimeout(() => setAttempt((a) => a + 1), RETRY_MS[attempt]);
  };
  if (failed) {
    return <div className="flex h-full items-center justify-center px-3 text-center text-[12px] text-slate-500">Không hiển thị được ảnh. Bấm &quot;Đổi ảnh&quot; để tải lại.</div>;
  }
  const src = attempt ? `${url}${url.includes("?") ? "&" : "?"}r=${attempt}` : url;
  // eslint-disable-next-line @next/next/no-img-element
  return <img key={src} src={src} alt="" onError={onError} className="h-full w-full object-cover" />;
}

/** Chọn ảnh → cắt đúng tỉ lệ ô → tải lên (server lưu WebP). Chặn SVG / file không phải ảnh / > 4MB. */
export function CampaignBannerField({ value, onChange, aspect, ratioLabel }: Props) {
  const { message } = App.useApp();
  const input = useRef<HTMLInputElement>(null);
  const [src, setSrc] = useState("");
  const [busy, setBusy] = useState(false);
  const pick = async (file?: File | null) => {
    if (!file) return;
    if (!/^image\/(jpeg|png|webp)$/i.test(file.type)) return void message.error("Chỉ nhận ảnh JPG, PNG hoặc WebP");
    if (file.size > MAX_BYTES) return void message.error("Ảnh tối đa 4MB");
    setSrc(await readAsDataUrl(file));
  };
  const upload = async (dataUrl: string) => {
    setBusy(true);
    try {
      const r = await websiteApi<{ url: string }>("/api/shop/admin/appearance/upload", {
        method: "POST",
        body: JSON.stringify({ data: dataUrl, kind: "banner" }),
      });
      onChange(r.url);
      setSrc("");
    } catch (e: any) {
      message.error(e?.message || "Tải ảnh thất bại");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  };
  return (
    <div>
      {value ? (
        <div className="relative overflow-hidden rounded-lg border border-slate-200 bg-slate-50" style={{ aspectRatio: String(aspect) }}>
          <BannerPreview url={value} />
          <button type="button" onClick={() => onChange("")} className="absolute right-1.5 top-1.5 rounded bg-white/90 p-1 text-red-600 shadow" aria-label="Xoá ảnh">
            <Trash2 size={14} />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => input.current?.click()}
          className="flex w-full flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-slate-300 bg-slate-50 text-[12px] text-slate-500 hover:border-emerald-400"
          style={{ aspectRatio: String(aspect) }}
        >
          <ImagePlus size={18} /> Chọn ảnh ({ratioLabel})
        </button>
      )}
      {value ? (
        <Button size="small" className="mt-1" onClick={() => input.current?.click()}>
          Đổi ảnh
        </Button>
      ) : null}
      <input ref={input} type="file" accept={ACCEPT} className="hidden" onChange={(e) => void pick(e.target.files?.[0])} />
      <ArticleImageCropDialog
        open={!!src}
        imageSrc={src}
        aspect={aspect}
        title={`Cắt ảnh theo tỉ lệ ${ratioLabel}`}
        busy={busy}
        onCancel={() => setSrc("")}
        onApply={upload}
      />
    </div>
  );
}
