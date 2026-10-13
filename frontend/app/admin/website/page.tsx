"use client";

import WebsiteBanHangShell from "@/components/admin/website/WebsiteBanHangShell";
import { Suspense } from "react";

export default function AdminWebsitePage() {
  return <Suspense fallback={<div className="h-40 animate-pulse rounded-xl bg-white" aria-busy="true" />}><WebsiteBanHangShell /></Suspense>;
}
