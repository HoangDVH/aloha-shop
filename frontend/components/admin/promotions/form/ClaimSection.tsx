"use client";

import { Form, InputNumber, DatePicker, Switch, type FormInstance } from "antd";
import { CollapsibleCard } from "./CollapsibleCard";
import type { PromotionItem } from "./promotionFormModel";

type Props = {
  form: FormInstance;
  editingItem?: PromotionItem | null;
  isShipping: boolean;
  collapsed: boolean;
  onToggle: () => void;
};

const ROW = "flex items-start justify-between gap-4";
const HINT = "text-[11px] text-slate-400 mt-0.5";

/** Khối "Cách nhận" + các công tắc dùng chung; áp dụng cho cả voucher hàng và ship. */
export function ClaimSection({ form, editingItem, isShipping, collapsed, onToggle }: Props) {
  const claimRequired = Form.useWatch("claimRequired", { form, preserve: true });
  const claimed = Number(editingItem?.claimedCount) || 0;
  return (
    <CollapsibleCard title="Cách nhận" collapsed={collapsed} onToggle={onToggle}>
      <div className={ROW}>
        <div>
          <div className="font-medium text-slate-800">Khách phải bấm &quot;Lưu mã&quot; trước khi dùng</div>
          <p className={HINT}>Voucher hiện ở Kho voucher, khách lưu vào ví rồi mới dùng được khi đặt hàng. Mỗi khách lưu 1 lần.</p>
        </div>
        <Form.Item name="claimRequired" valuePropName="checked" noStyle>
          <Switch size="small" />
        </Form.Item>
      </div>
      {claimRequired ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pl-1">
          <div>
            <div className="font-medium text-slate-600 mb-1">Tổng lượt phát</div>
            <Form.Item name="claimLimitTotal" noStyle>
              <InputNumber className="!w-full !h-9 !rounded-lg [&_.ant-input-number-input]:!h-[34px]" min={claimed || 0} placeholder="Không giới hạn" />
            </Form.Item>
            <p className={HINT}>
              Ví dụ 500 = 500 khách đầu tiên lưu được.
              {claimed ? ` Đã có ${claimed} khách lưu, không giảm dưới ${claimed}.` : ""}
            </p>
          </div>
          <div>
            <div className="font-medium text-slate-600 mb-1">Mở lưu từ</div>
            <Form.Item name="claimStartDate" noStyle>
              <DatePicker showTime format="DD/MM/YYYY HH:mm" className="!w-full !h-9 !rounded-lg" placeholder="Ngay khi bật" />
            </Form.Item>
            <p className={HINT}>Có thể mở sớm hơn ngày bắt đầu để khách lưu trước. Hạn dùng = hạn voucher.</p>
          </div>
        </div>
      ) : null}
      {!isShipping ? (
        <>
          <div className={`${ROW} pt-2 border-t border-slate-100`}>
            <div>
              <div className="font-medium text-slate-800">Dùng chung với hỗ trợ ship</div>
              <p className={HINT}>Bật: khách dùng voucher này và voucher hỗ trợ ship trong cùng 1 đơn.</p>
            </div>
            <Form.Item name="combineWithShip" valuePropName="checked" noStyle>
              <Switch size="small" />
            </Form.Item>
          </div>
          <div className={ROW}>
            <div>
              <div className="font-medium text-slate-800">Không giảm thêm trên sản phẩm đang Flash Sale</div>
              <p className={HINT}>Bật: dòng hàng đã có giá sale không được tính giảm từ voucher này.</p>
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
