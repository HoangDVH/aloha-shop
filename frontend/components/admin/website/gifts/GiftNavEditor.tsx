"use client";

import { useEffect, useState } from "react";
import {
  Button,
  Card,
  Input,
  Select,
  Switch,
  message,
  Spin,
} from "antd";
import {
  ArrowRight,
  BriefcaseBusiness,
  Cake,
  Flower2,
  Gift,
  Heart,
  House,
  RefreshCw,
  Save,
  Smile,
  Sparkles,
  Sprout,
  Star,
  Sun,
  Trophy,
  type LucideIcon,
} from "lucide-react";
import { DEFAULT_GIFT_NAV_CONFIG, type GiftNavCategoryItem, type GiftNavConfig } from "@/lib/giftFilters";
import { useQueryClient } from "@tanstack/react-query";
import { PUBLIC_CONTENT_KEY } from "@/lib/publicContentQueries";

const AVAILABLE_ICONS: { value: string; label: string; icon: LucideIcon }[] = [
  { value: "Heart", label: "Trái tim (Người thương)", icon: Heart },
  { value: "House", label: "Ngôi nhà (Gia đình & Mẹ)", icon: House },
  { value: "Trophy", label: "Cúp vàng (Khai trương & Thăng chức)", icon: Trophy },
  { value: "Sprout", label: "Mầm cây (Bàn làm việc & Đồng nghiệp)", icon: Sprout },
  { value: "Sparkles", label: "Ngôi sao lấp lánh (Tâm điểm)", icon: Sparkles },
  { value: "Gift", label: "Hộp quà tặng", icon: Gift },
  { value: "Star", label: "Ngôi sao yêu thích", icon: Star },
  { value: "Flower2", label: "Bông hoa tươi thắm", icon: Flower2 },
  { value: "Sun", label: "Ánh mặt trời năng lượng", icon: Sun },
  { value: "Cake", label: "Bánh kem (Sinh nhật)", icon: Cake },
  { value: "Smile", label: "Mặt cười hạnh phúc", icon: Smile },
  { value: "BriefcaseBusiness", label: "Cặp doanh nghiệp (B2B)", icon: BriefcaseBusiness },
];

const COLOR_OPTIONS: { value: string; label: string; previewClass: string }[] = [
  { value: "bg-rose-50 text-rose-600", label: "Hồng dịu dàng (Rose)", previewClass: "bg-rose-50 text-rose-600 border-rose-200" },
  { value: "bg-orange-50 text-orange-600", label: "Cam ấm áp (Orange)", previewClass: "bg-orange-50 text-orange-600 border-orange-200" },
  { value: "bg-amber-50 text-amber-600", label: "Vàng hổ phách (Amber)", previewClass: "bg-amber-50 text-amber-600 border-amber-200" },
  { value: "bg-emerald-50 text-emerald-600", label: "Xanh lục bảo (Emerald)", previewClass: "bg-emerald-50 text-emerald-600 border-emerald-200" },
  { value: "bg-blue-50 text-blue-600", label: "Xanh dương thanh nhã (Blue)", previewClass: "bg-blue-50 text-blue-600 border-blue-200" },
  { value: "bg-purple-50 text-purple-600", label: "Tím mộng mơ (Purple)", previewClass: "bg-purple-50 text-purple-600 border-purple-200" },
  { value: "bg-teal-50 text-teal-600", label: "Xanh mòng két (Teal)", previewClass: "bg-teal-50 text-teal-600 border-teal-200" },
];

const ICON_MAP: Record<string, LucideIcon> = {
  Heart,
  House,
  Home: House,
  Trophy,
  Sprout,
  Gift,
  BriefcaseBusiness,
  Briefcase: BriefcaseBusiness,
  Sparkles,
  Star,
  Smile,
  Cake,
  Sun,
  Flower2,
};

function renderIcon(name: string) {
  const IconComp = ICON_MAP[name] || Gift;
  return <IconComp size={18} aria-hidden />;
}

export function GiftNavEditor() {
  const queryClient = useQueryClient();
  const [config, setConfig] = useState<GiftNavConfig>(DEFAULT_GIFT_NAV_CONFIG);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const fetchConfig = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/shop/admin/gifts/nav");
      const json = await res.json();
      if (json.ok && json.data) {
        setConfig(json.data);
      } else {
        message.error(json.error || "Không thể tải cấu hình menu quà tặng");
      }
    } catch {
      message.error("Lỗi kết nối máy chủ");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfig();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/shop/admin/gifts/nav", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      const json = await res.json();
      if (json.ok && json.data) {
        setConfig(json.data);
        queryClient.setQueryData([...PUBLIC_CONTENT_KEY, "gift_nav"], json.data);
        queryClient.invalidateQueries({ queryKey: [...PUBLIC_CONTENT_KEY, "gift_nav"] });
        message.success("Đã lưu cấu hình 4 nhóm gợi ý quà tặng thành công!");
      } else {
        message.error(json.error || "Không thể lưu cấu hình");
      }
    } catch {
      message.error("Lỗi khi gửi yêu cầu lưu");
    } finally {
      setSaving(false);
    }
  };

  const updateCategory = (idx: number, patch: Partial<GiftNavCategoryItem>) => {
    setConfig(prev => {
      const nextCategories = [...prev.categories];
      nextCategories[idx] = { ...nextCategories[idx], ...patch };
      return { ...prev, categories: nextCategories };
    });
  };

  return (
    <div className="space-y-6">
      {/* Thanh Header công cụ */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-stone-200/80 shadow-2xs">
        <div>
          <h2 className="text-base font-bold text-stone-900 flex items-center gap-2">
            <Gift size={18} className="text-[#0E5242]" />
            <span>Tùy Chỉnh 4 Nhóm Gợi Ý Quà Tặng (Menu Header)</span>
          </h2>
          <p className="text-xs text-stone-500 mt-0.5">
            Tự chỉnh tên 4 nhóm đối tượng, câu gợi cảm xúc, biểu tượng và link trong menu dropdown &quot;Gợi ý quà tặng&quot;.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button icon={<RefreshCw size={14} />} onClick={fetchConfig} loading={loading}>
            Làm mới
          </Button>
          <Button
            type="primary"
            icon={<Save size={15} />}
            onClick={handleSave}
            loading={saving}
            className="!bg-[#0E5242] hover:!bg-[#156e59] !font-bold"
          >
            Lưu cấu hình Menu
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="p-12 text-center bg-white rounded-2xl border border-stone-200/80">
          <Spin tip="Đang tải cấu hình..." />
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
          {/* CỘT TRÁI: FORM CHỈNH SỬA 4 THẺ & TIÊU ĐỀ KHỐI */}
          <div className="xl:col-span-7 space-y-4">
            {/* Khối Cấu hình Tiêu đề Menu */}
            <Card
              size="small"
              className="!rounded-2xl !border-stone-200/80 shadow-2xs"
              title={<span className="font-bold text-xs uppercase tracking-wider text-stone-700">1. Tiêu đề khối dropdown</span>}
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Tiêu đề chính
                  </label>
                  <Input
                    value={config.headerTitle}
                    onChange={e => setConfig(prev => ({ ...prev, headerTitle: e.target.value }))}
                    placeholder="VD: Chọn quà, gửi yêu thương"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Lời tựa phụ
                  </label>
                  <Input
                    value={config.headerSubtitle}
                    onChange={e => setConfig(prev => ({ ...prev, headerSubtitle: e.target.value }))}
                    placeholder="VD: Bạn muốn tặng ai, nhân dịp nào?"
                  />
                </div>
              </div>
            </Card>

            {/* Khối Cấu hình 4 Thẻ Quà Tặng */}
            <Card
              size="small"
              className="!rounded-2xl !border-stone-200/80 shadow-2xs"
              title={<span className="font-bold text-xs uppercase tracking-wider text-stone-700">2. Cấu hình chi tiết 4 thẻ gợi ý</span>}
            >
              <div className="space-y-4">
                {config.categories.map((cat, idx) => (
                  <div
                    key={cat.id || idx}
                    className="p-3.5 rounded-xl border border-stone-200 bg-stone-50/50 space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-[#0E5242] flex items-center gap-1.5">
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100 text-[11px] font-bold">
                          {idx + 1}
                        </span>
                        Thẻ {idx + 1}: {cat.label || "Chưa đặt tên"}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-stone-500">Hiển thị</span>
                        <Switch
                          size="small"
                          checked={cat.enabled}
                          onChange={checked => updateCategory(idx, { enabled: checked })}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-stone-600 mb-1">
                          Tên nhóm đối tượng / Dịp tặng
                        </label>
                        <Input
                          value={cat.label}
                          onChange={e => updateCategory(idx, { label: e.target.value })}
                          placeholder="VD: Người thương, Gia đình & Mẹ..."
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-stone-600 mb-1">
                          Lời gợi ý cảm xúc (Hint)
                        </label>
                        <Input
                          value={cat.hint}
                          onChange={e => updateCategory(idx, { hint: e.target.value })}
                          placeholder="VD: Một món quà nhỏ, gửi nhiều yêu thương"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-stone-600 mb-1">
                          Biểu tượng (Icon)
                        </label>
                        <Select
                          className="w-full"
                          value={cat.icon || "Gift"}
                          onChange={val => updateCategory(idx, { icon: val })}
                          options={AVAILABLE_ICONS.map(i => ({
                            value: i.value,
                            label: (
                              <div className="flex items-center gap-2">
                                <i.icon size={15} />
                                <span>{i.label}</span>
                              </div>
                            ),
                          }))}
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-stone-600 mb-1">
                          Tông màu thẻ
                        </label>
                        <Select
                          className="w-full"
                          value={cat.color || "bg-emerald-50 text-emerald-600"}
                          onChange={val => updateCategory(idx, { color: val })}
                          options={COLOR_OPTIONS.map(c => ({
                            value: c.value,
                            label: (
                              <div className="flex items-center gap-2">
                                <span className={`h-3 w-3 rounded-full border ${c.previewClass}`} />
                                <span>{c.label}</span>
                              </div>
                            ),
                          }))}
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-stone-600 mb-1">
                          Đường dẫn tĩnh (URL)
                        </label>
                        <Input
                          value={cat.href}
                          onChange={e => updateCategory(idx, { href: e.target.value })}
                          placeholder="/qua-tang/nguoi-thuong"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            {/* Khối Cấu hình Quà tặng Doanh Nghiệp (B2B) */}
            <Card
              size="small"
              className="!rounded-2xl !border-stone-200/80 shadow-2xs"
              title={<span className="font-bold text-xs uppercase tracking-wider text-stone-700">3. Mục quà tặng doanh nghiệp (B2B) ở cuối</span>}
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between pb-1">
                  <span className="text-xs font-semibold text-stone-700">Bật mục Doanh nghiệp</span>
                  <Switch
                    size="small"
                    checked={config.b2bEnabled !== false}
                    onChange={checked => setConfig(prev => ({ ...prev, b2bEnabled: checked }))}
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-stone-600 mb-1">Tiêu đề</label>
                    <Input
                      value={config.b2bTitle}
                      onChange={e => setConfig(prev => ({ ...prev, b2bTitle: e.target.value }))}
                      placeholder="Quà tặng doanh nghiệp"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-stone-600 mb-1">Đường dẫn (URL)</label>
                    <Input
                      value={config.b2bHref}
                      onChange={e => setConfig(prev => ({ ...prev, b2bHref: e.target.value }))}
                      placeholder="/qua-tang/doanh-nghiep"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-stone-600 mb-1">Mô tả tư vấn</label>
                  <Input
                    value={config.b2bSubtitle}
                    onChange={e => setConfig(prev => ({ ...prev, b2bSubtitle: e.target.value }))}
                    placeholder="Tư vấn quà tặng cho đối tác, khách hàng & đội ngũ"
                  />
                </div>
              </div>
            </Card>
          </div>

          {/* CỘT PHẢI: LIVE PREVIEW TRỰC QUAN (GIỐNG 100% STOREFRONT) */}
          <div className="xl:col-span-5 space-y-3 sticky top-4">
            <div className="flex items-center justify-between px-1">
              <span className="text-xs font-bold uppercase tracking-wider text-stone-500">
                👁️ Bản xem trước thực tế ngoài Website
              </span>
              <span className="text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                Xem trước tức thì
              </span>
            </div>

            <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-md space-y-4">
              <div className="flex items-center gap-3 border-b border-stone-100 pb-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-[var(--aloha-green,#0E5242)]">
                  <Gift size={20} aria-hidden="true" />
                </span>
                <div>
                  <h3 className="text-sm font-bold text-[var(--aloha-green,#0E5242)]">
                    {config.headerTitle || "Chọn quà, gửi yêu thương"}
                  </h3>
                  <p className="text-[11px] text-stone-500">
                    {config.headerSubtitle || "Bạn muốn tặng ai, nhân dịp nào?"}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {config.categories.filter(c => c.enabled !== false).map((cat, idx) => (
                  <div
                    key={cat.id || idx}
                    className="flex min-h-20 items-center gap-2.5 rounded-xl border border-stone-200 bg-white p-3 shadow-2xs"
                  >
                    <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${cat.color || "bg-emerald-50 text-emerald-600"}`}>
                      {renderIcon(cat.icon)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <span className="block text-xs font-bold text-stone-800 truncate">
                        {cat.label || "Chưa đặt tên"}
                      </span>
                      <span className="mt-0.5 block text-[10px] leading-tight text-stone-500 line-clamp-2">
                        {cat.hint || "Chưa có lời tựa"}
                      </span>
                    </div>
                    <ArrowRight size={14} className="shrink-0 text-stone-300" />
                  </div>
                ))}
              </div>

              {config.b2bEnabled !== false && (
                <div className="flex items-center gap-2.5 rounded-xl bg-[var(--aloha-green-light,#eef7ed)] p-3 text-[var(--aloha-green,#0E5242)]">
                  <BriefcaseBusiness size={18} className="shrink-0" />
                  <div className="min-w-0 flex-1">
                    <span className="block text-xs font-bold truncate">
                      {config.b2bTitle || "Quà tặng doanh nghiệp"}
                    </span>
                    <span className="block text-[10px] text-stone-600 truncate">
                      {config.b2bSubtitle || "Tư vấn quà tặng cho đối tác, khách hàng..."}
                    </span>
                  </div>
                  <ArrowRight size={14} className="shrink-0" />
                </div>
              )}
            </div>

            <div className="p-3 bg-amber-50 rounded-xl border border-amber-200/80 text-amber-800 text-xs leading-relaxed">
              💡 <strong>Lưu ý:</strong> Khi bạn nhấn nút <strong>&quot;Lưu cấu hình Menu&quot;</strong>, toàn bộ thay đổi về tiêu đề, câu gợi cảm xúc và icon sẽ được cập nhật tự động ngay trên menu <em>&quot;Gợi ý quà tặng&quot;</em> của cả giao diện máy tính và điện thoại.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
