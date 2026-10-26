"use client";

import { Suspense } from "react";
import { WebOrdersAdmin } from "@/components/admin/orders/WebOrdersAdmin";

export default function AdminWebOrdersPage() {
  return (
    <Suspense fallback={null}>
      <WebOrdersAdmin />
    </Suspense>
  );
}

