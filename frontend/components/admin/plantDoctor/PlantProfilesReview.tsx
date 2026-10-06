"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown } from "lucide-react";
import { AdminApiError, adminFetch } from "@/components/admin/api/adminFetch";
import { LIGHT_LEVELS, type PlantBasics } from "@/lib/plantDoctor/api";

type Problem = {
  id: string;
  title: string;
  signs: string;
  summary: string;
  why: string;
  steps: string[];
  care: string[];
  severity: "nhe" | "chu_y" | "nang";
  needHelp: boolean;
};

type Profile = {
  id: string;
  nameVi: string;
  aliases: string[];
  scientific: string;
  match: { species?: string[]; genera?: string[]; families?: string[] };
  basics: Required<PlantBasics>;
  alohaDoc: string | null;
  problems: Problem[];
  source: { name: string; url: string };
  reviewed: boolean;
  reviewedAt: string | null;
  reviewedBy: string | null;
};

const SEVERITY = { nhe: "Nhẹ", chu_y: "Cần chú ý", nang: "Nặng" } as const;
const KEY = ["admin", "plant-doctor", "profiles"] as const;

function ReviewControl({ p }: { p: Profile }) {
  const qc = useQueryClient();
  const toggle = useMutation({
    mutationFn: (reviewed: boolean) =>
      adminFetch(`/api/shop/admin/plant-doctor/profiles/${encodeURIComponent(p.id)}/review`, {
        method: "PUT",
        body: JSON.stringify({ reviewed }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
  const error =
    toggle.error instanceof AdminApiError && (toggle.error.status === 401 || toggle.error.status === 403)
      ? "Chỉ tài khoản Quản lý được duyệt hồ sơ."
      : toggle.error
        ? "Lưu không thành công, vui lòng thử lại."
        : "";
  const when = p.reviewedAt ? new Date(p.reviewedAt).toLocaleString("vi-VN") : "";
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg bg-slate-50 px-3 py-2 text-xs">
      <button
        type="button"
        disabled={toggle.isPending}
        onClick={() => toggle.mutate(!p.reviewed)}
        className={`rounded-lg px-3 py-1.5 font-semibold disabled:opacity-60 ${
          p.reviewed ? "border border-slate-300 bg-white text-slate-700" : "bg-[#2D5A27] text-white"
        }`}
      >
        {toggle.isPending ? "Đang lưu…" : p.reviewed ? "Bỏ duyệt" : "Duyệt hồ sơ này"}
      </button>
      <span className="text-slate-600">
        {p.reviewed
          ? `Đã duyệt${p.reviewedBy ? ` bởi ${p.reviewedBy}` : ""}${when ? ` lúc ${when}` : ""}.`
          : "Đọc hết nội dung bên dưới, đúng thì bấm duyệt. Khách sẽ không còn thấy dòng \"đang chờ Aloha duyệt\"."}
      </span>
      {error ? <span className="text-red-700">{error}</span> : null}
    </div>
  );
}

const fold = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d");

function List({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <div>
      <p className="text-xs font-semibold text-slate-700">{title}</p>
      <ol className="mt-0.5 list-decimal space-y-0.5 pl-5 text-xs text-slate-600">
        {items.map((s, i) => (
          <li key={i}>{s}</li>
        ))}
      </ol>
    </div>
  );
}

function ProfileItem({ p }: { p: Profile }) {
  const { species = [], genera = [], families = [] } = p.match;
  const nameKeys = [...species, ...genera.map((g) => `${g} (chi)`), ...families.map((f) => `${f} (họ)`)];
  return (
    <details className="group rounded-xl border border-[#e8eaed] bg-white">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3">
        <span className="min-w-0">
          <span className="font-semibold text-slate-900">{p.nameVi}</span>{" "}
          <em className="text-xs text-slate-500">{p.scientific}</em>
          <span className="ml-2 text-xs text-slate-500">{p.problems.length} vấn đề</span>
        </span>
        <span className="flex shrink-0 items-center gap-2">
          <span
            className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
              p.reviewed ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
            }`}
          >
            {p.reviewed ? "Đã duyệt" : "Chờ duyệt"}
          </span>
          <ChevronDown className="h-4 w-4 text-slate-400 transition group-open:rotate-180" />
        </span>
      </summary>
      <div className="space-y-3 border-t border-[#e8eaed] px-4 py-3 text-sm">
        <p className="text-xs text-slate-600">
          <span className="font-semibold text-slate-700">Tên khách hay gọi: </span>
          {p.aliases.join(", ")}
        </p>
        <p className="text-xs text-slate-600">
          <span className="font-semibold text-slate-700">Pl@ntNet trả về các tên này sẽ dùng hồ sơ này: </span>
          {nameKeys.join(", ")}
        </p>
        <p className="text-xs text-slate-600">
          <span className="font-semibold text-slate-700">Ánh sáng, tưới nước lấy từ: </span>
          {p.alohaDoc ? `bài viết Aloha (${p.alohaDoc})` : "nguồn tham khảo bên dưới (Aloha chưa có bài hướng dẫn)"}
        </p>
        <dl className="grid gap-2 text-xs sm:grid-cols-2">
          {(
            [
              ["Ánh sáng", `${LIGHT_LEVELS[p.basics.lightLevel]}. ${p.basics.light}`],
              ["Tưới nước", p.basics.water],
              ["Đất / giá thể", p.basics.soil],
              ["Độc tính", p.basics.toxic],
              ["Lưu ý", p.basics.note],
            ] as const
          ).map(([k, v]) => (
            <div key={k} className="rounded-lg bg-slate-50 px-3 py-2">
              <dt className="font-semibold text-slate-700">{k}</dt>
              <dd className="text-slate-600">{v}</dd>
            </div>
          ))}
        </dl>
        <div className="space-y-2">
          {p.problems.map((pr) => (
            <div key={pr.id} className="space-y-1.5 rounded-lg border border-slate-100 px-3 py-2">
              <p className="text-sm font-semibold text-slate-900">
                {pr.title}{" "}
                <span className="text-xs font-normal text-slate-500">
                  · {SEVERITY[pr.severity]}
                  {pr.needHelp ? " · gợi ý nhắn Zalo" : ""}
                </span>
              </p>
              <p className="text-xs text-slate-600">
                <span className="font-semibold text-slate-700">Dấu hiệu: </span>
                {pr.signs}
              </p>
              <p className="text-xs text-slate-600">
                <span className="font-semibold text-slate-700">Tóm tắt: </span>
                {pr.summary}
              </p>
              <List title="Việc nên làm ngay" items={pr.steps} />
              <List title="Chăm sóc để không tái phát" items={pr.care} />
              <p className="text-xs text-slate-600">
                <span className="font-semibold text-slate-700">Vì sao: </span>
                {pr.why}
              </p>
            </div>
          ))}
        </div>
        <p className="text-xs text-slate-600">
          <span className="font-semibold text-slate-700">Nguồn tham khảo: </span>
          <a href={p.source.url} target="_blank" rel="noopener noreferrer" className="text-[#2D5A27] underline">
            {p.source.name}
          </a>
        </p>
        <ReviewControl p={p} />
      </div>
    </details>
  );
}

/** Danh sách hồ sơ loài để nhân viên đọc và duyệt nội dung trước khi mở cho khách. */
export function PlantProfilesReview() {
  const [q, setQ] = useState("");
  const res = useQuery({
    queryKey: KEY,
    queryFn: () => adminFetch<{ profiles: Profile[] }>("/api/shop/admin/plant-doctor/profiles"),
    staleTime: 5 * 60_000,
  });

  const shown = useMemo(() => {
    const list = res.data?.profiles ?? [];
    const key = fold(q.trim());
    if (!key) return list;
    return list.filter((p) => fold([p.nameVi, p.scientific, ...p.aliases].join(" ")).includes(key));
  }, [res.data, q]);

  const total = res.data?.profiles.length ?? 0;
  const pending = res.data?.profiles.filter((p) => !p.reviewed).length ?? 0;

  return (
    <section className="rounded-2xl border border-[#e8eaed] bg-white p-5 shadow-sm">
      <h2 className="text-base font-bold text-slate-900">Hồ sơ loài cây</h2>
      <p className="mt-1 text-sm text-slate-600">
        Bác sĩ cây chỉ đưa ra cách chữa có trong các hồ sơ này. Cây chưa có hồ sơ sẽ được báo thật và mời nhắn Zalo.
        {total ? ` Có ${total} loài, ${pending} loài đang chờ duyệt.` : ""}
      </p>
      <p className="mt-1 text-xs text-slate-500">
        Cần sửa nội dung: ghi chú lại tên loài và đoạn cần đổi, gửi cho kỹ thuật cập nhật. Hồ sơ đã sửa sẽ tự về &quot;Chờ duyệt&quot; để duyệt lại.
      </p>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Tìm theo tên cây…"
        className="mt-3 w-full rounded-xl border border-[#e8eaed] px-3 py-2 text-sm focus:border-[#2D5A27] focus:outline-none"
      />
      <div className="mt-3 space-y-2">
        {res.isLoading ? <p className="text-sm text-slate-500">Đang tải hồ sơ…</p> : null}
        {res.isError ? <p className="text-sm text-red-700">Không tải được hồ sơ cây.</p> : null}
        {shown.map((p) => (
          <ProfileItem key={p.id} p={p} />
        ))}
        {res.data && !shown.length ? <p className="text-sm text-slate-500">Không có loài nào khớp.</p> : null}
      </div>
    </section>
  );
}
