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
  Checkbox,
  message,
  Tabs,
  Tooltip,
} from "antd";
import {
  X,
  Info,
  ChevronUp,
  ChevronDown,
  Sparkles,
  Ticket,
  Calendar,
  CheckCircle2,
} from "lucide-react";
import dayjs from "dayjs";

export const SHIPPING_REGION_OPTIONS = [
  { value: "hcm_pre_2025", label: "TP.HCM (ranh giới trước 01/07/2025)" },
];

export function shippingRegionLabel(regionId?: string): string {
  return SHIPPING_REGION_OPTIONS.find((r) => r.value === regionId)?.label || regionId || "—";
}

const formatThousands = (v: unknown) => `${v ?? ""}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
const parseThousands = (v: string | undefined) => Number(String(v || "").replace(/[^\d.]/g, "")) || 0;

export interface PromotionItem {
  id: string;
  name: string;
  title: string;
  description?: string;
  type: "auto" | "code";
  benefitType?: "goods" | "shipping";
  regionId?: string;
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
  onSuccess: (savedItem?: PromotionItem) => void;
  onSuccessAndCreateCode?: (savedItem: PromotionItem) => void;
  editingItem?: PromotionItem | null;
};

export function PromotionFormModal({
  open,
  onClose,
  onSuccess,
  onSuccessAndCreateCode,
  editingItem,
}: Props) {
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState("info");

  // Accordion collapse state matching KiotViet
  const [collapseHieuLuc, setCollapseHieuLuc] = useState(false);
  const [collapseDieuKien, setCollapseDieuKien] = useState(false);
  const [collapseChiNhanh, setCollapseChiNhanh] = useState(false);
  const [collapseNhomKhach, setCollapseNhomKhach] = useState(false);
  const [collapseNganSach, setCollapseNganSach] = useState(false);

  // Time validity mode: "range" | "unlimited"
  const [timeMode, setTimeMode] = useState<"range" | "unlimited">("range");
  // Customer mode: "all" | "specific"
  const [customerMode, setCustomerMode] = useState<"all" | "specific">("all");

  useEffect(() => {
    if (!open) return;
    setActiveTab("info");

    if (editingItem) {
      const hasDates = !!(editingItem.startDate && editingItem.endDate);
      setTimeMode(hasDates ? "range" : "unlimited");
      const isSpecificCust = editingItem.targetCustomer && editingItem.targetCustomer !== "all";
      setCustomerMode(isSpecificCust ? "specific" : "all");

      form.setFieldsValue({
        benefitType: editingItem.benefitType || "goods",
        regionId: editingItem.regionId || SHIPPING_REGION_OPTIONS[0].value,
        name: editingItem.name,
        code: editingItem.id || "",
        discountValue: editingItem.discountValue || 0,
        discountType: editingItem.discountType || "percentage",
        maxDiscountVnd: editingItem.maxDiscountVnd,
        timeMode: hasDates ? "range" : "unlimited",
        timeRange: hasDates
          ? [dayjs(editingItem.startDate), dayjs(editingItem.endDate)]
          : [dayjs(), dayjs().add(6, "month")],
        status: editingItem.status === "active" ? "active" : "draft",
        minOrderThreshold: editingItem.minOrderThreshold || 0,
        scope: editingItem.scope || "all",
        productMasText: editingItem.productMas?.join(", ") || "",
        excludedProductMasText: editingItem.excludedProductMas?.join(", ") || "",
        description: editingItem.description || "",
        isAutoApply: editingItem.type === "auto",
        allowStack: false,
        branchScope: "all",
        customerMode: isSpecificCust ? "specific" : "all",
        targetCustomer: editingItem.targetCustomer || "all",
        usageLimitTotal: editingItem.usageLimitTotal,
        usageLimitPerCustomer: editingItem.usageLimitPerCustomer,
        budgetTotal: editingItem.budgetTotal,
        priority: editingItem.priority || 0,
      });
    } else {
      // Default new promotion
      setTimeMode("range");
      setCustomerMode("all");
      form.setFieldsValue({
        benefitType: "goods",
        regionId: SHIPPING_REGION_OPTIONS[0].value,
        name: "",
        code: "",
        discountValue: 10,
        discountType: "percentage",
        maxDiscountVnd: 200000,
        timeMode: "range",
        timeRange: [dayjs(), dayjs().add(6, "month")],
        status: "active",
        minOrderThreshold: 0,
        scope: "all",
        productMasText: "",
        excludedProductMasText: "",
        description: "",
        isAutoApply: true,
        allowStack: false,
        branchScope: "all",
        customerMode: "all",
        targetCustomer: "all",
        usageLimitTotal: undefined,
        usageLimitPerCustomer: undefined,
        budgetTotal: undefined,
        priority: 0,
      });
    }
  }, [open, editingItem, form]);

  const switchBenefitType = (next: "goods" | "shipping") => {
    form.setFieldValue("benefitType", next);
    if (next === "shipping") {
      const currentValue = Number(form.getFieldValue("discountValue")) || 0;
      form.setFieldsValue({
        discountType: "fixed",
        discountValue: form.getFieldValue("discountType") === "fixed" && currentValue > 0 ? currentValue : 30000,
        maxDiscountVnd: undefined,
        isAutoApply: true,
        regionId: form.getFieldValue("regionId") || SHIPPING_REGION_OPTIONS[0].value,
      });
    }
  };

  const applyPreset = (preset: "first10" | "bigOrder" | "coupon" | "shipHcm") => {
    if (preset !== "shipHcm") form.setFieldValue("benefitType", "goods");
    if (preset === "shipHcm") {
      form.setFieldsValue({
        benefitType: "shipping",
        regionId: SHIPPING_REGION_OPTIONS[0].value,
        name: "Hỗ trợ phí ship nội thành TP.HCM 30k",
        discountType: "fixed",
        discountValue: 30000,
        maxDiscountVnd: undefined,
        minOrderThreshold: 0,
        isAutoApply: true,
        customerMode: "all",
        targetCustomer: "all",
        usageLimitTotal: 100,
        usageLimitPerCustomer: 1,
        budgetTotal: undefined,
        description: "Tự động giảm tối đa 30.000đ phí giao hàng cho địa chỉ TP.HCM (ranh giới cũ)",
      });
      setCustomerMode("all");
    } else if (preset === "first10") {
      form.setFieldsValue({
        name: "Ưu đãi khách mới web 10%",
        discountType: "percentage",
        discountValue: 10,
        maxDiscountVnd: 200000,
        minOrderThreshold: 0,
        isAutoApply: true,
        customerMode: "specific",
        targetCustomer: "new_web",
        description: "Tự động áp dụng cho khách hàng chưa từng mua trên website",
      });
      setCustomerMode("specific");
    } else if (preset === "bigOrder") {
      form.setFieldsValue({
        name: "Ưu đãi đơn hàng trên 1 triệu (Giảm 100k)",
        discountType: "fixed",
        discountValue: 100000,
        maxDiscountVnd: undefined,
        minOrderThreshold: 1000000,
        isAutoApply: true,
        customerMode: "all",
        targetCustomer: "retail",
        description: "Tự động giảm 100k khi tổng tiền hàng đạt từ 1.000.000đ",
      });
      setCustomerMode("all");
    } else if (preset === "coupon") {
      form.setFieldsValue({
        name: "Mã giảm giá chiến dịch 50k",
        discountType: "fixed",
        discountValue: 50000,
        maxDiscountVnd: undefined,
        minOrderThreshold: 300000,
        isAutoApply: false,
        customerMode: "all",
        targetCustomer: "all",
        description: "Khách nhập mã khuyến mại trong giỏ hàng hoặc xác nhận đơn hàng",
      });
      setCustomerMode("all");
    }
  };

  const handleSave = async (andCreateCode = false) => {
    try {
      await form.validateFields();
      // Tab đang ẩn bị unmount: validateFields() chỉ trả field đang hiển thị.
      const values = form.getFieldsValue(true);
      const isShipping = values.benefitType === "shipping";
      if (isShipping) {
        if (!values.regionId) {
          setActiveTab("info");
          message.warning("Chọn vùng áp dụng cho voucher hỗ trợ ship");
          return;
        }
        if (!(Number(values.usageLimitTotal) >= 1)) {
          setActiveTab("scope");
          setCollapseNganSach(false);
          message.warning("Voucher hỗ trợ ship bắt buộc nhập tổng lượt dùng");
          return;
        }
      }
      setSubmitting(true);

      const productMas = String(values.productMasText || "")
        .split(/[,;\s]+/)
        .map((m) => m.trim().toUpperCase())
        .filter(Boolean);
      const excludedProductMas = String(values.excludedProductMasText || "")
        .split(/[,;\s]+/)
        .map((m) => m.trim().toUpperCase())
        .filter(Boolean);

      let startDate: string | undefined;
      let endDate: string | undefined;
      if (values.timeMode === "range" && values.timeRange) {
        startDate = values.timeRange[0]?.toISOString();
        endDate = values.timeRange[1]?.toISOString();
      }

      const specificTarget =
        values.targetCustomer && values.targetCustomer !== "all" ? values.targetCustomer : "retail";
      const targetCustomer = customerMode === "all" ? "all" : specificTarget;
      const discountType = isShipping ? "fixed" : values.discountType || "percentage";
      const optionalNumber = (v: unknown) => (v ? Number(v) : null);

      const payload = {
        name: values.name,
        title: values.name,
        description: values.description,
        benefitType: isShipping ? "shipping" : "goods",
        regionId: isShipping ? values.regionId : undefined,
        type: isShipping || values.isAutoApply ? "auto" : "code",
        discountType,
        discountValue: Number(values.discountValue) || 0,
        maxDiscountVnd:
          discountType === "percentage" && values.maxDiscountVnd
            ? Number(values.maxDiscountVnd)
            : undefined,
        minOrderThreshold: Number(values.minOrderThreshold) || 0,
        thresholdOperator: ">=",
        scope: values.scope || "all",
        productMas,
        excludedProductMas,
        targetCustomer,
        startDate,
        endDate,
        usageLimitTotal: optionalNumber(values.usageLimitTotal),
        usageLimitPerCustomer: optionalNumber(values.usageLimitPerCustomer),
        budgetTotal: optionalNumber(values.budgetTotal),
        status: values.status || "active",
        priority: Number(values.priority) || 0,
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
        throw new Error(data.error || "Không thể lưu đợt phát hành voucher");
      }

      const savedPromo: PromotionItem = data.item || {
        ...payload,
        id: editingItem?.id || data.id,
      };

      message.success(
        editingItem ? "Đã cập nhật đợt phát hành voucher" : "Đã tạo đợt phát hành voucher thành công"
      );

      if (andCreateCode && onSuccessAndCreateCode) {
        onSuccessAndCreateCode(savedPromo);
      } else {
        onSuccess(savedPromo);
      }
    } catch (e: any) {
      if (e?.errorFields) {
        message.warning("Vui lòng điền đầy đủ các thông tin bắt buộc");
      } else {
        message.error(e?.message || "Lỗi lưu đợt phát hành voucher");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const discountType = Form.useWatch("discountType", form);
  const scope = Form.useWatch("scope", form);
  const benefitType = Form.useWatch("benefitType", { form, preserve: true });
  const watchedDiscountValue = Form.useWatch("discountValue", { form, preserve: true });
  const watchedUsageLimitTotal = Form.useWatch("usageLimitTotal", { form, preserve: true });
  const watchedBudgetTotal = Form.useWatch("budgetTotal", { form, preserve: true });
  const isShipping = benefitType === "shipping";
  const defaultShipBudget =
    isShipping && Number(watchedUsageLimitTotal) > 0 && Number(watchedDiscountValue) > 0
      ? Number(watchedUsageLimitTotal) * Number(watchedDiscountValue)
      : null;
  const shipBudgetTooLow =
    defaultShipBudget != null &&
    Number(watchedBudgetTotal) > 0 &&
    Number(watchedBudgetTotal) < defaultShipBudget;

  return (
    <Modal
      open={open}
      onCancel={onClose}
      width={780}
      centered
      closable={false}
      footer={null}
      destroyOnClose
      styles={{
        body: { padding: 0 },
      }}
      className="[&_.ant-modal-content]:!p-0 [&_.ant-modal-content]:!rounded-xl [&_.ant-modal-content]:!overflow-hidden [&_.ant-modal-content]:!shadow-xl"
    >
      <div className="flex flex-col bg-white text-slate-800">
        {/* ========================================================================= */}
        {/* 1. HEADER CHUẨN KIOTVIET (Theo đúng Ảnh 1, 2, 3, 4)                       */}
        {/* ========================================================================= */}
        <div className="px-6 pt-5 pb-0 bg-white">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-xl font-bold text-slate-800">
              {editingItem ? "Cập nhật đợt phát hành voucher" : "Tạo đợt phát hành voucher"}
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="text-slate-400 hover:text-slate-700 transition p-1 rounded-md"
              aria-label="Đóng"
            >
              <X size={20} />
            </button>
          </div>

          {/* Quick presets helper bar */}
          {!editingItem ? (
            <div className="flex items-center gap-1.5 pb-2 text-xs text-slate-500">
              <span className="flex items-center gap-1 text-slate-400">
                <Sparkles size={12} className="text-amber-500" />
                Mẫu gợi ý:
              </span>
              <button
                type="button"
                onClick={() => applyPreset("first10")}
                className="text-blue-600 hover:underline px-1.5 py-0.5 rounded bg-blue-50/60 text-[11px] font-medium"
              >
                Khách mới 10%
              </button>
              •
              <button
                type="button"
                onClick={() => applyPreset("bigOrder")}
                className="text-blue-600 hover:underline px-1.5 py-0.5 rounded bg-blue-50/60 text-[11px] font-medium"
              >
                Đơn lớn &gt; 1tr
              </button>
              •
              <button
                type="button"
                onClick={() => applyPreset("coupon")}
                className="text-blue-600 hover:underline px-1.5 py-0.5 rounded bg-blue-50/60 text-[11px] font-medium"
              >
                Mã voucher 50k
              </button>
              •
              <button
                type="button"
                onClick={() => applyPreset("shipHcm")}
                className="text-blue-600 hover:underline px-1.5 py-0.5 rounded bg-blue-50/60 text-[11px] font-medium"
              >
                Hỗ trợ ship HCM 30k
              </button>
            </div>
          ) : null}

          {/* Tabs Navigation (Ảnh 1 & 3): [Thông tin] [Phạm vi áp dụng] */}
          <div className="flex border-b border-slate-200 gap-8 text-sm font-semibold">
            <button
              type="button"
              onClick={() => setActiveTab("info")}
              className={`pb-2.5 transition border-b-2 -mb-[2px] ${
                activeTab === "info"
                  ? "border-[#0070e0] text-[#0070e0]"
                  : "border-transparent text-slate-600 hover:text-slate-900"
              }`}
            >
              Thông tin
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("scope")}
              className={`pb-2.5 transition border-b-2 -mb-[2px] ${
                activeTab === "scope"
                  ? "border-[#0070e0] text-[#0070e0]"
                  : "border-transparent text-slate-600 hover:text-slate-900"
              }`}
            >
              Phạm vi áp dụng
            </button>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 2. BODY CONTENT: Cuộn mượt, chuẩn 100% bố cục KiotViet                    */}
        {/* ========================================================================= */}
        <div
          id="kiotviet-modal-scroll"
          className="px-6 py-5 overflow-y-auto max-h-[calc(85vh-160px)] space-y-4 pb-8"
        >
          <Form form={form} layout="vertical" requiredMark={false}>
            {/* -------------------- TAB 1: THÔNG TIN (ẢNH 1, 2, 4) -------------------- */}
            {activeTab === "info" ? (
              <div className="space-y-4">
                <div className="flex items-center gap-4 flex-wrap text-xs text-slate-700">
                  <span className="font-semibold text-slate-700">Loại ưu đãi</span>
                  <Form.Item name="benefitType" noStyle>
                    <Radio.Group
                      onChange={(e) => switchBenefitType(e.target.value)}
                      disabled={
                        !!editingItem &&
                        (editingItem.usedCount || 0) + (editingItem.heldCount || 0) > 0
                      }
                    >
                      <Radio value="goods">Giảm tiền hàng</Radio>
                      <Radio value="shipping">Hỗ trợ phí ship</Radio>
                    </Radio.Group>
                  </Form.Item>
                  {isShipping ? (
                    <span className="inline-flex items-center gap-2">
                      <span className="font-medium text-slate-600">Vùng áp dụng</span>
                      <Form.Item name="regionId" noStyle>
                        <Select className="!w-72 !h-8" options={SHIPPING_REGION_OPTIONS} />
                      </Form.Item>
                    </span>
                  ) : null}
                </div>
                {isShipping ? (
                  <p className="text-[11px] text-slate-500 -mt-2">
                    Tự áp dụng khi giao hàng tận nơi, địa chỉ thuộc vùng và đơn chưa được miễn ship. Giảm
                    tối đa bằng mệnh giá, không vượt phí ship thực tế. Dùng chung được với ưu đãi giảm
                    tiền hàng.
                  </p>
                ) : null}

                {/* Hàng 1 (3 Cột): Tên đợt phát hành | Mã đợt phát hành | Mệnh giá */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-3.5 items-start">
                  <div className="md:col-span-5">
                    <Form.Item
                      name="name"
                      label={<span className="text-xs font-semibold text-slate-700">Tên đợt phát hành</span>}
                      rules={[{ required: true, message: "Vui lòng nhập tên đợt phát hành" }]}
                      className="!mb-0"
                    >
                      <Input
                        placeholder="Bắt buộc"
                        className="!h-9 !rounded-md border-slate-300 focus:!border-[#0070e0]"
                      />
                    </Form.Item>
                  </div>

                  <div className="md:col-span-3">
                    <Form.Item
                      name="code"
                      label={
                        <span className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                          Mã đợt phát hành
                          <Tooltip title="Để trống hệ thống sẽ tự sinh mã quản lý">
                            <Info size={13} className="text-slate-400 cursor-pointer" />
                          </Tooltip>
                        </span>
                      }
                      className="!mb-0"
                    >
                      <Input
                        placeholder="Tự động"
                        className="!h-9 !rounded-md border-slate-300 text-slate-500 bg-slate-50/50"
                      />
                    </Form.Item>
                  </div>

                  <div className="md:col-span-4">
                    <Form.Item
                      label={
                        <span className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                          Mệnh giá
                          <Tooltip
                            title={
                              isShipping
                                ? "Số tiền phí ship tối đa được hỗ trợ mỗi đơn (VNĐ)"
                                : "Giá trị chiết khấu khi áp dụng voucher (theo VNĐ hoặc %)"
                            }
                          >
                            <Info size={13} className="text-slate-400 cursor-pointer" />
                          </Tooltip>
                        </span>
                      }
                      required
                      className="!mb-0"
                    >
                      <div className="flex gap-1.5">
                        <Form.Item
                          name="discountValue"
                          noStyle
                          rules={[{ required: true, message: "Nhập mệnh giá" }]}
                        >
                          <InputNumber
                            className="flex-1 !h-9 !rounded-md border-slate-300 font-semibold text-slate-900"
                            min={1}
                            formatter={formatThousands}
                            parser={parseThousands}
                          />
                        </Form.Item>
                        <Form.Item name="discountType" noStyle>
                          <Select
                            className="!w-20 !h-9"
                            disabled={isShipping}
                            options={[
                              { label: "%", value: "percentage" },
                              { label: "VND", value: "fixed" },
                            ]}
                          />
                        </Form.Item>
                      </div>
                    </Form.Item>
                  </div>
                </div>

                {/* Khối Accordion 1: HIỆU LỰC (Ảnh 1, 2) */}
                <div className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-2xs">
                  <div
                    onClick={() => setCollapseHieuLuc(!collapseHieuLuc)}
                    className="flex items-center justify-between cursor-pointer font-bold text-slate-800 text-sm pb-2 border-b border-slate-100 select-none"
                  >
                    <span>Hiệu lực</span>
                    {collapseHieuLuc ? (
                      <ChevronDown size={18} className="text-slate-400" />
                    ) : (
                      <ChevronUp size={18} className="text-slate-400" />
                    )}
                  </div>

                  {!collapseHieuLuc && (
                    <div className="pt-3.5 space-y-3.5 text-xs text-slate-700">
                      {/* Dòng hiệu lực thời gian */}
                      <div className="flex items-center gap-4 flex-wrap">
                        <span className="w-16 font-medium text-slate-600">Hiệu lực</span>
                        <Radio.Group
                          value={timeMode}
                          onChange={(e) => {
                            setTimeMode(e.target.value);
                            form.setFieldValue("timeMode", e.target.value);
                          }}
                          className="flex items-center gap-4 flex-wrap"
                        >
                          <Radio value="range">
                            <span className="inline-flex items-center gap-2">
                              <span>Từ</span>
                              <Form.Item name="timeRange" noStyle>
                                <DatePicker.RangePicker
                                  format="DD/MM/YYYY"
                                  className="!h-8 !rounded-md border-slate-300"
                                  placeholder={["28/09/2026", "28/03/2027"]}
                                  disabled={timeMode !== "range"}
                                />
                              </Form.Item>
                            </span>
                          </Radio>

                          <Radio value="unlimited">
                            <span className="text-slate-600">Không giới hạn thời gian</span>
                          </Radio>
                        </Radio.Group>
                      </div>

                      {/* Dòng trạng thái */}
                      <div className="flex items-center gap-4">
                        <span className="w-16 font-medium text-slate-600">Trạng thái</span>
                        <Form.Item name="status" noStyle>
                          <Radio.Group className="flex items-center gap-6">
                            <Radio value="active">Đang kích hoạt</Radio>
                            <Radio value="draft">Chưa kích hoạt</Radio>
                          </Radio.Group>
                        </Form.Item>
                      </div>
                    </div>
                  )}
                </div>

                {/* Khối Accordion 2: ĐIỀU KIỆN MUA HÀNG (Ảnh 1, 4) */}
                <div className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-2xs">
                  <div
                    onClick={() => setCollapseDieuKien(!collapseDieuKien)}
                    className="flex items-center justify-between cursor-pointer font-bold text-slate-800 text-sm pb-2 border-b border-slate-100 select-none"
                  >
                    <span>Điều kiện mua hàng</span>
                    {collapseDieuKien ? (
                      <ChevronDown size={18} className="text-slate-400" />
                    ) : (
                      <ChevronUp size={18} className="text-slate-400" />
                    )}
                  </div>

                  {!collapseDieuKien && (
                    <div className="pt-3.5 space-y-3.5 text-xs text-slate-700">
                      {/* Tổng tiền hàng tối thiểu từ */}
                      <div className="flex items-center gap-3">
                        <span className="min-w-[170px] font-medium text-slate-600 flex items-center gap-1">
                          Tổng tiền hàng tối thiểu từ
                          {isShipping ? (
                            <Tooltip title="Tính trên tiền hàng đủ điều kiện, chưa trừ mã giảm toàn đơn">
                              <Info size={13} className="text-slate-400 cursor-pointer" />
                            </Tooltip>
                          ) : null}
                        </span>
                        <Form.Item name="minOrderThreshold" noStyle>
                          <InputNumber
                            className="!w-44 !h-8 !rounded-md border-slate-300"
                            min={0}
                            step={50000}
                            formatter={formatThousands}
                            parser={parseThousands}
                            addonAfter="VND"
                          />
                        </Form.Item>
                      </div>

                      {/* Trong đơn có */}
                      <div className="flex items-center gap-3">
                        <span className="min-w-[170px] font-medium text-slate-600 flex items-center gap-1">
                          Trong đơn có
                        </span>
                        <div className="flex items-center gap-2 flex-1">
                          <Form.Item name="scope" noStyle>
                            <Select
                              className="!w-32 !h-8"
                              options={[
                                { label: "Toàn bộ hàng", value: "all" },
                                { label: "Hàng chỉ định", value: "product" },
                              ]}
                            />
                          </Form.Item>

                          {scope === "product" ? (
                            <Form.Item name="productMasText" noStyle>
                              <Input
                                placeholder="Nhập các mã SKU hàng mua (cách nhau bởi dấu phẩy)..."
                                className="!h-8 !rounded-md flex-1 border-slate-300"
                              />
                            </Form.Item>
                          ) : (
                            <span className="text-slate-400 italic text-xs">
                              Áp dụng cho mọi sản phẩm trong đơn
                            </span>
                          )}

                          <Tooltip title="Chọn áp dụng cho toàn bộ hàng hoặc lọc danh sách mã SKU cụ thể">
                            <Info size={14} className="text-slate-400 cursor-pointer" />
                          </Tooltip>
                        </div>
                      </div>

                      {/* Mức trần tối đa nếu chọn % */}
                      {discountType === "percentage" ? (
                        <div className="flex items-center gap-3 pt-1 border-t border-slate-100">
                          <span className="min-w-[170px] font-medium text-slate-600 flex items-center gap-1">
                            Mức trần giảm tối đa
                            <Tooltip title="Giới hạn số tiền giảm tối đa để tránh thất thoát với đơn hàng lớn">
                              <Info size={13} className="text-slate-400 cursor-pointer" />
                            </Tooltip>
                          </span>
                          <Form.Item name="maxDiscountVnd" noStyle>
                            <InputNumber
                              className="!w-44 !h-8 !rounded-md border-slate-300"
                              min={0}
                              step={10000}
                              placeholder="Không giới hạn"
                              formatter={formatThousands}
                              parser={parseThousands}
                              addonAfter="VND"
                            />
                          </Form.Item>
                        </div>
                      ) : null}
                    </div>
                  )}
                </div>

                {/* Khối Ghi chú (Ảnh 1, 4) */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Ghi chú
                  </label>
                  <Form.Item name="description" className="!mb-2">
                    <Input.TextArea
                      rows={2}
                      placeholder="Nhập ghi chú"
                      className="!rounded-md border-slate-300"
                    />
                  </Form.Item>
                </div>

                {/* Các Checkbox tùy chọn (Ảnh 4) */}
                <div className="space-y-2 pt-1 text-xs text-slate-700">
                  <div>
                    <Form.Item name="isAutoApply" valuePropName="checked" noStyle>
                      <Checkbox disabled={isShipping}>
                        <span className="font-medium text-slate-800">
                          Áp dụng tự động trên website khi thỏa điều kiện (⚡ Ưu đãi tự động)
                        </span>
                      </Checkbox>
                    </Form.Item>
                    <p className="text-[11px] text-slate-400 ml-6 mt-0.5">
                      {isShipping
                        ? "Voucher hỗ trợ ship luôn tự áp dụng, không phát mã."
                        : "Nếu bỏ chọn, voucher chỉ kích hoạt khi khách hàng nhập mã coupon vào ô mã giảm giá."}
                    </p>
                  </div>

                  <div>
                    <Form.Item name="allowStack" valuePropName="checked" noStyle>
                      <Checkbox>
                        <span className="text-slate-600 flex items-center gap-1">
                          Cho phép gộp nhiều voucher trên một hóa đơn
                          <Tooltip title="Chính sách kết hợp nhiều voucher cùng lúc trên đơn hàng">
                            <Info size={13} className="text-slate-400 cursor-pointer" />
                          </Tooltip>
                        </span>
                      </Checkbox>
                    </Form.Item>
                  </div>
                </div>
              </div>
            ) : (
              /* -------------------- TAB 2: PHẠM VI ÁP DỤNG (ẢNH 3) -------------------- */
              <div className="space-y-4">
                {/* Khối 1: Chi nhánh / Kênh bán */}
                <div className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-2xs">
                  <div
                    onClick={() => setCollapseChiNhanh(!collapseChiNhanh)}
                    className="flex items-center justify-between cursor-pointer font-bold text-slate-800 text-sm pb-2 border-b border-slate-100 select-none"
                  >
                    <span>Chi nhánh & Kênh bán</span>
                    {collapseChiNhanh ? (
                      <ChevronDown size={18} className="text-slate-400" />
                    ) : (
                      <ChevronUp size={18} className="text-slate-400" />
                    )}
                  </div>

                  {!collapseChiNhanh && (
                    <div className="pt-3.5 text-xs text-slate-700">
                      <Form.Item name="branchScope" noStyle>
                        <Radio.Group className="flex flex-col gap-2.5">
                          <Radio value="all">Toàn hệ thống (Website Aloha & Cửa hàng)</Radio>
                          <Radio value="web_only">Chỉ áp dụng trên Website Aloha Online</Radio>
                        </Radio.Group>
                      </Form.Item>
                    </div>
                  )}
                </div>

                {/* Khối 2: Nhóm khách hàng (Ảnh 3) */}
                <div className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-2xs">
                  <div
                    onClick={() => setCollapseNhomKhach(!collapseNhomKhach)}
                    className="flex items-center justify-between cursor-pointer font-bold text-slate-800 text-sm pb-2 border-b border-slate-100 select-none"
                  >
                    <span>Nhóm khách hàng</span>
                    {collapseNhomKhach ? (
                      <ChevronDown size={18} className="text-slate-400" />
                    ) : (
                      <ChevronUp size={18} className="text-slate-400" />
                    )}
                  </div>

                  {!collapseNhomKhach && (
                    <div className="pt-3.5 space-y-3 text-xs text-slate-700">
                      <Radio.Group
                        value={customerMode}
                        onChange={(e) => {
                          setCustomerMode(e.target.value);
                          form.setFieldValue("customerMode", e.target.value);
                          const currentTarget = form.getFieldValue("targetCustomer");
                          if (e.target.value === "specific" && (!currentTarget || currentTarget === "all")) {
                            form.setFieldValue("targetCustomer", "retail");
                          }
                        }}
                        className="flex flex-col gap-2.5"
                      >
                        <Radio value="all">Tất cả</Radio>
                        <Radio value="specific">
                          <span className="inline-flex items-center gap-2">
                            <span>Nhóm khách hàng cụ thể:</span>
                            <Form.Item name="targetCustomer" noStyle>
                              <Select
                                className="!w-64 !h-8"
                                disabled={customerMode !== "specific"}
                                options={[
                                  { label: "⭐ Khách mua lần đầu trên Web (New Web)", value: "new_web" },
                                  { label: "👤 Khách mua lẻ (Retail)", value: "retail" },
                                  { label: "💼 Khách đại lý / Sỉ (Wholesale)", value: "wholesale" },
                                ]}
                              />
                            </Form.Item>
                          </span>
                        </Radio>
                      </Radio.Group>
                    </div>
                  )}
                </div>

                {/* Khối 3: Ngân sách & Giới hạn phát hành */}
                <div className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-2xs">
                  <div
                    onClick={() => setCollapseNganSach(!collapseNganSach)}
                    className="flex items-center justify-between cursor-pointer font-bold text-slate-800 text-sm pb-2 border-b border-slate-100 select-none"
                  >
                    <span>Ngân sách & Giới hạn phát hành</span>
                    {collapseNganSach ? (
                      <ChevronDown size={18} className="text-slate-400" />
                    ) : (
                      <ChevronUp size={18} className="text-slate-400" />
                    )}
                  </div>

                  {!collapseNganSach && (
                    <div className="pt-3.5 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-slate-700">
                      <div>
                        <label className="block font-medium text-slate-600 mb-1">
                          Tổng lượt dùng tối đa{isShipping ? " (bắt buộc)" : ""}
                        </label>
                        <Form.Item name="usageLimitTotal" noStyle>
                          <InputNumber
                            className="!w-full !h-8 !rounded-md border-slate-300"
                            min={1}
                            placeholder={isShipping ? "Bắt buộc" : "Không giới hạn"}
                          />
                        </Form.Item>
                      </div>

                      <div>
                        <label className="block font-medium text-slate-600 mb-1 flex items-center gap-1">
                          Lượt dùng mỗi khách
                          <Tooltip title="Khi đặt giới hạn này, khách phải đăng nhập mới được áp dụng ưu đãi">
                            <Info size={12} className="text-slate-400 cursor-pointer" />
                          </Tooltip>
                        </label>
                        <Form.Item name="usageLimitPerCustomer" noStyle>
                          <InputNumber
                            className="!w-full !h-8 !rounded-md border-slate-300"
                            min={1}
                            placeholder="Không giới hạn"
                          />
                        </Form.Item>
                      </div>

                      <div>
                        <label className="block font-medium text-slate-600 mb-1">
                          Tổng ngân sách (VND)
                        </label>
                        <Form.Item name="budgetTotal" noStyle>
                          <InputNumber
                            className="!w-full !h-8 !rounded-md border-slate-300"
                            min={0}
                            step={500000}
                            placeholder={isShipping ? "Mặc định = lượt × mệnh giá" : "Không giới hạn"}
                            formatter={formatThousands}
                            parser={parseThousands}
                            addonAfter="VND"
                          />
                        </Form.Item>
                        {defaultShipBudget != null ? (
                          <p
                            className={`mt-1 text-[11px] ${shipBudgetTooLow ? "text-amber-600" : "text-slate-400"}`}
                          >
                            {shipBudgetTooLow
                              ? `Thấp hơn lượt × mệnh giá (${formatThousands(defaultShipBudget)}đ): có thể hết ngân sách trước khi hết lượt.`
                              : `Lượt × mệnh giá = ${formatThousands(defaultShipBudget)}đ`}
                          </p>
                        ) : null}
                      </div>

                      <div>
                        <label className="block font-medium text-slate-600 mb-1 flex items-center gap-1">
                          Độ ưu tiên áp dụng
                          <Tooltip title="Số càng cao càng ưu tiên áp dụng khi có nhiều ưu đãi cùng thỏa mãn">
                            <Info size={12} className="text-slate-400 cursor-pointer" />
                          </Tooltip>
                        </label>
                        <Form.Item name="priority" noStyle>
                          <InputNumber
                            className="!w-full !h-8 !rounded-md border-slate-300"
                            min={0}
                            max={100}
                            placeholder="0"
                          />
                        </Form.Item>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </Form>
        </div>

        {/* ========================================================================= */}
        {/* 3. FOOTER CHUẨN KIOTVIET (Theo đúng Ảnh 1, 3, 4)                           */}
        {/* ========================================================================= */}
        <div className="px-6 py-3.5 border-t border-slate-200 bg-white flex items-center justify-end gap-2.5">
          <Button
            onClick={onClose}
            disabled={submitting}
            className="!h-9 !px-4 !rounded-md border-slate-300 text-slate-700 hover:text-slate-900 font-medium"
          >
            Bỏ qua
          </Button>

          {!isShipping ? (
            <Button
              onClick={() => handleSave(true)}
              loading={submitting}
              className="!h-9 !px-4 !rounded-md border-slate-300 text-slate-700 hover:text-[#0070e0] font-medium"
            >
              Lưu &amp; Tạo mã voucher
            </Button>
          ) : null}

          <Button
            type="primary"
            onClick={() => handleSave(false)}
            loading={submitting}
            className="!h-9 !px-6 !rounded-md !bg-[#0070e0] hover:!bg-[#005bb5] font-bold text-white shadow-xs cursor-pointer"
          >
            Lưu (F9)
          </Button>
        </div>
      </div>
    </Modal>
  );
}
