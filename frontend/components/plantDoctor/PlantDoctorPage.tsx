"use client";

import { Sparkles } from "lucide-react";
import { Clinic } from "./Clinic";

/** Trang "Bác sĩ cây cảnh" cho khách: chẩn đoán bệnh cây bằng AI. */
export function PlantDoctorPage() {
  return (
    <div className="bg-gradient-to-b from-[#FAF8F5] via-[#F4EFE6] to-[#FAF8F5] min-h-[calc(100vh-130px)]">
      <section className="mx-auto max-w-7xl px-3 pb-12 pt-3 sm:px-4 sm:pt-5">
        {/* Header tinh gọn, chuẩn app chẩn đoán lớn (PictureThis / The Sill) */}
        <header className="mb-4 sm:mb-5 text-center">
          <div className="flex items-center justify-center gap-2">
            <h1 className="font-serif text-2xl sm:text-3xl font-black text-[#1C4C40] tracking-tight">
              Bác sĩ cây cảnh
            </h1>
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-bold text-[#1C4C40]">
              <Sparkles size={11} className="text-emerald-700" /> AI Miễn Phí
            </span>
          </div>
          <p className="mt-1 text-xs sm:text-sm text-stone-600">
            Chụp ảnh cây để AI nhận diện bệnh & hướng dẫn phác đồ cứu cây trong 3 giây.
          </p>
        </header>

        <Clinic />
      </section>
    </div>
  );
}
