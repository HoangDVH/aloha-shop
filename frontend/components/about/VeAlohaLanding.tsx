"use client";

import React, { useState } from "react";
import { useQuoteSubmission } from "@/lib/useQuoteSubmission";
import Link from "next/link";
import {
  Compass,
  Gift,
  ArrowRight,
  Send,
  Phone,
  MapPin,
  Clock,
  CheckCircle2,
} from "lucide-react";
import { SHOP_BRAND } from "@/lib/brand";
import { CustomerReviews } from "./CustomerReviews";
import { CUSTOMER_REVIEWS_SEED } from "./customerReviewsSeed";
import { HomeVisionSection, HomeAboutMissionSection } from "@/components/HomeVisionMission";

// 5 Giá trị cốt lõi
const CORE_VALUES = [
  {
    number: "01",
    title: "Chất lượng thật – Giá trị thật",
    desc: "Cam kết sản phẩm đẹp – bền – giá trị thật, đúng như những gì khách hàng nhận được. Không chỉ bán sản phẩm, mà trao trọn niềm tin và sự hài lòng bền lâu.",
    highlight: "Giá trị từ sự chân thật",
  },
  {
    number: "02",
    title: "Làm việc có tâm – Kinh doanh có tầm",
    desc: "Mọi quy trình từ chọn cây, dưỡng rễ, phối chậu, đóng gói đến giao hàng đều phản ánh sự chỉn chu và cái tâm trong nghề. “Cái tâm vững – mới dựng được cái tầm bền.”",
    highlight: "Tâm vững – Tầm bền",
  },
  {
    number: "03",
    title: "Kỷ luật – Hiệu quả – Trách nhiệm",
    desc: "Mỗi cá nhân Aloha luôn chủ động, đúng hẹn và chịu trách nhiệm cao nhất với từng đơn quà của khách. Kỷ luật là sức mạnh giúp Aloha phát triển bền vững.",
    highlight: "Đúng hẹn từng khoảnh khắc",
  },
  {
    number: "04",
    title: "Học hỏi – Cải tiến – Đổi mới",
    desc: "Không ngừng cập nhật các phong cách chậu gốm mới, chậu hoa nổi 3D, tiểu cảnh terrarium sáng tạo. “Học để tốt hơn mỗi ngày.”",
    highlight: "Sáng tạo không ngừng",
  },
  {
    number: "05",
    title: "Xanh bền vững – Lan tỏa lối sống xanh",
    desc: "Aloha ưu tiên giá thể hữu cơ, chậu gốm Bát Tràng thân thiện môi trường, hạn chế rác thải nhựa, lan tỏa ý thức xanh và yêu thiên nhiên đến cộng đồng.",
    highlight: "Vì một tương lai xanh",
  },
];

export function VeAlohaLanding() {
  const { sent: formSent, loading: formLoading, error: formError, submit } = useQuoteSubmission();
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    occasion: "20/10 - Quà tặng phái đẹp",
    note: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await submit({ source: "gift_consultation", contactName: formData.name, phone: formData.phone, occasion: formData.occasion, notes: formData.note });
  };

  return (
    <div className="bg-white text-[var(--aloha-ink)] selection:bg-[var(--aloha-green)] selection:text-white">
      {/* ─────────────────────────────────────────────────────────────
          SECTION 1: HERO STORYTELLING (Phong cách Là Cây Concept)
      ───────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden border-b border-[var(--aloha-line)] bg-[#FDFBF7] py-10 sm:py-14 lg:py-18">
        {/* Font chữ Dancing Script mềm mại cho câu trích dẫn cảm xúc */}
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Dancing+Script:wght@600;700&display=swap"
        />

        {/* Họa tiết lá decor tự nhiên */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/decor/leaves-tr.png"
          alt=""
          aria-hidden
          className="pointer-events-none absolute -right-4 -top-4 z-0 h-36 w-36 opacity-15 sm:h-52 sm:w-52"
        />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/decor/leaves-bl.png"
          alt=""
          aria-hidden
          className="pointer-events-none absolute -left-6 -bottom-6 z-0 h-32 w-32 opacity-15 sm:h-48 sm:w-48"
        />

        <div className="relative z-10 mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          {/* Tiêu đề trung tâm thương hiệu */}
          <div className="mx-auto max-w-3xl text-center mb-8 sm:mb-12">
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold uppercase tracking-wider text-[#0E5242]">
              ALOHA THẾ GIỚI CHẬU CÂY
            </h1>
            <div className="mx-auto mt-2 h-0.5 w-24 bg-[#0E5242]/80" />
            <p className="mt-3 text-base sm:text-lg font-semibold italic text-stone-700">
              “Người bạn đồng hành gửi trao món quà xanh độc bản”.
            </p>
          </div>

          {/* Bố cục 2 cột: Trái văn bản cảm xúc, Phải bức ảnh chậu quà */}
          <div className="grid items-center gap-8 lg:grid-cols-12 lg:gap-12">
            {/* Cột trái: Đoạn trích dẫn viết tay + Giới thiệu */}
            <div className="lg:col-span-7 space-y-6">
              {/* Blockquote với viền vàng đồng & font chữ uốn lượn mềm mại */}
              <div className="border-l-[3.5px] border-[#D99A46] pl-5 sm:pl-7 py-1">
                <p
                  className="text-lg sm:text-xl lg:text-[23px] leading-relaxed text-stone-800"
                  style={{
                    fontFamily:
                      "'Dancing Script', 'Playfair Display', Georgia, cursive, serif",
                    fontWeight: 600,
                  }}
                >
                  Đã bao lần bạn đứng trước một dịp đặc biệt mà lòng bối rối: “Mình sẽ tặng gì cho người ấy đây?” Một món quà không chỉ đẹp, mà còn phải ý nghĩa, đủ tinh tế để thay lời muốn nói. Giữa vô vàn lựa chọn, bạn lại ao ước có một người bạn đồng hành, ai đó thấu hiểu, đủ khéo léo để biến những cảm xúc riêng của bạn thành một món quà thật trọn vẹn.
                </p>
              </div>

              {/* Đoạn văn giới thiệu triết lý Aloha */}
              <p className="text-sm sm:text-base leading-relaxed text-stone-700">
                Đó chính là lý do <strong>ALOHA – Thế Giới Chậu Cây</strong> ra đời – nơi cây xanh không chỉ là cây, mà là những câu chuyện được kể bằng sắc lá, bằng hơi thở của thiên nhiên. Ở Aloha, mỗi món quà đều được chuẩn bị với tất cả sự chỉn chu, dịu dưỡng, như cách một người bạn thân thiết lặng lẽ thay bạn chăm chút từng chi tiết nhỏ bé nhất.
              </p>

              {/* Slogan Aloha */}
              <div className="rounded-2xl border border-emerald-200/80 bg-emerald-50/70 px-4 py-3 text-xs sm:text-sm font-semibold text-emerald-900 shadow-2xs">
                🌿 Slogan: “{SHOP_BRAND} — Kiến tạo mọi không gian, nâng tầm cảm xúc.”
              </div>

              {/* Nút hành động */}
              <div className="flex flex-wrap items-center gap-3 pt-1">
                <a
                  href="#tam-nhin-aloha"
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-[var(--aloha-green-dark)] px-6 text-sm font-bold text-white shadow-md transition hover:bg-[var(--aloha-green)]"
                >
                  <Compass size={16} />
                  <span>Tầm Nhìn & Sứ Mệnh</span>
                </a>
                <Link
                  href="/qua-tang"
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-stone-300 bg-white px-6 text-sm font-bold text-stone-700 shadow-xs transition hover:border-[var(--aloha-green)] hover:text-[var(--aloha-green)]"
                >
                  <Gift size={16} />
                  <span>Bộ Sưu Tập Quà Tặng</span>
                </Link>
              </div>
            </div>

            {/* Cột phải: Bức ảnh chân dung chậu quà */}
            <div className="lg:col-span-5">
              <div className="relative mx-auto max-w-md overflow-hidden rounded-2xl border border-stone-200/80 bg-white p-2.5 shadow-xl">
                <div className="overflow-hidden rounded-xl bg-stone-100 aspect-[3/4]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/banners/ve-aloha/real-hong-ngoc-2010.jpg"
                    alt="Món quà xanh độc bản sen đá hồng ngọc tại Aloha"
                    className="h-full w-full object-cover transition duration-500 hover:scale-103"
                  />
                </div>
                <div className="p-3 text-center">
                  <p className="text-xs font-semibold text-stone-700">
                    Món quà xanh độc bản — Cây thật thực tế tại vườn Aloha, chỉn chu từ chậu cây, thắt nơ đến thiệp chúc
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          SECTION 2: TẦM NHÌN ALOHA (Nằm ngay sau mục Giới thiệu)
      ───────────────────────────────────────────────────────────── */}
      <section id="tam-nhin-aloha" className="relative scroll-mt-20 border-b border-[var(--aloha-line)]">
        <HomeVisionSection />
      </section>

      {/* ─────────────────────────────────────────────────────────────
          SECTION 2.5: VỀ ALOHA THẾ GIỚI CHẬU CÂY (Nằm ngay dưới mục Tầm nhìn)
      ───────────────────────────────────────────────────────────── */}
      <section id="ve-aloha-chi-tiet" className="relative scroll-mt-20 border-b border-[var(--aloha-line)]">
        <HomeAboutMissionSection
          ctaHref="#gia-tri-cot-loi"
          ctaLabel="Khám phá 5 giá trị cốt lõi"
        />
      </section>

      {/* ─────────────────────────────────────────────────────────────
          SECTION 3: 5 GIÁ TRỊ CỐT LÕI (Bento Grid)
      ───────────────────────────────────────────────────────────── */}
      <section id="gia-tri-cot-loi" className="relative scroll-mt-20 py-14 sm:py-18 lg:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <span className="text-xs font-bold uppercase tracking-wider text-[var(--aloha-green)]">
              Triết lý & Tinh thần Aloha
            </span>
            <h2 className="mt-2 text-2xl font-bold text-stone-900 sm:text-3xl lg:text-4xl">
              5 Giá Trị Cốt Lõi: Đặt Cái Tâm Vào Từng Nhánh Lá
            </h2>
            <p className="mt-3 text-sm text-stone-600 sm:text-base">
              “Chất lượng thật – Tâm trong nghề – Kỷ luật vững – Luôn học hỏi – Xanh bền vững.”
            </p>
          </div>

          <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {CORE_VALUES.map((val, idx) => (
              <div
                key={idx}
                className="group relative flex flex-col justify-between overflow-hidden rounded-3xl border border-stone-200/80 bg-white p-6 shadow-sm transition duration-300 hover:border-[var(--aloha-green)] hover:shadow-lg"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-2xl font-extrabold text-stone-300 group-hover:text-[var(--aloha-green)]">
                      {val.number}
                    </span>
                    <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-800">
                      {val.highlight}
                    </span>
                  </div>
                  <h3 className="mt-4 text-lg font-bold text-stone-900 group-hover:text-[var(--aloha-green)]">
                    {val.title}
                  </h3>
                  <p className="mt-3 text-xs leading-relaxed text-stone-600 sm:text-sm">
                    {val.desc}
                  </p>
                </div>
                <div className="mt-6 pt-4 border-t border-stone-100 flex items-center gap-1.5 text-xs font-semibold text-[var(--aloha-green)]">
                  <span>Cam kết từ Aloha</span>
                  <ArrowRight size={13} />
                </div>
              </div>
            ))}

            {/* Thẻ thứ 6: Câu nói tâm đắc */}
            <div className="flex flex-col justify-center rounded-3xl bg-gradient-to-br from-[var(--aloha-green-dark)] to-[#0c7031] p-6 text-white shadow-md">
              <span className="text-3xl">🌱</span>
              <h3 className="mt-3 text-lg font-bold">“Cái tâm vững – mới dựng được cái tầm bền.”</h3>
              <p className="mt-2 text-xs leading-relaxed text-emerald-100/90 sm:text-sm">
                Chúng tôi hiểu rằng một món quà gửi đi không chỉ đại diện cho Aloha, mà là danh dự và tình cảm của chính
                bạn. Sự chỉn chu là lời hứa danh dự của chúng tôi.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          SECTION 4: NĂNG LỰC CUNG ỨNG & XƯỞNG SẢN XUẤT
      ───────────────────────────────────────────────────────────── */}
      <section
        id="nang-luc-cung-ung"
        className="relative scroll-mt-20 border-t border-[var(--aloha-line)] bg-[#FAF8F5] py-14 sm:py-18 lg:py-20"
      >
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <span className="text-xs font-bold uppercase tracking-wider text-[var(--aloha-green)]">
              Quy mô & Lợi thế cạnh tranh
            </span>
            <h2 className="mt-2 text-2xl font-bold text-stone-900 sm:text-3xl lg:text-4xl">
              Năng Lực Xưởng Sản Xuất Aloha
            </h2>
            <p className="mt-3 text-sm text-stone-600 sm:text-base">
              Không chỉ là cửa hàng bán lẻ, Aloha là xưởng sản xuất và phân phối trực tiếp quy mô lớn tại TP.HCM
            </p>
          </div>

          {/* 4 Chỉ số năng lực */}
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl border border-stone-200/80 bg-white p-5 text-center shadow-xs">
              <p className="text-3xl font-black text-[var(--aloha-green-dark)] sm:text-4xl">2.000+</p>
              <h3 className="mt-2 text-sm font-bold text-stone-900">Mã Mẫu Chậu & Cây Cảnh</h3>
              <p className="mt-1 text-xs text-stone-500">Mục tiêu đạt 10.000 mã tinh chọn phục vụ mọi nhu cầu.</p>
            </div>
            <div className="rounded-2xl border border-stone-200/80 bg-white p-5 text-center shadow-xs">
              <p className="text-3xl font-black text-[var(--aloha-green-dark)] sm:text-4xl">100%</p>
              <h3 className="mt-2 text-sm font-bold text-stone-900">Sản Xuất Trực Tiếp</h3>
              <p className="mt-1 text-xs text-stone-500">Trồng sẵn cây thành phẩm, tối ưu chi phí tận xưởng không qua trung gian.</p>
            </div>
            <div className="rounded-2xl border border-stone-200/80 bg-white p-5 text-center shadow-xs">
              <p className="text-3xl font-black text-[var(--aloha-green-dark)] sm:text-4xl">Trọn Bộ</p>
              <h3 className="mt-2 text-sm font-bold text-stone-900">Giải Pháp Cảnh Quan</h3>
              <p className="mt-1 text-xs text-stone-500">Cây nội – ngoại thất, chậu Bát Tràng, gốm 3D, giá thể, phân bón hữu cơ.</p>
            </div>
            <div className="rounded-2xl border border-stone-200/80 bg-white p-5 text-center shadow-xs">
              <p className="text-3xl font-black text-[var(--aloha-green-dark)] sm:text-4xl">Toàn Diện</p>
              <h3 className="mt-2 text-sm font-bold text-stone-900">Tư Vấn & Thi Công</h3>
              <p className="mt-1 text-xs text-stone-500">Thiết kế, thi công và bảo trì cảnh quan trọn gói cho văn phòng, biệt thự.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          SECTION 5: THÔNG TIN LIÊN HỆ & FORM TƯ VẤN QUÀ TẶNG
      ───────────────────────────────────────────────────────────── */}
      <section
        id="lien-he-tu-van"
        className="relative scroll-mt-20 border-t border-[var(--aloha-line)] bg-stone-50 py-14 sm:py-18 lg:py-20"
      >
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-10 lg:grid-cols-12">
            {/* Thông tin liên hệ xưởng */}
            <div className="lg:col-span-5">
              <span className="text-xs font-bold uppercase tracking-wider text-[var(--aloha-green)]">
                Thông tin liên hệ
              </span>
              <h2 className="mt-2 text-2xl font-bold text-stone-900 sm:text-3xl">
                Ghé Thăm Xưởng Hoặc Kết Nối Trực Tiếp
              </h2>
              <p className="mt-3 text-sm text-stone-600 leading-relaxed">
                Aloha luôn mở rộng cửa đón chào bạn đến tận nơi ngắm nhìn, chạm tay vào từng phiến lá và lựa chọn chậu
                cây ưng ý nhất.
              </p>

              <div className="mt-6 space-y-4">
                <div className="flex items-start gap-3 rounded-2xl bg-white p-4 shadow-xs border border-stone-200/60">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-[var(--aloha-green)]">
                    <MapPin size={20} />
                  </span>
                  <div>
                    <h4 className="text-xs font-bold text-stone-900 uppercase tracking-wider">Địa chỉ xưởng</h4>
                    <p className="mt-0.5 text-sm font-semibold text-stone-800">
                      90/2 Nguyễn Phúc Chu, Phường 15, Quận Tân Bình, TP.HCM
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 rounded-2xl bg-white p-4 shadow-xs border border-stone-200/60">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-[var(--aloha-green)]">
                    <Phone size={20} />
                  </span>
                  <div>
                    <h4 className="text-xs font-bold text-stone-900 uppercase tracking-wider">Hotline & Zalo OA</h4>
                    <a
                      href="tel:0794901233"
                      className="mt-0.5 text-sm font-bold text-[var(--aloha-green-dark)] hover:underline"
                    >
                      079 490 1233
                    </a>
                  </div>
                </div>

                <div className="flex items-start gap-3 rounded-2xl bg-white p-4 shadow-xs border border-stone-200/60">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-[var(--aloha-green)]">
                    <Clock size={20} />
                  </span>
                  <div>
                    <h4 className="text-xs font-bold text-stone-900 uppercase tracking-wider">Giờ mở cửa</h4>
                    <p className="mt-0.5 text-sm text-stone-700">08:00 – 18:30 (Thứ 2 – Chủ nhật)</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Form nhận tư vấn mẫu quà */}
            <div className="lg:col-span-7">
              <div className="rounded-3xl border border-stone-200 bg-white p-6 shadow-xl sm:p-8">
                <h3 className="text-xl font-bold text-stone-900 sm:text-2xl">
                  Nhận Tư Vấn Mẫu Quà Độc Bản & Báo Giá
                </h3>
                <p className="mt-1 text-xs text-stone-500 sm:text-sm">
                  Để lại thông tin, Aloha sẽ liên hệ gửi ảnh mẫu thực tế và tư vấn tận tình trong 5 phút.
                </p>

                {formSent ? (
                  <div className="mt-6 rounded-2xl bg-emerald-50 p-6 text-center text-emerald-800">
                    <CheckCircle2 size={36} className="mx-auto mb-2 text-[var(--aloha-green)]" />
                    <h4 className="text-base font-bold">Aloha đã nhận thông tin của bạn!</h4>
                    <p className="mt-1 text-xs text-emerald-700">
                      Chuyên viên tư vấn quà tặng sẽ liên hệ qua SĐT/Zalo của bạn ngay ít phút nữa.
                    </p>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                    {formError ? <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{formError}</p> : null}
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider">
                          Họ và tên của bạn *
                        </label>
                        <input
                          type="text"
                          required
                          value={formData.name}
                          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                          placeholder="Nguyễn Văn A"
                          className="mt-1.5 w-full rounded-xl border border-stone-300 bg-stone-50/50 px-3.5 py-2.5 text-sm outline-none transition focus:border-[var(--aloha-green)] focus:bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider">
                          Số điện thoại (hoặc Zalo) *
                        </label>
                        <input
                          type="tel"
                          required
                          value={formData.phone}
                          onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                          placeholder="09xx xxx xxx"
                          className="mt-1.5 w-full rounded-xl border border-stone-300 bg-stone-50/50 px-3.5 py-2.5 text-sm outline-none transition focus:border-[var(--aloha-green)] focus:bg-white"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider">
                        Dịp trao tặng & Nhu cầu
                      </label>
                      <select
                        value={formData.occasion}
                        onChange={(e) => setFormData({ ...formData, occasion: e.target.value })}
                        className="mt-1.5 w-full rounded-xl border border-stone-300 bg-stone-50/50 px-3.5 py-2.5 text-sm outline-none transition focus:border-[var(--aloha-green)] focus:bg-white"
                      >
                        <option value="20/10 - Quà tặng phái đẹp">Quà 20/10 cho Mẹ / Vợ / Bạn gái</option>
                        <option value="Quà tặng doanh nghiệp (B2B số lượng lớn)">
                          Quà doanh nghiệp 20/10 (in logo, số lượng lớn)
                        </option>
                        <option value="Sinh nhật / Kỷ niệm">Sinh nhật / Ngày kỷ niệm</option>
                        <option value="Tân gia / Khai trương">Tân gia / Khai trương phong thủy</option>
                        <option value="Tư vấn cảnh quan văn phòng">Tư vấn cảnh quan văn phòng / Nhà ở</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider">
                        Lời nhắn gửi (hoặc yêu cầu thiệp viết tay)
                      </label>
                      <textarea
                        rows={3}
                        value={formData.note}
                        onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                        placeholder="Ví dụ: Mình muốn tặng mẹ dịp 20/10, mong muốn viết thiệp chúc mẹ mạnh khỏe..."
                        className="mt-1.5 w-full rounded-xl border border-stone-300 bg-stone-50/50 px-3.5 py-2.5 text-sm outline-none transition focus:border-[var(--aloha-green)] focus:bg-white"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={formLoading}
                      className="flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--aloha-green-dark)] py-3 text-sm font-bold text-white shadow-md transition hover:bg-[var(--aloha-green)]"
                    >
                      <Send size={16} />
                      <span>{formLoading ? "Đang gửi yêu cầu..." : "Gửi Yêu Cầu Nhận Tư Vấn Mẫu Quà"}</span>
                    </button>
                  </form>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Đánh giá khách hàng thực tế */}
      <CustomerReviews reviews={CUSTOMER_REVIEWS_SEED} demo />
    </div>
  );
}
