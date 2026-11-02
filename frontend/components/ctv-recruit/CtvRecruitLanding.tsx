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

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [formOpen]);

  const openForm = () => setFormOpen(true);
  const closeForm = () => setFormOpen(false);

  return (
    <div className="bg-[#F7F7F4] text-[#202622]">
      {/* Hero — 2 cột kiểu landing Affiliate sàn TMĐT */}
      <RecruitHero onOpenForm={openForm} />

      {/* Form đăng ký — mở toàn màn hình cuộn mượt trên Mobile, dạng popup modal trên Desktop */}
      {formOpen ? (
        <div
          className="fixed inset-0 z-[80] overflow-y-auto bg-[#0b141a]/60 backdrop-blur-xs sm:p-6 sm:flex sm:items-center sm:justify-center ios-scroll-touch"
          role="dialog"
          aria-modal="true"
          aria-labelledby="ctv-dang-ky"
        >
          {/* Backdrop click on desktop */}
          <div
            className="hidden sm:block absolute inset-0 cursor-pointer"
            aria-hidden="true"
            onClick={closeForm}
          />
          <div className="relative z-10 w-full min-h-full sm:min-h-0 sm:max-w-lg sm:rounded-2xl bg-white shadow-2xl">
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
