"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  BadgePercent,
  Boxes,
  CheckCircle2,
  ChevronRight,
  Gift,
  Headphones,
  Link2,
  Package,
  Percent,
  Phone,
  Share2,
  ShieldCheck,
  Sparkles,
  Sprout,
  Users,
  Wallet,
} from "lucide-react";
import { useShopAuth } from "@/components/ShopAuthProvider";
import { useShopRegisterMutation } from "@/lib/authQueries";
import { useShopRouter } from "@/lib/useShopRouter";
import { CTV_PENDING_PATH, isCtvPendingBlocked } from "@/lib/ctvGate";
import { SHOP_BRAND } from "@/lib/brand";

const ctvRecruitSchema = z.object({
  fullName: z.string().trim().min(1, "Nhập họ và tên"),
  phone: z
    .string()
    .trim()
    .min(9, "Nhập số điện thoại")
    .regex(/^[0-9+\s()-]{9,15}$/, "Số điện thoại không hợp lệ"),
  email: z.string().trim().email("Email không hợp lệ"),
  password: z.string().min(8, "Mật khẩu tối thiểu 8 ký tự"),
  source: z.string().trim().optional(),
});

type CtvRecruitInput = z.infer<typeof ctvRecruitSchema>;

const SOURCES = [
  "Facebook / Instagram",
  "Zalo / bạn bè giới thiệu",
  "TikTok / YouTube",
  "Google tìm kiếm",
  "Đã mua hàng tại Aloha",
  "Khác",
];

const QUICK_BENEFITS = [
  { icon: Percent, label: "Hoa hồng lên đến 15%" },
  { icon: Boxes, label: "Sản phẩm đa dạng 4.000+" },
  { icon: Sparkles, label: "Hỗ trợ marketing & công cụ bán" },
  { icon: Wallet, label: "Thanh toán nhanh & minh bạch" },
];

const WHY_CARDS = [
  {
    icon: BadgePercent,
    title: "Hoa hồng hấp dẫn",
    desc: "Mức hoa hồng cạnh tranh theo từng sản phẩm, càng bán nhiều càng nhận nhiều.",
  },
  {
    icon: Package,
    title: "Sản phẩm chất lượng",
    desc: "Kho chậu & cây chọn lọc, hình ảnh thật — dễ chia sẻ, dễ chốt đơn.",
  },
  {
    icon: Share2,
    title: "Hỗ trợ toàn diện",
    desc: "Có link giới thiệu, ảnh mẫu, nội dung bán hàng sẵn để đăng ngay.",
  },
  {
    icon: Headphones,
    title: "Đội ngũ hỗ trợ",
    desc: "Tư vấn Zalo / hotline khi cần — không để bạn bán một mình.",
  },
  {
    icon: Sprout,
    title: "Phát triển lâu dài",
    desc: "Xây dựng thu nhập thụ động từ đam mê cây xanh cùng Aloha.",
  },
];

const STEPS = [
  {
    n: 1,
    icon: Users,
    title: "Đăng ký tài khoản",
    desc: "Điền form bên trên — chờ Aloha duyệt CTV.",
  },
  {
    n: 2,
    icon: Link2,
    title: "Nhận link & sản phẩm",
    desc: "Vào cổng CTV lấy link, ảnh và mã giới thiệu.",
  },
  {
    n: 3,
    icon: Gift,
    title: "Chia sẻ & kiếm hoa hồng",
    desc: "Đăng bán trên mạng xã hội — nhận hoa hồng khi đơn thành công.",
  },
];

const COMMUNITY = [
  {
    badge: "Dễ dàng",
    title: "Chỉ cần điện thoại",
    desc: "Chia sẻ link sản phẩm trên Zalo, Facebook, TikTok — bắt đầu ngay hôm nay.",
    image: "/categories/cat-cay-canh.png",
  },
  {
    badge: "Đa dạng",
    title: "Kho hàng phong phú",
    desc: "Hàng nghìn mẫu chậu & cây — luôn có gì mới để giới thiệu khách.",
    image: "/categories/cat-chau-cay.png",
  },
  {
    badge: "Hỗ trợ",
    title: "Công cụ bán hàng",
    desc: "Ảnh đẹp, mô tả sẵn, theo dõi đơn và hoa hồng trên cổng CTV.",
    image: "/categories/cat-phu-kien.png",
  },
  {
    badge: "Thu nhập",
    title: "Hoa hồng rõ ràng",
    desc: "Minh bạch từng đơn — thanh toán đúng hạn, yên tâm gắn bó lâu dài.",
    image: "/categories/cat-gia-the.png",
  },
];

function scrollToForm() {
  document.getElementById("ctv-dang-ky")?.scrollIntoView({ behavior: "smooth", block: "center" });
}

function CtvRecruitForm() {
  const { user, loading } = useShopAuth();
  const registerMut = useShopRegisterMutation();
  const router = useShopRouter();
  const [done, setDone] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    setError,
  } = useForm<CtvRecruitInput>({
    resolver: zodResolver(ctvRecruitSchema),
    defaultValues: {
      fullName: "",
      phone: "",
      email: "",
      password: "",
      source: "",
    },
  });

  useEffect(() => {
    if (loading || !user) return;
    if (isCtvPendingBlocked(user)) {
      router.replace(CTV_PENDING_PATH);
      return;
    }
    if (user.roles.includes("ctv") && user.ctvStatus === "active") {
      router.replace("/cong-tac-vien");
    }
  }, [loading, user, router]);

  const onSubmit = handleSubmit(async (values) => {
    try {
      if (values.source) {
        try {
          sessionStorage.setItem("aloha:ctv-source", values.source);
        } catch {
          /* ignore */
        }
      }
      const data = await registerMut.mutateAsync({
        fullName: values.fullName,
        email: values.email,
        phone: values.phone,
        password: values.password,
        asCustomer: false,
        asCtv: true,
        ctvCode: "",
      });
      setDone(true);
      if (isCtvPendingBlocked(data.user)) {
        router.replace(CTV_PENDING_PATH);
      } else if (data.user.roles.includes("ctv") && data.user.ctvStatus === "active") {
        router.replace("/cong-tac-vien");
      } else {
        router.replace(CTV_PENDING_PATH);
      }
    } catch (err) {
      setError("root", {
        message: err instanceof Error ? err.message : "Không đăng ký được. Thử lại sau.",
      });
    }
  });

  if (done) {
    return (
      <div className="rounded-2xl bg-white p-6 text-center shadow-lg ring-1 ring-[var(--aloha-line)] sm:p-8">
        <CheckCircle2 className="mx-auto text-[var(--aloha-green)]" size={40} strokeWidth={1.75} />
        <h3 className="mt-3 text-lg font-extrabold text-[var(--aloha-green-dark)]">
          Đã gửi đăng ký CTV
        </h3>
        <p className="mt-2 text-sm text-[var(--aloha-muted)]">
          Aloha đang duyệt hồ sơ — bạn sẽ vào trang chờ duyệt ngay.
        </p>
      </div>
    );
  }

  return (
    <div
      id="ctv-dang-ky"
      className="rounded-2xl bg-white p-5 shadow-[0_18px_48px_-20px_rgba(27,94,32,0.35)] ring-1 ring-[var(--aloha-line)] sm:p-7"
    >
      <h3 className="text-lg font-extrabold text-[var(--aloha-green-dark)] sm:text-xl">
        Đăng ký trở thành CTV Aloha
      </h3>
      <p className="mt-1 text-sm text-[var(--aloha-muted)]">
        Điền thông tin — chúng tôi duyệt sớm nhất có thể.
      </p>

      <form onSubmit={onSubmit} className="mt-5 space-y-3.5" noValidate>
        <div>
          <label className="mb-1.5 block text-xs font-semibold text-slate-600" htmlFor="ctv-name">
            Họ và tên
          </label>
          <input
            id="ctv-name"
            placeholder="Nguyễn Văn A"
            className="auth-field"
            {...register("fullName")}
          />
          {errors.fullName ? (
            <p className="mt-1 text-xs font-medium text-red-600">{errors.fullName.message}</p>
          ) : null}
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-semibold text-slate-600" htmlFor="ctv-phone">
            Số điện thoại
          </label>
          <input
            id="ctv-phone"
            inputMode="tel"
            placeholder="09xx xxx xxx"
            className="auth-field"
            {...register("phone")}
          />
          {errors.phone ? (
            <p className="mt-1 text-xs font-medium text-red-600">{errors.phone.message}</p>
          ) : null}
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-semibold text-slate-600" htmlFor="ctv-email">
            Email
          </label>
          <input
            id="ctv-email"
            type="email"
            autoComplete="email"
            placeholder="ban@email.com"
            className="auth-field"
            {...register("email")}
          />
          {errors.email ? (
            <p className="mt-1 text-xs font-medium text-red-600">{errors.email.message}</p>
          ) : null}
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-semibold text-slate-600" htmlFor="ctv-pass">
            Mật khẩu đăng nhập
          </label>
          <input
            id="ctv-pass"
            type="password"
            autoComplete="new-password"
            placeholder="Ít nhất 8 ký tự"
            className="auth-field"
            {...register("password")}
          />
          {errors.password ? (
            <p className="mt-1 text-xs font-medium text-red-600">{errors.password.message}</p>
          ) : null}
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-semibold text-slate-600" htmlFor="ctv-source">
            Bạn biết đến Aloha qua đâu?
          </label>
          <select id="ctv-source" className="auth-field" {...register("source")}>
            <option value="">— Chọn nguồn —</option>
            {SOURCES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        {errors.root?.message ? (
          <p className="rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-700 ring-1 ring-red-100">
            {errors.root.message}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={registerMut.isPending}
          className="inline-flex h-12 w-full items-center justify-center rounded-full bg-[var(--aloha-green-dark)] text-[15px] font-bold text-white shadow-md transition hover:bg-[var(--aloha-green)] disabled:opacity-60"
        >
          {registerMut.isPending ? "Đang gửi…" : "Đăng ký ngay"}
        </button>

        <p className="flex items-center justify-center gap-1.5 text-center text-[11px] text-[var(--aloha-muted)]">
          <ShieldCheck size={14} className="text-[var(--aloha-green)]" aria-hidden />
          Thông tin của bạn được bảo mật tuyệt đối
        </p>

        <p className="text-center text-xs text-[var(--aloha-muted)]">
          Đã có tài khoản?{" "}
          <Link
            href={`/dang-nhap?next=${encodeURIComponent("/cong-tac-vien")}`}
            className="font-bold text-[var(--aloha-green)] hover:underline"
          >
            Đăng nhập
          </Link>
        </p>
      </form>
    </div>
  );
}

/** Landing tuyển CTV — UI theo mock + đăng ký CTV thật. */
export function CtvRecruitLanding() {
  const formRef = useRef<HTMLDivElement>(null);

  return (
    <div className="bg-[#FDFBF7] text-[var(--aloha-ink)]">
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-[var(--aloha-border-brown)]/30">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/decor/leaves-tr.png"
          alt=""
          aria-hidden
          className="pointer-events-none absolute -right-4 top-0 z-0 h-28 w-28 opacity-35 sm:h-40 sm:w-40"
        />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/decor/leaves-bl.png"
          alt=""
          aria-hidden
          className="pointer-events-none absolute -left-2 bottom-0 z-0 h-24 w-24 opacity-30 sm:h-36 sm:w-36"
        />

        <div className="relative z-10 mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:py-12 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-10 lg:py-14">
          <div>
            <p className="inline-flex items-center gap-1.5 rounded-full bg-[var(--aloha-green-light)] px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-[var(--aloha-green-dark)]">
              <Sprout size={14} aria-hidden />
              Chương trình Cộng tác viên
            </p>
            <h1 className="ctv-recruit-script mt-4 text-[2.35rem] leading-[1.15] text-[var(--aloha-green-dark)] sm:text-[2.85rem] md:text-[3.15rem]">
              Gia nhập đội ngũ
              <br />
              Cộng tác viên Aloha
            </h1>
            <p className="mt-3 text-base font-bold text-[var(--aloha-green)] sm:text-lg">
              Chia sẻ đam mê cây xanh – Kiếm thêm thu nhập
            </p>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-[var(--aloha-muted)] sm:text-[15px]">
              Chỉ cần điện thoại là bạn có thể bắt đầu chia sẻ sản phẩm {SHOP_BRAND} và nhận hoa
              hồng minh bạch cho mỗi đơn hàng thành công.
            </p>

            <div className="mt-6 grid grid-cols-2 gap-3 sm:gap-4">
              {QUICK_BENEFITS.map(({ icon: Icon, label }) => (
                <div
                  key={label}
                  className="flex items-start gap-2.5 rounded-xl bg-white/80 px-3 py-2.5 ring-1 ring-[var(--aloha-line)]"
                >
                  <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--aloha-green-light)] text-[var(--aloha-green)]">
                    <Icon size={16} strokeWidth={2} aria-hidden />
                  </span>
                  <span className="text-[12px] font-semibold leading-snug text-[var(--aloha-ink)] sm:text-[13px]">
                    {label}
                  </span>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={scrollToForm}
              className="mt-7 inline-flex h-12 items-center gap-1.5 rounded-full bg-[var(--aloha-green-dark)] px-7 text-[15px] font-bold text-white shadow-lg shadow-[var(--aloha-green-dark)]/25 transition hover:bg-[var(--aloha-green)]"
            >
              Đăng ký ngay
              <ChevronRight size={18} aria-hidden />
            </button>

            {/* Visual phụ desktop */}
            <div className="relative mt-8 hidden max-w-md overflow-hidden rounded-2xl bg-[var(--aloha-green-light)]/50 p-4 ring-1 ring-[var(--aloha-green)]/15 lg:block">
              <div className="flex items-center gap-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/categories/cat-cay-canh.png"
                  alt=""
                  className="h-28 w-28 object-contain"
                />
                <div>
                  <p className="rounded-2xl bg-white px-3 py-2 text-sm font-semibold text-[var(--aloha-green-dark)] shadow-sm">
                    Kiếm thêm thu nhập cùng Aloha! ♡
                  </p>
                  <p className="mt-2 flex items-center gap-1.5 text-xs text-[var(--aloha-muted)]">
                    <Phone size={12} aria-hidden />
                    Bán online mọi lúc, mọi nơi
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div ref={formRef}>
            <CtvRecruitForm />
          </div>
        </div>
      </section>

      {/* Vì sao */}
      <section className="mx-auto max-w-7xl px-4 py-12 sm:py-14">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <h2 className="text-2xl font-extrabold text-[var(--aloha-green-dark)] sm:text-[1.75rem]">
            Vì sao nên trở thành CTV Aloha?
          </h2>
          <p className="max-w-md text-sm text-[var(--aloha-muted)]">
            Lợi ích rõ ràng — phù hợp người mới bắt đầu bán online.
          </p>
        </div>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {WHY_CARDS.map(({ icon: Icon, title, desc }) => (
            <article
              key={title}
              className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-[var(--aloha-line)] transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--aloha-green-light)] text-[var(--aloha-green)]">
                <Icon size={22} strokeWidth={1.75} aria-hidden />
              </span>
              <h3 className="mt-3 text-[15px] font-extrabold text-[var(--aloha-ink)]">{title}</h3>
              <p className="mt-1.5 text-[13px] leading-relaxed text-[var(--aloha-muted)]">{desc}</p>
            </article>
          ))}
        </div>
      </section>

      {/* Quy trình */}
      <section className="border-y border-[var(--aloha-line)] bg-white py-12 sm:py-14">
        <div className="mx-auto max-w-7xl px-4">
          <h2 className="flex items-center gap-2 text-2xl font-extrabold text-[var(--aloha-green-dark)] sm:text-[1.75rem]">
            <Sprout size={22} className="text-[var(--aloha-green)]" aria-hidden />
            Quy trình tham gia đơn giản
          </h2>
          <div className="mt-10 grid gap-6 md:grid-cols-3 md:gap-4">
            {STEPS.map((step, i) => (
              <div key={step.n} className="relative flex flex-col items-center text-center md:px-4">
                {i < STEPS.length - 1 ? (
                  <span
                    className="pointer-events-none absolute top-7 left-[58%] hidden h-0.5 w-[84%] bg-[var(--aloha-green)]/25 md:block"
                    aria-hidden
                  />
                ) : null}
                <span className="relative z-10 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--aloha-green-dark)] text-lg font-black text-white shadow-md">
                  {step.n}
                </span>
                <span className="mt-3 text-[var(--aloha-green)]">
                  <step.icon size={22} strokeWidth={1.75} aria-hidden />
                </span>
                <h3 className="mt-2 text-base font-extrabold text-[var(--aloha-ink)]">{step.title}</h3>
                <p className="mt-1.5 max-w-[16rem] text-sm text-[var(--aloha-muted)]">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Cộng đồng */}
      <section className="mx-auto max-w-7xl px-4 py-12 sm:py-14">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="max-w-xl text-2xl font-extrabold text-[var(--aloha-green-dark)] sm:text-[1.75rem]">
            Cộng đồng CTV Aloha — Càng chia sẻ, càng nhận nhiều
          </h2>
          <button
            type="button"
            onClick={scrollToForm}
            className="inline-flex h-11 w-fit shrink-0 items-center gap-1 rounded-full bg-[var(--aloha-green-dark)] px-5 text-sm font-bold text-white hover:bg-[var(--aloha-green)]"
          >
            Đăng ký ngay
            <ChevronRight size={16} aria-hidden />
          </button>
        </div>

        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {COMMUNITY.map((c) => (
            <article
              key={c.title}
              className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-[var(--aloha-line)] transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="relative flex h-40 items-center justify-center bg-[#f3f6f0]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={c.image} alt="" className="max-h-[85%] max-w-[70%] object-contain" />
                <span className="absolute left-3 top-3 rounded-full bg-[var(--aloha-green)] px-2.5 py-0.5 text-[11px] font-bold text-white">
                  {c.badge}
                </span>
              </div>
              <div className="p-4">
                <h3 className="text-[15px] font-extrabold text-[var(--aloha-ink)]">{c.title}</h3>
                <p className="mt-1.5 text-[13px] leading-relaxed text-[var(--aloha-muted)]">{c.desc}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* Trust strip */}
      <section className="border-t border-[var(--aloha-border-brown)]/40 bg-[#FDF6E3] py-10">
        <div className="mx-auto flex max-w-7xl flex-col gap-8 px-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="grid flex-1 gap-6 sm:grid-cols-3">
            {[
              { icon: Package, title: "Sản phẩm chất lượng", desc: "Cây & chậu chọn lọc" },
              { icon: ShieldCheck, title: "Đóng gói cẩn thận", desc: "Giao hàng toàn quốc" },
              { icon: Headphones, title: "Hỗ trợ 24/7", desc: "Zalo / hotline sẵn sàng" },
            ].map(({ icon: Icon, title, desc }) => (
              <div key={title} className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-[var(--aloha-green)] ring-1 ring-[var(--aloha-border-brown)]/50">
                  <Icon size={20} strokeWidth={1.75} aria-hidden />
                </span>
                <div>
                  <div className="text-sm font-bold text-[var(--aloha-ink)]">{title}</div>
                  <p className="text-xs text-[var(--aloha-muted)]">{desc}</p>
                </div>
              </div>
            ))}
          </div>
          <p className="ctv-recruit-script text-2xl text-[var(--aloha-green-dark)] sm:text-[1.75rem]">
            Cùng Aloha lan tỏa màu xanh! ♡
          </p>
        </div>
      </section>
    </div>
  );
}
