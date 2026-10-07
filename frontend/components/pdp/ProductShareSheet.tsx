"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Check, Download, Link2, Loader2, Play, Share2, X } from "lucide-react";
import { formatVnd } from "@/lib/api";
import { buildProductShareUrl } from "@/lib/ctv";
import { SHOP_ORIGIN } from "@/lib/seo";
import { useToast } from "@/components/Toast";
import {
  canShareFilesOnDevice,
  copyText,
  downloadFile,
  isShareableVideoUrl,
  loadShareFile,
  type ShareMediaItem,
} from "@/lib/shareMedia";

const MAX_MEDIA = 12;
const MAX_PICK = 9;
const DEFAULT_PICK = 6;

type LoadState = "loading" | "ok" | "error";

/** Zalo/Facebook chỉ dựng thẻ xem trước (ảnh SP) từ domain công khai — không dùng localhost/IP LAN. */
function publicShareUrl(raw: string): string {
  try {
    const u = new URL(raw, SHOP_ORIGIN);
    return `${SHOP_ORIGIN}${u.pathname}${u.search}`;
  } catch {
    return raw;
  }
}

type ShareProps = {
  ma: string;
  name: string;
  path: string;
  price: number;
  images: string[];
  videos: string[];
  ctvCode?: string;
};

/** Nút «Chia sẻ» trang SP kiểu Shopee: Zalo / Facebook kèm ảnh + video của SP. */
export function ProductShareButton(props: ShareProps) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3 text-xs font-bold text-slate-600 ring-1 ring-slate-200 transition hover:bg-slate-50 active:scale-95"
      >
        <Share2 size={15} aria-hidden />
        Chia sẻ
      </button>
      {open ? <ProductShareSheet {...props} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

function ProductShareSheet({ ma, name, path, price, images, videos, ctvCode, onClose }: ShareProps & { onClose: () => void }) {
  const toast = useToast();
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const files = useRef(new Map<string, File>());
  const inflight = useRef(new Set<string>());
  const loader = useRef<AbortController | null>(null);
  const [loadState, setLoadState] = useState<Record<string, LoadState>>({});
  const [deviceShare, setDeviceShare] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const media = useMemo<ShareMediaItem[]>(() => {
    const vids = [...new Set(videos.filter(isShareableVideoUrl))].map((src) => ({ src, kind: "video" as const }));
    const imgs = [...new Set(images.filter(Boolean))].map((src) => ({ src, kind: "image" as const }));
    return [...vids.slice(0, 2), ...imgs].slice(0, MAX_MEDIA);
  }, [images, videos]);

  const [picked, setPicked] = useState<string[]>(() => media.slice(0, DEFAULT_PICK).map((m) => m.src));
  const pickedItems = media.filter((m) => picked.includes(m.src));
  const poster = images[0] || "";
  const url = publicShareUrl(buildProductShareUrl(path, ctvCode, ma));
  const priceLabel = price > 0 ? formatVnd(price) : "";
  const caption = [name, priceLabel ? `Giá: ${priceLabel}` : "", `Xem tại ALOHA: ${url}`].filter(Boolean).join("\n");
  const fileBase = `aloha-${ma}`.replace(/[^\w-]+/g, "-");

  useEffect(() => {
    const el = dialog.current;
    if (!el) return;
    const before = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    el.showModal();
    setDeviceShare(canShareFilesOnDevice());
    return () => {
      el.close();
      document.body.style.overflow = before;
    };
  }, []);

  useEffect(() => () => loader.current?.abort(), []);

  // Điện thoại: tải sẵn file khi mở bảng để lúc bấm Zalo/Facebook, navigator.share còn trong lượt thao tác của khách.
  useEffect(() => {
    if (!deviceShare) return;
    loader.current ??= new AbortController();
    const { signal } = loader.current;
    for (const item of pickedItems) {
      if (files.current.has(item.src) || inflight.current.has(item.src) || loadState[item.src] === "error") continue;
      inflight.current.add(item.src);
      setLoadState((s) => ({ ...s, [item.src]: "loading" }));
      loadShareFile(item, `${fileBase}-${media.indexOf(item) + 1}`, signal)
        .then((f) => {
          files.current.set(item.src, f);
          setLoadState((s) => ({ ...s, [item.src]: "ok" }));
        })
        .catch(() => {
          if (!signal.aborted) setLoadState((s) => ({ ...s, [item.src]: "error" }));
        })
        .finally(() => inflight.current.delete(item.src));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deviceShare, picked, loadState]);

  const pending = deviceShare ? pickedItems.filter((m) => loadState[m.src] !== "ok" && loadState[m.src] !== "error").length : 0;
  const readyFiles = pickedItems.map((m) => files.current.get(m.src)).filter((f): f is File => Boolean(f));

  const toggle = (src: string) => {
    setPicked((p) => {
      if (p.includes(src)) return p.filter((s) => s !== src);
      if (p.length >= MAX_PICK) {
        toast.push(`Chọn tối đa ${MAX_PICK} ảnh/video`);
        return p;
      }
      return [...p, src];
    });
    setLoadState((s) => {
      if (s[src] !== "error") return s;
      const { [src]: _retry, ...rest } = s;
      return rest;
    });
  };

  const shareWithDevice = async () => {
    void copyText(caption);
    try {
      if (readyFiles.length && navigator.canShare?.({ files: readyFiles })) {
        await navigator.share({ files: readyFiles, title: name, text: caption });
      } else {
        await navigator.share({ title: name, text: priceLabel ? `${name} — ${priceLabel}` : name, url });
      }
      toast.push("Link SP đã được sao chép — dán vào tin nhắn nếu ứng dụng không tự kèm");
      onClose();
    } catch (e) {
      if ((e as { name?: string })?.name !== "AbortError") toast.push("Không mở được bảng chia sẻ, đã sao chép link SP");
    }
  };

  const shareTo = async (target: "zalo" | "facebook") => {
    if (deviceShare && typeof navigator.share === "function") {
      await shareWithDevice();
      return;
    }
    if (target === "facebook") {
      window.open(
        `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
        "_blank",
        "noopener,noreferrer,width=640,height=600"
      );
      return;
    }
    await copyText(caption);
    window.open("https://chat.zalo.me/", "_blank", "noopener,noreferrer");
    toast.push("Đã sao chép link SP — dán (Ctrl+V) vào khung chat Zalo");
  };

  const copyLink = async () => {
    toast.push((await copyText(url)) ? "Đã sao chép link sản phẩm" : "Không sao chép được link");
  };

  const saveMedia = async () => {
    if (!pickedItems.length) {
      toast.push("Chọn ít nhất 1 ảnh hoặc video");
      return;
    }
    setDownloading(true);
    let failed = 0;
    for (const item of pickedItems) {
      try {
        const n = media.indexOf(item) + 1;
        const f = files.current.get(item.src) ?? (await loadShareFile(item, `${fileBase}-${n}`));
        files.current.set(item.src, f);
        downloadFile(f);
      } catch {
        failed += 1;
      }
    }
    setDownloading(false);
    toast.push(failed ? `Đã lưu ${pickedItems.length - failed}/${pickedItems.length} file` : `Đã lưu ${pickedItems.length} file`);
  };

  const busy = pending > 0;
  const actions = [
    {
      key: "zalo",
      label: "Zalo",
      icon: <span className="text-[11px] font-black tracking-tight">Zalo</span>,
      tone: "bg-[#0068FF] text-white",
      onClick: () => void shareTo("zalo"),
      wait: true,
    },
    {
      key: "facebook",
      label: "Facebook",
      icon: <span className="text-xl font-black leading-none">f</span>,
      tone: "bg-[#1877F2] text-white",
      onClick: () => void shareTo("facebook"),
      wait: true,
    },
    {
      key: "copy",
      label: "Sao chép link",
      icon: <Link2 size={20} />,
      tone: "bg-slate-100 text-slate-700",
      onClick: () => void copyLink(),
      wait: false,
    },
    {
      key: "save",
      label: "Lưu ảnh & video",
      icon: downloading ? <Loader2 size={20} className="animate-spin" /> : <Download size={20} />,
      tone: "bg-emerald-50 text-[var(--aloha-green-mid)]",
      onClick: () => void saveMedia(),
      wait: false,
    },
  ];

  return (
    <dialog
      ref={dialog}
      aria-labelledby={titleId}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-x-0 bottom-0 top-auto m-0 max-h-[90dvh] w-full max-w-none overflow-hidden rounded-t-[28px] border-0 bg-white p-0 text-stone-900 backdrop:bg-black/50 sm:inset-0 sm:m-auto sm:h-fit sm:max-w-md sm:rounded-3xl"
    >
      <div className="flex max-h-[90dvh] flex-col">
        <div className="flex shrink-0 items-center justify-between px-5 pb-2 pt-4">
          <h2 id={titleId} className="text-base font-bold">Chia sẻ sản phẩm</h2>
          <button type="button" onClick={onClose} aria-label="Đóng chia sẻ" className="-mr-2 flex h-11 w-11 items-center justify-center rounded-full text-stone-500 outline-none focus-visible:ring-2 focus-visible:ring-stone-300">
            <X size={22} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-2">
          <div className="flex items-center gap-3 rounded-2xl bg-stone-50 p-2.5">
            <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-white">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {poster ? <img src={poster} alt="" className="h-full w-full object-cover" /> : null}
            </div>
            <div className="min-w-0">
              <p className="line-clamp-2 text-sm font-semibold text-stone-800">{name}</p>
              {priceLabel ? <p className="mt-0.5 text-sm font-bold text-[#e91e50]">{priceLabel}</p> : null}
            </div>
          </div>

          {media.length ? (
            <div className="mt-4">
              <div className="flex items-baseline justify-between">
                <p className="text-sm font-semibold">Gửi kèm ảnh & video</p>
                <p className="text-xs tabular-nums text-stone-500">
                  Đã chọn {pickedItems.length}/{Math.min(MAX_PICK, media.length)}
                </p>
              </div>
              <ul className="-mx-5 mt-2 flex gap-2 overflow-x-auto px-5 pb-1">
                {media.map((m) => {
                  const on = picked.includes(m.src);
                  const st = loadState[m.src];
                  return (
                    <li key={m.src} className="shrink-0">
                      <button
                        type="button"
                        onClick={() => toggle(m.src)}
                        aria-pressed={on}
                        aria-label={`${m.kind === "video" ? "Video" : "Ảnh"} ${media.indexOf(m) + 1}`}
                        className={`relative h-16 w-16 overflow-hidden rounded-xl bg-stone-100 ring-2 transition ${on ? "ring-[var(--aloha-green)]" : "ring-transparent opacity-70"}`}
                      >
                        {m.kind === "video" ? (
                          poster ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={poster} alt="" className="h-full w-full object-cover" />
                          ) : (
                            <video src={m.src} muted playsInline preload="metadata" className="h-full w-full object-cover" />
                          )
                        ) : (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={m.src} alt="" className="h-full w-full object-cover" />
                        )}
                        {m.kind === "video" ? (
                          <span className="absolute inset-0 flex items-center justify-center bg-black/35">
                            <Play size={18} className="fill-white text-white" />
                          </span>
                        ) : null}
                        <span
                          className={`absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full text-white ring-2 ring-white ${
                            on ? (st === "error" ? "bg-rose-500" : "bg-[var(--aloha-green)]") : "bg-black/30"
                          }`}
                        >
                          {on && deviceShare && st === "loading" ? (
                            <Loader2 size={11} className="animate-spin" />
                          ) : on && st === "error" ? (
                            <X size={11} strokeWidth={3} />
                          ) : on ? (
                            <Check size={11} strokeWidth={3} />
                          ) : null}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
              <p className="mt-1.5 text-xs leading-relaxed text-stone-500">
                {deviceShare
                  ? "Bấm Zalo hoặc Facebook rồi chọn ứng dụng trong bảng chia sẻ của máy — ảnh, video và link SP được gửi kèm."
                  : "Trên máy tính, Zalo/Facebook hiện ảnh xem trước từ link. Muốn gửi kèm video, bấm «Lưu ảnh & video» rồi kéo file vào khung chat."}
              </p>
            </div>
          ) : null}
        </div>

        <div className="shrink-0 border-t border-stone-100 px-3 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <p role="status" aria-live="polite" className="min-h-4 px-2 text-center text-xs text-stone-500">
            {busy ? `Đang chuẩn bị ảnh & video… (${pickedItems.length - pending}/${pickedItems.length})` : ""}
          </p>
          <div className="mt-1 grid grid-cols-4 gap-1">
            {actions.map((a) => {
              const disabled = (a.wait && busy) || (a.key === "save" && downloading);
              return (
                <button
                  key={a.key}
                  type="button"
                  onClick={a.onClick}
                  disabled={disabled}
                  className="flex flex-col items-center gap-1.5 rounded-2xl px-1 py-2 text-[11px] font-semibold text-stone-700 transition hover:bg-stone-50 disabled:opacity-40"
                >
                  <span className={`flex h-12 w-12 items-center justify-center rounded-full ${a.tone}`}>
                    {a.wait && busy ? <Loader2 size={18} className="animate-spin" /> : a.icon}
                  </span>
                  <span className="text-center leading-tight">{a.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </dialog>
  );
}
