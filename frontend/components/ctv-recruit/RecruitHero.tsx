"use client";

import React from "react";
import { ChevronRight } from "lucide-react";
import { QUICK_BENEFITS } from "./recruitData";

export function RecruitHero({ onOpenForm }: { onOpenForm: () => void }) {
  return (
    <section className="relative overflow-hidden border-b border-stone-200/70 bg-[linear-gradient(135deg,#FFF8E8_0%,#FAF9F6_100%)]">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/decor/leaves-tr.png"
        alt=""
        aria-hidden
        className="pointer-events-none absolute -right-4 top-0 z-0 h-28 w-28 opacity-[0.06] sm:h-44 sm:w-44"
      />
      <div className="relative z-10 mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10 lg:py-12">
        <div className="mx-auto max-w-4xl text-center">
          <h1 className="text-[1.85rem] font-extrabold leading-[1.2] tracking-tight text-[#202622] sm:text-[2.35rem]">
            Chia sẻ cây xanh —{" "}
            <span className="text-[var(--aloha-green-dark)]">
              nhận hoa hồng
            </span>
          </h1>
          <ul className="mx-auto mt-5 grid max-w-3xl grid-cols-2 gap-x-4 gap-y-3 sm:flex sm:flex-wrap sm:items-center sm:justify-center sm:gap-x-6">
            {QUICK_BENEFITS.map(({ icon: Icon, title }) => (
              <li
                key={title}
                className="inline-flex items-center gap-2 text-[13px] font-medium text-stone-600 sm:text-sm"
              >
                <Icon
                  size={16}
                  strokeWidth={2}
                  className="shrink-0 text-[#526759]"
                  aria-hidden
                />
                {title}
              </li>
            ))}
          </ul>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={onOpenForm}
              className="inline-flex h-11 items-center gap-1.5 rounded-full bg-[var(--aloha-green-dark)] px-6 text-[15px] font-bold text-white shadow-sm transition hover:bg-[var(--aloha-green)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--aloha-green-dark)]"
            >
              Đăng ký ngay
              <ChevronRight size={18} aria-hidden />
            </button>
            <a
              href="https://zalo.me/0794901233"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-11 items-center gap-1.5 rounded-full border border-stone-300 bg-white px-5 text-[15px] font-bold text-[#202622] transition hover:bg-stone-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-stone-500"
            >
              Liên hệ tư vấn
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
