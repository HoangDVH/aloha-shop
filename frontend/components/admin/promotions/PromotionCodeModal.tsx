"use client";

import { useEffect, useState } from "react";
import {
  Modal,
  Table,
  Button,
  Form,
  Input,
  InputNumber,
  DatePicker,
  Tag,
  Space,
  App,
  Card,
} from "antd";
import { Plus, Ticket, Copy, Check, User, Calendar } from "lucide-react";
import dayjs from "dayjs";
import type { PromotionItem } from "./PromotionFormModal";

interface PromotionCode {
  code: string;
  promotionId: string;
  assignedBuyerPhone?: string;
  assignedBuyerEmail?: string;
  maxUses?: number;
  usedCount: number;
  heldCount: number;
  expiresAt?: string;
  active: boolean;
  createdAt: string;
}

type Props = {
  open: boolean;
  onClose: () => void;
  promotion: PromotionItem | null;
};

export function PromotionCodeModal({ open, onClose, promotion }: Props) {
  const { message } = App.useApp();
  const [codes, setCodes] = useState<PromotionCode[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form] = Form.useForm();
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const fetchCodes = async () => {
    if (!promotion?.id) return;
    try {
      setLoading(true);
      const res = await fetch(`/api/shop/admin/promotions/${promotion.id}/codes`);
      const data = await res.json();
      if (data.ok) {
        setCodes(data.codes || []);
      }
    } catch (e: any) {
      message.error(e?.message || "Lỗi tải mã giảm giá");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open && promotion?.id) {
      fetchCodes();
    }
  }, [open, promotion?.id]);

  const handleCreateCode = async (values: any) => {
    if (!promotion?.id) return;
    try {
      setCreating(true);
      const cleanCode = String(values.code || "").trim().toUpperCase();
      const expiresAt = values.expiresAt ? values.expiresAt.toISOString() : undefined;

      const res = await fetch(`/api/shop/admin/promotions/${promotion.id}/codes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: cleanCode,
          maxUses: values.maxUses || undefined,
          assignedBuyerPhone: values.assignedBuyerPhone || undefined,
          assignedBuyerEmail: values.assignedBuyerEmail || undefined,
          expiresAt,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Không tạo được mã giảm giá");
      }

      message.success(`Đã tạo mã ${cleanCode}`);
      form.resetFields();
      fetchCodes();
    } catch (e: any) {
      message.error(e?.message || "Lỗi tạo mã giảm giá");
    } finally {
      setCreating(false);
    }
  };

  const handleCopy = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    message.success(`Đã sao chép mã ${code}`);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  if (!open || !promotion) return null;

  return (
    <Modal
      open={open}
      onCancel={onClose}
      width={750}
      title={
        <div className="flex items-center gap-2">
          <Ticket className="text-[var(--aloha-green)]" size={20} />
          <div>
            <h3 className="text-base font-bold text-[var(--aloha-ink)]">
              Quản lý mã giảm giá: {promotion.title}
            </h3>
            <p className="text-xs text-slate-500 font-normal">
              Tạo và theo dõi lượt dùng của các mã thuộc chương trình này
            </p>
          </div>
        </div>
      }
      footer={[
        <Button key="close" onClick={onClose} className="!h-9 !rounded-lg px-4 text-xs font-medium">
          Đóng
        </Button>,
      ]}
    >
      <div className="space-y-4 pt-2">
        {/* Form tạo mã mới */}
        <Card size="small" className="bg-slate-50 border-slate-200">
          <Form
            form={form}
            layout="inline"
            onFinish={handleCreateCode}
            className="flex flex-wrap gap-2 items-end"
          >
            <Form.Item
              name="code"
              label={<span className="text-xs font-semibold">Mã code</span>}
              rules={[{ required: true, message: "Nhập mã code" }]}
            >
              <Input
                placeholder="VD: ALOHA50"
                className="font-mono uppercase font-bold !h-9 !rounded-lg text-xs"
                style={{ width: 140 }}
              />
            </Form.Item>
            <Form.Item
              name="maxUses"
              label={<span className="text-xs font-semibold">Lượt dùng</span>}
            >
              <InputNumber
                min={1}
                placeholder="Vô hạn"
                className="!h-9 !rounded-lg text-xs [&_.ant-input-number-input]:!h-[34px]"
                style={{ width: 100 }}
              />
            </Form.Item>
            <Form.Item
              name="assignedBuyerPhone"
              label={<span className="text-xs font-semibold">SĐT chỉ định</span>}
            >
              <Input
                placeholder="Tùy chọn"
                className="!h-9 !rounded-lg text-xs"
                style={{ width: 130 }}
              />
            </Form.Item>
            <Form.Item
              name="expiresAt"
              label={<span className="text-xs font-semibold">Hạn dùng</span>}
            >
              <DatePicker
                placeholder="Chọn ngày"
                className="!h-9 !rounded-lg text-xs"
                style={{ width: 130 }}
              />
            </Form.Item>
            <Form.Item>
              <Button
                type="primary"
                htmlType="submit"
                icon={<Plus size={14} />}
                loading={creating}
                className="!h-9 !rounded-lg !bg-[#2D5A27] hover:!bg-[#23481e] font-semibold text-white shadow-xs text-xs px-3.5"
              >
                Tạo mã
              </Button>
            </Form.Item>
          </Form>
        </Card>

        {/* Bảng danh sách mã */}
        <Table
          dataSource={codes}
          rowKey="code"
          loading={loading}
          size="small"
          pagination={{ pageSize: 8 }}
          columns={[
            {
              title: "Mã giảm giá",
              dataIndex: "code",
              key: "code",
              render: (code: string) => (
                <div className="flex items-center gap-1.5 font-mono font-bold text-slate-800">
                  <span>{code}</span>
                  <button
                    type="button"
                    onClick={() => handleCopy(code)}
                    className="text-slate-400 hover:text-[var(--aloha-green)] p-1"
                    title="Sao chép mã"
                  >
                    {copiedCode === code ? (
                      <Check size={13} className="text-emerald-600" />
                    ) : (
                      <Copy size={13} />
                    )}
                  </button>
                </div>
              ),
            },
            {
              title: "Lượt đã dùng",
              key: "usage",
              render: (_, r) => (
                <span className="text-xs">
                  <strong className="text-emerald-700">{r.usedCount}</strong>
                  {r.heldCount > 0 ? (
                    <span className="text-amber-600 text-[11px] ml-1">
                      (+{r.heldCount} đang giữ)
                    </span>
                  ) : null}
                  {" / "}
                  <span>{r.maxUses ? r.maxUses : "∞"}</span>
                </span>
              ),
            },
            {
              title: "Chỉ định khách",
              key: "assigned",
              render: (_, r) => (
                <span className="text-xs text-slate-600">
                  {r.assignedBuyerPhone || r.assignedBuyerEmail || "Mọi khách hàng"}
                </span>
              ),
            },
            {
              title: "Hạn dùng",
              dataIndex: "expiresAt",
              key: "expiresAt",
              render: (val: string) => (
                <span className="text-xs text-slate-500">
                  {val ? dayjs(val).format("YYYY-MM-DD HH:mm") : "Không thời hạn"}
                </span>
              ),
            },
            {
              title: "Trạng thái",
              dataIndex: "active",
              key: "active",
              render: (active: boolean) =>
                active ? <Tag color="green">Khả dụng</Tag> : <Tag color="default">Khóa</Tag>,
            },
          ]}
        />
      </div>
    </Modal>
  );
}
