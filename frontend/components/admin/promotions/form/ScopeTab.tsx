"use client";

import { Form, InputNumber, Radio, Select, Tooltip, type FormInstance } from "antd";
import { Info } from "lucide-react";
import type { ReactNode } from "react";
import { CollapsibleCard } from "./CollapsibleCard";
import type { CollapseProps } from "./InfoTab";
import { formatThousands, parseThousands, type CustomerMode } from "./promotionFormModel";

type Props = CollapseProps & {
  form: FormInstance;
  isShipping: boolean;
  customerMode: CustomerMode;
  setCustomerMode: (m: CustomerMode) => void;
  defaultShipBudget: number | null;
  shipBudgetTooLow: boolean;
};

function FieldLabel({ children, hint }: { children: ReactNode; hint?: string }) {
  return (
    <label className="block font-medium text-slate-600 mb-1 flex items-center gap-1">
      {children}
      {hint ? (
        <Tooltip title={hint}>
          <Info size={12} className="text-slate-400 cursor-pointer" />
        </Tooltip>
      ) : null}
    </label>
  );
}

function CustomerGroupSection({ form, customerMode, setCustomerMode, collapsed, toggle }: Props) {
  return (
    <CollapsibleCard
      title="Nhóm khách hàng"
      collapsed={!!collapsed.nhomKhach}
      onToggle={() => toggle("nhomKhach")}
      bodyClassName="pt-3.5 space-y-3 text-xs text-slate-700"
    >
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
                className="!w-64 !h-9 [&_.ant-select-selector]:!h-9 [&_.ant-select-selector]:!rounded-lg [&_.ant-select-selection-item]:!leading-[34px]"
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
    </CollapsibleCard>
  );
}

function BudgetSection(props: Props) {
  const { isShipping, defaultShipBudget, shipBudgetTooLow, collapsed, toggle } = props;
  return (
    <CollapsibleCard
      title="Ngân sách & Giới hạn phát hành"
      collapsed={!!collapsed.nganSach}
      onToggle={() => toggle("nganSach")}
      bodyClassName="pt-3.5 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-slate-700"
    >
      <div>
        <label className="block font-medium text-slate-600 mb-1">
          Tổng lượt dùng tối đa{isShipping ? " (bắt buộc)" : ""}
        </label>
        <Form.Item name="usageLimitTotal" noStyle>
          <InputNumber
            className="!w-full !h-9 !rounded-lg [&_.ant-input-number-input]:!h-[34px] border-slate-300"
            min={1}
            placeholder={isShipping ? "Bắt buộc" : "Không giới hạn"}
          />
        </Form.Item>
      </div>
      <div>
        <FieldLabel hint="Khi đặt giới hạn này, khách phải đăng nhập mới được áp dụng ưu đãi">
          Lượt dùng mỗi khách
        </FieldLabel>
        <Form.Item name="usageLimitPerCustomer" noStyle>
          <InputNumber
            className="!w-full !h-9 !rounded-lg [&_.ant-input-number-input]:!h-[34px] border-slate-300"
            min={1}
            placeholder="Không giới hạn"
          />
        </Form.Item>
      </div>
      <div>
        <label className="block font-medium text-slate-600 mb-1">Tổng ngân sách (₫)</label>
        <Form.Item name="budgetTotal" noStyle>
          <InputNumber
            className="!w-full !h-9 !rounded-lg [&_.ant-input-number-input]:!h-[34px] font-semibold text-slate-800"
            min={0}
            step={500000}
            placeholder={isShipping ? "Mặc định = lượt × mệnh giá" : "Không giới hạn"}
            formatter={formatThousands}
            parser={parseThousands}
            suffix={<span className="text-xs font-bold text-slate-400 select-none">₫</span>}
          />
        </Form.Item>
        {defaultShipBudget != null ? (
          <p className={`mt-1 text-[11px] ${shipBudgetTooLow ? "text-amber-600" : "text-slate-400"}`}>
            {shipBudgetTooLow
              ? `Thấp hơn lượt × mệnh giá (${formatThousands(defaultShipBudget)}đ): có thể hết ngân sách trước khi hết lượt.`
              : `Lượt × mệnh giá = ${formatThousands(defaultShipBudget)}đ`}
          </p>
        ) : null}
      </div>
      <div>
        <FieldLabel hint="Số càng cao càng ưu tiên áp dụng khi có nhiều ưu đãi cùng thỏa mãn">
          Độ ưu tiên áp dụng
        </FieldLabel>
        <Form.Item name="priority" noStyle>
          <InputNumber
            className="!w-full !h-9 !rounded-lg [&_.ant-input-number-input]:!h-[34px] border-slate-300"
            min={0}
            max={100}
            placeholder="0"
          />
        </Form.Item>
      </div>
    </CollapsibleCard>
  );
}

/** Tab "Phạm vi áp dụng" của form voucher. */
export function ScopeTab(props: Props) {
  const { collapsed, toggle } = props;
  return (
    <div className="space-y-4">
      <CollapsibleCard
        title="Chi nhánh & Kênh bán"
        collapsed={!!collapsed.chiNhanh}
        onToggle={() => toggle("chiNhanh")}
        bodyClassName="pt-3.5 text-xs text-slate-700"
      >
        <Form.Item name="branchScope" noStyle>
          <Radio.Group className="flex flex-col gap-2.5">
            <Radio value="all">Toàn hệ thống (Website Aloha & Cửa hàng)</Radio>
            <Radio value="web_only">Chỉ áp dụng trên Website Aloha Online</Radio>
          </Radio.Group>
        </Form.Item>
      </CollapsibleCard>
      <CustomerGroupSection {...props} />
      <BudgetSection {...props} />
    </div>
  );
}
