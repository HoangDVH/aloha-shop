import Link from "next/link";
import { Globe, Users } from "lucide-react";
import { AdminCard, AdminPageHeader } from "@/components/admin/shell/AdminUi";

export default function AdminHomePage() {
  return (
    <div>
      <AdminPageHeader
        title="Tổng quan"
        description="Quản lý CTV hoa hồng và giao diện website bán hàng — cùng dữ liệu hệ thống trước đây trên app nội bộ."
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Link href="/admin/ctv" className="block transition hover:-translate-y-0.5">
          <AdminCard className="h-full hover:border-emerald-300 hover:shadow-md">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                <Users className="h-5 w-5" />
              </span>
              <div>
                <h2 className="font-bold text-slate-900">CTV / Hoa hồng</h2>
                <p className="mt-1 text-sm text-slate-500">
                  % hoa hồng, duyệt CTV, kỳ tháng, cảnh báo gian lận.
                </p>
              </div>
            </div>
          </AdminCard>
        </Link>
        <Link href="/admin/website" className="block transition hover:-translate-y-0.5">
          <AdminCard className="h-full hover:border-emerald-300 hover:shadow-md">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-50 text-sky-700">
                <Globe className="h-5 w-5" />
              </span>
              <div>
                <h2 className="font-bold text-slate-900">Website bán hàng</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Giao diện trang chủ, hàng hóa web, bài viết CMS.
                </p>
              </div>
            </div>
          </AdminCard>
        </Link>
      </div>
      <AdminCard className="mt-4">
        <p className="text-sm text-slate-600">
          Storefront khách:{" "}
          <a href="/" target="_blank" rel="noopener noreferrer" className="font-semibold text-emerald-700 underline">
            mở trang bán hàng
          </a>
        </p>
      </AdminCard>
    </div>
  );
}
