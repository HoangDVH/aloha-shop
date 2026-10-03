"use client";

import { Card, Tag } from "antd";
import { CheckCircle2 } from "lucide-react";
import type { ReactNode } from "react";

function Rule({ title, children }: { title: string; children: ReactNode }) {
  return (
    <li className="flex items-start gap-2">
      <span className="font-bold text-emerald-600">✓</span>
      <span>
        <strong>{title}</strong> {children}
      </span>
    </li>
  );
}

/** Tab "Đồng bộ KiotViet": giải thích cách ưu đãi web khớp với KiotViet (chỉ đọc). */
export function KiotVietTab() {
  return (
    <div className="space-y-5 pt-2">
      <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 rounded-lg bg-emerald-600 p-2 text-white">
            <CheckCircle2 size={18} />
          </div>
          <div>
            <h4 className="text-sm font-bold text-emerald-950">
              Kiến trúc tích hợp ưu đãi web với KiotViet
            </h4>
            <p className="mt-1 text-xs text-emerald-800 leading-relaxed">
              Hệ thống ưu đãi Aloha tính toán độc lập tại web và phân bổ chính xác vào từng dòng sản
              phẩm (<strong>orderDetails[i].discount</strong>). Khi đơn hàng đẩy sang KiotViet
              (KiotViet Push), giá trị chiết khấu và tổng thanh toán được đồng bộ hoàn toàn khớp,
              không gây phát sinh thuế/phí chênh lệch.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card
          title={<span className="text-sm font-bold text-slate-800">Quy tắc đối soát tài chính</span>}
          size="small"
          className="border-slate-200"
        >
          <ul className="space-y-3 text-xs text-slate-600">
            <Rule title="Phân bổ tỷ trọng:">
              Giảm giá toàn đơn được chia theo giá trị từng món để phục vụ tính hoàn trả từng phần và
              hoa hồng CTV chính xác.
            </Rule>
            <Rule title="Hoa hồng CTV:">
              CTV nhận hoa hồng theo giá thực thu của dòng sau giảm (
              <strong>lineNet = price * qty - discount</strong>).
            </Rule>
            <Rule title="Đồng bộ KiotViet Invoice:">
              Trường <code>discount</code> cấp đơn và dòng được mapping khớp với KiotViet API.
            </Rule>
          </ul>
        </Card>

        <Card
          title={
            <span className="text-sm font-bold text-slate-800">
              Trạng thái Voucher KiotViet (Mục 9 & 18)
            </span>
          }
          size="small"
          className="border-slate-200"
        >
          <div className="space-y-3 text-xs text-slate-600">
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Chế độ vận hành:</span>
              <Tag color="cyan">Khảo sát & Đối soát (Read-only)</Tag>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">API Đợt phát hành:</span>
              <span className="font-mono text-slate-700">GET /vouchercampaign</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Phương thức thanh toán:</span>
              <Tag color="green">Payments: Voucher</Tag>
            </div>
            <p className="mt-2 text-slate-500 bg-slate-50 p-2 rounded-lg border border-slate-100">
              Theo tài liệu thiết kế, voucher thanh toán của KiotViet cần qua giai đoạn kiểm thử đồng
              thời giữa POS và Website trước khi kích hoạt nhập mã tại quầy thu ngân online để đảm bảo
              tính duy nhất và không bị dùng trùng mã.
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}
