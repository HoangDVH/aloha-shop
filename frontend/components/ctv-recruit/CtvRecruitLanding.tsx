"use client";

import React, { useEffect, useState } from "react";
import { useShopAuth } from "@/components/ShopAuthProvider";
import { RecruitHero } from "./RecruitHero";
import { RecruitWhy } from "./RecruitWhy";
import { RecruitSteps } from "./RecruitSteps";
import { RecruitTerms } from "./RecruitTerms";
import { CtvRecruitForm } from "./CtvRecruitForm";

/** Landing tuyển CTV — UI theo mock + đăng ký CTV thật. */
export function CtvRecruitLanding() {
  const { user } = useShopAuth();
  const [formOpen, setFormOpen] = useState(false);

  useEffect(() => {
    if (!formOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFormOpen(false);
    };
    document.addEventListener("keydown", onKey);

    // Chuẩn khóa cuộn an toàn cho iOS Safari (body-scroll-lock technique)
    const scrollY = window.scrollY;
    const originalPosition = document.body.style.position;
    const originalTop = document.body.style.top;
    const originalWidth = document.body.style.width;

    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = "100%";

    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.position = originalPosition;
      document.body.style.top = originalTop;
      document.body.style.width = originalWidth;
      window.scrollTo(0, scrollY);
    };
  }, [formOpen]);

  const openForm = () => setFormOpen(true);
  const closeForm = () => setFormOpen(false);

  return (
    <div className="bg-[#F7F7F4] text-[#202622]">
      {/* Hero — 2 cột kiểu landing Affiliate sàn TMĐT */}
      <RecruitHero onOpenForm={openForm} />

      {/* Form đăng ký — chỉ hiện khi bấm Đăng ký ngay */}
      {formOpen ? (
        <div
          className="fixed inset-0 z-[80] flex items-end justify-center p-0 sm:items-center sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby="ctv-dang-ky"
        >
          <div
            className="absolute inset-0 bg-[#0b141a]/55 backdrop-blur-[2px] cursor-pointer"
            aria-hidden="true"
            onClick={closeForm}
          />
          <div className="relative z-10 max-h-[min(92dvh,720px)] w-full max-w-lg overflow-y-auto overscroll-contain rounded-t-2xl sm:rounded-2xl ios-scroll-touch">
            <CtvRecruitForm key={user?.id || "guest"} onClose={closeForm} />
          </div>
        </div>
      ) : null}

      {/* Vì sao */}
      <RecruitWhy />

      {/* Quy trình */}
      <RecruitSteps />

      {/* Điều khoản CTV */}
      <RecruitTerms />
    </div>
  );
}
