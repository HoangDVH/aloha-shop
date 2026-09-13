/**
 * Chuẩn hóa HTML body bài viết khi hiện trên shop:
 * - URL → link nổi bật
 * - #hashtag → pill bấm được (lọc /bai-viet?q=)
 */

function escapeHtml(s: string): string {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttr(s: string): string {
  return escapeHtml(s).replace(/'/g, "&#39;");
}

/** Biến URL / domain thành thẻ <a> (bỏ qua đoạn đã nằm trong thẻ a / iframe). */
export function linkifyHtml(html: string): string {
  const parts = String(html || "").split(/(<a\b[^>]*>[\s\S]*?<\/a>|<iframe\b[^>]*>[\s\S]*?<\/iframe>)/gi);
  return parts
    .map((part) => {
      if (/^<(a|iframe)\b/i.test(part)) return part;
      return part.replace(
        /(https?:\/\/[^\s<]+)|(?<![\w@/#])((?:www\.)?[a-z0-9][\w.-]*\.(?:com|vn|net|org|shop|edu|info)(?:\/[^\s<]*)?)/gi,
        (m, https: string, bare: string) => {
          const url = https || bare || m;
          const href = /^https?:\/\//i.test(url) ? url : `https://${url}`;
          return `<a class="article-link" href="${escapeAttr(href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(url)}</a>`;
        }
      );
    })
    .join("");
}

/** #hashtag → pill link tới danh sách bài (bỏ qua trong thẻ a). */
export function hashtagifyHtml(html: string): string {
  const parts = String(html || "").split(/(<a\b[^>]*>[\s\S]*?<\/a>)/gi);
  return parts
    .map((part) => {
      if (/^<a\b/i.test(part)) return part;
      return part.replace(/#([\p{L}\p{N}_-]{2,40})/gu, (_m, tag: string) => {
        const label = `#${tag}`;
        const href = `/bai-viet?q=${encodeURIComponent(tag)}`;
        return `<a class="article-hashtag" href="${escapeAttr(href)}">${escapeHtml(label)}</a>`;
      });
    })
    .join("");
}

/** Bọc ảnh: giữ width % từ editor, cao theo tỉ lệ — không blur, không cắt. */
export function wrapArticleImages(html: string): string {
  return String(html || "").replace(
    /<img\b([^>]*?)\/?>/gi,
    (full, attrs: string) => {
      if (/article-img-frame|article-cover__/i.test(attrs)) return full;
      const srcMatch = attrs.match(/\bsrc\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/i);
      const src = (srcMatch?.[2] || srcMatch?.[3] || srcMatch?.[4] || "").trim();
      if (!src) return full;
      const altMatch = attrs.match(/\balt\s*=\s*("([^"]*)"|'([^']*)')/i);
      const alt = altMatch?.[2] || altMatch?.[3] || "";
      const styleMatch = attrs.match(/\bstyle\s*=\s*("([^"]*)"|'([^']*)')/i);
      const styleRaw = styleMatch?.[2] || styleMatch?.[3] || "";
      const widthMatch = styleRaw.match(/(?:^|;)\s*width\s*:\s*([^;]+)/i);
      const heightMatch = styleRaw.match(/(?:^|;)\s*height\s*:\s*([^;]+)/i);
      const fitMatch = styleRaw.match(/(?:^|;)\s*object-fit\s*:\s*([^;]+)/i);
      const mlMatch = styleRaw.match(/(?:^|;)\s*margin-left\s*:\s*([^;]+)/i);
      const mrMatch = styleRaw.match(/(?:^|;)\s*margin-right\s*:\s*([^;]+)/i);
      let frameStyle = "display:block;max-width:100%";
      if (widthMatch?.[1]) {
        const w = widthMatch[1].trim();
        if (/%$/.test(w) || /^\d+(\.\d+)?px$/i.test(w)) {
          frameStyle += `;width:${w}`;
        }
      } else {
        frameStyle += ";width:100%";
      }
      if (mlMatch?.[1]) frameStyle += `;margin-left:${mlMatch[1].trim()}`;
      if (mrMatch?.[1]) frameStyle += `;margin-right:${mrMatch[1].trim()}`;
      let imgStyle = "";
      if (heightMatch?.[1] && !/^auto$/i.test(heightMatch[1].trim())) {
        frameStyle += `;height:${heightMatch[1].trim()}`;
        imgStyle = `height:100%;width:100%;object-fit:${(fitMatch?.[1] || "fill").trim()}`;
      } else {
        imgStyle = "height:auto;width:100%;object-fit:contain";
      }
      const safeSrc = escapeAttr(src);
      const safeAlt = escapeAttr(alt);
      return (
        `<span class="article-img-frame" style="${escapeAttr(frameStyle)}">` +
        `<img class="article-img-frame__img" src="${safeSrc}" alt="${safeAlt}" loading="lazy" style="${escapeAttr(imgStyle)}" />` +
        `</span>`
      );
    }
  );
}

/**
 * Gỡ style bảng dán từ Word/AI (nền xanh + chữ trắng) để CSS `.article-body` hiện đẹp.
 * Giữ nội dung; chỉ bỏ màu nền / màu chữ / width cố định trên table|th|td|tr.
 */
export function normalizeArticleTableStyles(html: string): string {
  return String(html || "").replace(
    /<(table|thead|tbody|tfoot|tr|th|td)\b([^>]*)>/gi,
    (_full, tag: string, attrs: string) => {
      let next = String(attrs || "");
      next = next.replace(/\sbgcolor\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "");
      next = next.replace(/\sstyle\s*=\s*("[^"]*"|'[^']*')/gi, (_m, quoted: string) => {
        const q = quoted[0];
        const raw = quoted.slice(1, -1);
        const cleaned = raw
          .replace(
            /(?:^|;)\s*(?:background(?:-color)?|color|width|min-width|max-width|height|border-color|border)\s*:[^;]*/gi,
            ""
          )
          .replace(/^;+|;+$/g, "")
          .replace(/;;+/g, ";")
          .trim();
        return cleaned ? ` style=${q}${cleaned}${q}` : "";
      });
      return `<${tag}${next}>`;
    }
  );
}

/** Plain text + Enter → <br>; HTML từ editor giữ nguyên; link + hashtag + khung ảnh. */
export function bodyHtmlForDisplay(raw: string): string {
  const s = String(raw || "");
  if (!s.trim()) return "";
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
  // Chèn khoảng trắng sau </strong>/</b> nếu Word dính chữ sát (giống khoảng cách app nội bộ)
  html = html.replace(/<\/(strong|b)>(?=[^\s<])/gi, "</$1> ");
  html = normalizeArticleTableStyles(html);
  return wrapArticleImages(hashtagifyHtml(linkifyHtml(html)));
}
