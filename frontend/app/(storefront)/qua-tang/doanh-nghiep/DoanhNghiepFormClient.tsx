"use client";

import React, { useState } from "react";
import { useQuoteSubmission } from "@/lib/useQuoteSubmission";
import { Send, CheckCircle2, Phone, MessageCircle, Building2, Mail, FileText } from "lucide-react";

export function DoanhNghiepFormClient() {
  const { sent, loading, error, submit, reset } = useQuoteSubmission();
  const [form, setForm] = useState({
    companyName: "",
    contactName: "",
    phone: "",
    email: "",
    quantity: "50-100",
    budgetPerSet: "150.000đ - 250.000đ",
    eventDate: "",
    notes: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await submit({ ...form, source: "b2b" });
  };

  return (
    <div className="overflow-hidden rounded-3xl border border-stone-200/90 bg-white p-6 shadow-xl sm:p-10">
      <div className="grid gap-8 lg:grid-cols-12">
        {/* Thông tin bên trái */}
        <div className="lg:col-span-5 space-y-4">
          <span className="text-xs font-extrabold uppercase tracking-widest text-[var(--aloha-green)]">
            Hợp Tác B2B
          </span>
          <h3 className="text-2xl font-bold text-stone-900 sm:text-3xl">
            Nhận Báo Giá Sỉ &amp; Catalog Quà Tặng 2026
          </h3>
          <p className="text-xs sm:text-sm text-stone-600 leading-relaxed">
            Để lại thông tin nhu cầu, đội ngũ chuyên viên B2B của Aloha sẽ liên hệ gửi file báo giá chiết khấu, hình ảnh mockup và tư vấn tận tình trong 15 phút.
          </p>

          <div className="space-y-3 pt-3">
            <div className="flex items-center gap-3 text-xs sm:text-sm text-stone-700">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-50 text-[var(--aloha-green)] shrink-0">
                <Phone size={15} />
              </span>
              <div>
                <p className="font-semibold text-stone-900">Hotline Doanh Nghiệp</p>
                <a href="tel:0794901233" className="text-xs font-bold text-[var(--aloha-green)] hover:underline">
                  079 490 1233 (Zalo B2B)
                </a>
              </div>
            </div>

            <div className="flex items-center gap-3 text-xs sm:text-sm text-stone-700">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-50 text-[var(--aloha-green)] shrink-0">
                <Mail size={15} />
              </span>
              <div>
                <p className="font-semibold text-stone-900">Email Báo Giá</p>
                <p className="text-xs text-stone-500">kinhdoanh@thegioichaucay.vn</p>
              </div>
            </div>
          </div>
        </div>

        {/* Form bên phải */}
        <div className="lg:col-span-7">
          {sent ? (
            <div className="flex h-full flex-col items-center justify-center rounded-2xl bg-emerald-50/80 p-8 text-center text-emerald-900">
              <CheckCircle2 size={48} className="text-[var(--aloha-green)] mb-3" />
              <h4 className="text-lg font-bold">Aloha đã nhận yêu cầu của quý công ty!</h4>
              <p className="mt-2 text-xs sm:text-sm text-emerald-800 leading-relaxed max-w-md">
                Chuyên viên phụ trách khách hàng doanh nghiệp sẽ liên hệ qua Số điện thoại/Zalo <strong>{form.phone}</strong> kèm Catalog và Bảng báo giá trong ít phút.
              </p>
              <button
                type="button"
                onClick={reset}
                className="mt-6 rounded-xl bg-[var(--aloha-green)] px-5 py-2 text-xs font-bold text-white shadow-sm hover:opacity-90 transition"
              >
                Gửi thêm yêu cầu khác
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error ? <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p> : null}
              <div className="grid gap-3.5 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider">
                    Tên doanh nghiệp / Đơn vị *
                  </label>
                  <input
                    type="text"
                    required
                    value={form.companyName}
                    onChange={(e) => setForm({ ...form, companyName: e.target.value })}
                    placeholder="Công ty TNHH..."
                    className="mt-1 w-full rounded-xl border border-stone-300 bg-stone-50/50 px-3.5 py-2 text-xs sm:text-sm outline-none transition focus:border-[var(--aloha-green)] focus:bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider">
                    Người liên hệ *
                  </label>
                  <input
                    type="text"
                    required
                    value={form.contactName}
                    onChange={(e) => setForm({ ...form, contactName: e.target.value })}
                    placeholder="Nguyễn Văn A"
                    className="mt-1 w-full rounded-xl border border-stone-300 bg-stone-50/50 px-3.5 py-2 text-xs sm:text-sm outline-none transition focus:border-[var(--aloha-green)] focus:bg-white"
                  />
                </div>
              </div>

              <div className="grid gap-3.5 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider">
                    Số điện thoại / Zalo *
                  </label>
                  <input
                    type="tel"
                    required
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    placeholder="09xx xxx xxx"
                    className="mt-1 w-full rounded-xl border border-stone-300 bg-stone-50/50 px-3.5 py-2 text-xs sm:text-sm outline-none transition focus:border-[var(--aloha-green)] focus:bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider">
                    Số lượng set quà dự kiến
                  </label>
                  <select
                    value={form.quantity}
                    onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-stone-300 bg-stone-50/50 px-3.5 py-2 text-xs sm:text-sm outline-none transition focus:border-[var(--aloha-green)] focus:bg-white"
                  >
                    <option value="10-50">10 – 50 phần</option>
                    <option value="50-100">50 – 100 phần</option>
                    <option value="100-300">100 – 300 phần</option>
                    <option value="300-1000">300 – 1.000 phần</option>
                    <option value="1000+">Trên 1.000 phần</option>
                  </select>
                </div>
              </div>

              <div className="grid gap-3.5 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider">
                    Ngân sách dự kiến mỗi set
                  </label>
                  <select
                    value={form.budgetPerSet}
                    onChange={(e) => setForm({ ...form, budgetPerSet: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-stone-300 bg-stone-50/50 px-3.5 py-2 text-xs sm:text-sm outline-none transition focus:border-[var(--aloha-green)] focus:bg-white"
                  >
                    <option value="duoi-150k">Dưới 150.000đ / set</option>
                    <option value="150k-250k">150.000đ – 250.000đ / set</option>
                    <option value="250k-400k">250.000đ – 400.000đ / set</option>
                    <option value="tren-400k">Trên 400.000đ / set (Cao cấp)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider">
                    Ngày cần nhận hàng
                  </label>
                  <input
                    type="text"
                    value={form.eventDate}
                    onChange={(e) => setForm({ ...form, eventDate: e.target.value })}
                    placeholder="Ví dụ: 18/10 hoặc Cuối tháng..."
                    className="mt-1 w-full rounded-xl border border-stone-300 bg-stone-50/50 px-3.5 py-2 text-xs sm:text-sm outline-none transition focus:border-[var(--aloha-green)] focus:bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider">
                  Yêu cầu thêm (in logo, màu nơ, loại cây...)
                </label>
                <textarea
                  rows={2}
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder="Ghi chú thêm về yêu cầu in logo hoặc xuất hóa đơn VAT..."
                  className="mt-1 w-full rounded-xl border border-stone-300 bg-stone-50/50 px-3.5 py-2 text-xs sm:text-sm outline-none transition focus:border-[var(--aloha-green)] focus:bg-white"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--aloha-green-dark)] py-3 text-sm font-bold text-white shadow-md transition hover:bg-[var(--aloha-green)] disabled:opacity-50"
              >
                <Send size={15} />
                <span>{loading ? "Đang gửi yêu cầu..." : "Gửi Yêu Cầu Nhận Báo Giá & Catalog B2B"}</span>
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
