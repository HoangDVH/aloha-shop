"use client";

import { Suspense } from "react";
import CustomerDirectory from "@/components/admin/customers/CustomerDirectory";

export default function AdminCtvKhachHangPage() {
  return (
    <Suspense fallback={null}>
      <CustomerDirectory />
    </Suspense>
  );
}

