import React from "react";
import { Sprout } from "lucide-react";
import { STEPS } from "./recruitData";

export function RecruitSteps() {
  return (
    <section className="border-y border-[var(--aloha-line)] bg-white py-12 sm:py-14">
      <div className="mx-auto max-w-7xl px-4">
        <h2 className="flex items-center gap-2 text-2xl font-extrabold text-[#202622] sm:text-[1.75rem]">
          <Sprout size={22} className="text-[#526759]" aria-hidden />
          Quy trình tham gia đơn giản
        </h2>
        <div className="mt-10 grid gap-6 md:grid-cols-3 md:gap-4">
          {STEPS.map((step, i) => (
            <div
              key={step.n}
              className="relative flex flex-col items-center text-center md:px-4"
            >
              {i < STEPS.length - 1 ? (
                <span
                  className="pointer-events-none absolute top-7 left-[58%] hidden h-0.5 w-[84%] bg-stone-200 md:block"
                  aria-hidden
                />
              ) : null}
              <span className="relative z-10 flex h-14 w-14 items-center justify-center rounded-full bg-stone-100 text-lg font-bold text-[#202622] ring-1 ring-stone-200">
                {step.n}
              </span>
              <span className="mt-3 text-[#526759]">
                <step.icon size={22} strokeWidth={1.75} aria-hidden />
              </span>
              <h3 className="mt-2 text-base font-extrabold text-[var(--aloha-ink)]">
                {step.title}
              </h3>
              <p className="mt-1.5 max-w-[16rem] text-sm text-[var(--aloha-muted)]">
                {step.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
