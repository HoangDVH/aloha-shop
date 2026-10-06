"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink } from "lucide-react";
import { AdminApiError, adminFetch } from "@/components/admin/api/adminFetch";
import { PlantProfilesReview } from "./PlantProfilesReview";

type Settings = {
  enabledForAll: boolean;
  testEmails: string[];
  envTestEmails: string[];
  plantNetConfigured: boolean;
  geminiConfigured: boolean;
};

function StatusRow({ ok, label, okText, missingText }: { ok: boolean; label: string; okText: string; missingText: string }) {
  return (
    <li className="flex items-start gap-2 text-sm">
      <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${ok ? "bg-emerald-500" : "bg-amber-500"}`} aria-hidden />
      <span>
        <span className="font-semibold text-slate-800">{label}: </span>
        <span className="text-slate-600">{ok ? okText : missingText}</span>
      </span>
    </li>
  );
}

const KEY = ["admin", "plant-doctor", "settings"] as const;
const PATH = "/api/shop/admin/plant-doctor/settings";

function errorMessage(e: unknown): string {
  if (e instanceof AdminApiError) {
    const body = e.body as { message?: unknown } | null;
    if (body && typeof body === "object" && typeof body.message === "string") return body.message;
    if (e.status === 401 || e.status === 403) return "Chỉ tài khoản Quản lý được đổi cài đặt này.";
  }
  return "Lưu không thành công, vui lòng thử lại.";
}

export function PlantDoctorSettingsAdmin() {
  const qc = useQueryClient();
  const settings = useQuery({ queryKey: KEY, queryFn: () => adminFetch<Settings>(PATH) });
  const [emailsText, setEmailsText] = useState("");

  useEffect(() => {
    if (settings.data) setEmailsText(settings.data.testEmails.join("\n"));
  }, [settings.data]);

  const save = useMutation({
    mutationFn: (body: { enabledForAll: boolean; testEmails: string[] }) =>
      adminFetch<Settings>(PATH, { method: "PUT", body: JSON.stringify(body) }),
    onSuccess: (data) => qc.setQueryData(KEY, data),
  });

  if (settings.isLoading) return <p className="text-sm text-slate-500">Đang tải cài đặt…</p>;
  if (settings.isError || !settings.data) {
    return (
      <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        Không tải được cài đặt Bác sĩ cây. Thử tải lại trang.
      </p>
    );
  }

  const data = settings.data;
  const emails = emailsText.split(/[,;\s]+/).map((e) => e.trim().toLowerCase()).filter(Boolean);
  const emailsDirty = emails.join("\n") !== data.testEmails.join("\n");

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">Bác sĩ cây cảnh</h1>
        <p className="mt-1 text-sm text-slate-600">
          Khi chưa mở, chỉ tài khoản test thấy Bác sĩ cây. Khách khác bấm vào sẽ thấy thông báo &quot;Tính năng đang phát triển&quot;.
        </p>
      </header>

      <section className="rounded-2xl border border-[#e8eaed] bg-white p-5 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-slate-900">Mở cho tất cả khách</h2>
            <p className="mt-1 text-sm text-slate-600">
              {data.enabledForAll
                ? "Đang mở: mọi khách (kể cả chưa đăng nhập) đều dùng được Bác sĩ cây."
                : "Đang tắt: chỉ tài khoản test bên dưới dùng được."}
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={data.enabledForAll}
            aria-label="Mở Bác sĩ cây cho tất cả khách"
            disabled={save.isPending}
            onClick={() => {
              const next = !data.enabledForAll;
              if (next && !window.confirm("Mở Bác sĩ cây cho tất cả khách?")) return;
              save.mutate({ enabledForAll: next, testEmails: data.testEmails });
            }}
            className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition disabled:opacity-60 ${
              data.enabledForAll ? "bg-[#2D5A27]" : "bg-slate-300"
            }`}
          >
            <span
              className={`inline-block h-5 w-5 rounded-full bg-white shadow transition ${
                data.enabledForAll ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
        </div>
      </section>

      <section className="rounded-2xl border border-[#e8eaed] bg-white p-5 shadow-sm">
        <h2 className="text-base font-bold text-slate-900">Tài khoản test</h2>
        <p className="mt-1 text-sm text-slate-600">
          Email tài khoản shop được dùng thử khi tính năng đang tắt. Mỗi dòng một email.
        </p>
        <textarea
          value={emailsText}
          onChange={(e) => setEmailsText(e.target.value)}
          rows={5}
          placeholder="vidu@gmail.com"
          className="mt-3 w-full rounded-xl border border-[#e8eaed] px-3 py-2 text-sm focus:border-[#2D5A27] focus:outline-none"
        />
        {data.envTestEmails.length > 0 && (
          <p className="mt-2 text-xs text-slate-500">
            Luôn được dùng thử (cấu hình máy chủ): {data.envTestEmails.join(", ")}
          </p>
        )}
        <div className="mt-3 flex items-center gap-3">
          <button
            type="button"
            disabled={!emailsDirty || save.isPending}
            onClick={() => save.mutate({ enabledForAll: data.enabledForAll, testEmails: emails })}
            className="rounded-xl bg-[#2D5A27] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#244a20] disabled:opacity-50"
          >
            {save.isPending ? "Đang lưu…" : "Lưu danh sách"}
          </button>
          {save.isSuccess && !emailsDirty && <span className="text-xs text-emerald-700">Đã lưu.</span>}
        </div>
      </section>

      {save.isError && (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{errorMessage(save.error)}</p>
      )}

      <section className="rounded-2xl border border-[#e8eaed] bg-white p-5 shadow-sm">
        <h2 className="text-base font-bold text-slate-900">Trạng thái máy chủ</h2>
        <ul className="mt-3 space-y-2">
          <StatusRow
            ok={data.plantNetConfigured}
            label="Nhận diện cây (Pl@ntNet)"
            okText="Đã cấu hình. Gói miễn phí 500 lượt/ngày."
            missingText="Chưa có PLANTNET_API_KEY. Khách phải gõ tên cây hoặc tự chọn cây."
          />
          <StatusRow
            ok={data.geminiConfigured}
            label="Xem dấu hiệu bệnh (Gemini)"
            okText="Đã cấu hình. AI chỉ chọn vấn đề có sẵn trong hồ sơ loài."
            missingText="Chưa có GEMINI_API_KEY. Khách tự chọn dấu hiệu giống cây nhất."
          />
        </ul>
      </section>

      <PlantProfilesReview />

      <a
        href="/bac-si-cay"
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#2D5A27] hover:underline"
      >
        <ExternalLink className="h-4 w-4" />
        Mở trang Bác sĩ cây
      </a>
    </div>
  );
}
