"use client";

import { useEffect, useRef, useState } from "react";
import { Share2, X } from "lucide-react";
import { ShareCaptionEditor } from "./ShareCaptionEditor";
import { useShopAuth } from "./ShopAuthProvider";
import { useToast } from "./Toast";
import { buildArticleCaption, shareCaptionWithLink } from "@/lib/shareCaption";
import { fetchPublicShareProduct } from "@/lib/publicShareProduct";
import { copyText } from "@/lib/shareMedia";
import { buildProductShareUrl, isValidCtvCode, normalizeCtvCode } from "@/lib/ctv";
import { SHOP_ORIGIN } from "@/lib/seo";
import type { ShopProduct } from "@/lib/api";
import { useHydrated } from "@/lib/useHydratedQuery";

export function ArticleShareButton(props: { title: string; excerpt: string; url: string; productMas: string[] }) {
  const hydrated = useHydrated();
  const [open, setOpen] = useState(false);
  return <><button type="button" disabled={!hydrated} aria-busy={!hydrated} onClick={() => setOpen(true)} aria-haspopup="dialog" className="inline-flex items-center gap-1.5 font-semibold text-[var(--aloha-green)] hover:underline"><Share2 size={14} />Chia sẻ</button>
    {open ? <ArticleShareDialog {...props} onClose={() => setOpen(false)} /> : null}</>;
}

function ArticleShareDialog({ title, excerpt, url, productMas, onClose }: { title: string; excerpt: string; url: string; productMas: string[]; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const toast = useToast();
  const { user } = useShopAuth();
  const code = normalizeCtvCode(user?.roles.includes("ctv") ? user.ctvCode || "" : "");
  const ctv = isValidCtvCode(code) ? code : "";
  const link = new URL(url, SHOP_ORIGIN);
  if (ctv) link.searchParams.set("ctv", ctv);
  const [products, setProducts] = useState<ShopProduct[]>([]);
  const [loading, setLoading] = useState(Boolean(productMas.length));
  const [edited, setEdited] = useState<string | null>(null);
  const defaultCaption = buildArticleCaption(title, excerpt, link.toString(), products.map(product => ({ product, url: buildProductShareUrl(product.path, ctv, product.ma).replace(/^https?:\/\/[^/]+/, SHOP_ORIGIN) })));
  const caption = edited ?? defaultCaption;

  useEffect(() => {
    const el = dialog.current;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    el?.showModal();
    return () => { el?.close(); document.body.style.overflow = overflow; };
  }, []);

  useEffect(() => {
    const ctrl = new AbortController();
    void Promise.allSettled(productMas.slice(0, 3).map(ma => fetchPublicShareProduct(ma, ctrl.signal))).then(results => {
      if (ctrl.signal.aborted) return;
      setProducts(results.flatMap(r => r.status === "fulfilled" ? [r.value] : []));
      setLoading(false);
    });
    return () => ctrl.abort();
  }, [productMas]);

  const shareText = shareCaptionWithLink(caption, link.toString());
  const copy = async () => { toast.push(await copyText(shareText) ? "Đã sao chép nội dung và link bài viết" : "Không sao chép được nội dung"); };
  const share = async (target: "facebook" | "zalo") => {
    if (target === "facebook") {
      window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(link.toString())}`, "_blank", "noopener,noreferrer,width=640,height=600");
      toast.push("Bấm Sao chép nội dung & link để dán phần nội dung vào bài đăng Facebook.");
    } else {
      if (!await copyText(shareText)) { toast.push("Không sao chép được nội dung. Hãy chọn nội dung để sao chép."); return; }
      window.open("https://chat.zalo.me/", "_blank", "noopener,noreferrer");
      toast.push("Đã sao chép nội dung — dán vào khung chat Zalo");
    }
  };
  return <dialog ref={dialog} aria-label="Chia sẻ bài viết" onCancel={onClose} onClick={e => { if (e.target === e.currentTarget) onClose(); }} className="fixed inset-x-0 bottom-0 top-auto m-0 max-h-[90dvh] w-full max-w-none overflow-y-auto rounded-t-3xl border-0 bg-white p-5 text-stone-900 backdrop:bg-black/50 sm:inset-0 sm:m-auto sm:max-w-lg sm:rounded-3xl">
    <div className="flex items-center justify-between"><h2 className="font-bold">Chia sẻ bài viết</h2><button type="button" aria-label="Đóng chia sẻ" onClick={onClose} className="flex h-11 w-11 items-center justify-center"><X size={22} /></button></div>
    <ShareCaptionEditor value={caption} onChange={setEdited} onReset={() => setEdited(null)} loading={loading} />
    <div className="mt-4 grid grid-cols-3 gap-2">
      <button type="button" disabled={loading} onClick={() => void share("zalo")} className="rounded-xl bg-blue-600 p-3 text-sm font-semibold text-white disabled:opacity-40">Zalo</button>
      <button type="button" disabled={loading} onClick={() => void share("facebook")} className="rounded-xl bg-blue-700 p-3 text-sm font-semibold text-white disabled:opacity-40">Facebook</button>
      <button type="button" disabled={loading} onClick={() => void copy()} className="rounded-xl bg-stone-100 p-3 text-xs font-semibold disabled:opacity-40">Sao chép nội dung & link</button>
    </div>
  </dialog>;
}
