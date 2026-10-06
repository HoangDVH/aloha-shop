"use client";

import Link from "next/link";
import { Sprout } from "lucide-react";
import { ALOHA_ZALO } from "@/lib/plantDoctor/presets";

/** Màn hình cho khách khi Bác sĩ cây chưa mở công khai. */
export function PlantDoctorComingSoon({ loggedIn }: { loggedIn: boolean }) {
  return (
    <div className="flex flex-1 items-center justify-center px-4 py-10">
      <div className="w-full max-w-md rounded-3xl border border-emerald-100 bg-white p-7 text-center shadow-sm">
        <span className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
          <Sprout className="h-7 w-7" aria-hidden />
        </span>
        <h1 className="text-xl font-bold text-stone-900">Tính năng đang phát triển</h1>
        <p className="mt-2 text-sm leading-relaxed text-stone-600">
          Bác sĩ cây cảnh đang được Aloha hoàn thiện và sẽ sớm ra mắt. Trong lúc chờ, bạn cần tư vấn chăm cây cứ nhắn Zalo
          cho Aloha nhé.
        </p>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <a
            href={ALOHA_ZALO.href}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 items-center justify-center rounded-xl bg-emerald-700 px-5 text-sm font-semibold text-white hover:bg-emerald-800"
          >
            Nhắn Zalo {ALOHA_ZALO.label}
          </a>
          <Link
            href="/"
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-stone-200 px-5 text-sm font-semibold text-stone-700 hover:bg-stone-50"
          >
            Về trang chủ
          </Link>
        </div>
        {!loggedIn && (
          <p className="mt-5 text-xs text-stone-500">
            Tài khoản thử nghiệm?{" "}
            <Link href="/dang-nhap?next=/bac-si-cay" className="font-semibold text-emerald-700 underline">
              Đăng nhập
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}
