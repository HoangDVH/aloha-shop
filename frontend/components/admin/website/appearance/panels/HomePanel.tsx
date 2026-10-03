"use client";

import React from "react";
import {
  FileText,
  Image as ImageIcon,
  Layers,
  Plus,
  Sparkles,
  Trash2,
} from "lucide-react";
import type { AppearanceBlock, AppearanceLayout } from "../../api";
import type { CatNode } from "../../nav/ShopWebNavEditor";
import { ShopCategoryPicker } from "../ShopCategoryPicker";
import { BlockList, BLOCK_LABEL } from "../BlockList";
import { HeroSlidesForm, type HeroSlideDraft } from "../HeroSlidesForm";
import {
  WbBadge,
  WbBtn,
  WbField,
  WbSectionLabel,
  wbInput,
  wbSelect,
} from "../../ui";

export function HomePanel({
  draft,
  setDraft,
  selectedId,
  setSelectedId,
  primary,
  cats,
  addProductSection,
  addArticleSection,
  updateBlock,
  updateProps,
}: {
  draft: AppearanceLayout;
  setDraft: React.Dispatch<React.SetStateAction<AppearanceLayout | null>>;
  selectedId: string | null;
  setSelectedId: React.Dispatch<React.SetStateAction<string | null>>;
  primary: string;
  cats: CatNode[];
  addProductSection: () => void;
  addArticleSection: () => void;
  updateBlock: (id: string, patch: Partial<AppearanceBlock>) => void;
  updateProps: (id: string, patch: Record<string, unknown>) => void;
}) {
  return (
    <div className="space-y-4">
      <WbSectionLabel
        action={
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={addProductSection}
              className="inline-flex h-8 items-center gap-1 rounded-lg border border-solid border-[var(--aloha-green)]/40 bg-[var(--aloha-green-light)] px-2.5 text-[11px] font-bold text-[var(--aloha-green-mid)] shadow-sm hover:brightness-95"
              style={{ borderStyle: "solid" }}
            >
              <Plus className="h-3.5 w-3.5" /> Thêm mục SP
            </button>
            <button
              type="button"
              onClick={addArticleSection}
              className="inline-flex h-8 items-center gap-1 rounded-lg border border-solid border-[var(--aloha-green)]/40 bg-white px-2.5 text-[11px] font-bold text-[var(--aloha-green-mid)] shadow-sm hover:bg-[var(--aloha-green-light)]"
              style={{ borderStyle: "solid" }}
            >
              <FileText className="h-3.5 w-3.5" /> Thêm bài viết
            </button>
          </div>
        }
      >
        Khối trang chủ
      </WbSectionLabel>

      <BlockList
        blocks={draft.blocks}
        selectedId={selectedId}
        primary={primary}
        onSelect={(id) =>
          setSelectedId((cur) => (cur === id ? null : id))
        }
        onToggle={(id) => {
          const b = draft.blocks.find((x) => x.id === id);
          if (b) updateBlock(id, { enabled: !b.enabled });
        }}
        onReorder={(blocks) => setDraft({ ...draft, blocks })}
        renderEditor={(b) => {
          if (b.type === "hero" || b.type === "banner_carousel") {
            return (
              <div className="space-y-3 rounded-xl border border-gray-200 bg-white p-3.5">
                <div className="flex items-center justify-between gap-2">
                  <p className="flex items-center gap-2 text-[13px] font-semibold text-gray-900">
                    <ImageIcon className="h-4 w-4 text-gray-500" />
                    {BLOCK_LABEL[b.type] || b.type}
                  </p>
                  <WbBadge tone={b.enabled ? "success" : "neutral"}>
                    {b.enabled ? "Đang hiện" : "Đang ẩn"}
                  </WbBadge>
                </div>
                <HeroSlidesForm
                  slides={(b.props.slides as HeroSlideDraft[]) || []}
                  useDefaultBanners={b.props.useDefaultBanners !== false}
                  onChange={({ slides, useDefaultBanners }) =>
                    updateProps(b.id, { slides, useDefaultBanners })
                  }
                />
              </div>
            );
          }
          if (b.type === "product_section") {
            return (
              <div className="space-y-3 rounded-xl border border-gray-200 bg-white p-3.5">
                <div className="flex items-center justify-between gap-2">
                  <p className="flex items-center gap-2 text-[13px] font-semibold text-gray-900">
                    <Layers className="h-4 w-4 text-gray-500" />
                    {BLOCK_LABEL[b.type] || b.type}
                  </p>
                  <WbBadge tone={b.enabled ? "success" : "neutral"}>
                    {b.enabled ? "Đang hiện" : "Đang ẩn"}
                  </WbBadge>
                </div>
                <div className="space-y-3">
                  <WbField label="Tiêu đề">
                    <input
                      className={wbInput}
                      value={String(b.props.title || "")}
                      onChange={(e) =>
                        updateProps(b.id, { title: e.target.value })
                      }
                    />
                  </WbField>
                  <WbField
                    label="Nguồn sản phẩm"
                    hint="Lấy SP đã gắn NHÃN tương ứng ở tab Hàng hóa web"
                  >
                    <select
                      className={wbSelect}
                      value={
                        String(b.props.source || "ban_chay") === "nhom"
                          ? "category"
                          : String(b.props.source || "ban_chay")
                      }
                      onChange={(e) => {
                        const source = e.target.value;
                        const labelTitle =
                          source === "moi"
                            ? "Sản phẩm mới"
                            : source === "noi_bat"
                              ? "Sản phẩm nổi bật"
                              : source === "giam_gia"
                                ? "Sản phẩm giảm giá"
                                : source === "dat_truoc"
                                  ? "Sản phẩm đặt trước"
                                  : source === "uu_dai"
                                    ? "Sản phẩm ưu đãi"
                                  : source === "ban_chay_sap_het"
                                    ? "Sản phẩm bán chạy và sắp hết"
                                    : source === "ban_chay"
                                      ? "Sản phẩm bán chạy"
                                      : "";
                        updateProps(b.id, {
                          source,
                          ...(source === "moi"
                            ? { sort: "moi", limit: 50 }
                            : {}),
                          ...(source === "noi_bat"
                            ? { sort: "ten", limit: 6 }
                            : {}),
                          ...(labelTitle &&
                          (!b.props.title ||
                            [
                              "Mục sản phẩm mới",
                              "Sản phẩm bán chạy",
                              "Sản phẩm mới",
                              "Sản phẩm nổi bật",
                              "Sản phẩm giảm giá",
                              "Sản phẩm đặt trước",
                              "Sản phẩm ưu đãi",
                              "Sản phẩm bán chạy và sắp hết",
                            ].includes(String(b.props.title)))
                            ? { title: labelTitle }
                            : {}),
                        });
                      }}
                    >
                      <option value="ban_chay">Theo doanh thu: Bán chạy</option>
                      <option value="moi">Theo thời gian: Sản phẩm mới (top 50)</option>
                      <option value="noi_bat">Theo nhãn: Nổi bật (trang chủ)</option>
                      <option value="ban_chay_sap_het">
                        Theo nhãn: Bán chạy và sắp hết
                      </option>
                      <option value="giam_gia">Theo nhãn: Giảm giá</option>
                      <option value="dat_truoc">Theo nhãn: Đặt trước</option>
                      <option value="uu_dai">Theo nhãn: Ưu đãi</option>
                      <option value="category">Theo nhóm hàng (categoryId)</option>
                    </select>
                  </WbField>
                  {String(b.props.source) === "nhom" ||
                  String(b.props.source) === "category" ? (
                    <WbField
                      label="Nhóm hàng"
                      hint="Lưu categoryId — khớp DB shop mới"
                    >
                      <ShopCategoryPicker
                        cats={cats}
                        valueCategoryId={Number(b.props.categoryId) || 0}
                        valuePath={String(b.props.nhomPath || b.props.categoryName || "")}
                        onChange={(picked) =>
                          updateProps(b.id, {
                            source: "category",
                            categoryId: picked.categoryId || 0,
                            categoryName: picked.name,
                            categorySlug: picked.slug,
                            nhomPath: picked.path,
                            nhomName: picked.name,
                            nhomSlug: picked.slug,
                            title:
                              picked.name &&
                              (!b.props.title ||
                                String(b.props.title) === "Mục sản phẩm mới")
                                ? picked.name
                                : b.props.title,
                          })
                        }
                      />
                    </WbField>
                  ) : null}
                  <WbField label="Số sản phẩm">
                    <input
                      type="number"
                      min={4}
                      max={40}
                      className={wbInput}
                      value={Number(b.props.limit) || 15}
                      onChange={(e) =>
                        updateProps(b.id, {
                          limit: Math.max(
                            4,
                            Math.min(40, Number(e.target.value) || 15)
                          ),
                        })
                      }
                    />
                  </WbField>
                  <WbBtn
                    variant="danger"
                    className="!h-8 !px-2"
                    onClick={() => {
                      if (!confirm("Xóa mục này khỏi trang chủ?")) return;
                      setDraft((d) =>
                        d
                          ? {
                              ...d,
                              blocks: d.blocks.filter((x) => x.id !== b.id),
                            }
                          : d
                      );
                      setSelectedId(null);
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Xóa mục
                  </WbBtn>
                </div>
              </div>
            );
          }
          if (b.type === "article_section") {
            return (
              <div className="space-y-3 rounded-xl border border-gray-200 bg-white p-3.5">
                <div className="flex items-center justify-between gap-2">
                  <p className="flex items-center gap-2 text-[13px] font-semibold text-gray-900">
                    <FileText className="h-4 w-4 text-gray-500" />
                    {BLOCK_LABEL[b.type] || b.type}
                  </p>
                  <WbBadge tone={b.enabled ? "success" : "neutral"}>
                    {b.enabled ? "Đang hiện" : "Đang ẩn"}
                  </WbBadge>
                </div>
                <WbField label="Tiêu đề">
                  <input
                    className={wbInput}
                    value={String(b.props.title || "")}
                    onChange={(e) =>
                      updateProps(b.id, { title: e.target.value })
                    }
                  />
                </WbField>
                <WbField
                  label="Số bài (2–6)"
                  hint="Chỉ lấy bài đang Hiện và đã tới ngày xuất bản"
                >
                  <input
                    type="number"
                    min={2}
                    max={6}
                    className={wbInput}
                    value={Number(b.props.limit) || 3}
                    onChange={(e) =>
                      updateProps(b.id, {
                        limit: Math.max(
                          2,
                          Math.min(6, Number(e.target.value) || 3)
                        ),
                      })
                    }
                  />
                </WbField>
                <WbBtn
                  variant="danger"
                  className="!h-8 !px-2"
                  onClick={() => {
                    if (!confirm("Xóa khối bài viết khỏi trang chủ?")) return;
                    setDraft((d) =>
                      d
                        ? {
                            ...d,
                            blocks: d.blocks.filter((x) => x.id !== b.id),
                          }
                        : d
                    );
                    setSelectedId(null);
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" /> Xóa mục
                </WbBtn>
              </div>
            );
          }
          if (b.type === "feature_strip") {
            return (
              <div className="rounded-xl border border-gray-200 bg-white p-3.5">
                <p className="flex items-center gap-2 text-[13px] font-semibold text-gray-900">
                  <Sparkles className="h-4 w-4 text-gray-500" />
                  {BLOCK_LABEL[b.type]}
                </p>
                <p className="mt-2 text-[12px] text-gray-500">
                  Khối dịch vụ / Why Aloha — bật/tắt bằng công tắc trên danh sách.
                </p>
              </div>
            );
          }
          return null;
        }}
      />
    </div>
  );
}
