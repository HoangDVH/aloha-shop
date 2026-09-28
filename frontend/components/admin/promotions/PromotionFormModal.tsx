"use client";

import { useEffect, useState } from "react";
import {
  Modal,
  Form,
  Input,
  InputNumber,
  Radio,
  Select,
  DatePicker,
  Button,
  message,
  Tabs,
  Space,
  Card,
  Tag,
  Divider,
} from "antd";
import {
  Sparkles,
  Ticket,
  AlertCircle,
  Eye,
  Calendar,
  Layers,
  DollarSign,
  UserCheck,
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

  useEffect(() => {
    if (!open) return;
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

  const applyTemplate = (tpl: "first10" | "bigOrder" | "coupon") => {
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
      width={880}
      title={
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--aloha-green-light)] text-[var(--aloha-green)]">
            <Ticket size={18} />
          </div>
          <div>
            <h3 className="text-base font-bold text-[var(--aloha-ink)]">
              {editingItem ? "Chỉnh sửa chương trình ưu đãi" : "Tạo chương trình ưu đãi mới"}
            </h3>
            <p className="text-xs text-slate-500 font-normal">
              Cấu hình điều kiện, mức giảm và thời gian tự động áp dụng
            </p>
          </div>
        </div>
      }
      footer={null}
      destroyOnClose
    >
      {!editingItem ? (
        <div className="mb-4 mt-2 rounded-xl bg-slate-50 p-3 border border-slate-200/80">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
            Mẫu ưu đãi phổ biến:
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              size="small"
              icon={<Sparkles size={14} className="text-emerald-600" />}
              onClick={() => applyTemplate("first10")}
            >
              Khách mới web (10%)
            </Button>
            <Button
              size="small"
              icon={<DollarSign size={14} className="text-blue-600" />}
              onClick={() => applyTemplate("bigOrder")}
            >
              Đơn lớn (&gt; 1 triệu)
            </Button>
            <Button
              size="small"
              icon={<Ticket size={14} className="text-amber-600" />}
              onClick={() => applyTemplate("coupon")}
            >
              Mã giảm giá chiến dịch
            </Button>
          </div>
        </div>
      ) : null}

      <div className="grid gap-6 md:grid-cols-[1fr_300px] pt-1">
        {/* Cột trái: Form cấu hình */}
        <Form
          form={form}
          layout="vertical"
          onFinish={handleFinish}
          onValuesChange={handleValuesChange}
          requiredMark={false}
        >
          <div className="space-y-4">
            {/* Thông tin cơ bản */}
            <div className="rounded-xl border border-slate-100 p-4 bg-white shadow-xs">
              <h4 className="text-sm font-bold text-[var(--aloha-ink)] mb-3 flex items-center gap-1.5">
                <Ticket size={16} className="text-[var(--aloha-green)]" />
                Thông tin chương trình
              </h4>
              <Form.Item
                name="name"
                label={<span className="font-semibold text-xs">Tên nội bộ (Admin quản lý)</span>}
                rules={[{ required: true, message: "Nhập tên chương trình" }]}
              >
                <Input placeholder="VD: Khuyến mại ra mắt web - 10%" />
              </Form.Item>
              <Form.Item
                name="title"
                label={<span className="font-semibold text-xs">Tiêu đề khách thấy trên web</span>}
                rules={[{ required: true, message: "Nhập tiêu đề hiển thị" }]}
              >
                <Input placeholder="VD: Giảm 10% cho khách mua web lần đầu" />
              </Form.Item>
              <Form.Item
                name="description"
                label={<span className="font-semibold text-xs">Mô tả chi tiết</span>}
              >
                <Input.TextArea
                  rows={2}
                  placeholder="Mô tả điều kiện hoặc ghi chú ngắn..."
                />
              </Form.Item>
              <Form.Item
                name="type"
                label={<span className="font-semibold text-xs">Cách áp dụng</span>}
              >
                <Radio.Group buttonStyle="solid">
                  <Radio.Button value="auto">Tự động (Không cần mã)</Radio.Button>
                  <Radio.Button value="code">Mã ưu đãi (Nhập hoặc chọn mã)</Radio.Button>
                </Radio.Group>
              </Form.Item>
            </div>

            {/* Mức giảm giá & Ngưỡng */}
            <div className="rounded-xl border border-slate-100 p-4 bg-white shadow-xs">
              <h4 className="text-sm font-bold text-[var(--aloha-ink)] mb-3 flex items-center gap-1.5">
                <DollarSign size={16} className="text-[var(--aloha-green)]" />
                Mức giảm giá & Điều kiện đơn
              </h4>
              <div className="grid grid-cols-2 gap-3">
                <Form.Item
                  name="discountType"
                  label={<span className="font-semibold text-xs">Hình thức giảm</span>}
                >
                  <Select
                    options={[
                      { label: "Giảm theo %", value: "percentage" },
                      { label: "Giảm số tiền cố định (VND)", value: "fixed" },
                    ]}
                  />
                </Form.Item>
                <Form.Item
                  name="discountValue"
                  label={
                    <span className="font-semibold text-xs">
                      {discountType === "fixed" ? "Mức giảm (VND)" : "Mức giảm (%)"}
                    </span>
                  }
                  rules={[{ required: true, message: "Nhập mức giảm" }]}
                >
                  <InputNumber
                    className="w-full"
                    min={1}
                    max={discountType === "fixed" ? 50000000 : 100}
                    formatter={(v) => (discountType === "fixed" ? `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",") : `${v}`)}
                  />
                </Form.Item>
              </div>

              {discountType === "percentage" ? (
                <Form.Item
                  name="maxDiscountVnd"
                  label={<span className="font-semibold text-xs">Trần giảm tối đa (VND) — Bắt buộc nếu giảm %</span>}
                >
                  <InputNumber
                    className="w-full"
                    min={0}
                    step={10000}
                    placeholder="VD: 200,000đ (để trống nếu không giới hạn trần)"
                    formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}
                  />
                </Form.Item>
              ) : null}

              <div className="grid grid-cols-[130px_1fr] gap-3">
                <Form.Item
                  name="thresholdOperator"
                  label={<span className="font-semibold text-xs">Toán tử ngưỡng</span>}
                >
                  <Select
                    options={[
                      { label: "Trên (>)", value: ">" },
                      { label: "Từ (>=)", value: ">=" },
                    ]}
                  />
                </Form.Item>
                <Form.Item
                  name="minOrderThreshold"
                  label={<span className="font-semibold text-xs">Giá trị đơn tối thiểu (VND)</span>}
                >
                  <InputNumber
                    className="w-full"
                    min={0}
                    step={100000}
                    placeholder="0 là không giới hạn ngưỡng"
                    formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}
                  />
                </Form.Item>
              </div>
            </div>

            {/* Đối tượng & Phạm vi */}
            <div className="rounded-xl border border-slate-100 p-4 bg-white shadow-xs">
              <h4 className="text-sm font-bold text-[var(--aloha-ink)] mb-3 flex items-center gap-1.5">
                <UserCheck size={16} className="text-[var(--aloha-green)]" />
                Đối tượng khách hàng & Phạm vi sản phẩm
              </h4>
              <Form.Item
                name="targetCustomer"
                label={<span className="font-semibold text-xs">Đối tượng được hưởng</span>}
              >
                <Radio.Group>
                  <Radio value="retail">Khách lẻ</Radio>
                  <Radio value="new_web">Khách mua lần đầu trên web</Radio>
                  <Radio value="wholesale">Khách sỉ</Radio>
                  <Radio value="all">Tất cả</Radio>
                </Radio.Group>
              </Form.Item>

              <Form.Item
                name="scope"
                label={<span className="font-semibold text-xs">Phạm vi sản phẩm áp dụng</span>}
              >
                <Radio.Group>
                  <Radio value="all">Toàn bộ sản phẩm</Radio>
                  <Radio value="product">Sản phẩm cụ thể</Radio>
                </Radio.Group>
              </Form.Item>

              {scope === "product" ? (
                <Form.Item
                  name="productMasText"
                  label={<span className="font-semibold text-xs">Mã SKU sản phẩm áp dụng (phân cách bằng dấu phẩy)</span>}
                >
                  <Input placeholder="VD: CHAU_SU_01, CHAU_XI_MANG_02" />
                </Form.Item>
              ) : null}

              <Form.Item
                name="excludedProductMasText"
                label={<span className="font-semibold text-xs">Sản phẩm loại trừ (không áp dụng giảm)</span>}
              >
                <Input placeholder="VD: SP_DAC_BIET_01, CAY_CANH_VIP" />
              </Form.Item>
            </div>

            {/* Thời gian & Giới hạn */}
            <div className="rounded-xl border border-slate-100 p-4 bg-white shadow-xs">
              <h4 className="text-sm font-bold text-[var(--aloha-ink)] mb-3 flex items-center gap-1.5">
                <Calendar size={16} className="text-[var(--aloha-green)]" />
                Thời gian & Giới hạn ngân sách
              </h4>
              <Form.Item
                name="timeRange"
                label={<span className="font-semibold text-xs">Thời gian hiệu lực</span>}
              >
                <DatePicker.RangePicker showTime className="w-full" format="YYYY-MM-DD HH:mm" />
              </Form.Item>

              <div className="grid grid-cols-2 gap-3">
                <Form.Item
                  name="usageLimitTotal"
                  label={<span className="font-semibold text-xs">Tổng lượt dùng</span>}
                >
                  <InputNumber className="w-full" min={1} placeholder="Không giới hạn" />
                </Form.Item>
                <Form.Item
                  name="budgetTotal"
                  label={<span className="font-semibold text-xs">Tổng ngân sách (VND)</span>}
                >
                  <InputNumber
                    className="w-full"
                    min={0}
                    step={500000}
                    placeholder="Không giới hạn"
                    formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}
                  />
                </Form.Item>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Form.Item
                  name="status"
                  label={<span className="font-semibold text-xs">Trạng thái</span>}
                >
                  <Select
                    options={[
                      { label: "Đang áp dụng (Active)", value: "active" },
                      { label: "Bản nháp (Draft)", value: "draft" },
                      { label: "Tạm dừng (Paused)", value: "paused" },
                    ]}
                  />
                </Form.Item>
                <Form.Item
                  name="priority"
                  label={<span className="font-semibold text-xs">Độ ưu tiên (Auto-best)</span>}
                >
                  <InputNumber className="w-full" placeholder="0" />
                </Form.Item>
              </div>
            </div>
          </div>

          <div className="mt-6 flex justify-end gap-3 border-t border-slate-100 pt-4">
            <Button onClick={onClose}>Hủy bỏ</Button>
            <Button
              type="primary"
              htmlType="submit"
              loading={submitting}
              className="!bg-[var(--aloha-green)] hover:!bg-[var(--aloha-green-hover)] font-bold px-6"
            >
              {editingItem ? "Lưu thay đổi" : "Tạo chương trình"}
            </Button>
          </div>
        </Form>

        {/* Cột phải: Thẻ Xem trước (Live Preview) */}
        <div>
          <div className="sticky top-4 space-y-3">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Eye size={14} /> Khách sẽ thấy:
            </p>

            {/* Thẻ mô phỏng Storefront */}
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--aloha-green)] text-white">
                  <Ticket size={14} />
                </div>
                <span className="text-xs font-extrabold text-[var(--aloha-green)] uppercase">
                  {previewValues.type === "code" ? "Mã giảm giá" : "Ưu đãi tự động"}
                </span>
              </div>
              <h5 className="text-sm font-bold text-slate-800 leading-snug">
                {previewValues.title || "Tiêu đề ưu đãi"}
              </h5>
              <p className="mt-1 text-xs text-slate-600 line-clamp-2">
                {previewValues.description || "Mô tả điều kiện ưu đãi"}
              </p>

              <div className="mt-3 pt-3 border-t border-emerald-200/60 space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500">Mức giảm:</span>
                  <span className="font-bold text-[var(--aloha-price)]">
                    {previewValues.discountType === "percentage"
                      ? `${previewValues.discountValue || 0}% ${previewValues.maxDiscountVnd ? `(tối đa ${formatVnd(previewValues.maxDiscountVnd)})` : ""}`
                      : formatVnd(previewValues.discountValue || 0)}
                  </span>
                </div>
                {previewValues.minOrderThreshold ? (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Đơn tối thiểu:</span>
                    <span className="font-medium text-slate-700">
                      {previewValues.thresholdOperator === ">=" ? "Từ" : "Trên"}{" "}
                      {formatVnd(previewValues.minOrderThreshold)}
                    </span>
                  </div>
                ) : null}
                <div className="flex justify-between">
                  <span className="text-slate-500">Đối tượng:</span>
                  <span className="font-medium text-slate-700">
                    {previewValues.targetCustomer === "new_web"
                      ? "Khách mua lần đầu"
                      : previewValues.targetCustomer === "wholesale"
                        ? "Khách sỉ"
                        : "Khách lẻ"}
                  </span>
                </div>
              </div>
            </div>

            <div className="rounded-lg bg-amber-50/80 p-3 border border-amber-200/60 text-xs text-amber-900 leading-relaxed">
              <strong className="block font-semibold mb-0.5">Lưu ý nghiệp vụ:</strong>
              • Ưu đãi tự động sẽ được hệ thống tự tính và trừ vào đơn hàng khi thỏa điều kiện mà không cần khách bấm mã.
              <br />
              • Tiền xét ngưỡng là tiền hàng sau giảm từng sản phẩm, trước phí ship.
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}
