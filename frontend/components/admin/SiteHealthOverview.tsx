"use client";
import { useQuery } from "@tanstack/react-query";
import { websiteApi } from "./website/api";

type Report = { _id: string; at: string; name: string; message: string; path: string; release: string; browser: string; stack: string };
type Health = { recentCount: number; dayCount: number; errorAlert: boolean; updatedAt: string; latest: Report[];
  disk: { freeBytes: number; usedPercent: number; status: "ok" | "warning" | "critical" } };
export function SiteHealthOverview() {
  const query = useQuery({ queryKey: ["admin-site-health"],
    queryFn: () => websiteApi<Health>("/api/shop/admin/site-health"), refetchInterval: 60_000, staleTime: 30_000 });
  const health = query.data;
  const alert = health && (health.errorAlert || health.disk.status !== "ok");
  return <section aria-label="Tình trạng website" className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 className="text-lg font-bold">Tình trạng website</h2>
      <button onClick={() => void query.refetch()} disabled={query.isFetching} className="rounded-lg bg-slate-100 px-3 py-2 text-sm disabled:opacity-50">Làm mới</button>
    </div>
    {query.isPending && <p className="mt-3 text-sm">Đang kiểm tra…</p>}
    {query.isError && <p role="alert" className="mt-3 text-sm text-red-700">{query.error.message}</p>}
    {health && <>
      <p role={alert ? "alert" : "status"} className={`mt-3 rounded-lg p-3 text-sm ${alert ? "bg-amber-50 text-amber-900" : "bg-emerald-50 text-emerald-900"}`}>
        {health.errorAlert ? "Lỗi giao diện tăng: có ít nhất 5 báo cáo trong 15 phút qua." : "Chưa ghi nhận đợt tăng lỗi giao diện trong 15 phút qua."}
        {health.disk.status !== "ok" && ` Dung lượng máy chủ đã dùng ${health.disk.usedPercent}%; cần kiểm tra và dọn bản cũ.`}
      </p>
      <div className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
        <p>Lỗi trong 15 phút: <strong>{health.recentCount}</strong></p>
        <p>Lỗi trong 24 giờ: <strong>{health.dayCount}</strong></p>
        <p>Ổ đĩa: <strong>{health.disk.usedPercent}%</strong> đã dùng · còn {(health.disk.freeBytes / 1024 ** 3).toFixed(1)} GB</p>
      </div>
      <p className="mt-3 text-xs text-slate-500">Tự cập nhật mỗi phút khi mở trang. Báo cáo được giữ 7 ngày; số liệu phản ánh các lỗi trình duyệt gửi về, có giới hạn ghi nhận.</p>
      {health.latest.length === 0 ? <p className="mt-3 text-sm text-slate-500">Chưa có báo cáo lỗi.</p> :
        <div className="mt-4 max-h-80 space-y-2 overflow-auto">{health.latest.map(report => <details key={report._id} className="rounded-lg border border-slate-200 p-3 text-sm">
          <summary className="cursor-pointer break-words"><span>{new Date(report.at).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })}</span> · {report.name}: {report.message}</summary>
          <p className="mt-2 break-all">Trang: {report.path} · Phiên bản: {report.release}</p>
          <p className="mt-1 break-all text-slate-500">{report.browser}</p>
          <pre className="mt-2 whitespace-pre-wrap break-all text-xs text-slate-500">{report.stack}</pre>
        </details>)}</div>}
    </>}
  </section>;
}
