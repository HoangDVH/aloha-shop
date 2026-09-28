import React from "react";
import { CtvTermsBody } from "@/components/ctv-recruit/CtvTermsAccept";

export function RecruitTerms() {
  return (
    <section
      id="dieu-khoan-ctv"
      className="scroll-mt-24 border-t border-[var(--aloha-line)] bg-white py-10 sm:py-12"
    >
      <div className="mx-auto max-w-3xl px-4">
        <h2 className="text-xl font-extrabold text-[#202622] sm:text-2xl">
          Điều khoản cộng tác viên
        </h2>
        <div className="mt-4">
          <CtvTermsBody />
        </div>
      </div>
    </section>
  );
}
