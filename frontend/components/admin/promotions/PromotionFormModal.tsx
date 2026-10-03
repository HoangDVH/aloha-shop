"use client";

import { useEffect, useState } from "react";
import { Modal, Form, Button, App } from "antd";
import { X, Sparkles } from "lucide-react";
import { InfoTab } from "./form/InfoTab";
import { ScopeTab } from "./form/ScopeTab";
import {
  SHIPPING_REGION_OPTIONS,
  buildPromotionPayload,
  initialFormValues,
  presetValues,
  type CustomerMode,
  type PresetKey,
  type PromotionItem,
  type TimeMode,
} from "./form/promotionFormModel";

export {
  SHIPPING_REGION_OPTIONS,
  shippingRegionLabel,
  type PromotionItem,
} from "./form/promotionFormModel";

type Props = {
  open: boolean;
  onClose: () => void;
  onSuccess: (savedItem?: PromotionItem) => void;
  onSuccessAndCreateCode?: (savedItem: PromotionItem) => void;
  editingItem?: PromotionItem | null;
};

const PRESETS: { key: PresetKey; label: string }[] = [
  { key: "first10", label: "Khách mới 10%" },
  { key: "bigOrder", label: "Đơn lớn > 1tr" },
  { key: "coupon", label: "Mã voucher 50k" },
  { key: "shipHcm", label: "Hỗ trợ ship HCM 30k" },
];

function PresetBar({ onPick }: { onPick: (k: PresetKey) => void }) {
  return (
    <div className="flex items-center gap-1.5 pb-2 text-xs text-slate-500">
      <span className="flex items-center gap-1 text-slate-400">
        <Sparkles size={12} className="text-amber-500" />
        Mẫu gợi ý:
      </span>
      {PRESETS.map((p, i) => (
        <span key={p.key} className="contents">
          {i > 0 ? "•" : null}
          <button
            type="button"
            onClick={() => onPick(p.key)}
            className="text-[#2D5A27] hover:underline px-2 py-0.5 rounded bg-emerald-50 text-[11px] font-medium border border-emerald-200/60"
          >
            {p.label}
          </button>
        </span>
      ))}
    </div>
  );
}

function TabButton(props: { active: boolean; onClick: () => void; children: string }) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      className={`pb-2.5 transition border-b-2 -mb-[2px] ${
        props.active
          ? "border-[#2D5A27] text-[#2D5A27]"
          : "border-transparent text-slate-600 hover:text-slate-900"
      }`}
    >
      {props.children}
    </button>
  );
}

export function PromotionFormModal({
  open,
  onClose,
  onSuccess,
  onSuccessAndCreateCode,
  editingItem,
}: Props) {
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState("info");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [timeMode, setTimeMode] = useState<TimeMode>("range");
  const [customerMode, setCustomerMode] = useState<CustomerMode>("all");
  const toggle = (key: string) => setCollapsed((c) => ({ ...c, [key]: !c[key] }));

  useEffect(() => {
    if (!open) return;
    setActiveTab("info");
    const values = initialFormValues(editingItem);
    setTimeMode(values.timeMode as TimeMode);
    setCustomerMode(values.customerMode as CustomerMode);
    form.setFieldsValue(values);
  }, [open, editingItem, form]);

  const switchBenefitType = (next: "goods" | "shipping") => {
    form.setFieldValue("benefitType", next);
    if (next !== "shipping") return;
    const currentValue = Number(form.getFieldValue("discountValue")) || 0;
    form.setFieldsValue({
      discountType: "fixed",
      discountValue:
        form.getFieldValue("discountType") === "fixed" && currentValue > 0 ? currentValue : 30000,
      maxDiscountVnd: undefined,
      isAutoApply: true,
      regionId: form.getFieldValue("regionId") || SHIPPING_REGION_OPTIONS[0].value,
    });
  };

  const applyPreset = (preset: PresetKey) => {
    if (preset !== "shipHcm") form.setFieldValue("benefitType", "goods");
    const p = presetValues(preset);
    form.setFieldsValue(p.values);
    setCustomerMode(p.customerMode);
  };

  /** Chặn lưu voucher ship thiếu vùng / tổng lượt; trả false nếu đã báo lỗi. */
  const checkShippingRequired = (values: any): boolean => {
    if (values.benefitType !== "shipping") return true;
    if (!values.regionId) {
      setActiveTab("info");
      message.warning("Chọn vùng áp dụng cho voucher hỗ trợ ship");
      return false;
    }
    if (!(Number(values.usageLimitTotal) >= 1)) {
      setActiveTab("scope");
      setCollapsed((c) => ({ ...c, nganSach: false }));
      message.warning("Voucher hỗ trợ ship bắt buộc nhập tổng lượt dùng");
      return false;
    }
    return true;
  };

  const handleSave = async (andCreateCode = false) => {
    try {
      await form.validateFields();
      // Tab đang ẩn bị unmount: validateFields() chỉ trả field đang hiển thị.
      const values = form.getFieldsValue(true);
      if (!checkShippingRequired(values)) return;
      setSubmitting(true);
      const payload = buildPromotionPayload(values, customerMode, editingItem);
      const url = editingItem
        ? `/api/shop/admin/promotions/${editingItem.id}`
        : "/api/shop/admin/promotions";
      const res = await fetch(url, {
        method: editingItem ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Không thể lưu đợt phát hành voucher");
      }
      const savedPromo: PromotionItem = data.item || { ...payload, id: editingItem?.id || data.id };
      message.success(
        editingItem ? "Đã cập nhật đợt phát hành voucher" : "Đã tạo đợt phát hành voucher thành công"
      );
      if (andCreateCode && onSuccessAndCreateCode) onSuccessAndCreateCode(savedPromo);
      else onSuccess(savedPromo);
    } catch (e: any) {
      if (e?.errorFields) message.warning("Vui lòng điền đầy đủ các thông tin bắt buộc");
      else message.error(e?.message || "Lỗi lưu đợt phát hành voucher");
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
      destroyOnHidden
      styles={{ body: { padding: 0 } }}
      className="[&_.ant-modal-content]:!p-0 [&_.ant-modal-content]:!rounded-xl [&_.ant-modal-content]:!overflow-hidden [&_.ant-modal-content]:!shadow-xl"
    >
      <div className="flex flex-col bg-white text-slate-800">
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
          {!editingItem ? <PresetBar onPick={applyPreset} /> : null}
          <div className="flex border-b border-slate-200 gap-8 text-sm font-semibold">
            <TabButton active={activeTab === "info"} onClick={() => setActiveTab("info")}>
              Thông tin
            </TabButton>
            <TabButton active={activeTab === "scope"} onClick={() => setActiveTab("scope")}>
              Phạm vi áp dụng
            </TabButton>
          </div>
        </div>

        <div
          id="kiotviet-modal-scroll"
          className="px-6 py-5 overflow-y-auto max-h-[calc(85vh-160px)] space-y-4 pb-8"
        >
          <Form form={form} layout="vertical" requiredMark={false}>
            {activeTab === "info" ? (
              <InfoTab
                form={form}
                editingItem={editingItem}
                isShipping={isShipping}
                discountType={discountType}
                scope={scope}
                timeMode={timeMode}
                setTimeMode={setTimeMode}
                onBenefitTypeChange={switchBenefitType}
                collapsed={collapsed}
                toggle={toggle}
              />
            ) : (
              <ScopeTab
                form={form}
                isShipping={isShipping}
                customerMode={customerMode}
                setCustomerMode={setCustomerMode}
                defaultShipBudget={defaultShipBudget}
                shipBudgetTooLow={shipBudgetTooLow}
                collapsed={collapsed}
                toggle={toggle}
              />
            )}
          </Form>
        </div>

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
              className="!h-9 !px-4 !rounded-md border-slate-300 text-slate-700 hover:!text-[#2D5A27] hover:!border-[#2D5A27] font-medium"
            >
              Lưu &amp; Tạo mã voucher
            </Button>
          ) : null}
          <Button
            type="primary"
            onClick={() => handleSave(false)}
            loading={submitting}
            className="!h-9 !px-6 !rounded-md !bg-[#2D5A27] hover:!bg-[#23481e] font-bold text-white shadow-xs cursor-pointer"
          >
            Lưu (F9)
          </Button>
        </div>
      </div>
    </Modal>
  );
}
