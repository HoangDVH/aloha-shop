"use client";
import { ClientErrorFallback } from "@/components/ClientErrorFallback";
export default function GlobalError(props: { error: Error & { digest?: string }; reset: () => void }) {
  return <html lang="vi"><body style={{ margin: 0 }}><ClientErrorFallback {...props} /></body></html>;
}
