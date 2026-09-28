"use client";

import { useEffect, useState } from "react";
import {
  Modal,
  Form,
  Input,
  InputNumber,
  Select,
  DatePicker,
  Button,
  message,
  Tabs,
  Tooltip,
} from "antd";
import {
  Sparkles,
  Ticket,
  Eye,
  Calendar,
  DollarSign,
  UserCheck,
  CheckCircle2,
  Info,
  X,
  ShieldCheck,
  Tag as TagIcon,
  Store,
  Layers,
  Percent,
  SlidersHorizontal,
} from "lucide-react";
import dayjs from "dayjs";
import { formatVnd } from "@/lib/api";

export interface PromotionItem {
  id: string;
  name: string;
  title: string;
  description?: string;
  type: "auto" | "code";
  discountType: "percentage" | "fixed";
  discountValue: number;
  maxDiscountVnd?: number;
  minOrderThreshold?: number;
  thresholdOperator?: ">" | ">=";
  scope: "all" | "category" | "product";
  categoryIds?: string[];
  productMas?: string[];
  excludedProductMas?: string[];
  targetCustomer: "all" | "retail" | "wholesale" | "new_web";
  startDate?: string;
  endDate?: string;
  usageLimitTotal?: number;
  usageLimitPerCustomer?: number;
  budgetTotal?: number;
  budgetUsed?: number;
  budgetHeld?: number;
  usedCount?: number;
  heldCount?: number;
  status: "draft" | "active" | "paused" | "archived";
  isPublic?: boolean;
  priority?: number;
  revision?: number;
}

type Props = {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  editingItem?: PromotionItem | null;
};

export function PromotionFormModal({
  open,
  onClose,
  onSuccess,
  editingItem,
}: Props) {
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const [previewValues, setPreviewValues] = useState<Partial<PromotionItem>>({});
  const [activeTab, setActiveTab] = useState("basic");

  useEffect(() => {
    if (!open) return;
    setActiveTab("basic");
    if (editingItem) {
      form.setFieldsValue({
        name: editingItem.name,
        title: editingItem.title,
        description: editingItem.description,
        type: editingItem.type,
        discountType: editingItem.discountType,
        discountValue: editingItem.discountValue,
        maxDiscountVnd: editingItem.maxDiscountVnd,
        minOrderThreshold: editingItem.minOrderThreshold,
        thresholdOperator: editingItem.thresholdOperator || ">",
        scope: editingItem.scope || "all",
        productMasText: editingItem.productMas?.join(", ") || "",
        excludedProductMasText: editingItem.excludedProductMas?.join(", ") || "",
        targetCustomer: editingItem.targetCustomer || "retail",
        timeRange:
          editingItem.startDate && editingItem.endDate
            ? [dayjs(editingItem.startDate), dayjs(editingItem.endDate)]
            : undefined,
        usageLimitTotal: editingItem.usageLimitTotal,
        usageLimitPerCustomer: editingItem.usageLimitPerCustomer,
        budgetTotal: editingItem.budgetTotal,
        status: editingItem.status || "active",
        priority: editingItem.priority || 0,
      });
      setPreviewValues(editingItem);
    } else {
      // Default: Khách mới 10%
      const def = {
        name: "Ưu đãi khách mới 10%",
        title: "Giảm 10% cho khách mua web lần đầu",
        description: "Tự động áp dụng cho khách hàng chưa từng mua trên website",
        type: "auto",
        discountType: "percentage",
        discountValue: 10,
        maxDiscountVnd: 200000,
        minOrderThreshold: 0,
        thresholdOperator: ">",
        scope: "all",
        targetCustomer: "new_web",
        status: "active",
        priority: 10,
      };
      form.setFieldsValue(def);
      setPreviewValues(def as any);
    }
  }, [open, editingItem, form]);

  const handleValuesChange = (_: any, allValues: any) => {
    setPreviewValues(allValues);
  };

  const applyTemplate = (tpl: "first10" | "bigOrder" | "coupon" | "fixedSmall") => {
    if (tpl === "first10") {
      const v = {
        name: "Ưu đãi khách mới 10%",
        title: "Giảm 10% cho khách mua web lần đầu",
        description: "Tự động áp dụng cho khách hàng chưa từng mua trên website",
        type: "auto",
        discountType: "percentage",
        discountValue: 10,
        maxDiscountVnd: 200000,
        minOrderThreshold: 0,
        thresholdOperator: ">",
        scope: "all",
        targetCustomer: "new_web",
        status: "active",
        priority: 10,
      };
      form.setFieldsValue(v);
      setPreviewValues(v as any);
    } else if (tpl === "bigOrder") {
      const v = {
        name: "Ưu đãi đơn hàng trên 1 triệu",
        title: "Giảm 100.000đ cho đơn hàng trên 1.000.000đ",
        description: "Tự động giảm 100k khi tổng giá trị hàng vượt 1.000.000đ",
        type: "auto",
        discountType: "fixed",
        discountValue: 100000,
        maxDiscountVnd: undefined,
        minOrderThreshold: 1000000,
        thresholdOperator: ">",
        scope: "all",
        targetCustomer: "retail",
        status: "active",
        priority: 5,
      };
      form.setFieldsValue(v);
      setPreviewValues(v as any);
    } else if (tpl === "coupon") {
      const v = {
        name: "Chiến dịch Mã giảm giá 50k",
        title: "Giảm ngay 50.000đ khi nhập mã ưu đãi",
        description: "Áp dụng khi khách nhập mã khuyến mại trong giỏ hoặc checkout",
        type: "code",
        discountType: "fixed",
        discountValue: 50000,
        maxDiscountVnd: undefined,
        minOrderThreshold: 300000,
        thresholdOperator: ">=",
        scope: "all",
        targetCustomer: "all",
        status: "active",
        priority: 1,
      };
      form.setFieldsValue(v);
      setPreviewValues(v as any);
    } else if (tpl === "fixedSmall") {
      const v = {
        name: "Khuyến mại đơn 200k",
        title: "Giảm 20.000đ cho đơn từ 200.000đ",
        description: "Ưu đãi tự động cho mọi khách hàng khi đơn đạt 200k",
        type: "auto",
        discountType: "fixed",
        discountValue: 20000,
        maxDiscountVnd: undefined,
        minOrderThreshold: 200000,
        thresholdOperator: ">=",
        scope: "all",
        targetCustomer: "all",
        status: "active",
        priority: 2,
      };
      form.setFieldsValue(v);
      setPreviewValues(v as any);
    }
  };

  const handleFinish = async (values: any) => {
    try {
      setSubmitting(true);
      const productMas = String(values.productMasText || "")
        .split(/[,;\s]+/)
        .map((m) => m.trim().toUpperCase())
        .filter(Boolean);
      const excludedProductMas = String(values.excludedProductMasText || "")
        .split(/[,;\s]+/)
        .map((m) => m.trim().toUpperCase())
        .filter(Boolean);

      const timeRange = values.timeRange;
      const startDate = timeRange?.[0] ? timeRange[0].toISOString() : undefined;
      const endDate = timeRange?.[1] ? timeRange[1].toISOString() : undefined;

      const payload = {
        name: values.name,
        title: values.title || values.name,
        description: values.description,
        type: values.type,
        discountType: values.discountType,
        discountValue: values.discountValue,
        maxDiscountVnd: values.maxDiscountVnd || undefined,
        minOrderThreshold: values.minOrderThreshold || 0,
        thresholdOperator: values.thresholdOperator || ">",
        scope: values.scope,
        productMas,
        excludedProductMas,
        targetCustomer: values.targetCustomer,
        startDate,
        endDate,
        usageLimitTotal: values.usageLimitTotal || undefined,
        usageLimitPerCustomer: values.usageLimitPerCustomer || undefined,
        budgetTotal: values.budgetTotal || undefined,
        status: values.status,
        priority: values.priority || 0,
        revision: editingItem?.revision,
      };

      const url = editingItem
        ? `/api/shop/admin/promotions/${editingItem.id}`
        : "/api/shop/admin/promotions";
      const method = editingItem ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Không lưu được chương trình");
      }

      message.success(
        editingItem ? "Đã cập nhật chương trình ưu đãi" : "Đã tạo chương trình ưu đãi mới"
      );
      onSuccess();
    } catch (e: any) {
      message.error(e?.message || "Lỗi lưu chương trình");
    } finally {
      setSubmitting(false);
    }
  };

  const discountType = Form.useWatch("discountType", form);
  const type = Form.useWatch("type", form);
  const scope = Form.useWatch("scope", form);

  return (
    <Modal
      open={open}
      onCancel={onClose}
      width={1040}
      centered
      closable={false}
      footer={null}
      destroyOnClose
      styles={{
        body: { padding: 0 },
      }}
      className="[&_.ant-modal-content]:!p-0 [&_.ant-modal-content]:!rounded-2xl [&_.ant-modal-content]:!overflow-hidden [&_.ant-modal-content]:!shadow-2xl"
    >
      <div className="flex flex-col bg-slate-50/40">
        {/* ========================================================================= */}
        {/* 1. HEADER CHUẨN KIOTVIET: Đẹp, Rõ ràng, Tích hợp Quick Presets             */}
        {/* ========================================================================= */}
        <div className="px-6 py-3.5 border-b border-slate-200/80 bg-white shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-700 text-white shadow-xs">
                <Ticket size={22} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-slate-900">
                    {editingItem ? "Cập nhật chương trình khuyến mại" : "Thêm mới chương trình khuyến mại"}
                  </h3>
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800 border border-emerald-200">
                    KiotViet Ready
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Thiết lập chiết khấu đơn hàng tự động hoặc mã voucher áp dụng trên Website Aloha
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
              aria-label="Đóng"
            >
              <X size={20} />
            </button>
          </div>

          {/* Quick Presets Bar */}
          {!editingItem ? (
            <div className="mt-2.5 pt-2.5 border-t border-slate-100 flex items-center justify-between gap-2 flex-wrap">
              <span className="text-[11px] font-semibold text-slate-500 flex items-center gap-1">
                <Sparkles size={13} className="text-amber-500" />
                Mẫu thiết lập nhanh (KiotViet Presets):
              </span>
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={() => applyTemplate("first10")}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition cursor-pointer"
                >
                  <Sparkles size={12} className="text-emerald-600" />
                  Khách mới 10%
                </button>
                <button
                  type="button"
                  onClick={() => applyTemplate("bigOrder")}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 transition cursor-pointer"
                >
                  <DollarSign size={12} className="text-blue-600" />
                  Đơn lớn &gt; 1tr (Giảm 100k)
                </button>
                <button
                  type="button"
                  onClick={() => applyTemplate("coupon")}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg bg-purple-50 text-purple-700 border border-purple-200 hover:bg-purple-100 transition cursor-pointer"
                >
                  <TagIcon size={12} className="text-purple-600" />
                  Mã giảm giá 50k
                </button>
                <button
                  type="button"
                  onClick={() => applyTemplate("fixedSmall")}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100 transition cursor-pointer"
                >
                  <Percent size={12} className="text-amber-600" />
                  Giảm 20k đơn 200k
                </button>
              </div>
            </div>
          ) : null}
        </div>

        {/* ========================================================================= */}
        {/* 2. BODY GỌN GÀNG, KHÔNG CẮT VỤN CARD, CÂN ĐỐI 100%                        */}
        {/* ========================================================================= */}
        <div className="p-5">
          <Form
            form={form}
            layout="vertical"
            onFinish={handleFinish}
            onValuesChange={handleValuesChange}
            requiredMark={false}
          >
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
              {/* ==================== CỘT TRÁI: FORM CẤU HÌNH THEO TABS (7 COLS) ==================== */}
              <div className="lg:col-span-7 flex flex-col justify-between">
                <div className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-2xs">
                  <Tabs
                    activeKey={activeTab}
                    onChange={setActiveTab}
                    size="small"
                    className="[&_.ant-tabs-nav]:!mb-3"
                    items={[
                      {
                        key: "basic",
                        label: (
                          <span className="flex items-center gap-1.5 font-bold text-xs">
                            <Sparkles size={14} className="text-emerald-600" />
                            1. Thiết lập ưu đãi & Mức giảm
                          </span>
                        ),
                        children: (
                          <div className="space-y-3 pt-1">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <Form.Item
                                name="name"
                                label={
                                  <span className="text-xs font-semibold text-slate-700">
                                    Tên chương trình nội bộ <span className="text-red-500">*</span>
                                  </span>
                                }
                                rules={[{ required: true, message: "Vui lòng nhập tên chương trình" }]}
                                className="!mb-0"
                              >
                                <Input placeholder="VD: Khuyến mại ra mắt web - 10%" className="!rounded-lg !h-9" />
                              </Form.Item>

                              <Form.Item
                                name="type"
                                label={<span className="text-xs font-semibold text-slate-700">Cách thức áp dụng</span>}
                                className="!mb-0"
                              >
                                <Select
                                  className="w-full !h-9"
                                  options={[
                                    { label: "⚡ Tự động (Hệ thống tự tính khi đủ ĐK)", value: "auto" },
                                    { label: "🎟️ Theo mã (Khách nhập mã Voucher)", value: "code" },
                                  ]}
                                />
                              </Form.Item>
                            </div>

                            <Form.Item
                              name="title"
                              label={
                                <span className="text-xs font-semibold text-slate-700">
                                  Tiêu đề hiển thị cho khách thấy trên Web <span className="text-red-500">*</span>
                                </span>
                              }
                              rules={[{ required: true, message: "Vui lòng nhập tiêu đề hiển thị" }]}
                              className="!mb-0"
                            >
                              <Input
                                placeholder="VD: Giảm 10% tối đa 200k cho khách mua web lần đầu"
                                className="!rounded-lg !h-9 font-medium text-slate-800"
                              />
                            </Form.Item>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <Form.Item
                                name="discountType"
                                label={<span className="text-xs font-semibold text-slate-700">Hình thức giảm</span>}
                                className="!mb-0"
                              >
                                <Select
                                  className="w-full !h-9"
                                  options={[
                                    { label: "Giảm theo phần trăm (%)", value: "percentage" },
                                    { label: "Giảm số tiền cố định (VNĐ)", value: "fixed" },
                                  ]}
                                />
                              </Form.Item>

                              <Form.Item
                                name="discountValue"
                                label={
                                  <span className="text-xs font-semibold text-slate-700">
                                    {discountType === "fixed" ? "Số tiền giảm (VNĐ)" : "Tỷ lệ giảm (%)"}{" "}
                                    <span className="text-red-500">*</span>
                                  </span>
                                }
                                rules={[{ required: true, message: "Vui lòng nhập mức giảm" }]}
                                className="!mb-0"
                              >
                                <InputNumber
                                  className="w-full !rounded-lg !h-9 font-bold text-emerald-800"
                                  min={1}
                                  max={discountType === "fixed" ? 50000000 : 100}
                                  addonAfter={discountType === "fixed" ? "đ" : "%"}
                                  formatter={(v) => (discountType === "fixed" ? `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",") : `${v}`)}
                                />
                              </Form.Item>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <Form.Item
                                name="maxDiscountVnd"
                                label={
                                  <span className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                                    Trần giảm tối đa (VNĐ)
                                    <Tooltip title="Khuyên dùng cho giảm % để tránh thất thoát khi đơn hàng có giá trị rất lớn">
                                      <Info size={12} className="text-slate-400 cursor-pointer" />
                                    </Tooltip>
                                  </span>
                                }
                                className="!mb-0"
                              >
                                <InputNumber
                                  className="w-full !rounded-lg !h-9"
                                  min={0}
                                  step={10000}
                                  placeholder={discountType === "fixed" ? "Không áp dụng" : "VD: 200,000"}
                                  addonAfter="đ"
                                  disabled={discountType === "fixed"}
                                  formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}
                                />
                              </Form.Item>

                              <div className="grid grid-cols-[110px_1fr] gap-2">
                                <Form.Item
                                  name="thresholdOperator"
                                  label={<span className="text-xs font-semibold text-slate-700">Đơn hàng</span>}
                                  className="!mb-0"
                                >
                                  <Select
                                    className="w-full !h-9"
                                    options={[
                                      { label: "Trên (>)", value: ">" },
                                      { label: "Từ (>=)", value: ">=" },
                                    ]}
                                  />
                                </Form.Item>

                                <Form.Item
                                  name="minOrderThreshold"
                                  label={<span className="text-xs font-semibold text-slate-700">Đơn tối thiểu</span>}
                                  className="!mb-0"
                                >
                                  <InputNumber
                                    className="w-full !rounded-lg !h-9"
                                    min={0}
                                    step={50000}
                                    placeholder="0 = Mọi đơn"
                                    addonAfter="đ"
                                    formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}
                                  />
                                </Form.Item>
                              </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <Form.Item
                                name="targetCustomer"
                                label={<span className="text-xs font-semibold text-slate-700">Khách hàng áp dụng</span>}
                                className="!mb-0"
                              >
                                <Select
                                  className="w-full !h-9"
                                  options={[
                                    { label: "⭐ Khách mua lần đầu trên Web", value: "new_web" },
                                    { label: "👤 Khách mua lẻ (Retail)", value: "retail" },
                                    { label: "💼 Khách đại lý / Sỉ (Wholesale)", value: "wholesale" },
                                    { label: "🌐 Toàn bộ khách hàng", value: "all" },
                                  ]}
                                />
                              </Form.Item>

                              <Form.Item
                                name="timeRange"
                                label={<span className="text-xs font-semibold text-slate-700">Thời gian hiệu lực</span>}
                                className="!mb-0"
                              >
                                <DatePicker.RangePicker
                                  showTime
                                  className="w-full !rounded-lg !h-9"
                                  format="DD/MM/YYYY HH:mm"
                                  placeholder={["Từ ngày", "Đến ngày"]}
                                />
                              </Form.Item>
                            </div>
                          </div>
                        ),
                      },
                      {
                        key: "advanced",
                        label: (
                          <span className="flex items-center gap-1.5 font-bold text-xs">
                            <SlidersHorizontal size={14} className="text-blue-600" />
                            2. Phạm vi SKU & Ngân sách nâng cao
                          </span>
                        ),
                        children: (
                          <div className="space-y-3 pt-1">
                            <Form.Item
                              name="scope"
                              label={<span className="text-xs font-semibold text-slate-700">Phạm vi sản phẩm áp dụng</span>}
                              className="!mb-0"
                            >
                              <Select
                                className="w-full !h-9"
                                options={[
                                  { label: "📦 Toàn bộ sản phẩm trên Website Aloha", value: "all" },
                                  { label: "🏷️ Chỉ định danh sách SKU cụ thể", value: "product" },
                                ]}
                              />
                            </Form.Item>

                            {scope === "product" ? (
                              <Form.Item
                                name="productMasText"
                                label={<span className="text-xs font-semibold text-slate-700">Danh sách SKU áp dụng (cách nhau bởi dấu phẩy)</span>}
                                className="!mb-0"
                              >
                                <Input placeholder="VD: CHAU_SU_01, CHAU_DAT_NUNG_02" className="!rounded-lg !h-9" />
                              </Form.Item>
                            ) : null}

                            <Form.Item
                              name="excludedProductMasText"
                              label={<span className="text-xs font-semibold text-slate-700">Sản phẩm loại trừ (SKU không áp dụng giảm)</span>}
                              className="!mb-0"
                            >
                              <Input placeholder="VD: CAY_CANH_VIP_01, PHU_KIEN_DAI_LY (để trống nếu không loại trừ)" className="!rounded-lg !h-9" />
                            </Form.Item>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <Form.Item
                                name="usageLimitTotal"
                                label={<span className="text-xs font-semibold text-slate-700">Tổng lượt dùng tối đa</span>}
                                className="!mb-0"
                              >
                                <InputNumber className="w-full !rounded-lg !h-9" min={1} placeholder="Không giới hạn" />
                              </Form.Item>

                              <Form.Item
                                name="budgetTotal"
                                label={<span className="text-xs font-semibold text-slate-700">Tổng ngân sách khuyến mại (VNĐ)</span>}
                                className="!mb-0"
                              >
                                <InputNumber
                                  className="w-full !rounded-lg !h-9"
                                  min={0}
                                  step={500000}
                                  placeholder="Không giới hạn"
                                  addonAfter="đ"
                                  formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}
                                />
                              </Form.Item>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <Form.Item
                                name="status"
                                label={<span className="text-xs font-semibold text-slate-700">Trạng thái phát hành</span>}
                                className="!mb-0"
                              >
                                <Select
                                  className="w-full !h-9"
                                  options={[
                                    { label: "🟢 Đang áp dụng (Active)", value: "active" },
                                    { label: "🟡 Bản nháp (Draft)", value: "draft" },
                                    { label: "🔴 Tạm dừng (Paused)", value: "paused" },
                                  ]}
                                />
                              </Form.Item>

                              <Form.Item
                                name="priority"
                                label={
                                  <span className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                                    Độ ưu tiên (Số càng cao càng ưu tiên)
                                    <Tooltip title="Khi có nhiều ưu đãi tự động cùng thỏa mãn, chương trình có số ưu tiên cao hơn sẽ được hệ thống áp dụng">
                                      <Info size={12} className="text-slate-400 cursor-pointer" />
                                    </Tooltip>
                                  </span>
                                }
                                className="!mb-0"
                              >
                                <InputNumber className="w-full !rounded-lg !h-9" placeholder="0" min={0} max={100} />
                              </Form.Item>
                            </div>

                            <Form.Item
                              name="description"
                              label={<span className="text-xs font-semibold text-slate-700">Mô tả chi tiết / Ghi chú nội bộ</span>}
                              className="!mb-0"
                            >
                              <Input.TextArea rows={2} placeholder="Ghi chú điều kiện hoặc lưu ý triển khai..." className="!rounded-lg" />
                            </Form.Item>
                          </div>
                        ),
                      },
                    ]}
                  />
                </div>
              </div>

              {/* ==================== CỘT PHẢI: LIVE PREVIEW STOREFRONT (5 COLS) ==================== */}
              <div className="lg:col-span-5 flex flex-col justify-between">
                <div className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-2xs h-full flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
                      <div className="flex items-center gap-2">
                        <Eye size={15} className="text-emerald-700" />
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                          Xem trước hiển thị Storefront
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-400 font-medium">Khách hàng sẽ thấy</span>
                    </div>

                    {/* Thẻ Voucher mô phỏng trực quan chuẩn phong cách Ticket Voucher */}
                    <div className="mt-3.5 relative overflow-hidden rounded-xl border-2 border-dashed border-emerald-300 bg-linear-to-br from-emerald-50/90 via-white to-emerald-50/40 p-4 shadow-2xs">
                      {/* Vết cắt tròn 2 bên kiểu phiếu giảm giá (Ticket notch) */}
                      <div className="absolute -left-3 top-1/2 -mt-2.5 h-5 w-5 rounded-full bg-white border-r-2 border-dashed border-emerald-300" />
                      <div className="absolute -right-3 top-1/2 -mt-2.5 h-5 w-5 rounded-full bg-white border-l-2 border-dashed border-emerald-300" />

                      <div className="pl-1">
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider ${
                              previewValues.type === "code"
                                ? "bg-purple-100 text-purple-700 border border-purple-200"
                                : "bg-emerald-100 text-emerald-800 border border-emerald-200"
                            }`}
                          >
                            <Ticket size={11} />
                            {previewValues.type === "code" ? "Mã giảm giá" : "Ưu đãi tự động"}
                          </span>

                          <span className="text-[11px] font-bold text-slate-400">
                            Aloha Shop
                          </span>
                        </div>

                        <h4 className="text-sm font-extrabold text-slate-900 leading-snug">
                          {previewValues.title || "Tiêu đề chương trình hiển thị"}
                        </h4>

                        <p className="mt-1 text-xs text-slate-500 line-clamp-2">
                          {previewValues.description || "Tự động trừ trực tiếp vào giỏ hàng khi đủ điều kiện..."}
                        </p>

                        <div className="mt-3 pt-2.5 border-t border-dashed border-emerald-200/80 space-y-1 text-xs">
                          <div className="flex items-center justify-between">
                            <span className="text-slate-500 font-medium">Mức giảm:</span>
                            <span className="font-extrabold text-sm text-red-600">
                              {previewValues.discountType === "percentage"
                                ? `${previewValues.discountValue || 0}% ${
                                    previewValues.maxDiscountVnd
                                      ? `(tối đa ${formatVnd(previewValues.maxDiscountVnd)})`
                                      : ""
                                  }`
                                : formatVnd(previewValues.discountValue || 0)}
                            </span>
                          </div>

                          <div className="flex items-center justify-between">
                            <span className="text-slate-500 font-medium">Đơn tối thiểu:</span>
                            <span className="font-semibold text-slate-800">
                              {previewValues.minOrderThreshold
                                ? `${previewValues.thresholdOperator === ">=" ? "Từ" : "Trên"} ${formatVnd(
                                    previewValues.minOrderThreshold
                                  )}`
                                : "Mọi đơn hàng"}
                            </span>
                          </div>

                          <div className="flex items-center justify-between">
                            <span className="text-slate-500 font-medium">Đối tượng:</span>
                            <span className="font-semibold text-slate-800">
                              {previewValues.targetCustomer === "new_web"
                                ? "Khách mua web lần đầu"
                                : previewValues.targetCustomer === "wholesale"
                                ? "Khách đại lý sỉ"
                                : previewValues.targetCustomer === "retail"
                                ? "Khách mua lẻ"
                                : "Tất cả khách hàng"}
                            </span>
                          </div>

                          <div className="flex items-center justify-between">
                            <span className="text-slate-500 font-medium">Phạm vi:</span>
                            <span className="font-semibold text-slate-800">
                              {previewValues.scope === "product" ? "Sản phẩm chỉ định" : "Toàn bộ cửa hàng"}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Hướng dẫn nghiệp vụ & KiotViet */}
                  <div className="mt-3 rounded-xl bg-amber-50/80 p-3 border border-amber-200/70 text-xs text-amber-950 space-y-1">
                    <div className="font-bold flex items-center gap-1.5 text-amber-900 text-[11px]">
                      <Store size={13} className="text-amber-700" />
                      Đồng bộ hóa đơn KiotViet:
                    </div>
                    <p className="leading-relaxed text-slate-600 text-[11px]">
                      • Giảm giá được phân bổ vào trường <strong className="text-slate-800">Chiết khấu HĐ</strong> khi tạo đơn hàng KiotViet, đảm bảo kế toán doanh thu và thuế chính xác 100%.
                    </p>
                    <p className="leading-relaxed text-slate-600 text-[11px]">
                      • Không tạo mã rác trên KiotViet — Giữ danh mục POS luôn sạch sẽ.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Hidden submit trigger */}
            <button id="promotion-form-submit-btn" type="submit" className="hidden" />
          </Form>
        </div>

        {/* ========================================================================= */}
        {/* 3. FOOTER CỐ ĐỊNH CHUẨN KIOTVIET (STICKY BOTTOM, KHÔNG BAO GIỜ BỊ ĐÈ)     */}
        {/* ========================================================================= */}
        <div className="px-6 py-3 border-t border-slate-200/90 bg-white flex items-center justify-between shrink-0">
          <div className="hidden sm:flex items-center gap-2 text-xs text-slate-500">
            <ShieldCheck size={16} className="text-emerald-700" />
            <span>Tự động tối ưu mức giảm tốt nhất và đối soát chính xác với hóa đơn KiotViet.</span>
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
            <Button
              onClick={onClose}
              disabled={submitting}
              className="!h-9 !px-4 !rounded-lg !font-medium"
            >
              Hủy bỏ (Bỏ qua)
            </Button>

            <Button
              type="primary"
              loading={submitting}
              onClick={() => {
                const submitBtn = document.getElementById("promotion-form-submit-btn");
                submitBtn?.click();
              }}
              className="!h-9 !px-6 !rounded-lg !bg-emerald-700 hover:!bg-emerald-800 !font-bold flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <CheckCircle2 size={16} />
              {editingItem ? "Lưu thay đổi" : "Lưu chương trình"}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
