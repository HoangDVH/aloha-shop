"use client";

import React from "react";
import { RecruitHero } from "./RecruitHero";
import { RecruitWhy } from "./RecruitWhy";
import { RecruitSteps } from "./RecruitSteps";
import { RecruitTerms } from "./RecruitTerms";
import { CtvRecruitForm } from "./CtvRecruitForm";

/** Landing tuyển CTV — UI chuẩn sàn TMĐT (Shopee/TikTok Affiliate): nhúng form trực tiếp trên trang */
export function CtvRecruitLanding() {
  const scrollToForm = () => {
    const el = document.getElementById("form-dang-ky");
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <div className="bg-[#F7F7F4] text-[#202622]">
      {/* Hero — Giới thiệu hoa hồng & nút Đăng ký ngay cuộn xuống form */}
      <RecruitHero onOpenForm={scrollToForm} />

      {/* Form đăng ký CTV — Nhúng trực tiếp trên trang, chống lỗi bàn phím 100% trên iPhone */}
      <section id="form-dang-ky" className="mx-auto max-w-xl px-4 py-8 sm:py-12 scroll-mt-20">
        <CtvRecruitForm />
      </section>

      {/* Vì sao nên trở thành CTV */}
      <RecruitWhy />

      {/* Quy trình tham gia đơn giản */}
      <RecruitSteps />

      {/* Điều khoản CTV */}
      <RecruitTerms />
    </div>
  );
}
