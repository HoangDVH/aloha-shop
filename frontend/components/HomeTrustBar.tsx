import { Flower2, Leaf, Package, RefreshCcw, Truck } from "lucide-react";

const ITEMS = [
  {
    icon: Leaf,
    title: "Cây chất lượng",
    desc: "Tuyển chọn kỹ · kiểm tra trước giao",
  },
  {
    icon: Flower2,
    title: "Chậu đa dạng",
    desc: "Nhiều mẫu mã · dễ phối không gian",
  },
  {
    icon: Truck,
    title: "Giao hàng nhanh",
    desc: "Đóng gói chắc · giao toàn quốc",
  },
  {
    icon: Package,
    title: "Hỗ trợ 24/7",
    desc: "Zalo / hotline sẵn sàng hỗ trợ",
  },
  {
    icon: RefreshCcw,
    title: "Đổi trả linh hoạt",
    desc: "Hỗ trợ đổi khi lỗi vận chuyển",
  },
] as const;

/** Thanh tin cậy dưới hero — 5 USP theo mock. */
export function HomeTrustBar() {
  return (
    <section className="border-b border-[var(--aloha-line)] bg-white">
      <div className="mx-auto grid max-w-7xl grid-cols-2 gap-4 px-4 py-5 sm:grid-cols-3 sm:gap-6 sm:py-6 lg:grid-cols-5 lg:gap-5 lg:py-7">
        {ITEMS.map(({ icon: Icon, title, desc }) => (
          <div key={title} className="flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--aloha-green-light)] text-[var(--aloha-green)] ring-1 ring-[var(--aloha-line)]">
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
