import React from "react";
import { WHY_CARDS } from "./recruitData";

export function RecruitWhy() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-12 sm:py-14">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <h2 className="text-2xl font-extrabold text-[#202622] sm:text-[1.75rem]">
          Vì sao nên trở thành CTV Aloha?
        </h2>
        <p className="max-w-md text-sm text-[var(--aloha-muted)]">
          Lợi ích rõ ràng — phù hợp người mới bắt đầu bán online.
        </p>
      </div>
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {WHY_CARDS.map(({ icon: Icon, title, desc }) => (
          <article
            key={title}
            className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-stone-200 transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-stone-100 text-[#526759]">
              <Icon size={22} strokeWidth={1.75} aria-hidden />
            </span>
            <h3 className="mt-3 text-[15px] font-extrabold text-[var(--aloha-ink)]">
              {title}
            </h3>
            <p className="mt-1.5 text-[13px] leading-relaxed text-[var(--aloha-muted)]">
              {desc}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}
