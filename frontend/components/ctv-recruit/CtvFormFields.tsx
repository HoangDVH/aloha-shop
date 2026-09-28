"use client";

import React from "react";
import {
  Controller,
  type Control,
  type UseFormRegister,
} from "react-hook-form";
import { PasswordField } from "@/components/PasswordField";
import {
  CTV_REFERRAL_CHANNELS,
  CTV_REFERRAL_SOURCES,
} from "@/lib/ctvRecruitSchema";
import type { CtvFormValues } from "./recruitData";

export function CtvFormFields({
  register,
  control,
  hasExp,
  loggedIn,
  userEmail,
  fieldErr,
}: {
  register: UseFormRegister<CtvFormValues>;
  control: Control<CtvFormValues>;
  hasExp: string | undefined;
  loggedIn: boolean;
  userEmail?: string;
  fieldErr: (name: keyof CtvFormValues) => string | null;
}) {
  return (
    <>
      <fieldset className="space-y-3.5">
        <legend className="text-[11px] font-bold tracking-wide text-slate-500 uppercase">
          Liên hệ
        </legend>
        <div>
          <label
            className="mb-1.5 block text-xs font-semibold text-slate-600"
            htmlFor="ctv-name"
          >
            Họ và tên
          </label>
          <input
            id="ctv-name"
            placeholder="Nguyễn Văn A"
            className="auth-field"
            {...register("fullName")}
          />
          {fieldErr("fullName") ? (
            <p className="mt-1 text-xs font-medium text-red-600">
              {fieldErr("fullName")}
            </p>
          ) : null}
        </div>
        <div>
          <label
            className="mb-1.5 block text-xs font-semibold text-slate-600"
            htmlFor="ctv-phone"
          >
            Số điện thoại
          </label>
          <input
            id="ctv-phone"
            inputMode="tel"
            placeholder="09xx xxx xxx"
            className="auth-field"
            {...register("phone")}
          />
          {fieldErr("phone") ? (
            <p className="mt-1 text-xs font-medium text-red-600">
              {fieldErr("phone")}
            </p>
          ) : null}
        </div>
        <div>
          <label
            className="mb-1.5 block text-xs font-semibold text-slate-600"
            htmlFor="ctv-zalo"
          >
            Zalo
          </label>
          <input
            id="ctv-zalo"
            placeholder="SĐT Zalo hoặc https://zalo.me/..."
            className="auth-field"
            {...register("zalo")}
          />
          {fieldErr("zalo") ? (
            <p className="mt-1 text-xs font-medium text-red-600">
              {fieldErr("zalo")}
            </p>
          ) : null}
        </div>
        {!loggedIn ? (
          <>
            <div>
              <label
                className="mb-1.5 block text-xs font-semibold text-slate-600"
                htmlFor="ctv-email"
              >
                Email
              </label>
              <input
                id="ctv-email"
                type="email"
                autoComplete="email"
                placeholder="ban@email.com"
                className="auth-field"
                {...register("email" as keyof CtvFormValues)}
              />
              {fieldErr("email" as keyof CtvFormValues) ? (
                <p className="mt-1 text-xs font-medium text-red-600">
                  {fieldErr("email" as keyof CtvFormValues)}
                </p>
              ) : null}
            </div>
            <PasswordField
              id="ctv-pass"
              label="Mật khẩu"
              autoComplete="new-password"
              placeholder="Ít nhất 8 ký tự"
              error={fieldErr("password" as keyof CtvFormValues) || undefined}
              {...register("password" as keyof CtvFormValues)}
            />
            <PasswordField
              id="ctv-pass2"
              label="Xác nhận mật khẩu"
              autoComplete="new-password"
              placeholder="Nhập lại mật khẩu"
              error={
                fieldErr("passwordConfirm" as keyof CtvFormValues) || undefined
              }
              {...register("passwordConfirm" as keyof CtvFormValues)}
            />
          </>
        ) : (
          <p className="rounded-xl bg-[var(--aloha-green-light)]/70 px-3 py-2 text-xs text-[var(--aloha-muted)]">
            Đang nộp trên tài khoản <strong>{userEmail}</strong> — không cần
            nhập lại email / mật khẩu.
          </p>
        )}
        <div>
          <label
            className="mb-1.5 block text-xs font-semibold text-slate-600"
            htmlFor="ctv-addr"
          >
            Địa chỉ
          </label>
          <input
            id="ctv-addr"
            placeholder="Số nhà, đường, phường, tỉnh/thành"
            className="auth-field"
            {...register("addressText")}
          />
          {fieldErr("addressText") ? (
            <p className="mt-1 text-xs font-medium text-red-600">
              {fieldErr("addressText")}
            </p>
          ) : null}
        </div>
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="text-[11px] font-bold tracking-wide text-slate-500 uppercase">
          Kinh nghiệm kinh doanh
        </legend>
        <Controller
          name="hasBusinessExp"
          control={control}
          render={({ field }) => (
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  { v: "chua_co" as const, label: "Chưa có" },
                  { v: "co_roi" as const, label: "Có rồi" },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.v}
                  type="button"
                  onClick={() => field.onChange(opt.v)}
                  className={`rounded-xl px-3 py-3 text-sm font-bold ring-1 transition ${
                    field.value === opt.v
                      ? "bg-[var(--aloha-green-light)] text-[var(--aloha-green-dark)] ring-[var(--aloha-green)]"
                      : "bg-white text-slate-600 ring-[var(--aloha-line)] hover:bg-slate-50"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        />
        {fieldErr("hasBusinessExp") ? (
          <p className="text-xs font-medium text-red-600">
            {fieldErr("hasBusinessExp")}
          </p>
        ) : null}
        {hasExp === "co_roi" ? (
          <div className="space-y-3 rounded-xl bg-[#FDF6E3]/70 p-3 ring-1 ring-[var(--aloha-border-brown)]/40">
            <div>
              <label
                className="mb-1.5 block text-xs font-semibold text-slate-600"
                htmlFor="ctv-exp-note"
              >
                Bạn đang / đã kinh doanh gì?
              </label>
              <input
                id="ctv-exp-note"
                placeholder="VD: bán cây cảnh trên Facebook"
                className="auth-field"
                {...register("businessExpNote")}
              />
              {fieldErr("businessExpNote") ? (
                <p className="mt-1 text-xs font-medium text-red-600">
                  {fieldErr("businessExpNote")}
                </p>
              ) : null}
            </div>
            <div>
              <label
                className="mb-1.5 block text-xs font-semibold text-slate-600"
                htmlFor="ctv-exp-years"
              >
                Số năm kinh nghiệm
              </label>
              <input
                id="ctv-exp-years"
                type="number"
                min={1}
                max={50}
                inputMode="numeric"
                placeholder="1–50"
                className="auth-field"
                {...register("businessExpYears")}
              />
              {fieldErr("businessExpYears") ? (
                <p className="mt-1 text-xs font-medium text-red-600">
                  {fieldErr("businessExpYears")}
                </p>
              ) : null}
            </div>
            <div>
              <p className="mb-1.5 text-[11px] font-bold tracking-wide text-slate-500 uppercase">
                Kênh bán
              </p>
              <label
                className="mb-1.5 block text-xs font-semibold text-slate-600"
                htmlFor="ctv-channel"
              >
                Bạn bán chủ yếu trên kênh nào?
              </label>
              <select
                id="ctv-channel"
                className="auth-field"
                {...register("referralChannel")}
              >
                <option value="">— Chọn kênh —</option>
                {CTV_REFERRAL_CHANNELS.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
              {fieldErr("referralChannel") ? (
                <p className="mt-1 text-xs font-medium text-red-600">
                  {fieldErr("referralChannel")}
                </p>
              ) : null}
            </div>
            <div>
              <label
                className="mb-1.5 block text-xs font-semibold text-slate-600"
                htmlFor="ctv-url"
              >
                Link kênh / trang bán
              </label>
              <input
                id="ctv-url"
                placeholder="https://..."
                className="auth-field"
                {...register("channelUrl")}
              />
              {fieldErr("channelUrl") ? (
                <p className="mt-1 text-xs font-medium text-red-600">
                  {fieldErr("channelUrl")}
                </p>
              ) : null}
            </div>
          </div>
        ) : null}
      </fieldset>

      <fieldset className="space-y-3.5">
        <legend className="text-[11px] font-bold tracking-wide text-slate-500 uppercase">
          Bạn biết đến Aloha
        </legend>
        <div>
          <label
            className="mb-1.5 block text-xs font-semibold text-slate-600"
            htmlFor="ctv-source"
          >
            Bạn biết đến Aloha qua đâu?{" "}
            <span className="font-normal text-slate-400">(tuỳ chọn)</span>
          </label>
          <select
            id="ctv-source"
            className="auth-field"
            {...register("referralSource")}
          >
            <option value="">— Chọn nguồn —</option>
            {CTV_REFERRAL_SOURCES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
      </fieldset>
    </>
  );
}
