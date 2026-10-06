"use client";

import { useQuery } from "@tanstack/react-query";
import { useShopMeQuery } from "@/lib/authQueries";
import { fetchPlantDoctorAccess } from "@/lib/plantDoctor/api";
import { Clinic } from "./Clinic";
import { PlantDoctorComingSoon } from "./ComingSoon";

/** Trang "Bác sĩ cây cảnh" chuẩn Google Gemini AI: giao diện trò chuyện toàn màn hình thoáng đãng. */
export function PlantDoctorPage() {
  const me = useShopMeQuery();
  const userId = me.data?.id ?? null;
  const access = useQuery({
    queryKey: ["plant-doctor", "access", userId],
    queryFn: fetchPlantDoctorAccess,
    enabled: !me.isLoading,
    staleTime: 30_000,
    retry: 1,
  });

  const shell = "bg-[#FAF9F6] flex-1 flex flex-col h-[calc(100dvh-64px)] sm:h-[calc(100vh-108px)] w-full overflow-hidden";

  if (me.isLoading || access.isLoading) {
    return (
      <div className={shell}>
        <div className="flex flex-1 items-center justify-center text-sm text-stone-500">Đang tải…</div>
      </div>
    );
  }

  if (!access.data?.allowed) {
    return (
      <div className={shell}>
        <PlantDoctorComingSoon loggedIn={Boolean(userId)} />
      </div>
    );
  }

  return (
    <div className={shell}>
      {access.data.tester && (
        <div className="shrink-0 bg-amber-50 px-4 py-1.5 text-center text-xs font-medium text-amber-800">
          Chế độ thử nghiệm · chỉ tài khoản test thấy Bác sĩ cây
        </div>
      )}
      <Clinic />
    </div>
  );
}
