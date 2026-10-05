"use client";

import { useEffect } from "react";
import { Button, Form, InputNumber, Switch, type FormInstance } from "antd";
import { Gift, Plus, Trash2 } from "lucide-react";
import { CollapsibleCard } from "./CollapsibleCard";
import { MYSTERY_DEFAULT_TIERS, mysteryOdds, type MysteryFormTier, type PromotionItem } from "./promotionFormModel";

type Props = {
  form: FormInstance;
  editingItem?: PromotionItem | null;
  collapsed: boolean;
  onToggle: () => void;
};

const HINT = "text-[11px] text-slate-400 mt-0.5";
const NUM = "!w-full !h-8 !rounded-md [&_.ant-input-number-input]:!h-[30px]";

function OddsSummary({ tiers }: { tiers: MysteryFormTier[] }) {
  const { rows, average } = mysteryOdds(tiers);
  if (!rows.length) return null;
  return (
    <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-[11px] text-amber-900">
      <div className="font-semibold mb-1">Khách sẽ thấy tỉ lệ trúng:</div>
      <div className="flex flex-wrap gap-x-3 gap-y-1">
        {rows.map((r) => (
          <span key={r.percent}>
            <b>{r.percent}%</b>: {r.chance}%
          </span>
        ))}
      </div>
      <div className="mt-1 text-amber-700">Mức giảm trung bình dự kiến ≈ {average}% (dùng để ước tính ngân sách).</div>
    </div>
  );
}

function TierStats({ editingItem }: { editingItem?: PromotionItem | null }) {
  const tiers = editingItem?.mystery?.tiers || [];
  const drawn = tiers.reduce((s, t) => s + (t.drawn || 0), 0);
  if (!drawn) return null;
  return (
    <div className="text-[11px] text-slate-600">
      Đã bóc {drawn} túi:{" "}
      {tiers.map((t) => `${t.percent}% × ${t.drawn || 0}${t.limit != null ? ` (còn ${t.remaining})` : ""}`).join(" · ")}
    </div>
  );
}

/** Voucher "túi mù": khách bấm Bóc, server bốc ngẫu nhiên 1 mức % theo tỉ lệ và lưu cố định vào ví. */
export function MysterySection({ form, editingItem, collapsed, onToggle }: Props) {
  const on = Form.useWatch("mysteryOn", { form, preserve: true });
  const tiers: MysteryFormTier[] = Form.useWatch("mysteryTiers", { form, preserve: true }) || [];
  const locked = (Number(editingItem?.claimedCount) || 0) > 0;
  const minPercent = mysteryOdds(tiers).rows[0]?.percent;

  useEffect(() => {
    if (on && minPercent) form.setFieldValue("discountValue", minPercent);
  }, [form, on, minPercent]);

  const toggle = (next: boolean) => {
    if (!next) return;
    const current: MysteryFormTier[] = form.getFieldValue("mysteryTiers") || [];
    form.setFieldsValue({
      discountType: "percentage",
      claimRequired: true,
      mysteryTiers: current.length ? current : MYSTERY_DEFAULT_TIERS,
      maxDiscountVnd: form.getFieldValue("maxDiscountVnd") || 200000,
    });
  };

  return (
    <CollapsibleCard title="Túi mù — giảm ngẫu nhiên" collapsed={collapsed} onToggle={onToggle}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="font-medium text-slate-800 flex items-center gap-1.5">
            <Gift size={14} className="text-amber-600" /> Khách bấm &quot;Bóc ngay&quot; để nhận mức giảm ngẫu nhiên
          </div>
          <p className={HINT}>
            Mỗi khách bóc 1 lần, mức trúng lưu cố định vào ví và dùng khi đặt hàng. Bật túi mù sẽ tự chuyển sang
            giảm theo %, bắt buộc lưu mã và cần mức trần giảm tối đa.
          </p>
        </div>
        <Form.Item name="mysteryOn" valuePropName="checked" noStyle>
          <Switch size="small" onChange={toggle} disabled={locked} />
        </Form.Item>
      </div>
      {locked ? (
        <p className="text-[11px] text-amber-700">
          Đã có khách lưu voucher này nên không đổi được túi mù / bảng mức. Hãy nhân bản thành voucher mới.
        </p>
      ) : null}
      {on ? (
        <div className="space-y-2">
          <div className="grid grid-cols-[1fr_1fr_1fr_32px] gap-2 text-[11px] font-semibold text-slate-500">
            <span>Mức giảm (%)</span>
            <span>Tỉ lệ (trọng số)</span>
            <span>Số suất (trống = không giới hạn)</span>
            <span />
          </div>
          <Form.List name="mysteryTiers">
            {(fields, { add, remove }) => (
              <>
                {fields.map((f) => (
                  <div key={f.key} className="grid grid-cols-[1fr_1fr_1fr_32px] gap-2 items-center">
                    <Form.Item name={[f.name, "percent"]} noStyle>
                      <InputNumber className={NUM} min={1} max={100} precision={0} suffix="%" disabled={locked} />
                    </Form.Item>
                    <Form.Item name={[f.name, "weight"]} noStyle>
                      <InputNumber className={NUM} min={0.1} step={1} disabled={locked} />
                    </Form.Item>
                    <Form.Item name={[f.name, "limit"]} noStyle>
                      <InputNumber className={NUM} min={1} precision={0} placeholder="Không giới hạn" disabled={locked} />
                    </Form.Item>
                    <Button
                      type="text"
                      size="small"
                      icon={<Trash2 size={14} />}
                      disabled={locked || fields.length <= 2}
                      onClick={() => remove(f.name)}
                    />
                  </div>
                ))}
                {!locked && fields.length < 10 ? (
                  <Button size="small" icon={<Plus size={13} />} onClick={() => add({ percent: undefined, weight: 1 })}>
                    Thêm mức
                  </Button>
                ) : null}
              </>
            )}
          </Form.List>
          <p className={HINT}>
            Ví dụ tỉ lệ 50 / 20 / 15 / 8 / 5 / 2 = 50% khách trúng mức thấp nhất. Mức có số suất khi hết sẽ không
            còn bốc trúng; hết sạch suất các mức thì voucher hết lượt.
          </p>
          <OddsSummary tiers={tiers} />
          <TierStats editingItem={editingItem} />
        </div>
      ) : null}
    </CollapsibleCard>
  );
}
