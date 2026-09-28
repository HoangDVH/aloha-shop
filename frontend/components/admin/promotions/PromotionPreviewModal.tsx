"use client";

import { useState } from "react";
import {
  Modal,
  Button,
  Select,
  InputNumber,
  Radio,
  Space,
  Divider,
  Tag,
  Table,
} from "antd";
import {
  Play,
  Sparkles,
  CheckCircle2,
  XCircle,
  Plus,
  Trash2,
  ShoppingCart,
  User,
} from "lucide-react";
import { formatVnd } from "@/lib/api";
import type { PromotionItem } from "./PromotionFormModal";

type Props = {
  open: boolean;
  onClose: () => void;
  promotion: PromotionItem | null;
};

interface TestItem {
  ma: string;
  ten: string;
  price: number;
  quantity: number;
}

export function PromotionPreviewModal({ open, onClose, promotion }: Props) {
  const [items, setItems] = useState<TestItem[]>([
    { ma: "CHAU_SU_01", ten: "Chậu sứ trắng tròn D20", price: 350000, quantity: 2 },
    { ma: "CHAU_DAT_NUNG_02", ten: "Chậu đất nung nâu D15", price: 150000, quantity: 3 },
  ]);
  const [isNewWebBuyer, setIsNewWebBuyer] = useState(true);
  const [isWholesale, setIsWholesale] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  if (!open || !promotion) return null;

  const addItem = () => {
    const nextIdx = items.length + 1;
    setItems([
      ...items,
      {
        ma: `SP_TEST_${nextIdx}`,
        ten: `Sản phẩm thử nghiệm ${nextIdx}`,
        price: 200000,
        quantity: 1,
      },
    ]);
  };

  const updateItem = (index: number, patch: Partial<TestItem>) => {
    const copy = [...items];
    copy[index] = { ...copy[index], ...patch };
    setItems(copy);
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleSimulate = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/shop/admin/promotions/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items,
          promotion,
          buyer: {
            isNewWebBuyer,
            isWholesale,
            phone: "0901234567",
          },
        }),
      });
      const data = await res.json();
      if (data.ok && data.quote) {
        setResult(data.quote);
      } else {
        setResult({ error: data.error || "Mô phỏng thất bại" });
      }
    } catch (e: any) {
      setResult({ error: e?.message || "Lỗi kết nối mô phỏng" });
    } finally {
      setLoading(false);
    }
  };

  const subtotal = items.reduce((s, it) => s + it.price * it.quantity, 0);

  return (
    <Modal
      open={open}
      onCancel={onClose}
      width={780}
      title={
        <div className="flex items-center gap-2">
          <Sparkles className="text-amber-500" size={20} />
          <div>
            <h3 className="text-base font-bold text-[var(--aloha-ink)]">
              Mô phỏng tính ưu đãi: {promotion.title}
            </h3>
            <p className="text-xs text-slate-500 font-normal">
              Chạy bộ tính toán với giỏ hàng và khách mẫu mà không tạo đơn thật
            </p>
          </div>
        </div>
      }
      footer={[
        <Button key="close" onClick={onClose}>
          Đóng
        </Button>,
        <Button
          key="run"
          type="primary"
          icon={<Play size={14} />}
          loading={loading}
          onClick={handleSimulate}
          className="!bg-[var(--aloha-green)] font-bold"
        >
          Chạy mô phỏng
        </Button>,
      ]}
    >
      <div className="space-y-4 pt-2">
        {/* Khách hàng mẫu */}
        <div className="rounded-xl border border-slate-200/80 bg-slate-50 p-3.5 space-y-2">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
            <User size={14} /> Khách hàng mẫu giả lập
          </p>
          <div className="flex flex-wrap gap-6 items-center">
            <div>
              <span className="text-xs text-slate-600 mr-2">Khách mới web:</span>
              <Radio.Group
                size="small"
                value={isNewWebBuyer}
                onChange={(e) => setIsNewWebBuyer(e.target.value)}
              >
                <Radio.Button value={true}>Lần đầu mua web</Radio.Button>
                <Radio.Button value={false}>Đã từng mua web</Radio.Button>
              </Radio.Group>
            </div>
            <div>
              <span className="text-xs text-slate-600 mr-2">Nhóm khách:</span>
              <Radio.Group
                size="small"
                value={isWholesale}
                onChange={(e) => setIsWholesale(e.target.value)}
              >
                <Radio.Button value={false}>Khách lẻ</Radio.Button>
                <Radio.Button value={true}>Khách sỉ</Radio.Button>
              </Radio.Group>
            </div>
          </div>
        </div>

        {/* Giỏ hàng mẫu */}
        <div className="rounded-xl border border-slate-200/80 p-3.5 space-y-2.5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <ShoppingCart size={14} /> Giỏ hàng mẫu
            </p>
            <Button
              size="small"
              icon={<Plus size={13} />}
              onClick={addItem}
            >
              Thêm sản phẩm
            </Button>
          </div>

          <div className="space-y-2">
            {items.map((it, idx) => (
              <div
                key={idx}
                className="flex items-center gap-2 rounded-lg border border-slate-100 bg-white p-2 text-xs"
              >
                <input
                  type="text"
                  value={it.ma}
                  onChange={(e) => updateItem(idx, { ma: e.target.value.toUpperCase() })}
                  placeholder="Mã SKU"
                  className="w-32 font-mono font-bold uppercase rounded border border-slate-200 px-2 py-1 text-xs"
                />
                <input
                  type="text"
                  value={it.ten}
                  onChange={(e) => updateItem(idx, { ten: e.target.value })}
                  placeholder="Tên sản phẩm"
                  className="flex-1 rounded border border-slate-200 px-2 py-1 text-xs"
                />
                <InputNumber
                  size="small"
                  value={it.price}
                  onChange={(val) => updateItem(idx, { price: Number(val) || 0 })}
                  formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}
                  className="w-28"
                />
                <span className="text-slate-400">×</span>
                <InputNumber
                  size="small"
                  min={1}
                  value={it.quantity}
                  onChange={(val) => updateItem(idx, { quantity: Number(val) || 1 })}
                  className="w-16"
                />
                <span className="font-bold text-slate-700 w-24 text-right">
                  {formatVnd(it.price * it.quantity)}
                </span>
                <button
                  type="button"
                  onClick={() => removeItem(idx)}
                  className="text-slate-400 hover:text-red-500 p-1"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>

          <div className="flex justify-between items-center pt-2 text-xs font-semibold border-t border-slate-100">
            <span className="text-slate-500">Tổng tiền hàng mẫu:</span>
            <span className="text-sm font-bold text-[var(--aloha-ink)]">
              {formatVnd(subtotal)}
            </span>
          </div>
        </div>

        {/* Kết quả mô phỏng */}
        {result ? (
          <div className="rounded-xl border border-emerald-300 bg-emerald-50/50 p-4 space-y-3">
            <h4 className="text-sm font-bold text-emerald-950 flex items-center gap-1.5">
              <Sparkles size={16} className="text-emerald-600" />
              Kết quả bộ tính toán (Promotion Evaluator)
            </h4>

            {result.error ? (
              <p className="text-xs text-red-600">{result.error}</p>
            ) : (
              <div className="space-y-3 text-xs">
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-lg bg-white p-2 border border-emerald-100">
                    <span className="text-slate-500 block">Tổng tiền gốc</span>
                    <strong className="text-sm font-bold text-slate-800">
                      {formatVnd(result.subtotal)}
                    </strong>
                  </div>
                  <div className="rounded-lg bg-white p-2 border border-emerald-100">
                    <span className="text-slate-500 block">Số tiền giảm</span>
                    <strong className="text-sm font-bold text-[var(--aloha-price)]">
                      -{formatVnd(result.discountTotal)}
                    </strong>
                  </div>
                  <div className="rounded-lg bg-white p-2 border border-emerald-100">
                    <span className="text-slate-500 block">Tổng thanh toán</span>
                    <strong className="text-sm font-bold text-emerald-800">
                      {formatVnd(result.finalTotal)}
                    </strong>
                  </div>
                </div>

                {result.applied ? (
                  <div className="rounded-lg bg-white p-2.5 border border-emerald-200 flex items-center justify-between">
                    <span className="flex items-center gap-1.5 font-bold text-emerald-900">
                      <CheckCircle2 size={15} className="text-emerald-600" />
                      Ưu đãi được chọn: {result.applied.title}
                    </span>
                    <Tag color="green">
                      Giảm {formatVnd(result.applied.discountAmount)}
                    </Tag>
                  </div>
                ) : (
                  <div className="rounded-lg bg-white p-2.5 border border-amber-200 flex items-center gap-1.5 text-amber-800">
                    <XCircle size={15} className="text-amber-600" />
                    Không có ưu đãi nào được áp dụng cho giỏ hàng này.
                  </div>
                )}

                {/* Phân bổ từng dòng SP */}
                {result.lineDiscounts && Object.keys(result.lineDiscounts).length > 0 ? (
                  <div className="rounded-lg bg-white p-3 border border-slate-200/80 space-y-1">
                    <span className="font-semibold text-slate-600 block mb-1">
                      Phân bổ giảm giá theo từng dòng SP (Line-item allocation):
                    </span>
                    {Object.entries(result.lineDiscounts).map(([sku, disc]) => (
                      <div key={sku} className="flex justify-between text-slate-700">
                        <span className="font-mono">{sku}:</span>
                        <span className="font-semibold text-[var(--aloha-price)]">
                          -{formatVnd(Number(disc) || 0)}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : null}

                {/* Ứng viên & Lý do */}
                {result.candidates && result.candidates.length > 0 ? (
                  <div className="space-y-1">
                    <span className="font-semibold text-slate-600 block">
                      Chi tiết đánh giá các điều kiện:
                    </span>
                    {result.candidates.map((cand: any, i: number) => (
                      <div
                        key={i}
                        className={`rounded-lg p-2 flex items-center justify-between border ${
                          cand.eligible
                            ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                            : "bg-slate-100 border-slate-200 text-slate-700"
                        }`}
                      >
                        <span className="font-medium">{cand.title}</span>
                        {cand.eligible ? (
                          <Tag color="success">Đủ điều kiện (+{formatVnd(cand.calculatedDiscount)})</Tag>
                        ) : (
                          <span className="text-slate-500 italic text-[11px]">
                            {cand.ineligibleReason || "Không đủ điều kiện"}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            )}
          </div>
        ) : null}
      </div>
    </Modal>
  );
}
