"use client";

import React, { useEffect, useState } from "react";
import {
  Calendar,
  Check,
  Link2,
  Lock,
  Mail,
  MapPin,
  Phone,
  User,
  Users,
  X,
} from "lucide-react";

export type AddCtvFormValues = {
  fullName: string;
  phone: string;
  email: string;
  address: string;
  gender: "" | "male" | "female" | "other";
  birthday: string;
  referralChannel: string;
  username: string;
  password: string;
  role: "ctv";
  sendInvite: boolean;
};

const emptyForm = (): AddCtvFormValues => ({
  fullName: "",
  phone: "",
  email: "",
  address: "",
  gender: "",
  birthday: "",
  referralChannel: "",
  username: "",
  password: "",
  role: "ctv",
  sendInvite: true,
});

const REFERRAL_CHANNELS = [
  { value: "facebook", label: "Facebook" },
  { value: "zalo", label: "Zalo" },
  { value: "tiktok", label: "TikTok" },
  { value: "youtube", label: "YouTube" },
  { value: "ban_be", label: "Bạn bè / giới thiệu" },
  { value: "khac", label: "Khác" },
];

const INPUT_CLS = [
  "w-full rounded-lg border border-slate-200 bg-white",
  "py-[10px] pl-10 pr-3 text-[13px] text-[#1a2e1a] outline-none",
  "placeholder:text-slate-400 focus:border-[#2D5A27]",
].join(" ");

function Field({
  label,
  required,
  hint,
  icon,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <label className="block min-w-0">
      <span className="mb-[6px] block text-[12px] font-bold text-[#1a2e1a]">
        {label}
        {required ? <span className="text-rose-500"> *</span> : null}
        {hint ? (
          <span className="font-semibold text-slate-400"> {hint}</span>
        ) : null}
      </span>
      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#2D5A27]">
          {icon}
        </span>
        {children}
      </div>
    </label>
  );
}

export function AddCtvModal({
  open,
  onClose,
  onSubmit,
  busy,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (values: AddCtvFormValues) => Promise<void> | void;
  busy?: boolean;
}) {
  const [form, setForm] = useState<AddCtvFormValues>(emptyForm);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setForm(emptyForm());
    setError("");
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, busy, onClose]);

  if (!open) return null;

  function set<K extends keyof AddCtvFormValues>(
    key: K,
    value: AddCtvFormValues[K]
  ) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSave() {
    setError("");
    if (!form.fullName.trim()) return setError("Nhập họ và tên");
    if (!form.phone.trim()) return setError("Nhập số điện thoại");
    if (!form.username.trim()) return setError("Nhập tên đăng nhập");
    if (form.password.length < 8) {
      return setError("Mật khẩu tạm thời tối thiểu 8 ký tự");
    }
    try {
      await onSubmit(form);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không lưu được");
    }
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-3 sm:p-6">
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        aria-label="Đóng"
        disabled={busy}
        onClick={() => {
          if (!busy) onClose();
        }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-ctv-title"
        className="relative z-10 flex max-h-[min(920px,92vh)] w-full max-w-[920px] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-[#eef2ee] px-5 py-4">
          <h2
            id="add-ctv-title"
            className="m-0 text-[18px] font-extrabold text-[#1a2e1a]"
          >
            Thêm cộng tác viên
          </h2>
          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            className="rounded-lg p-[6px] text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <X size={18} />
          </button>
        </div>

        <div className="grid min-h-0 flex-1 overflow-y-auto lg:grid-cols-[1fr_240px]">
          <div className="space-y-5 p-5">
            <section>
              <h3 className="mb-3 mt-0 text-[13px] font-extrabold uppercase tracking-wide text-[#2D5A27]">
                Thông tin cơ bản
              </h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Họ và tên" required icon={<User size={15} />}>
                  <input
                    className={INPUT_CLS}
                    placeholder="Nhập họ và tên"
                    value={form.fullName}
                    onChange={(e) => set("fullName", e.target.value)}
                  />
                </Field>
                <Field
                  label="Số điện thoại"
                  required
                  icon={<Phone size={15} />}
                >
                  <input
                    className={INPUT_CLS}
                    placeholder="Nhập số điện thoại"
                    value={form.phone}
                    onChange={(e) => set("phone", e.target.value)}
                  />
                </Field>
                <Field
                  label="Email"
                  hint="(không bắt buộc)"
                  icon={<Mail size={15} />}
                >
                  <input
                    className={INPUT_CLS}
                    placeholder="Nhập email (không bắt buộc)"
                    value={form.email}
                    onChange={(e) => set("email", e.target.value)}
                  />
                </Field>
                <Field
                  label="Địa chỉ"
                  hint="(không bắt buộc)"
                  icon={<MapPin size={15} />}
                >
                  <input
                    className={INPUT_CLS}
                    placeholder="Nhập địa chỉ (không bắt buộc)"
                    value={form.address}
                    onChange={(e) => set("address", e.target.value)}
                  />
                </Field>
                <Field label="Giới tính" icon={<Users size={15} />}>
                  <select
                    className={`${INPUT_CLS} appearance-none`}
                    value={form.gender}
                    onChange={(e) =>
                      set(
                        "gender",
                        e.target.value as AddCtvFormValues["gender"]
                      )
                    }
                  >
                    <option value="">Chọn giới tính</option>
                    <option value="male">Nam</option>
                    <option value="female">Nữ</option>
                    <option value="other">Khác</option>
                  </select>
                </Field>
                <Field label="Ngày sinh" icon={<Calendar size={15} />}>
                  <input
                    type="date"
                    className={INPUT_CLS}
                    value={form.birthday}
                    onChange={(e) => set("birthday", e.target.value)}
                  />
                </Field>
                <div className="sm:col-span-2">
                  <Field label="Kênh giới thiệu" icon={<Link2 size={15} />}>
                    <select
                      className={`${INPUT_CLS} appearance-none`}
                      value={form.referralChannel}
                      onChange={(e) => set("referralChannel", e.target.value)}
                    >
                      <option value="">Chọn kênh giới thiệu</option>
                      {REFERRAL_CHANNELS.map((c) => (
                        <option key={c.value} value={c.value}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>
              </div>
            </section>

            <section>
              <h3 className="mb-3 mt-0 text-[13px] font-extrabold uppercase tracking-wide text-[#2D5A27]">
                Tài khoản và quyền
              </h3>
              <div className="grid gap-3 sm:grid-cols-3">
                <Field
                  label="Tên đăng nhập"
                  required
                  icon={<User size={15} />}
                >
                  <input
                    className={INPUT_CLS}
                    placeholder="Nhập tên đăng nhập"
                    value={form.username}
                    onChange={(e) =>
                      set(
                        "username",
                        e.target.value
                          .replace(/[^a-zA-Z0-9_-]/g, "")
                          .slice(0, 20)
                      )
                    }
                  />
                </Field>
                <Field
                  label="Mật khẩu tạm thời"
                  required
                  icon={<Lock size={15} />}
                >
                  <input
                    type="text"
                    className={INPUT_CLS}
                    placeholder="Nhập mật khẩu tạm thời"
                    value={form.password}
                    onChange={(e) => set("password", e.target.value)}
                  />
                </Field>
                <Field label="Vai trò" icon={<Users size={15} />}>
                  <select
                    className={`${INPUT_CLS} appearance-none`}
                    value="ctv"
                    disabled
                  >
                    <option value="ctv">CTV thường</option>
                  </select>
                </Field>
              </div>
            </section>

            <label className="flex cursor-pointer items-start gap-[10px] text-[13px] font-semibold text-slate-600">
              <input
                type="checkbox"
                checked={form.sendInvite}
                onChange={(e) => set("sendInvite", e.target.checked)}
                className="mt-[2px] h-4 w-4 rounded border-slate-300 accent-[#2D5A27]"
              />
              <span>Gửi thông tin đăng nhập qua email/SĐT cho CTV</span>
            </label>

            {error ? (
              <p className="m-0 rounded-lg bg-rose-50 px-3 py-2 text-[13px] font-semibold text-rose-600">
                {error}
              </p>
            ) : null}
          </div>

          <aside className="hidden flex-col justify-center gap-4 border-l border-[#eef2ee] bg-[#F6F8F5] px-5 py-8 lg:flex">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-[#E8EFE4] text-[#2D5A27]">
              <Users size={36} strokeWidth={2} />
            </div>
            <div className="text-center">
              <p className="m-0 text-[15px] font-extrabold text-[#1a2e1a]">
                Cộng tác viên Aloha
              </p>
              <p className="mt-1 mb-0 text-[12px] leading-relaxed text-slate-500">
                Kết nối đồng hành - Lan tỏa giá trị xanh
              </p>
            </div>
            <ul className="m-0 list-none space-y-[10px] p-0 text-[12px] font-semibold text-slate-600">
              {[
                "Quản lý hoa hồng minh bạch",
                "Theo dõi hiệu quả theo thời gian thực",
                "Chống gian lận, bảo vệ quyền lợi",
              ].map((t) => (
                <li key={t} className="flex items-start gap-2">
                  <span className="mt-[2px] flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[#2D5A27] text-white">
                    <Check size={10} strokeWidth={3} />
                  </span>
                  {t}
                </li>
              ))}
            </ul>
          </aside>
        </div>

        <div className="flex justify-end gap-2 border-t border-[#eef2ee] px-5 py-[14px]">
          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-[13px] font-semibold text-slate-700 hover:bg-slate-50"
          >
            Hủy
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              void handleSave();
            }}
            className="rounded-lg bg-[#2D5A27] px-5 py-2 text-[13px] font-semibold text-white hover:bg-[#244a20] disabled:opacity-60"
          >
            {busy ? "Đang lưu…" : "Lưu"}
          </button>
        </div>
      </div>
    </div>
  );
}
