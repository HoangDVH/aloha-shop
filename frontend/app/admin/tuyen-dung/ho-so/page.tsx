"use client";

import { Suspense } from "react";
import { ApplicationsAdmin } from "@/components/admin/recruitment/ApplicationsAdmin";

export default function AdminRecruitmentApplicationsPage() {
  return (
    <Suspense fallback={null}>
      <ApplicationsAdmin />
    </Suspense>
  );
}
