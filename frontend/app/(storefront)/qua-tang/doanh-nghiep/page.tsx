import type { Metadata } from "next";
import Link from "next/link";
import {
  Sparkles,
  CheckCircle2,
  ArrowLeft,
  Building2,
  Gift,
  Palette,
  Truck,
  Phone,
  MessageCircle,
  FileCheck,
  Award,
  ChevronRight,
  ShieldCheck,
  Send,
} from "lucide-react";
import { SHOP_BRAND } from "@/lib/brand";
import { DoanhNghiepFormClient } from "./DoanhNghiepFormClient";

export const metadata: Metadata = {
  title: "Quà Tặng Doanh Nghiệp (B2B) | Giải Pháp Cây Xanh Trọn Gói Aloha",
  description:
    "Cung ứng quà tặng cây xanh doanh nghiệp số lượng lớn, in logo lên chậu, khắc tag gỗ, túi quà quai mộc sang trọng và xuất hóa đơn VAT đầy đủ tại TP.HCM.",
  openGraph: {
    title: "Dịch Vụ Quà Tặng Doanh Nghiệp (B2B) | Aloha Thế Giới Chậu Cây",
    description:
      "Giải pháp quà tặng cây xanh trọn gói cho đại hội, hội nghị và tri ân cán bộ nhân viên.",
    images: ["/banners/trust/dich-vu-goi-qua.webp"],
  },
};

// 3 Dịch vụ trọng tâm (như trong ảnh thực tế tại vườn Aloha)
const B2B_SERVICES = [
  {
    tag: "0đ PHÍ THIẾT KẾ",
    tagCls: "bg-emerald-50 text-emerald-800 border-emerald-200",
    title: "In logo chậu & túi quà theo yêu cầu",
    desc: "Thiết kế mockup mẫu miễn phí, công nghệ in sắc nét, bền màu theo đúng nhận diện thương hiệu của doanh nghiệp bạn.",
    image: "/banners/trust/dich-vu-in-logo.webp",
    alt: "In logo chậu cây và túi quà doanh nghiệp tại Aloha",
  },
  {
    tag: "CHỈN CHU TRỌN GÓI",
    tagCls: "bg-amber-50 text-amber-800 border-amber-200",
    title: "Gói quà trọn bộ & thiệp chúc mừng",
    desc: "Bao gồm túi giấy quai mộc cửa kính nhìn thấu cây xanh, thẻ cẩm nang chăm sóc chi tiết, nơ ruy băng satin và thiệp chúc mừng riêng.",
    image: "/banners/trust/dich-vu-goi-qua.webp",
    alt: "Gói quà cây xanh trọn bộ kèm thiệp và cẩm nang chăm sóc Aloha",
  },
  {
    tag: "CHIẾT KHẤU CAO & VAT",
    tagCls: "bg-blue-50 text-blue-800 border-blue-200",
    title: "Cung cấp đơn hàng số lượng lớn",
    desc: "Năng lực xưởng đáp ứng từ 10 đến 1.000+ chậu đồng bộ chất lượng, giá tận xưởng tối ưu ngân sách, đầy đủ hóa đơn VAT và hợp đồng bàn giao.",
    image: "/banners/trust/dich-vu-so-luong-lon.webp",
    alt: "Đơn hàng quà tặng doanh nghiệp số lượng lớn tại xưởng Aloha",
  },
];

// Khách hàng tiêu biểu đã hợp tác
const FEATURED_CLIENTS = [
  {
    name: "BIDV Chi nhánh Đông Sài Gòn",
    category: "Ngân hàng",
    scale: "300 chậu quà tặng cán bộ nhân viên",
    image: "/banners/trust/don-bidv.webp",
  },
  {
    name: "Tập đoàn Phan Vũ",
    category: "Tập đoàn Xây dựng",
    scale: "500 bộ quà tặng Đại hội cổ đông",
    image: "/banners/trust/don-phan-vu.webp",
  },
  {
    name: "Eco Retreat Long An",
    category: "Bất động sản cao cấp",
    scale: "200 chậu sứ quà tặng tri ân khách VIP",
    image: "/banners/trust/don-eco-retreat.webp",
  },
  {
    name: "Tỉnh Đoàn Bình Dương",
    category: "Đoàn thể",
    scale: "350 chậu kỷ niệm Ngày truyền thống HSSV",
    image: "/banners/trust/don-binh-duong.webp",
  },
];

// 4 Bước quy trình hợp tác
const PROCESS_STEPS = [
  {
    step: "01",
    title: "Tư vấn chọn cây & Ngân sách",
    desc: "Dựa trên số lượng, sự kiện và ngân sách của quý công ty, chuyên viên Aloha tư vấn mẫu cây và dáng chậu phù hợp nhất.",
  },
  {
    step: "02",
    title: "Lên mockup logo & Duyệt mẫu",
    desc: "Aloha thiết kế market in logo lên chậu và túi quà miễn phí, gửi mẫu thực tế duyệt trước khi sản xuất hàng loạt.",
  },
  {
    step: "03",
    title: "Trồng thành phẩm & Đóng gói",
    desc: "Dưỡng rễ kỹ càng, phối giá thể sạch dinh dưỡng, thắt nơ, đính kèm thẻ cẩm nang và thiệp chúc chỉn chu từng phần tử.",
  },
  {
    step: "04",
    title: "Giao tận nơi & Xuất hóa đơn VAT",
    desc: "Cam kết giao hàng đúng tiến độ sự kiện 100%, bảo hành cây xanh và hỗ trợ đầy đủ chứng từ, hợp đồng, hóa đơn VAT.",
  },
];

export default function DoanhNghiepGiftPage() {
  return (
    <div className="min-h-screen bg-[#FAF8F5] text-stone-800">
      {/* ─────────────────────────────────────────────────────────────
          HERO BANNER SECTION
      ───────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden border-b border-stone-200/90 bg-[#FDFBF7] py-10 sm:py-14 lg:py-18">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          {/* Breadcrumb */}
          <div className="mb-6">
            <Link
              href="/#goi-y-qua-tang"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-stone-500 hover:text-[var(--aloha-green)] transition"
            >
              <ArrowLeft size={14} />
              <span>Quay lại Gợi ý quà tặng</span>
            </Link>
          </div>

          <div className="grid grid-cols-1 items-center gap-6 lg:grid-cols-12 lg:gap-14">
            {/* Cột trái: Thông tin tiêu đề & Giới thiệu */}
            <div className="w-full lg:col-span-7 space-y-4 sm:space-y-5">
              <div className="inline-flex items-center gap-2 rounded-full bg-amber-50 border border-amber-200 px-3.5 py-1 text-xs font-extrabold uppercase tracking-wider text-amber-800">
                <Building2 size={13} className="text-amber-700" />
                <span>DỊCH VỤ QUÀ TẶNG DOANH NGHIỆP</span>
              </div>

              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold uppercase tracking-tight text-[#0E5242] leading-tight">
                Giải Pháp Quà Tặng Cây Xanh Trọn Gói
              </h1>

              {/* [MOBILE ONLY] Ảnh đại diện sản phẩm đặt ngay sau tiêu đề để thấy ngay trọn vẹn trong 1 khung */}
              <div className="block lg:hidden my-3">
                <div className="overflow-hidden rounded-2xl border border-stone-200/90 bg-white p-2.5 shadow-md">
                  <div className="overflow-hidden rounded-xl bg-stone-100 aspect-square">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src="/banners/trust/dich-vu-goi-qua.webp"
                      alt="Túi quà quai mộc cửa kính sang trọng cho doanh nghiệp"
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div className="p-2 text-center">
                    <p className="text-[11px] font-semibold text-stone-600">
                      Quy cách set quà tặng doanh nghiệp hoàn chỉnh: Túi quà cửa kính quai mộc, chậu cây in logo, thiệp và cẩm nang chăm sóc.
                    </p>
                  </div>
                </div>
              </div>

              <p className="text-sm sm:text-base lg:text-lg text-stone-700 font-medium leading-relaxed">
                Hỗ trợ trọn bộ từ khâu thiết kế tem logo thương hiệu, gói quà trang trọng đến đóng gói giao tận nơi đúng tiến độ cam kết.
              </p>

              <p className="hidden sm:block text-sm sm:text-base text-stone-600 leading-relaxed">
                Thay vì những giỏ quà bánh kẹo quen thuộc hay hoa tươi mau tàn, cây xanh mang biểu trưng cho sự phát triển bền vững, tươi mới và gắn kết dài lâu. Aloha đồng hành cùng doanh nghiệp trao gửi món quà văn hóa độc bản đến toàn thể cán bộ nhân viên, đối tác và khách hàng.
              </p>

              {/* Tag cam kết nhanh */}
              <div className="flex flex-wrap items-center gap-2 pt-1 text-xs font-bold text-stone-700">
                <span className="inline-flex items-center gap-1.5 rounded-xl bg-white border border-stone-200 px-3 py-1.5 shadow-2xs">
                  <CheckCircle2 size={14} className="text-[var(--aloha-green)] shrink-0" />
                  <span>Phục vụ từ 10 đến 1.000+ chậu</span>
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-xl bg-white border border-stone-200 px-3 py-1.5 shadow-2xs">
                  <CheckCircle2 size={14} className="text-[var(--aloha-green)] shrink-0" />
                  <span>Miễn phí in logo thương hiệu</span>
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-xl bg-white border border-stone-200 px-3 py-1.5 shadow-2xs">
                  <CheckCircle2 size={14} className="text-[var(--aloha-green)] shrink-0" />
                  <span>Đầy đủ hóa đơn VAT &amp; Hợp đồng</span>
                </span>
              </div>

              {/* Nút hành động */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-2 sm:pt-3">
                <a
                  href="#nhan-bao-gia"
                  className="inline-flex min-h-12 w-full sm:w-auto items-center justify-center gap-2 rounded-xl bg-[var(--aloha-green-dark)] px-5 sm:px-6 text-sm font-bold text-white shadow-md transition hover:bg-[var(--aloha-green)] text-center"
                >
                  <Send size={15} />
                  <span>Nhận Báo Giá Sỉ &amp; Catalog B2B</span>
                </a>
                <a
                  href="https://zalo.me/0794901233"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-12 w-full sm:w-auto items-center justify-center gap-2 rounded-xl border border-stone-300 bg-white px-5 text-sm font-bold text-stone-700 shadow-xs transition hover:border-[var(--aloha-green)] hover:text-[var(--aloha-green)] text-center"
                >
                  <MessageCircle size={15} />
                  <span>Tư Vấn Zalo 24/7 (079 490 1233)</span>
                </a>
              </div>
            </div>

            {/* [DESKTOP ONLY] Cột phải: Bức ảnh nổi bật túi quà quai mộc */}
            <div className="hidden lg:block w-full lg:col-span-5">
              <div className="relative mx-auto max-w-md overflow-hidden rounded-3xl border border-stone-200/80 bg-white p-3 shadow-xl">
                <div className="overflow-hidden rounded-2xl bg-stone-100 aspect-square">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/banners/trust/dich-vu-goi-qua.webp"
                    alt="Túi quà quai mộc cửa kính sang trọng cho doanh nghiệp"
                    className="h-full w-full object-cover transition duration-500 hover:scale-105"
                  />
                </div>
                <div className="p-3 text-center">
                  <p className="text-xs font-semibold text-stone-700">
                    Quy cách set quà tặng doanh nghiệp hoàn chỉnh: Túi quà cửa kính quai mộc, chậu cây in logo, thiệp và cẩm nang chăm sóc.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          SECTION 2: 3 GIẢI PHÁP DỊCH VỤ TRỌNG TÂM (NHƯ TRONG ẢNH)
      ───────────────────────────────────────────────────────────── */}
      <section className="py-14 sm:py-18 lg:py-22">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center mb-12 sm:mb-16">
            <span className="text-xs font-bold uppercase tracking-widest text-[var(--aloha-green)]">
              Đặc Quyền Dành Cho Khách Hàng Doanh Nghiệp
            </span>
            <h2 className="mt-2 text-2xl font-bold text-stone-900 sm:text-3xl lg:text-4xl">
              Chỉn Chu Trong Từng Chi Tiết Trao Đi
            </h2>
            <p className="mt-3 text-sm text-stone-600 sm:text-base">
              Chúng tôi hiểu rằng mỗi món quà trao tay mang theo uy tín và hình ảnh của chính thương hiệu bạn.
            </p>
          </div>

          {/* Lưới 3 thẻ dịch vụ */}
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3 lg:gap-8 max-w-6xl mx-auto">
            {B2B_SERVICES.map((srv, idx) => (
              <div
                key={idx}
                className="group flex flex-col overflow-hidden rounded-3xl border border-stone-200/90 bg-white p-4 sm:p-5 shadow-xs transition duration-300 hover:-translate-y-1 hover:border-[var(--aloha-green)] hover:shadow-xl"
              >
                {/* Ảnh dịch vụ - Vuông 1:1 */}
                <div className="relative aspect-square w-full overflow-hidden rounded-2xl bg-stone-100 mb-4">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={srv.image}
                    alt={srv.alt}
                    className="h-full w-full object-cover transition duration-700 group-hover:scale-106"
                  />
                  <span className={`absolute left-3 top-3 rounded-lg border px-2.5 py-1 text-[10.5px] font-extrabold shadow-sm ${srv.tagCls}`}>
                    {srv.tag}
                  </span>
                </div>

                <h3 className="text-base sm:text-lg font-bold text-stone-900 group-hover:text-[var(--aloha-green)] transition">
                  {srv.title}
                </h3>
                <p className="mt-2 text-xs sm:text-sm text-stone-600 leading-relaxed flex-1">
                  {srv.desc}
                </p>

                <div className="mt-4 pt-3 border-t border-stone-100 flex items-center justify-between text-xs font-bold text-[var(--aloha-green)]">
                  <span>Xem chi tiết quy cách</span>
                  <ChevronRight size={14} className="group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          SECTION 3: QUY TRÌNH HỢP TÁC 4 BƯỚC
      ───────────────────────────────────────────────────────────── */}
      <section className="border-y border-stone-200/80 bg-white py-14 sm:py-18">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center mb-12">
            <span className="text-xs font-bold uppercase tracking-widest text-[var(--aloha-green)]">
              Tiết Kiệm Thời Gian & Chi Phí
            </span>
            <h2 className="mt-2 text-2xl font-bold text-stone-900 sm:text-3xl">
              Quy Trình Triển Khai Đơn Quà B2B Nhanh Chóng
            </h2>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {PROCESS_STEPS.map((step, idx) => (
              <div
                key={idx}
                className="relative rounded-2xl border border-stone-200/70 bg-[#FAF9F5] p-5 shadow-2xs"
              >
                <span className="font-mono text-3xl font-black text-emerald-800/20">
                  {step.step}
                </span>
                <h3 className="mt-2 text-base font-bold text-stone-900">
                  {step.title}
                </h3>
                <p className="mt-2 text-xs text-stone-600 leading-relaxed">
                  {step.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          SECTION 4: CÁC DỰ ÁN ĐÃ THỰC HIỆN TIÊU BIỂU
      ───────────────────────────────────────────────────────────── */}
      <section className="py-14 sm:py-18 lg:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center mb-10">
            <span className="text-xs font-bold uppercase tracking-widest text-[var(--aloha-green)]">
              Minh Chứng Thực Tế
            </span>
            <h2 className="mt-2 text-2xl font-bold text-stone-900 sm:text-3xl">
              Doanh Nghiệp Đã Tin Chọn Aloha
            </h2>
            <p className="mt-2 text-xs sm:text-sm text-stone-600">
              Hình ảnh thực tế đã bàn giao từ các dự án quà tặng hội nghị, đại hội và sự kiện đối tác
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURED_CLIENTS.map((client, idx) => (
              <div
                key={idx}
                className="overflow-hidden rounded-2xl border border-stone-200/90 bg-white shadow-xs transition hover:shadow-md"
              >
                <div className="aspect-[4/3] w-full overflow-hidden bg-stone-100">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={client.image}
                    alt={client.name}
                    className="h-full w-full object-cover transition duration-500 hover:scale-104"
                  />
                </div>
                <div className="p-4">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 bg-amber-50 px-2 py-0.5 rounded">
                    {client.category}
                  </span>
                  <h4 className="mt-2 text-sm font-bold text-stone-900 line-clamp-1">
                    {client.name}
                  </h4>
                  <p className="mt-1 text-xs text-stone-500 line-clamp-2">
                    {client.scale}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          SECTION 5: FORM NHẬN BÁO GIÁ & CATALOG B2B
      ───────────────────────────────────────────────────────────── */}
      <section id="nhan-bao-gia" className="scroll-mt-20 border-t border-stone-200 bg-[#F4F1EA] py-14 sm:py-20">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <DoanhNghiepFormClient />
        </div>
      </section>
    </div>
  );
}
