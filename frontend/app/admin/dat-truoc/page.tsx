import { redirect } from "next/navigation";

/** Đã bỏ màn xử lý đặt trước trên shop — xử lý qua Zalo + KiotViet. */
export default function Page() {
  redirect("/admin");
}
