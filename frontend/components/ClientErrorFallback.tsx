"use client";
import { useEffect } from "react";
import { recoverChunk, reportClientError } from "@/lib/clientRecovery";

export function ClientErrorFallback({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    reportClientError(error, "boundary");
    recoverChunk(error);
  }, [error]);
  return (
    <main role="alert" style={{ minHeight: "60vh", display: "grid", placeItems: "center", padding: 24, background: "#f5f9f7", color: "#173b2b", fontFamily: "system-ui, sans-serif" }}>
      <section style={{ textAlign: "center", maxWidth: 420 }}>
        <h1 style={{ fontSize: 24 }}>Trang gặp sự cố</h1>
        <p>Vui lòng thử lại để tiếp tục xem sản phẩm.</p>
        <button onClick={reset} style={{ padding: "12px 24px", background: "#176342", color: "white", border: 0, borderRadius: 8, cursor: "pointer", fontSize: 16 }}>Thử lại</button>
        <p><a href="/" style={{ color: "#176342" }}>Về trang chủ</a></p>
      </section>
    </main>
  );
}
