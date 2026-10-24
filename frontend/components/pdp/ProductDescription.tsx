"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Copy } from "lucide-react";

export function plainDescription(raw: string): string {
  return String(raw || "")
    .replace(/&lt;br\s*\/?&gt;/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<\/h[1-6]>/gi, "\n\n")
    .replace(/<hr\s*\/?>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export type DescriptionBlock =
  | { type: "heading"; text: string }
  | { type: "list"; items: string[] }
  | { type: "paragraph"; text: string }
  | { type: "divider" };

function cleanLine(l: string): string {
  return l.replace(/^[\s\uFEFF\xA0]+|[\s\uFEFF\xA0]+$/g, "");
}

function isAsciiDivider(line: string): boolean {
  const t = cleanLine(line);
  if (!t) return false;
  // Các vạch kẻ ASCII lặp lại: ===, ---, ___, ━━━, ***, ~~~
  return /^[=\-_━~*─–—]{3,}$/.test(t);
}

export function parseDescriptionBlocks(rawText: string): DescriptionBlock[] {
  const lines = rawText.split(/\r?\n/).map(cleanLine);
  const blocks: DescriptionBlock[] = [];
  let currentList: string[] | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;

    // 1. Vạch ngăn cách ASCII: Bỏ vạch rác, thay bằng divider mờ nếu cần
    if (isAsciiDivider(line)) {
      if (currentList && currentList.length > 0) {
        blocks.push({ type: "list", items: currentList });
        currentList = null;
      }
      if (blocks.length > 0 && blocks[blocks.length - 1].type !== "divider") {
        blocks.push({ type: "divider" });
      }
      continue;
    }

    // 2. Tiêu đề mục:
    // - Số La Mã: I. II. III. ...
    // - Số thứ tự: 1. 2. 3. ...
    // - Biểu tượng đầu mục: ◆, ❖
    const romanHeading = /^([IVXLCDM]+|[0-9]+)\.\s*(.+)$/i.exec(line);
    const symbolHeading = /^[◆❖]\s*(.+)$/.exec(line);

    if (romanHeading) {
      if (currentList && currentList.length > 0) {
        blocks.push({ type: "list", items: currentList });
        currentList = null;
      }
      const title = `${romanHeading[1]}. ${romanHeading[2].trim()}`;
      blocks.push({ type: "heading", text: title });
      continue;
    }

    if (symbolHeading) {
      if (currentList && currentList.length > 0) {
        blocks.push({ type: "list", items: currentList });
        currentList = null;
      }
      const title = symbolHeading[1].trim().replace(/[◆❖]/g, "").trim();
      blocks.push({ type: "heading", text: title });
      continue;
    }

    // 3. Danh sách gạch đầu dòng: ▫, •, ✔, -, *, +, ➔
    const listItem = /^[▫•✔\-\*\+➔]\s*(.+)$/.exec(line);
    if (listItem) {
      if (!currentList) currentList = [];
      currentList.push(listItem[1].trim());
      continue;
    }

    // 4. Đoạn văn thông thường
    if (currentList && currentList.length > 0) {
      blocks.push({ type: "list", items: currentList });
      currentList = null;
    }

    blocks.push({ type: "paragraph", text: line });
  }

  if (currentList && currentList.length > 0) {
    blocks.push({ type: "list", items: currentList });
  }

  return blocks;
}

/** Chiều cao preview xem trước mô tả (chuẩn Shopee / Tiki) */
const DESC_COLLAPSE_PX = 280;

export type ProductDetailInfo = {
  ma: string;
  categoryName?: string;
  dvt?: string;
  trongLuong?: number;
  attributes?: { attributeName: string; attributeValue: string }[];
};

export function ProductDescription({
  text,
  productInfo,
}: {
  text: string;
  productInfo?: ProductDetailInfo;
}) {
  const [expanded, setExpanded] = useState(false);
  const [needsToggle, setNeedsToggle] = useState(false);
  const [copied, setCopied] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);

  const blocks = useMemo(() => parseDescriptionBlocks(text || ""), [text]);

  const handleCopySku = () => {
    if (!productInfo?.ma) return;
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard) {
        navigator.clipboard
          .writeText(productInfo.ma)
          .then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          })
          .catch(() => {});
      }
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    setExpanded(false);
  }, [text]);

  useEffect(() => {
    const el = bodyRef.current;
    if (!el) return;
    const measure = () => {
      setNeedsToggle(el.scrollHeight > DESC_COLLAPSE_PX + 16);
    };
    measure();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    ro?.observe(el);
    return () => ro?.disconnect();
  }, [blocks]);

  if (!text && !productInfo) return null;

  return (
    <div
      id="product-description-container"
      className="rounded-none border-t-8 border-stone-100 bg-white p-4 sm:p-7 sm:rounded-2xl sm:border sm:border-stone-200/90 sm:shadow-[0_2px_12px_rgba(0,0,0,0.04)] space-y-7"
    >
      
      {/* 1. BẢNG CHI TIẾT SẢN PHẨM (CHUẨN SHOPEE / TIKI) */}
      {productInfo ? (
        <div className="space-y-3.5">
          <div className="flex items-center justify-between pb-2 border-b border-stone-100">
            <h2 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-slate-900">
              Chi tiết sản phẩm
            </h2>
            <span className="text-[11px] text-slate-400 font-medium hidden sm:inline">
              Thông số sản phẩm
            </span>
          </div>

          <div className="divide-y divide-stone-100/90 text-xs sm:text-sm">
            {/* Mã sản phẩm (SKU) */}
            <div className="flex items-start justify-between py-2.5 sm:py-3 sm:justify-start sm:gap-8">
              <span className="w-32 sm:w-44 shrink-0 text-slate-500 font-normal">
                Mã sản phẩm (SKU)
              </span>
              <div className="flex items-center gap-2">
                <span className="font-mono font-semibold text-slate-900 select-all">
                  {productInfo.ma}
                </span>
                <button
                  type="button"
                  onClick={handleCopySku}
                  className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-slate-500 hover:text-emerald-700 hover:bg-slate-100 transition cursor-pointer active:scale-95"
                  title="Sao chép mã sản phẩm"
                >
                  {copied ? (
                    <>
                      <Check size={13} className="text-emerald-600" />
                      <span className="text-[11px] font-semibold text-emerald-600">Đã chép</span>
                    </>
                  ) : (
                    <>
                      <Copy size={13} />
                      <span className="text-[11px] font-medium">Sao chép</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Danh mục */}
            {productInfo.categoryName ? (
              <div className="flex items-start justify-between py-2.5 sm:py-3 sm:justify-start sm:gap-8">
                <span className="w-32 sm:w-44 shrink-0 text-slate-500 font-normal">
                  Danh mục
                </span>
                <span className="font-medium text-slate-900 text-right sm:text-left">
                  {productInfo.categoryName}
                </span>
              </div>
            ) : null}

            {/* Đơn vị tính */}
            {productInfo.dvt ? (
              <div className="flex items-start justify-between py-2.5 sm:py-3 sm:justify-start sm:gap-8">
                <span className="w-32 sm:w-44 shrink-0 text-slate-500 font-normal">
                  Đơn vị tính
                </span>
                <span className="font-medium text-slate-900">{productInfo.dvt}</span>
              </div>
            ) : null}

            {/* Khối lượng */}
            {productInfo.trongLuong && productInfo.trongLuong > 0 ? (
              <div className="flex items-start justify-between py-2.5 sm:py-3 sm:justify-start sm:gap-8">
                <span className="w-32 sm:w-44 shrink-0 text-slate-500 font-normal">
                  Khối lượng
                </span>
                <span className="font-medium text-slate-900">{productInfo.trongLuong} g</span>
              </div>
            ) : null}

            {/* Các thuộc tính bổ sung nếu có */}
            {productInfo.attributes?.map((attr, idx) => (
              <div
                key={idx}
                className="flex items-start justify-between py-2.5 sm:py-3 sm:justify-start sm:gap-8"
              >
                <span className="w-32 sm:w-44 shrink-0 text-slate-500 font-normal">
                  {attr.attributeName}
                </span>
                <span className="font-medium text-slate-900 text-right sm:text-left">
                  {attr.attributeValue}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* 2. MÔ TẢ SẢN PHẨM (TINH GỌN, DỄ ĐỌC, LOẠI BỎ RÁC ASCII) */}
      {text ? (
        <div className="space-y-3.5">
          <div className="flex items-center justify-between pb-2 border-b border-stone-100">
            <h2 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-slate-900">
              Mô tả sản phẩm
            </h2>
          </div>

          <div className="relative">
            <div
              ref={bodyRef}
              className={`transition-[max-height] duration-300 ease-out space-y-3 text-xs sm:text-sm ${
                expanded || !needsToggle ? "max-h-none" : "max-h-[280px] overflow-hidden"
              }`}
            >
              {blocks.map((block, i) => {
                if (block.type === "heading") {
                  return (
                    <h3
                      key={i}
                      className="text-xs sm:text-sm font-bold uppercase tracking-wider text-slate-900 pt-3 first:pt-0"
                    >
                      {block.text}
                    </h3>
                  );
                }
                if (block.type === "list") {
                  return (
                    <ul
                      key={i}
                      className="list-disc pl-5 space-y-1.5 text-slate-700"
                    >
                      {block.items.map((item, idx) => (
                        <li key={idx} className="leading-relaxed">
                          {item}
                        </li>
                      ))}
                    </ul>
                  );
                }
                if (block.type === "divider") {
                  return <hr key={i} className="border-stone-100 my-2" />;
                }
                return (
                  <p key={i} className="text-slate-700 leading-relaxed">
                    {block.text}
                  </p>
                );
              })}
            </div>

            {/* Gradient che mờ chân trang */}
            {needsToggle && !expanded ? (
              <div
                aria-hidden
                className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-white via-white/85 to-transparent"
              />
            ) : null}
          </div>

          {/* Nút Xem thêm / Thu gọn chuẩn Shopee */}
          {needsToggle ? (
            <div className="pt-2 text-center">
              <button
                type="button"
                onClick={() => setExpanded((v) => !v)}
                className="inline-flex items-center justify-center gap-1.5 px-6 py-2.5 rounded-xl border border-stone-200 bg-stone-50 hover:bg-stone-100/80 text-xs sm:text-sm font-bold text-slate-700 transition cursor-pointer shadow-xs active:scale-98"
                aria-expanded={expanded}
              >
                <span>{expanded ? "Thu gọn nội dung" : "Xem thêm nội dung"}</span>
                <ChevronDown
                  size={15}
                  className={`transition-transform duration-200 ${
                    expanded ? "rotate-180" : ""
                  }`}
                  aria-hidden
                />
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

    </div>
  );
}
