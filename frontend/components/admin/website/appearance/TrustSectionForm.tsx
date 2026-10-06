"use client";

import React, { useState, useMemo } from "react";
import {
  Building2,
  Gift,
  Store,
  Users,
  ShoppingBag,
  SlidersHorizontal,
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  AlertTriangle,
  RotateCcw,
  ShieldCheck,
  ChevronRight,
} from "lucide-react";
import type { AppearanceBlock } from "../api";
import {
  type TrustItem,
  type TrustMarketplace,
  type TrustSectionProps,
  DEFAULT_TRUST_PROPS,
  parseTrustProps,
} from "@/lib/trustShowcase";
import { ImageUploadField } from "./ImageUploadField";
import { WbField, WbToggle, WbBadge, wbInput, wbSelect } from "../ui";

type TabId = "general" | "clients" | "services" | "store" | "customers" | "marketplaces";

export function TrustSectionForm({
  block,
  updateProps,
}: {
  block: AppearanceBlock;
  updateProps: (patch: Record<string, unknown>) => void;
}) {
  const [activeTab, setActiveTab] = useState<TabId>("general");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const data = useMemo(() => parseTrustProps(block.props), [block.props]);

  const clients = data.clients || [];
  const services = data.services || [];
  const gallery = data.gallery || [];
  const storeGallery = useMemo(() => gallery.filter((g) => g.kind !== "customer"), [gallery]);
  const customerGallery = useMemo(() => gallery.filter((g) => g.kind === "customer"), [gallery]);
  const marketplaces = data.marketplaces || [];

  // Khôi phục bộ ảnh & dữ liệu gốc
  const handleResetDefaults = () => {
    if (
      !confirm(
        "Khôi phục toàn bộ nội dung Độ tin cậy về dữ liệu chuẩn của Aloha (bao gồm ảnh đơn hàng, dịch vụ, cửa hàng và khách hàng thực tế)?"
      )
    ) {
      return;
    }
    updateProps({ ...DEFAULT_TRUST_PROPS });
  };

  // Helper cho danh sách Clients
  const updateClientAt = (idx: number, patch: Partial<TrustItem>) => {
    const next = clients.map((item, i) => (i === idx ? { ...item, ...patch } : item));
    updateProps({ clients: next });
  };
  const moveClient = (idx: number, direction: -1 | 1) => {
    const target = idx + direction;
    if (target < 0 || target >= clients.length) return;
    const next = [...clients];
    const [moved] = next.splice(idx, 1);
    next.splice(target, 0, moved);
    updateProps({ clients: next });
  };
  const removeClient = (idx: number) => {
    if (!confirm("Xóa đơn hàng này khỏi danh sách?")) return;
    const next = clients.filter((_, i) => i !== idx);
    updateProps({ clients: next });
  };
  const addClient = () => {
    if (clients.length >= 12) return;
    const newItem: TrustItem = {
      id: `client-${Date.now()}`,
      enabled: true,
      imageUrl: "",
      title: "",
      caption: "",
    };
    updateProps({ clients: [...clients, newItem] });
    setExpandedId(newItem.id);
  };

  // Helper cho danh sách Services
  const updateServiceAt = (idx: number, patch: Partial<TrustItem>) => {
    const next = services.map((item, i) => (i === idx ? { ...item, ...patch } : item));
    updateProps({ services: next });
  };
  const moveService = (idx: number, direction: -1 | 1) => {
    const target = idx + direction;
    if (target < 0 || target >= services.length) return;
    const next = [...services];
    const [moved] = next.splice(idx, 1);
    next.splice(target, 0, moved);
    updateProps({ services: next });
  };
  const removeService = (idx: number) => {
    if (!confirm("Xóa dịch vụ này khỏi danh sách?")) return;
    const next = services.filter((_, i) => i !== idx);
    updateProps({ services: next });
  };
  const addService = () => {
    if (services.length >= 6) return;
    const newItem: TrustItem = {
      id: `srv-${Date.now()}`,
      enabled: true,
      imageUrl: "",
      title: "",
      caption: "",
    };
    updateProps({ services: [...services, newItem] });
    setExpandedId(newItem.id);
  };

  // Helper cho danh sách Gallery (Cửa hàng & Khách hàng)
  const updateGalleryItem = (id: string, patch: Partial<TrustItem>) => {
    const next = gallery.map((item) => (item.id === id ? { ...item, ...patch } : item));
    updateProps({ gallery: next });
  };
  const moveGalleryItem = (id: string, direction: -1 | 1) => {
    const idx = gallery.findIndex((item) => item.id === id);
    if (idx < 0) return;
    const target = idx + direction;
    if (target < 0 || target >= gallery.length) return;
    const next = [...gallery];
    const [moved] = next.splice(idx, 1);
    next.splice(target, 0, moved);
    updateProps({ gallery: next });
  };
  const removeGalleryItem = (id: string) => {
    if (!confirm("Xóa ảnh này khỏi danh sách?")) return;
    const next = gallery.filter((item) => item.id !== id);
    updateProps({ gallery: next });
  };
  const addStoreImage = () => {
    if (gallery.length >= 16) return;
    const newItem: TrustItem = {
      id: `store-${Date.now()}`,
      enabled: true,
      imageUrl: "",
      title: "",
      caption: "",
      kind: "store",
    };
    updateProps({ gallery: [...gallery, newItem] });
    setExpandedId(newItem.id);
  };
  const addCustomerImage = () => {
    if (gallery.length >= 16) return;
    const newItem: TrustItem = {
      id: `cust-${Date.now()}`,
      enabled: true,
      imageUrl: "",
      title: "",
      caption: "",
      kind: "customer",
    };
    updateProps({ gallery: [...gallery, newItem] });
    setExpandedId(newItem.id);
  };

  // Helper cho danh sách Marketplaces
  const updateMarketplaceAt = (idx: number, patch: Partial<TrustMarketplace>) => {
    const next = marketplaces.map((item, i) => (i === idx ? { ...item, ...patch } : item));
    updateProps({ marketplaces: next });
  };
  const moveMarketplace = (idx: number, direction: -1 | 1) => {
    const target = idx + direction;
    if (target < 0 || target >= marketplaces.length) return;
    const next = [...marketplaces];
    const [moved] = next.splice(idx, 1);
    next.splice(target, 0, moved);
    updateProps({ marketplaces: next });
  };
  const removeMarketplace = (idx: number) => {
    if (!confirm("Xóa liên kết sàn này?")) return;
    const next = marketplaces.filter((_, i) => i !== idx);
    updateProps({ marketplaces: next });
  };
  const addMarketplace = () => {
    if (marketplaces.length >= 6) return;
    const newItem: TrustMarketplace = {
      id: `mp-${Date.now()}`,
      enabled: true,
      platform: "shopee",
      label: "",
      url: "https://",
      note: "",
    };
    updateProps({ marketplaces: [...marketplaces, newItem] });
    setExpandedId(newItem.id);
  };

  const tabs: { id: TabId; label: string; count?: number; icon: React.ElementType }[] = [
    { id: "general", label: "Cài đặt chung", icon: SlidersHorizontal },
    { id: "clients", label: "Đơn hàng", count: clients.length, icon: Building2 },
    { id: "services", label: "Dịch vụ", count: services.length, icon: Gift },
    { id: "store", label: "Cửa hàng", count: storeGallery.length, icon: Store },
    { id: "customers", label: "Khách thật (Mục 4)", count: customerGallery.length, icon: Users },
    { id: "marketplaces", label: "Sàn TMĐT", count: marketplaces.length, icon: ShoppingBag },
  ];

  return (
    <div className="space-y-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      {/* HEADER */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 pb-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
            <ShieldCheck className="h-4 w-4" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-gray-900">
              Độ tin cậy & Bằng chứng thực tế
            </h4>
            <p className="text-[11px] text-gray-500">
              Quản lý đơn doanh nghiệp, dịch vụ quà tặng, cửa hàng và khách hàng thực tế
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <WbBadge tone={block.enabled ? "success" : "neutral"}>
            {block.enabled ? "Đang hiện trên web" : "Đang ẩn"}
          </WbBadge>
          <button
            type="button"
            onClick={handleResetDefaults}
            className="inline-flex h-7 items-center gap-1 rounded-md border border-gray-200 bg-gray-50 px-2 text-[11px] font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900"
            title="Khôi phục toàn bộ ảnh mẫu và văn bản tiêu chuẩn của Aloha"
          >
            <RotateCcw className="h-3 w-3" /> Khôi phục mẫu
          </button>
        </div>
      </div>

      {/* PRIVACY ADVISORY CALLOUT */}
      <div className="flex items-start gap-2.5 rounded-lg border border-amber-200/80 bg-amber-50/60 p-2.5 text-[11px] leading-relaxed text-amber-900">
        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
        <div>
          <strong className="font-semibold">Lưu ý bản quyền & bảo mật:</strong> Chỉ đăng
          tên và logo đối tác đã đồng ý. Ảnh học sinh, trẻ em cần có sự chấp thuận từ phụ
          huynh trước khi hiển thị công khai.
        </div>
      </div>

      {/* TABS NAVIGATION */}
      <div className="flex flex-wrap gap-1 rounded-lg bg-gray-100 p-1">
        {tabs.map((t) => {
          const Icon = t.icon;
          const active = activeTab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveTab(t.id)}
              className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold transition ${
                active
                  ? "bg-white text-emerald-800 shadow-xs"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              <Icon className={`h-3.5 w-3.5 ${active ? "text-emerald-600" : ""}`} />
              <span className="truncate">{t.label}</span>
              {typeof t.count === "number" ? (
                <span
                  className={`ml-0.5 rounded-full px-1.5 py-0.2 text-[10px] ${
                    active
                      ? "bg-emerald-100 text-emerald-800"
                      : "bg-gray-200 text-gray-600"
                  }`}
                >
                  {t.count}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {/* TAB: GENERAL SETTINGS */}
      {activeTab === "general" && (
        <div className="space-y-3 pt-1">
          <WbField label="Tiêu đề chính của khối">
            <input
              className={wbInput}
              value={data.title}
              placeholder="VD: Khách hàng tin chọn Aloha"
              onChange={(e) => updateProps({ title: e.target.value })}
            />
          </WbField>

          <WbField
            label="Phụ đề giới thiệu"
            hint="Hiển thị ngay dưới tiêu đề chính trên trang chủ"
          >
            <textarea
              rows={2}
              className="w-full rounded-lg border border-gray-200 bg-white p-2.5 text-sm text-gray-900 outline-none transition focus:border-[#0F9D58]/50 focus:ring-2 focus:ring-[#0F9D58]/15"
              value={data.subtitle}
              placeholder="VD: Bằng chứng thật từ các đơn hàng quà tặng doanh nghiệp..."
              onChange={(e) => updateProps({ subtitle: e.target.value })}
            />
          </WbField>

          <WbField label="Tiêu đề nhóm Đơn hàng doanh nghiệp">
            <input
              className={wbInput}
              value={data.clientsTitle}
              placeholder="VD: Đơn hàng đã thực hiện"
              onChange={(e) => updateProps({ clientsTitle: e.target.value })}
            />
          </WbField>

          <div className="rounded-lg border border-gray-200 bg-gray-50/50 p-3 space-y-3">
            <h5 className="text-xs font-bold text-gray-800 flex items-center gap-1.5">
              <span>Nút kêu gọi hành động (CTA) Zalo</span>
            </h5>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <WbField label="Nhãn nút">
                <input
                  className={wbInput}
                  value={data.cta?.label || ""}
                  placeholder="VD: Nhận báo giá quà tặng doanh nghiệp qua Zalo"
                  onChange={(e) =>
                    updateProps({
                      cta: {
                        label: e.target.value,
                        href: data.cta?.href || "https://zalo.me/0794901233",
                      },
                    })
                  }
                />
              </WbField>
              <WbField label="Đường dẫn nút (Zalo / Hotline / Trang liên hệ)">
                <input
                  className={wbInput}
                  value={data.cta?.href || ""}
                  placeholder="https://zalo.me/0794901233"
                  onChange={(e) =>
                    updateProps({
                      cta: {
                        label:
                          data.cta?.label ||
                          "Nhận báo giá quà tặng doanh nghiệp qua Zalo",
                        href: e.target.value,
                      },
                    })
                  }
                />
              </WbField>
            </div>
          </div>
        </div>
      )}

      {/* TAB: CLIENTS */}
      {activeTab === "clients" && (
        <div className="space-y-3 pt-1">
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-500">
              Đơn hàng doanh nghiệp / tổ chức ({clients.length}/12)
            </p>
            <button
              type="button"
              disabled={clients.length >= 12}
              onClick={addClient}
              className="inline-flex h-7 items-center gap-1 rounded-md border border-emerald-600/40 bg-emerald-50 px-2.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-40"
            >
              <Plus className="h-3.5 w-3.5" /> Thêm đơn hàng
            </button>
          </div>

          {clients.length === 0 ? (
            <div className="rounded-lg border border-dashed border-gray-300 p-6 text-center text-xs text-gray-400">
              Chưa có đơn hàng nào. Bấm &quot;Thêm đơn hàng&quot; hoặc &quot;Khôi phục
              mẫu&quot; để nạp danh sách.
            </div>
          ) : (
            <div className="space-y-2">
              {clients.map((item, idx) => {
                const isExpanded = expandedId === item.id;
                return (
                  <div
                    key={item.id}
                    className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-2xs"
                  >
                    <div className="flex items-center gap-2 bg-gray-50/80 px-3 py-2">
                      {item.imageUrl ? (
                        <img
                          src={item.imageUrl}
                          alt=""
                          className="h-8 w-8 rounded-md object-cover border border-gray-200"
                        />
                      ) : (
                        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-gray-200 text-gray-400 text-[10px]">
                          Trống
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={() => setExpandedId(isExpanded ? null : item.id)}
                        className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
                      >
                        <span className="truncate text-xs font-semibold text-gray-800">
                          {item.title || "(Chưa đặt tên đơn vị)"}
                        </span>
                        <ChevronRight
                          className={`h-3.5 w-3.5 shrink-0 text-gray-400 transition-transform ${
                            isExpanded ? "rotate-90" : ""
                          }`}
                        />
                      </button>

                      <div className="flex items-center gap-1">
                        <WbToggle
                          on={item.enabled}
                          onChange={() =>
                            updateClientAt(idx, { enabled: !item.enabled })
                          }
                          title={item.enabled ? "Ẩn mục" : "Hiện mục"}
                        />
                        <button
                          type="button"
                          disabled={idx === 0}
                          onClick={() => moveClient(idx, -1)}
                          className="p-1 text-gray-400 hover:text-gray-700 disabled:opacity-20"
                          title="Lên trên"
                        >
                          <ChevronUp className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={idx === clients.length - 1}
                          onClick={() => moveClient(idx, 1)}
                          className="p-1 text-gray-400 hover:text-gray-700 disabled:opacity-20"
                          title="Xuống dưới"
                        >
                          <ChevronDown className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => removeClient(idx)}
                          className="p-1 text-red-500 hover:text-red-700"
                          title="Xóa"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="border-t border-gray-100 p-3 space-y-3 bg-white">
                        <WbField
                          label="Tên đơn vị / Khách hàng"
                          hint="VD: BIDV Chi nhánh Đông Sài Gòn, Tập đoàn Phan Vũ..."
                        >
                          <input
                            className={wbInput}
                            value={item.title}
                            placeholder="Nhập tên đối tác..."
                            onChange={(e) =>
                              updateClientAt(idx, { title: e.target.value })
                            }
                          />
                        </WbField>

                        <WbField
                          label="Mô tả / Thông điệp đơn hàng"
                          hint="VD: Chậu cây thiết kế tem riêng mang thông điệp «Luôn bên bạn»"
                        >
                          <input
                            className={wbInput}
                            value={item.caption || ""}
                            placeholder="Nhập mô tả..."
                            onChange={(e) =>
                              updateClientAt(idx, { caption: e.target.value })
                            }
                          />
                        </WbField>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                          <WbField
                            label="Hình ảnh đơn hàng"
                            hint="Tự động nén WebP, khuyến nghị kích thước 800x600"
                          >
                            <ImageUploadField
                              kind="banner"
                              value={item.imageUrl}
                              onChange={(url) => updateClientAt(idx, { imageUrl: url })}
                            />
                          </WbField>

                          <WbField
                            label="Logo đơn vị (tùy chọn)"
                            hint="Chỉ tải khi đã có sự đồng ý từ đơn vị"
                          >
                            <ImageUploadField
                              kind="logo"
                              value={item.logoUrl}
                              onChange={(url) => updateClientAt(idx, { logoUrl: url })}
                            />
                          </WbField>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB: SERVICES */}
      {activeTab === "services" && (
        <div className="space-y-3 pt-1">
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-500">
              Dịch vụ in ấn & quà tặng trọn gói ({services.length}/6)
            </p>
            <button
              type="button"
              disabled={services.length >= 6}
              onClick={addService}
              className="inline-flex h-7 items-center gap-1 rounded-md border border-emerald-600/40 bg-emerald-50 px-2.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-40"
            >
              <Plus className="h-3.5 w-3.5" /> Thêm dịch vụ
            </button>
          </div>

          {services.length === 0 ? (
            <div className="rounded-lg border border-dashed border-gray-300 p-6 text-center text-xs text-gray-400">
              Chưa có dịch vụ nào. Bấm &quot;Thêm dịch vụ&quot; hoặc &quot;Khôi phục
              mẫu&quot;.
            </div>
          ) : (
            <div className="space-y-2">
              {services.map((item, idx) => {
                const isExpanded = expandedId === item.id;
                return (
                  <div
                    key={item.id}
                    className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-2xs"
                  >
                    <div className="flex items-center gap-2 bg-gray-50/80 px-3 py-2">
                      {item.imageUrl ? (
                        <img
                          src={item.imageUrl}
                          alt=""
                          className="h-8 w-8 rounded-md object-cover border border-gray-200"
                        />
                      ) : (
                        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-gray-200 text-gray-400 text-[10px]">
                          Trống
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={() => setExpandedId(isExpanded ? null : item.id)}
                        className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
                      >
                        <span className="truncate text-xs font-semibold text-gray-800">
                          {item.title || "(Chưa đặt tên dịch vụ)"}
                        </span>
                        <ChevronRight
                          className={`h-3.5 w-3.5 shrink-0 text-gray-400 transition-transform ${
                            isExpanded ? "rotate-90" : ""
                          }`}
                        />
                      </button>

                      <div className="flex items-center gap-1">
                        <WbToggle
                          on={item.enabled}
                          onChange={() =>
                            updateServiceAt(idx, { enabled: !item.enabled })
                          }
                          title={item.enabled ? "Ẩn dịch vụ" : "Hiện dịch vụ"}
                        />
                        <button
                          type="button"
                          disabled={idx === 0}
                          onClick={() => moveService(idx, -1)}
                          className="p-1 text-gray-400 hover:text-gray-700 disabled:opacity-20"
                          title="Lên trên"
                        >
                          <ChevronUp className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={idx === services.length - 1}
                          onClick={() => moveService(idx, 1)}
                          className="p-1 text-gray-400 hover:text-gray-700 disabled:opacity-20"
                          title="Xuống dưới"
                        >
                          <ChevronDown className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => removeService(idx)}
                          className="p-1 text-red-500 hover:text-red-700"
                          title="Xóa"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="border-t border-gray-100 p-3 space-y-3 bg-white">
                        <WbField
                          label="Tên dịch vụ"
                          hint="VD: In logo chậu & túi quà theo yêu cầu"
                        >
                          <input
                            className={wbInput}
                            value={item.title}
                            placeholder="Nhập tên dịch vụ..."
                            onChange={(e) =>
                              updateServiceAt(idx, { title: e.target.value })
                            }
                          />
                        </WbField>

                        <WbField
                          label="Mô tả chi tiết"
                          hint="VD: Thiết kế market mẫu miễn phí, in sắc nét theo nhận diện thương hiệu"
                        >
                          <textarea
                            rows={2}
                            className="w-full rounded-lg border border-gray-200 bg-white p-2.5 text-sm text-gray-900 outline-none transition focus:border-[#0F9D58]/50 focus:ring-2 focus:ring-[#0F9D58]/15"
                            value={item.caption || ""}
                            placeholder="Mô tả lợi thế dịch vụ..."
                            onChange={(e) =>
                              updateServiceAt(idx, { caption: e.target.value })
                            }
                          />
                        </WbField>

                        <WbField label="Hình ảnh thực tế dịch vụ">
                          <ImageUploadField
                            kind="banner"
                            value={item.imageUrl}
                            onChange={(url) => updateServiceAt(idx, { imageUrl: url })}
                          />
                        </WbField>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB: CỬA HÀNG THỰC TẾ (STORE) */}
      {activeTab === "store" && (
        <div className="space-y-3 pt-1">
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-500">
              Không gian cửa hàng & vườn ươm ({storeGallery.length})
            </p>
            <button
              type="button"
              disabled={gallery.length >= 16}
              onClick={addStoreImage}
              className="inline-flex h-7 items-center gap-1 rounded-md border border-emerald-600/40 bg-emerald-50 px-2.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-40"
            >
              <Plus className="h-3.5 w-3.5" /> Thêm ảnh cửa hàng
            </button>
          </div>

          {storeGallery.length === 0 ? (
            <div className="rounded-lg border border-dashed border-gray-300 p-6 text-center text-xs text-gray-400">
              Chưa có ảnh cửa hàng nào. Bấm &quot;Thêm ảnh cửa hàng&quot; hoặc &quot;Khôi phục
              mẫu&quot;.
            </div>
          ) : (
            <div className="space-y-2">
              {storeGallery.map((item, idx) => {
                const isExpanded = expandedId === item.id;
                return (
                  <div
                    key={item.id}
                    className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-2xs"
                  >
                    <div className="flex items-center gap-2 bg-gray-50/80 px-3 py-2">
                      {item.imageUrl ? (
                        <img
                          src={item.imageUrl}
                          alt=""
                          className="h-8 w-8 rounded-md object-cover border border-gray-200"
                        />
                      ) : (
                        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-gray-200 text-gray-400 text-[10px]">
                          Trống
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={() => setExpandedId(isExpanded ? null : item.id)}
                        className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
                      >
                        <span className="truncate text-xs font-semibold text-gray-800">
                          {item.title || "(Chưa đặt tiêu đề ảnh)"}
                        </span>
                        <ChevronRight
                          className={`h-3.5 w-3.5 shrink-0 text-gray-400 transition-transform ${
                            isExpanded ? "rotate-90" : ""
                          }`}
                        />
                      </button>

                      <div className="flex items-center gap-1">
                        <WbToggle
                          on={item.enabled}
                          onChange={() =>
                            updateGalleryItem(item.id, { enabled: !item.enabled })
                          }
                          title={item.enabled ? "Ẩn ảnh" : "Hiện ảnh"}
                        />
                        <button
                          type="button"
                          disabled={idx === 0}
                          onClick={() => moveGalleryItem(item.id, -1)}
                          className="p-1 text-gray-400 hover:text-gray-700 disabled:opacity-20"
                          title="Lên trên"
                        >
                          <ChevronUp className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={idx === storeGallery.length - 1}
                          onClick={() => moveGalleryItem(item.id, 1)}
                          className="p-1 text-gray-400 hover:text-gray-700 disabled:opacity-20"
                          title="Xuống dưới"
                        >
                          <ChevronDown className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => removeGalleryItem(item.id)}
                          className="p-1 text-red-500 hover:text-red-700"
                          title="Xóa"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="border-t border-gray-100 p-3 space-y-3 bg-white">
                        <WbField label="Tiêu đề ảnh">
                          <input
                            className={wbInput}
                            value={item.title}
                            placeholder="VD: Kệ trưng bày sen đá & cây mini"
                            onChange={(e) =>
                              updateGalleryItem(item.id, { title: e.target.value })
                            }
                          />
                        </WbField>

                        <WbField label="Chú thích ngắn">
                          <input
                            className={wbInput}
                            value={item.caption || ""}
                            placeholder="VD: Cây thuần khoẻ, gắn nhãn thông tin rõ ràng"
                            onChange={(e) =>
                              updateGalleryItem(item.id, { caption: e.target.value })
                            }
                          />
                        </WbField>

                        <WbField label="Tải ảnh">
                          <ImageUploadField
                            kind="banner"
                            value={item.imageUrl}
                            onChange={(url) =>
                              updateGalleryItem(item.id, { imageUrl: url })
                            }
                          />
                        </WbField>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB: KHÁCH HÀNG THỰC TẾ (MỤC SỐ 4) */}
      {activeTab === "customers" && (
        <div className="space-y-3 pt-1">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-gray-800">
                Mục số 4: Khách hàng thực tế ({customerGallery.length})
              </p>
              <p className="text-[11px] text-gray-500">
                Ảnh học sinh trải nghiệm tại shop & ảnh camera quầy thu ngân thực tế
              </p>
            </div>
            <button
              type="button"
              disabled={gallery.length >= 16}
              onClick={addCustomerImage}
              className="inline-flex h-7 items-center gap-1 rounded-md border border-emerald-600/40 bg-emerald-50 px-2.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-40"
            >
              <Plus className="h-3.5 w-3.5" /> Thêm ảnh khách
            </button>
          </div>

          {customerGallery.length === 0 ? (
            <div className="rounded-lg border border-dashed border-gray-300 p-6 text-center text-xs text-gray-400">
              Chưa có ảnh khách hàng thực tế nào. Bấm &quot;Thêm ảnh khách&quot; hoặc &quot;Khôi phục
              mẫu&quot;.
            </div>
          ) : (
            <div className="space-y-2">
              {customerGallery.map((item, idx) => {
                const isExpanded = expandedId === item.id;
                return (
                  <div
                    key={item.id}
                    className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-2xs"
                  >
                    <div className="flex items-center gap-2 bg-gray-50/80 px-3 py-2">
                      {item.imageUrl ? (
                        <img
                          src={item.imageUrl}
                          alt=""
                          className="h-8 w-8 rounded-md object-cover border border-gray-200"
                        />
                      ) : (
                        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-gray-200 text-gray-400 text-[10px]">
                          Trống
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={() => setExpandedId(isExpanded ? null : item.id)}
                        className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
                      >
                        <span className="truncate text-xs font-semibold text-gray-800">
                          {item.title || "(Chưa đặt tiêu đề ảnh)"}
                        </span>
                        <span className="rounded bg-emerald-50 px-1 py-0.2 text-[10px] text-emerald-700 font-medium">
                          {item.id.includes("cam") ? "Camera quầy" : "Khách tại shop"}
                        </span>
                        <ChevronRight
                          className={`h-3.5 w-3.5 shrink-0 text-gray-400 transition-transform ${
                            isExpanded ? "rotate-90" : ""
                          }`}
                        />
                      </button>

                      <div className="flex items-center gap-1">
                        <WbToggle
                          on={item.enabled}
                          onChange={() =>
                            updateGalleryItem(item.id, { enabled: !item.enabled })
                          }
                          title={item.enabled ? "Ẩn ảnh" : "Hiện ảnh"}
                        />
                        <button
                          type="button"
                          disabled={idx === 0}
                          onClick={() => moveGalleryItem(item.id, -1)}
                          className="p-1 text-gray-400 hover:text-gray-700 disabled:opacity-20"
                          title="Lên trên"
                        >
                          <ChevronUp className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={idx === customerGallery.length - 1}
                          onClick={() => moveGalleryItem(item.id, 1)}
                          className="p-1 text-gray-400 hover:text-gray-700 disabled:opacity-20"
                          title="Xuống dưới"
                        >
                          <ChevronDown className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => removeGalleryItem(item.id)}
                          className="p-1 text-red-500 hover:text-red-700"
                          title="Xóa"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="border-t border-gray-100 p-3 space-y-3 bg-white">
                        <WbField label="Tiêu đề ảnh">
                          <input
                            className={wbInput}
                            value={item.title}
                            placeholder="VD: Hai bạn học sinh ghé chọn cây"
                            onChange={(e) =>
                              updateGalleryItem(item.id, { title: e.target.value })
                            }
                          />
                        </WbField>

                        <WbField label="Chú thích ngắn">
                          <input
                            className={wbInput}
                            value={item.caption || ""}
                            placeholder="VD: Trải nghiệm chọn sen đá và cây cảnh mini tại shop"
                            onChange={(e) =>
                              updateGalleryItem(item.id, { caption: e.target.value })
                            }
                          />
                        </WbField>

                        <WbField label="Tải ảnh thực tế">
                          <ImageUploadField
                            kind="banner"
                            value={item.imageUrl}
                            onChange={(url) =>
                              updateGalleryItem(item.id, { imageUrl: url })
                            }
                          />
                        </WbField>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB: MARKETPLACES */}
      {activeTab === "marketplaces" && (
        <div className="space-y-3 pt-1">
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-500">
              Gian hàng trên sàn thương mại điện tử ({marketplaces.length}/6)
            </p>
            <button
              type="button"
              disabled={marketplaces.length >= 6}
              onClick={addMarketplace}
              className="inline-flex h-7 items-center gap-1 rounded-md border border-emerald-600/40 bg-emerald-50 px-2.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-40"
            >
              <Plus className="h-3.5 w-3.5" /> Thêm gian hàng
            </button>
          </div>

          {marketplaces.length === 0 ? (
            <div className="rounded-lg border border-dashed border-gray-300 p-6 text-center text-xs text-gray-400">
              Chưa có sàn TMĐT nào. Bấm &quot;Thêm gian hàng&quot; hoặc &quot;Khôi phục
              mẫu&quot;.
            </div>
          ) : (
            <div className="space-y-2">
              {marketplaces.map((item, idx) => {
                const isExpanded = expandedId === item.id;
                return (
                  <div
                    key={item.id}
                    className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-2xs"
                  >
                    <div className="flex items-center gap-2 bg-gray-50/80 px-3 py-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-md bg-emerald-50 text-emerald-700">
                        <ShoppingBag className="h-4 w-4" />
                      </div>

                      <button
                        type="button"
                        onClick={() => setExpandedId(isExpanded ? null : item.id)}
                        className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
                      >
                        <span className="truncate text-xs font-semibold text-gray-800">
                          {item.label || "(Chưa đặt tên gian hàng)"}
                        </span>
                        <span className="rounded bg-gray-200 px-1 py-0.2 text-[10px] uppercase text-gray-600">
                          {item.platform}
                        </span>
                        <ChevronRight
                          className={`h-3.5 w-3.5 shrink-0 text-gray-400 transition-transform ${
                            isExpanded ? "rotate-90" : ""
                          }`}
                        />
                      </button>

                      <div className="flex items-center gap-1">
                        <WbToggle
                          on={item.enabled}
                          onChange={() =>
                            updateMarketplaceAt(idx, { enabled: !item.enabled })
                          }
                          title={item.enabled ? "Ẩn sàn" : "Hiện sàn"}
                        />
                        <button
                          type="button"
                          disabled={idx === 0}
                          onClick={() => moveMarketplace(idx, -1)}
                          className="p-1 text-gray-400 hover:text-gray-700 disabled:opacity-20"
                          title="Lên trên"
                        >
                          <ChevronUp className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={idx === marketplaces.length - 1}
                          onClick={() => moveMarketplace(idx, 1)}
                          className="p-1 text-gray-400 hover:text-gray-700 disabled:opacity-20"
                          title="Xuống dưới"
                        >
                          <ChevronDown className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => removeMarketplace(idx)}
                          className="p-1 text-red-500 hover:text-red-700"
                          title="Xóa"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="border-t border-gray-100 p-3 space-y-3 bg-white">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <WbField label="Nền tảng sàn">
                            <select
                              className={wbSelect}
                              value={item.platform}
                              onChange={(e) =>
                                updateMarketplaceAt(idx, {
                                  platform: e.target.value as
                                    | "shopee"
                                    | "lazada"
                                    | "tiktok"
                                    | "khac",
                                })
                              }
                            >
                              <option value="shopee">Shopee</option>
                              <option value="lazada">Lazada</option>
                              <option value="tiktok">TikTok Shop</option>
                              <option value="khac">Khác</option>
                            </select>
                          </WbField>
                          <WbField label="Tên hiển thị gian hàng">
                            <input
                              className={wbInput}
                              value={item.label}
                              placeholder="VD: Gian hàng chính hãng Shopee"
                              onChange={(e) =>
                                updateMarketplaceAt(idx, { label: e.target.value })
                              }
                            />
                          </WbField>
                        </div>

                        <WbField
                          label="Đường dẫn gian hàng (Bắt buộc https://)"
                          hint="Khách bấm sẽ mở trực tiếp trang gian hàng trong tab mới"
                        >
                          <input
                            className={wbInput}
                            value={item.url}
                            placeholder="https://shopee.vn/..."
                            onChange={(e) =>
                              updateMarketplaceAt(idx, { url: e.target.value })
                            }
                          />
                        </WbField>

                        <WbField
                          label="Ghi chú uy tín / Số liệu thật (tùy chọn)"
                          hint="VD: Đánh giá 4.9★ · 1.2k đã bán"
                        >
                          <input
                            className={wbInput}
                            value={item.note || ""}
                            placeholder="VD: Đánh giá 4.9★ · 1.2k đã bán"
                            onChange={(e) =>
                              updateMarketplaceAt(idx, { note: e.target.value })
                            }
                          />
                        </WbField>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
