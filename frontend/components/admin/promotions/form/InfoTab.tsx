"use client";

import {
  Form,
  Input,
  InputNumber,
  Radio,
  Select,
  DatePicker,
  Checkbox,
  Tooltip,
  type FormInstance,
} from "antd";
import { Info } from "lucide-react";
import { CollapsibleCard } from "./CollapsibleCard";
import { ClaimSection } from "./ClaimSection";
import { MysterySection } from "./MysterySection";
import { AlohaDateRangePicker } from "../AlohaDateRangePicker";
import {
  SHIPPING_REGION_OPTIONS,
  formatThousands,
  parseThousands,
  type PromotionItem,
  type TimeMode,
} from "./promotionFormModel";

export type CollapseProps = {
  collapsed: Record<string, boolean>;
  toggle: (key: string) => void;
};

type Props = CollapseProps & {
  form: FormInstance;
  editingItem?: PromotionItem | null;
  isShipping: boolean;
  discountType?: string;
  scope?: string;
  timeMode: TimeMode;
  setTimeMode: (m: TimeMode) => void;
  onBenefitTypeChange: (next: "goods" | "shipping") => void;
};

const LABEL = "text-xs font-semibold text-slate-700";

function HintIcon({ title, size = 13 }: { title: string; size?: number }) {
  return (
    <Tooltip title={title}>
      <Info size={size} className="text-slate-400 cursor-pointer" />
    </Tooltip>
  );
}

function BenefitTypeRow({ editingItem, isShipping, onBenefitTypeChange }: Props) {
  const locked = !!editingItem && (editingItem.usedCount || 0) + (editingItem.heldCount || 0) > 0;
  return (
    <>
      <div className="flex items-center gap-4 flex-wrap text-xs text-slate-700">
        <span className="font-semibold text-slate-700">Loại ưu đãi</span>
        <Form.Item name="benefitType" noStyle>
          <Radio.Group onChange={(e) => onBenefitTypeChange(e.target.value)} disabled={locked}>
            <Radio value="goods">Giảm tiền hàng</Radio>
            <Radio value="shipping">Hỗ trợ phí ship</Radio>
          </Radio.Group>
        </Form.Item>
        {isShipping ? (
          <span className="inline-flex items-center gap-2">
            <span className="font-medium text-slate-600">Vùng áp dụng</span>
            <Form.Item name="regionId" noStyle>
              <Select className="!w-72 !h-9 [&_.ant-select-selector]:!h-9 [&_.ant-select-selector]:!rounded-lg [&_.ant-select-selection-item]:!leading-[34px]" options={SHIPPING_REGION_OPTIONS} />
            </Form.Item>
          </span>
        ) : null}
      </div>
      {isShipping ? (
        <p className="text-[11px] text-slate-500 -mt-2">
          Tự áp dụng khi giao hàng tận nơi, địa chỉ thuộc vùng và đơn chưa được miễn ship. Giảm tối đa
          bằng mệnh giá, không vượt phí ship thực tế. Dùng chung được với ưu đãi giảm tiền hàng.
        </p>
      ) : null}
    </>
  );
}

function NameCodeValueRow({ isShipping, mysteryOn }: Props & { mysteryOn: boolean }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-12 gap-3.5 items-start">
      <div className="md:col-span-5">
        <Form.Item
          name="name"
          label={<span className={LABEL}>Tên đợt phát hành</span>}
          rules={[{ required: true, message: "Vui lòng nhập tên đợt phát hành" }]}
          className="!mb-0"
        >
          <Input
            placeholder="Bắt buộc"
            className="!h-9 !rounded-md border-slate-300 focus:!border-[#2D5A27]"
          />
        </Form.Item>
      </div>
      <div className="md:col-span-3">
        <Form.Item
          name="code"
          label={
            <span className={`${LABEL} flex items-center gap-1`}>
              Mã đợt phát hành
              <HintIcon title="Để trống hệ thống sẽ tự sinh mã quản lý" />
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
            <span className={`${LABEL} flex items-center gap-1`}>
              Mệnh giá
              <HintIcon
                title={
                  isShipping
                    ? "Số tiền phí ship tối đa được hỗ trợ mỗi đơn (VNĐ)"
                    : mysteryOn
                      ? "Voucher túi mù: mệnh giá do khách bốc trúng theo bảng mức bên dưới"
                      : "Giá trị chiết khấu khi áp dụng voucher (theo VNĐ hoặc %)"
                }
              />
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
                disabled={mysteryOn}
                formatter={formatThousands}
                parser={parseThousands}
              />
            </Form.Item>
            <Form.Item name="discountType" noStyle>
              <Select
                className="!w-20 !h-9"
                disabled={isShipping || mysteryOn}
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
  );
}

function ValiditySection({ form, timeMode, setTimeMode, collapsed, toggle }: Props) {
  return (
    <CollapsibleCard title="Hiệu lực" collapsed={!!collapsed.hieuLuc} onToggle={() => toggle("hieuLuc")}>
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
                <AlohaDateRangePicker
                  disabled={timeMode !== "range"}
                  placeholder={["28/09/2026", "28/03/2027"]}
                  className="min-w-[280px] sm:min-w-[320px]"
                />
              </Form.Item>
            </span>
          </Radio>
          <Radio value="unlimited">
            <span className="text-slate-600">Không giới hạn thời gian</span>
          </Radio>
        </Radio.Group>
      </div>
      <div className="flex items-center gap-4">
        <span className="w-16 font-medium text-slate-600">Trạng thái</span>
        <Form.Item name="status" noStyle>
          <Radio.Group className="flex items-center gap-6">
            <Radio value="active">Đang kích hoạt</Radio>
            <Radio value="draft">Chưa kích hoạt</Radio>
          </Radio.Group>
        </Form.Item>
      </div>
    </CollapsibleCard>
  );
}

function ConditionSection({ isShipping, scope, discountType, collapsed, toggle }: Props) {
  const rowLabel = "min-w-[170px] font-medium text-slate-600 flex items-center gap-1";
  return (
    <CollapsibleCard
      title="Điều kiện mua hàng"
      collapsed={!!collapsed.dieuKien}
      onToggle={() => toggle("dieuKien")}
    >
      <div className="flex items-center gap-3">
        <span className={rowLabel}>
          Tổng tiền hàng tối thiểu từ
          {isShipping ? (
            <HintIcon title="Tính trên tiền hàng đủ điều kiện, chưa trừ mã giảm toàn đơn" />
          ) : null}
        </span>
        <Form.Item name="minOrderThreshold" noStyle>
          <InputNumber
            className="!w-44 !h-9 !rounded-lg [&_.ant-input-number-input]:!h-[34px] font-semibold text-slate-800"
            min={0}
            step={50000}
            formatter={formatThousands}
            parser={parseThousands}
            suffix={<span className="text-xs font-bold text-slate-400 select-none">₫</span>}
          />
        </Form.Item>
      </div>
      <div className="flex items-center gap-3">
        <span className={rowLabel}>Trong đơn có</span>
        <div className="flex items-center gap-2 flex-1">
          <Form.Item name="scope" noStyle>
            <Select
              className="!w-36 !h-9 [&_.ant-select-selector]:!h-9 [&_.ant-select-selector]:!rounded-lg [&_.ant-select-selection-item]:!leading-[34px]"
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
                className="flex-1 !h-9 !rounded-lg"
              />
            </Form.Item>
          ) : (
            <span className="text-slate-400 italic text-xs">Áp dụng cho mọi sản phẩm trong đơn</span>
          )}
          <HintIcon
            title="Chọn áp dụng cho toàn bộ hàng hoặc lọc danh sách mã SKU cụ thể"
            size={14}
          />
        </div>
      </div>
      {discountType === "percentage" ? (
        <div className="flex items-center gap-3 pt-1 border-t border-slate-100">
          <span className={rowLabel}>
            Mức trần giảm tối đa
            <HintIcon title="Giới hạn số tiền giảm tối đa để tránh thất thoát với đơn hàng lớn" />
          </span>
          <Form.Item name="maxDiscountVnd" noStyle>
            <InputNumber
              className="!w-44 !h-9 !rounded-lg [&_.ant-input-number-input]:!h-[34px] font-semibold text-slate-800"
              min={0}
              step={10000}
              placeholder="Không giới hạn"
              formatter={formatThousands}
              parser={parseThousands}
              suffix={<span className="text-xs font-bold text-slate-400 select-none">₫</span>}
            />
          </Form.Item>
        </div>
      ) : null}
    </CollapsibleCard>
  );
}

function NotesAndOptions({ isShipping }: Props) {
  return (
    <>
      <div>
        <label className="block text-xs font-semibold text-slate-700 mb-1.5">Ghi chú</label>
        <Form.Item name="description" className="!mb-2">
          <Input.TextArea rows={2} placeholder="Nhập ghi chú" className="!rounded-md border-slate-300" />
        </Form.Item>
      </div>
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
                <HintIcon title="Chính sách kết hợp nhiều voucher cùng lúc trên đơn hàng" />
              </span>
            </Checkbox>
          </Form.Item>
        </div>
      </div>
    </>
  );
}

/** Tab "Thông tin" của form voucher. */
export function InfoTab(props: Props) {
  const mysteryOn = Form.useWatch("mysteryOn", { form: props.form, preserve: true }) === true && !props.isShipping;
  return (
    <div className="space-y-4">
      <BenefitTypeRow {...props} />
      <NameCodeValueRow {...props} mysteryOn={mysteryOn} />
      <ValiditySection {...props} />
      <ConditionSection {...props} />
      {!props.isShipping ? (
        <MysterySection
          form={props.form}
          editingItem={props.editingItem}
          collapsed={!!props.collapsed.tuiMu}
          onToggle={() => props.toggle("tuiMu")}
        />
      ) : null}
      <ClaimSection
        form={props.form}
        editingItem={props.editingItem}
        isShipping={props.isShipping}
        collapsed={!!props.collapsed.cachNhan}
        onToggle={() => props.toggle("cachNhan")}
      />
      <NotesAndOptions {...props} />
    </div>
  );
}
