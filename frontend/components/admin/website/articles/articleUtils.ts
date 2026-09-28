export const SHOP_PREVIEW_URL =
  (typeof import.meta !== "undefined" && (import.meta as any).env?.VITE_SHOP_PREVIEW_URL) ||
  "http://localhost:3002";

export type Article = {
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

export type ProductSuggest = { ma: string; ten: string; anh?: string };

export type FormState = {
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

export const DEFAULT_CATEGORIES = [
  "Thông tin sản phẩm",
  "Chăm sóc cây",
  "Tin tức",
  "Hướng dẫn",
];

export function slugifyVi(input: string): string {
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

export function toLocalInput(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function fromLocalInput(local: string): string {
  if (!local) return new Date().toISOString();
  const t = Date.parse(local);
  return Number.isFinite(t) ? new Date(t).toISOString() : new Date().toISOString();
}

export function emptyForm(): FormState {
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

export function bodyHtmlForPreview(raw: string): string {
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
