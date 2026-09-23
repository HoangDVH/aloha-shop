import { Suspense } from "react";
import { SiRegisterWizard } from "@/components/si-register/SiRegisterWizard";
import { ShopPageLoader } from "@/components/ShopPageLoader";

export const metadata = { title: "Đăng ký khách sỉ | Aloha" };

export default function Page() {
  return (
    <Suspense fallback={<ShopPageLoader fullscreen={false} />}>
      <SiRegisterWizard />
    </Suspense>
  );
}
