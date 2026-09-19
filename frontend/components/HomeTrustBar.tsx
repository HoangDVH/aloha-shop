import { Headset, Leaf, RefreshCcw, Truck } from "lucide-react";

const ITEMS = [
  {
    icon: Leaf,
    title: "Cây chất lượng",
    desc: "Tuyển chọn kỹ · kiểm tra trước giao",
  },
  {
    icon: Truck,
    title: "Giao hàng toàn quốc",
    desc: "Đóng gói chắc · giao nhanh",
  },
  {
    icon: RefreshCcw,
    title: "Đổi trả linh hoạt",
    desc: "Hỗ trợ đổi khi lỗi vận chuyển",
  },
  {
    icon: Headset,
    title: "Tư vấn tận tâm",
    desc: "Zalo / hotline sẵn sàng hỗ trợ",
  },
] as const;

/** Thanh tin cậy dưới hero — theo mock trang chủ. */
export function HomeTrustBar() {
  return (
    <section className="border-b border-[var(--aloha-line)] bg-white">
      <div className="mx-auto grid max-w-7xl grid-cols-2 gap-4 px-4 py-5 sm:gap-6 sm:py-6 lg:grid-cols-4 lg:gap-8 lg:py-7">
        {ITEMS.map(({ icon: Icon, title, desc }) => (
          <div key={title} className="flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--aloha-cream-light)] text-[var(--aloha-green)] ring-1 ring-[var(--aloha-line)]">
              <Icon size={20} strokeWidth={1.75} aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-bold text-[var(--aloha-ink)]">{title}</p>
              <p className="mt-0.5 text-xs leading-snug text-[var(--aloha-muted)] sm:text-[13px]">
                {desc}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
