import { Suspense } from "react";
import { PasswordRecovery } from "@/components/si-register/PasswordRecovery";
export default function Page(){return <Suspense fallback={<p>Đang tải…</p>}><PasswordRecovery reset/></Suspense>;}
