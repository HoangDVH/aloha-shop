"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Suspense, useState } from "react";
import { ToastProvider } from "@/components/Toast";
import { ShopAuthProvider } from "@/components/ShopAuthProvider";
import { ShopGlobalLoading } from "@/components/ShopGlobalLoading";
import { CartSync } from "@/components/CartSync";
import { ShopCatalogSync } from "@/components/ShopCatalogSync";
import { CtvPendingGate } from "@/components/CtvPendingGate";
import { SiteDataMigrationCleanup } from "@/components/SiteDataMigrationCleanup";
import { ShopVisitTracker } from "@/components/ShopVisitTracker";
import { FacebookPixel } from "@/components/analytics/FacebookPixel";

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false },
        },
      })
  );
  return (
    <QueryClientProvider client={client}>
      <SiteDataMigrationCleanup />
      <ShopVisitTracker />
      <FacebookPixel />
      <ShopAuthProvider>
        <CartSync />
        <ShopCatalogSync />
        <CtvPendingGate />
        <ToastProvider>
          <Suspense fallback={null}>
            <ShopGlobalLoading />
          </Suspense>
          {children}
        </ToastProvider>
      </ShopAuthProvider>
    </QueryClientProvider>
  );
}
