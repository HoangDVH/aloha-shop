"use client";

import { Form, InputNumber, DatePicker, Switch, Tooltip, type FormInstance } from "antd";
import { Info } from "lucide-react";
import { CollapsibleCard } from "./CollapsibleCard";
import type { PromotionItem } from "./promotionFormModel";

type Props = {
  form: FormInstance;
  editingItem?: PromotionItem | null;
  isShipping: boolean;
  collapsed: boolean;
  onToggle: () => void;
};

const ROW = "flex items-center justify-between gap-4 py-1";

function HintIcon({ title }: { title: string }) {
  return (
    <Tooltip title={title} placement="top">
      <Info size={13} className="text-slate-400 hover:text-slate-600 cursor-help shrink-0" />
    </Tooltip>
  );
}

/** Khối "Cách nhận" + các công tắc dùng chung; áp dụng cho cả voucher hàng và ship. */
export function ClaimSection({ form, editingItem, isShipping, collapsed, onToggle }: Props) {
  const claimRequired = Form.useWatch("claimRequired", { form, preserve: true });
  const claimed = Number(editingItem?.claimedCount) || 0;
  return (
    <CollapsibleCard title="Cách nhận" collapsed={collapsed} onToggle={onToggle}>
      {isShipping && (
        <div className={ROW}>
          <div className="flex items-center gap-1.5 font-medium text-slate-800">
            <span>Mở thêm cho khách sỉ tỉnh đã duyệt</span>
            <HintIcon title="Áp dụng cùng điều kiện tiền hàng, địa chỉ và lưu mã." />
          </div>
          <Form.Item name="allowWholesaleTinh" valuePropName="checked" noStyle>
            <Switch size="small" />
          </Form.Item>
        </div>
      )}
      {isShipping && (
        <div className={ROW}>
          <div className="flex items-center gap-1.5 font-medium text-slate-800">
            <span>Mở thêm cho khách sỉ HCM đã duyệt</span>
            <HintIcon title="Áp dụng khi giao hàng tận nơi, đúng điều kiện tiền hàng, địa chỉ và lưu mã." />
          </div>
          <Form.Item name="allowWholesaleHcm" valuePropName="checked" noStyle>
            <Switch size="small" />
          </Form.Item>
        </div>
      )}
      <div className={ROW}>
        <div className="flex items-center gap-1.5 font-medium text-slate-800">
          <span>Khách phải bấm &quot;Lưu mã&quot; trước khi dùng</span>
          <HintIcon title="Voucher sẽ hiển thị ở Kho voucher, khách lưu vào ví rồi mới dùng được khi đặt hàng. Mỗi khách lưu 1 lần." />
        </div>
        <Form.Item name="claimRequired" valuePropName="checked" noStyle>
          <Switch size="small" />
        </Form.Item>
      </div>
      {claimRequired ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pl-1 pt-1">
          <div>
            <div className="flex items-center gap-1.5 font-medium text-slate-600 mb-1">
              <span>Tổng lượt phát</span>
              <HintIcon title="Số lượng voucher tối đa khách có thể lưu vào ví. Để trống nếu không giới hạn." />
            </div>
            <Form.Item name="claimLimitTotal" noStyle>
              <InputNumber
                className="!w-full !h-9 !rounded-lg [&_.ant-input-number-input]:!h-[34px]"
                min={claimed || 0}
                placeholder="Không giới hạn"
              />
            </Form.Item>
            {claimed ? (
              <p className="text-[11px] text-amber-700 mt-1">
                Đã có {claimed} khách lưu, không giảm dưới {claimed}.
              </p>
            ) : null}
          </div>
          <div>
            <div className="flex items-center gap-1.5 font-medium text-slate-600 mb-1">
              <span>Mở lưu từ</span>
              <HintIcon title="Có thể mở sớm hơn ngày bắt đầu để khách lưu trước. Hạn dùng tính theo hạn của voucher." />
            </div>
            <Form.Item name="claimStartDate" noStyle>
              <DatePicker
                showTime
                format="DD/MM/YYYY HH:mm"
                className="!w-full !h-9 !rounded-lg"
                placeholder="Ngay khi bật"
              />
            </Form.Item>
          </div>
        </div>
      ) : null}
      {!isShipping ? (
        <>
          <div className={`${ROW} pt-2 border-t border-slate-100`}>
            <div className="flex items-center gap-1.5 font-medium text-slate-800">
              <span>Dùng chung với hỗ trợ ship</span>
              <HintIcon title="Cho phép khách áp dụng đồng thời voucher này và voucher hỗ trợ ship trong cùng 1 đơn hàng." />
            </div>
            <Form.Item name="combineWithShip" valuePropName="checked" noStyle>
              <Switch size="small" />
            </Form.Item>
          </div>
          <div className={ROW}>
            <div className="flex items-center gap-1.5 font-medium text-slate-800">
              <span>Không giảm thêm trên sản phẩm đang Flash Sale</span>
              <HintIcon title="Dòng sản phẩm đã có giá Flash Sale sẽ không được tính giảm từ voucher này." />
            </div>
            <Form.Item name="excludeFlash" valuePropName="checked" noStyle>
              <Switch size="small" />
            </Form.Item>
          </div>
        </>
      ) : null}
    </CollapsibleCard>
  );
}
