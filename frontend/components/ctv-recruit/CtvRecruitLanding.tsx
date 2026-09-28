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
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
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
          <button
            type="button"
            className="absolute inset-0 bg-[#0b141a]/55 backdrop-blur-[2px]"
            aria-label="Đóng"
            onClick={closeForm}
          />
          <div className="relative z-[1] max-h-[min(92svh,720px)] w-full max-w-lg overflow-y-auto rounded-t-2xl sm:rounded-2xl">
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
