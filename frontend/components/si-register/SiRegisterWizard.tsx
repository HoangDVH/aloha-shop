"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  Check,
  Leaf,
  ShieldCheck,
  LoaderCircle,
  MapPin,
  Package,
  Sparkles,
} from "lucide-react";
import { siRegisterSchema, type SiRegisterInput } from "@/lib/siRegisterSchema";
import { SiApiError, siRequest, useSiSession } from "@/lib/siQueries";
import { shopLogout } from "@/lib/auth";
import { shopMeQueryKey, useShopMeQuery } from "@/lib/authQueries";
import { formatVnd } from "@/lib/api";
import { GhnAddressFields } from "@/components/GhnAddressFields";
import { useSiDraft } from "./siRegisterDraftStore";
import type { ShopUser } from "@/lib/auth";

const defaults: SiRegisterInput = { phone: "", province: "", district: "", ward: "", detail: "", fullName: "", shopName: "", businessType: "", taxCode: "", note: "", email: "", password: "", acceptedTerms: false };
function accountWholesalePhone(phone?: string | null) {
  const digits = String(phone || "").replace(/\D/g, "");
  const norm = digits.startsWith("84") ? `0${digits.slice(2)}` : digits;
  return /^0[35789]\d{8}$/.test(norm) ? norm : "";
}

const lookupMessages: Record<string, string> = {
  existing_si_candidate: "Thông tin phù hợp với hồ sơ khách sỉ. Aloha sẽ xác minh khi duyệt.",
  not_found: "Hãy giới thiệu cửa hàng của bạn để Aloha hỗ trợ chính sách mua sỉ phù hợp.",
  existing_non_si: "Aloha sẽ xem xét hồ sơ mua sỉ và đối chiếu thông tin khách hàng của bạn.",
  manual_review: "Thông tin cần được Aloha đối chiếu thêm. Bạn vẫn có thể gửi hồ sơ.",
  lookup_unavailable: "Chưa kiểm tra được thông tin lúc này. Bạn có thể gửi hồ sơ để Aloha kiểm tra lại.",
};

export function SiRegisterWizard() {
  const searchParams = useSearchParams();
  const callbackError = searchParams.get("error");
  const session = useSiSession();
  const me = useShopMeQuery();
  const qc = useQueryClient();
  const [step, setStep] = useState(1);
  const [lookup, setLookup] = useState<{ lookupId: string; result: string } | null>(null);
  const [error, setError] = useState("");
  const [errorCode, setErrorCode] = useState("");
  const [ghnLoc, setGhnLoc] = useState({ ghnProvinceId: 0, ghnDistrictId: 0, ghnWardCode: "" });
  const form = useForm<SiRegisterInput>({ resolver: zodResolver(siRegisterSchema), defaultValues: defaults });
  const account = me.data;
  const status = account?.siStatus;
  const linkedPhone = accountWholesalePhone(account?.phone);
  useEffect(() => {
    if (session.data?.verified) setStep(s => Math.max(2, s));
  }, [session.data?.verified]);
  useEffect(() => {
    const saved = useSiDraft.getState();
    const owner = account?.id || "onboarding";
    if (saved.owner && saved.owner !== owner) saved.clear();
    const draft = saved.owner === owner && Date.now() - saved.savedAt < 86400000 ? saved.draft : {};
    const phone = linkedPhone || draft.phone || "";
    form.reset({ ...defaults, ...draft, fullName: account?.fullName || draft.fullName || "", phone, email: account?.email || "" });
  }, [account?.id, account?.fullName, account?.email, linkedPhone, form]);
  const saveDraft = () => {
    const { email, password, acceptedTerms, ...draft } = form.getValues();
    useSiDraft.getState().save(draft, account?.id || "onboarding");
  };
  const lookupMutation = useMutation({ mutationFn: async () => {
    if (!await form.trigger(["phone", "province", "ward", "detail"])) throw new Error("Vui lòng kiểm tra SĐT và địa chỉ");
    saveDraft();
    const v = form.getValues();
    return siRequest<{ lookupId: string; result: string }>("/api/shop/auth/si/lookup", { phone: v.phone, province: v.province, district: v.district, ward: v.ward, detail: v.detail });
  }, onSuccess: data => { setLookup(data); setStep(3); setError(""); setErrorCode(""); }, onError: e => { setError(e.message); setErrorCode(e instanceof SiApiError ? e.code : ""); } });
  const register = useMutation({ mutationFn: async (values: SiRegisterInput) => {
    if (!lookup) throw new Error("Vui lòng kiểm tra thông tin lại");
    return siRequest<{ user: ShopUser }>("/api/shop/auth/si/register", { ...values, lookupId: lookup.lookupId,
      email: account ? undefined : values.email, password: account ? undefined : values.password });
  }, onSuccess: data => { qc.setQueryData(shopMeQueryKey, data.user); void qc.invalidateQueries({ queryKey: ["shop", "si"] }); useSiDraft.getState().clear(); setError(""); setErrorCode(""); }, onError: e => { setError(e.message); setErrorCode(e instanceof SiApiError ? e.code : ""); } });
  const continueWithPhoneAccount = async () => {
    await shopLogout();
    window.location.href = `/dang-nhap?next=${encodeURIComponent("/dang-ky-si")}`;
  };
  const field = (name: keyof SiRegisterInput, label: string, type = "text", optional = false) => <label className="block text-sm font-semibold text-slate-700" key={name}>
    {label} {optional && <span className="font-normal text-slate-400">(không bắt buộc)</span>}
    <input {...form.register(name)} type={type} autoComplete={name === "password" ? "new-password" : undefined} aria-invalid={Boolean(form.formState.errors[name])}
      className="mt-2 min-h-12 w-full rounded-xl border border-slate-200 bg-white px-3 text-base font-normal outline-none transition focus:border-[var(--aloha-green)] focus:ring-2 focus:ring-[var(--aloha-green-light)]" />
    {form.formState.errors[name] && <span role="alert" className="mt-1 block text-xs text-red-700">{form.formState.errors[name]?.message}</span>}
  </label>;
  const busy = lookupMutation.isPending || register.isPending;

  return (
    <div className="min-h-[75vh] bg-[var(--aloha-cream)] px-4 py-8 sm:py-16">
      <div className="mx-auto max-w-5xl">

        {/* TẦNG 1: CHÍNH SÁCH BÁN SỈ (Rộng rãi, thoáng mắt, dễ đọc) */}
        <section className="space-y-6">
          {/* Header trung tâm */}
          <div className="text-center">
            <h1 className="text-3xl font-black tracking-tight text-[#0f3822] sm:text-4xl lg:text-5xl">
              CHÍNH SÁCH BÁN SỈ
            </h1>
          </div>

          {/* Banner quy định bắt buộc */}
          <div className="mx-auto max-w-3xl overflow-hidden rounded-2xl bg-[#0f3822] p-4 text-center text-white shadow-md sm:p-5">
            <h2 className="text-sm font-black uppercase tracking-wide text-white sm:text-base">
              CHỈ ÁP DỤNG CHO KHÁCH MUA HÀNG ĐỂ KINH DOANH, BÁN LẠI
            </h2>
            <p className="mt-1 text-xs font-medium text-emerald-100 sm:text-sm">
              Mua theo kiện hoặc theo thùng sẽ có giá tốt hơn mua từng sản phẩm riêng lẻ
            </p>
          </div>

          {/* Lưới 2 khối chính sách: 01 TP.HCM & 02 Đi Tỉnh (Chia 2 cột song song trên màn hình lớn) */}
          <div className="grid gap-6 md:grid-cols-2 items-stretch pt-2">
            {/* 01: MUA SỈ TẠI TP.HCM */}
            <div className="relative flex flex-col justify-between overflow-hidden rounded-2xl border border-slate-200/90 bg-white p-6 shadow-sm transition hover:shadow-md">
              <div className="absolute left-0 top-0 bottom-0 w-2.5 bg-[#2e7d32]" />
              <div>
                <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#e8f5e9] text-base font-black text-[#1b5e20] ring-4 ring-[#e8f5e9]/60">
                    01
                  </div>
                  <div>
                    <h3 className="text-lg font-black uppercase tracking-wide text-[#0f3822]">
                      MUA SỈ TẠI TP.HCM
                    </h3>
                    <p className="text-xs text-slate-500">Nội thành & khu vực lân cận</p>
                  </div>
                </div>

                <ul className="mt-4 space-y-2.5 text-sm text-slate-700">
                  <li className="flex items-start gap-2.5">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#2e7d32]" />
                    <span>Đơn hàng đầu tiên có giá trị từ <strong className="font-extrabold text-[#0f3822]">2.000.000đ</strong>.</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#2e7d32]" />
                    <span>Từ lần mua tiếp theo, lấy số lượng tùy nhu cầu.</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#2e7d32]" />
                    <span>Áp dụng khi mua tại cửa hàng hoặc nhận tại TP.HCM.</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#2e7d32]" />
                    <span>Khách tự đến lấy hoặc cho xe đến nhận hàng.</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#2e7d32]" />
                    <span>Vui lòng đặt trước vài tiếng để ALOHA chuẩn bị, tránh chờ đợi hoặc kẹt đơn.</span>
                  </li>
                </ul>
              </div>
            </div>

            {/* 02: ĐƠN SỈ GIAO ĐI TỈNH */}
            <div className="relative flex flex-col justify-between overflow-hidden rounded-2xl border border-slate-200/90 bg-white p-6 shadow-sm transition hover:shadow-md">
              <div className="absolute left-0 top-0 bottom-0 w-2.5 bg-[#d49926]" />
              <div>
                <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#fef7e0] text-base font-black text-[#b38600] ring-4 ring-[#fef7e0]/60">
                    02
                  </div>
                  <div>
                    <h3 className="text-lg font-black uppercase tracking-wide text-[#0f3822]">
                      ĐƠN SỈ GIAO ĐI TỈNH
                    </h3>
                    <p className="text-xs text-slate-500">Đóng kiện gửi chành xe</p>
                  </div>
                </div>

                <p className="mt-3 text-xs italic text-slate-500 sm:text-sm">
                  Hàng cần kiểm tra và đóng gói kỹ nên thời gian chuẩn bị lâu hơn.
                </p>

                <ul className="mt-3 space-y-2 text-sm text-slate-700">
                  <li className="flex items-start gap-2.5">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#d49926]" />
                    <span>Mua theo thùng hoặc đơn tối thiểu <strong className="font-extrabold text-[#0f3822]">2.000.000đ</strong>.</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#d49926]" />
                    <span>Mua theo thùng có giá tốt hơn mua riêng lẻ.</span>
                  </li>
                </ul>

                {/* 3 highlight boxes theo từng dòng hàng */}
                <div className="mt-4 space-y-2">
                  <div className="rounded-xl border border-emerald-100/90 bg-[#eef6ed] p-2.5 sm:p-3">
                    <h4 className="text-xs font-black uppercase tracking-wider text-[#1b5e20]">
                      CÂY THÀNH PHẨM
                    </h4>
                    <p className="mt-0.5 text-xs text-slate-700 sm:text-sm">
                      Mỗi mẫu lấy tối thiểu <strong className="font-extrabold text-[#0f3822]">5 chậu</strong>.
                    </p>
                  </div>

                  <div className="rounded-xl border border-emerald-100/90 bg-[#eef6ed] p-2.5 sm:p-3">
                    <h4 className="text-xs font-black uppercase tracking-wider text-[#1b5e20]">
                      CHẬU HOẶC TIỂU CẢNH
                    </h4>
                    <p className="mt-0.5 text-xs text-slate-700 sm:text-sm">
                      Mẫu dưới <strong className="font-extrabold text-[#0f3822]">15.000đ/sản phẩm</strong>: lấy tối thiểu{" "}
                      <strong className="font-extrabold text-[#0f3822]">5 sản phẩm</strong> cho mỗi mẫu.
                    </p>
                  </div>

                  <div className="rounded-xl border border-emerald-100/90 bg-[#eef6ed] p-2.5 sm:p-3">
                    <h4 className="text-xs font-black uppercase tracking-wider text-[#1b5e20]">
                      CÂY THÔ
                    </h4>
                    <p className="mt-0.5 text-xs text-slate-700 sm:text-sm">
                      Mỗi mẫu lấy tối thiểu <strong className="font-extrabold text-[#0f3822]">10 cây</strong>.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Footer Tag & Hỗ trợ nhanh */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
            <div className="rounded-full border border-emerald-200/80 bg-[#e8f5e9]/80 py-2 px-5 text-center text-xs font-black uppercase tracking-widest text-[#1b5e20] shadow-sm">
              BÁN SỈ & BÁN LẺ CHẬU - CÂY - TIỂU CẢNH
            </div>
            <div className="flex items-center gap-2 text-xs sm:text-sm text-slate-600">
              <Leaf size={15} className="text-[var(--aloha-green)]" />
              <span>Cần hỗ trợ sỉ nhanh?</span>
              <a
                href="https://zalo.me"
                target="_blank"
                rel="noreferrer"
                className="font-bold text-[var(--aloha-green)] hover:underline"
              >
                Nhắn Zalo 24/7 →
              </a>
            </div>
          </div>

        </section>

        {/* TẦNG 2: FORM ĐĂNG KÝ SỈ (Căn giữa, độc lập, tối ưu tập trung) */}
        <section
          id="form-dang-ky"
          className="mt-12 sm:mt-16 scroll-mt-10 mx-auto max-w-2xl rounded-3xl border border-slate-200/90 bg-white p-6 sm:p-10 shadow-[var(--aloha-shadow)]"
        >
          {/* Header trong Form */}
          <div className="mb-6 border-b border-slate-100 pb-5 text-center">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--aloha-green-light)] px-3 py-1 text-xs font-bold text-[var(--aloha-green)]">
              <Sparkles size={13} />
              Hồ sơ đối tác sỉ
            </span>
            <h2 className="mt-2 text-2xl font-bold text-slate-900 sm:text-3xl">
              Đăng ký tài khoản mua sỉ
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Nhận chính sách chiết khấu và báo giá sỉ riêng từ Aloha
            </p>
          </div>
        {status === "cho_duyet" || status === "active" || status === "khoa" ? <div className="py-8 text-center">
          <div className="mx-auto mb-5 w-fit rounded-full bg-[var(--aloha-green-light)] p-5 text-[var(--aloha-green)]"><Check size={30}/></div>
          <h2 className="text-2xl font-bold">{status === "active" ? "Tài khoản sỉ đã được mở" : status === "khoa" ? "Tài khoản sỉ tạm khóa" : "Aloha đã nhận hồ sơ của bạn"}</h2>
          <p className="mt-3 leading-relaxed text-slate-600">{status === "active" ? "Bạn có thể xem giá sỉ và mua hàng ngay tại shop." : status === "khoa" ? "Vui lòng liên hệ Aloha để được hỗ trợ." : "Hồ sơ đang chờ duyệt. Aloha sẽ đối chiếu thông tin và liên hệ với bạn khi cần bổ sung."}</p>
          <Link href="/" className="mt-7 inline-flex min-h-12 items-center gap-2 rounded-xl bg-[var(--aloha-green)] px-6 font-bold text-white">Tiếp tục mua sắm <ArrowRight size={18}/></Link>
        </div> : <>
          <ol className="mb-7 flex justify-between gap-2" aria-label="Các bước đăng ký">{["Đăng nhập","Thông tin liên hệ","Hồ sơ"].map((label,i)=><li key={label} aria-current={step===i+1?"step":undefined} className={`flex flex-1 flex-col gap-2 text-xs sm:text-sm ${step>=i+1?"text-[var(--aloha-green)]":"text-slate-400"}`}><span className={`flex h-8 w-8 items-center justify-center rounded-full font-bold ${step>=i+1?"bg-[var(--aloha-green)] text-white":"bg-slate-100"}`}>{step>i+1?<Check size={16}/>:i+1}</span>{label}</li>)}</ol>
          <h2 className="mb-2 text-xl font-bold">{step===1?"Bắt đầu với tài khoản Zalo":step===2?"Thông tin liên hệ của bạn":"Hoàn tất hồ sơ mua sỉ"}</h2>
          {step===1 ? <div className="mt-4 space-y-4">
            <p className="text-sm leading-relaxed text-slate-500">Đăng nhập để lưu hồ sơ. Aloha sẽ xác minh thông tin cửa hàng khi duyệt.</p>
            {session.isPending?<p>Đang kiểm tra…</p>:session.data?.zaloConfigured?<a href="/api/shop/auth/zalo/start" className="flex min-h-12 items-center justify-center rounded-xl bg-[var(--aloha-green)] px-4 font-bold text-white">Tiếp tục với Zalo</a>:<p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">Đăng ký qua Zalo đang được chuẩn bị. Vui lòng liên hệ Aloha để được hỗ trợ.</p>}
            <p className="text-sm">Đã có tài khoản Aloha? <Link href="/dang-nhap?next=/dang-ky-si" className="font-semibold text-[var(--aloha-green)] underline">Đăng nhập</Link></p>
          </div> : <form onSubmit={form.handleSubmit(values=>register.mutate(values))} onBlur={saveDraft} className="mt-5 space-y-5">
            {step===2 ? (
              <>
                <label className="block text-sm font-semibold text-slate-700">
                  Số điện thoại {linkedPhone && <span className="font-normal text-xs text-slate-500">(đã gắn với tài khoản)</span>}
                  <input
                    {...form.register("phone")}
                    type="tel"
                    readOnly={Boolean(linkedPhone)}
                    aria-invalid={Boolean(form.formState.errors.phone)}
                    className={`mt-2 min-h-12 w-full rounded-xl border border-slate-200 bg-white px-3 text-base font-normal outline-none transition focus:border-[var(--aloha-green)] focus:ring-2 focus:ring-[var(--aloha-green-light)] ${
                      linkedPhone ? "bg-slate-100 cursor-not-allowed text-slate-600" : ""
                    }`}
                  />
                  {form.formState.errors.phone && <span role="alert" className="mt-1 block text-xs text-red-700">{form.formState.errors.phone.message}</span>}
                </label>
                <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
                  <p className="mb-3 text-sm font-semibold text-slate-700">Địa chỉ kinh doanh / kho hàng</p>
                  <GhnAddressFields
                    hideContactFields
                    addressLabel="Số nhà, tên đường"
                    value={{
                      fullName: form.watch("fullName") || "",
                      phone: form.watch("phone") || "",
                      province: form.watch("province") || "",
                      district: form.watch("district") || "",
                      ward: form.watch("ward") || "",
                      detail: form.watch("detail") || "",
                      ghnProvinceId: ghnLoc.ghnProvinceId,
                      ghnDistrictId: ghnLoc.ghnDistrictId,
                      ghnWardCode: ghnLoc.ghnWardCode,
                    }}
                    onChange={(patch) => {
                      if (patch.province !== undefined) form.setValue("province", patch.province, { shouldValidate: true });
                      if (patch.district !== undefined) form.setValue("district", patch.district, { shouldValidate: true });
                      if (patch.ward !== undefined) form.setValue("ward", patch.ward, { shouldValidate: true });
                      if (patch.detail !== undefined) form.setValue("detail", patch.detail, { shouldValidate: true });
                      setGhnLoc((prev) => ({ ...prev, ...patch }));
                    }}
                  />
                  {form.formState.errors.province && <span role="alert" className="mt-1 block text-xs text-red-700">{form.formState.errors.province.message}</span>}
                  {form.formState.errors.ward && <span role="alert" className="mt-1 block text-xs text-red-700">{form.formState.errors.ward.message}</span>}
                  {form.formState.errors.detail && <span role="alert" className="mt-1 block text-xs text-red-700">{form.formState.errors.detail.message}</span>}
                </div>
              </>
            ) : <>
              <p className="rounded-xl bg-[var(--aloha-green-light)] p-3 text-sm leading-relaxed text-[var(--aloha-green-dark)]">{lookupMessages[lookup?.result || ""]}</p>
              {field("fullName","Họ tên người liên hệ")}
              {lookup?.result!=="existing_si_candidate" && <>{field("shopName","Tên cửa hàng / công ty")}{field("businessType","Loại hình kinh doanh")}</>}
              {!account && <>{field("email","Email","email")}{field("password","Mật khẩu (ít nhất 8 ký tự)","password")}</>}
              <details className="rounded-xl border border-slate-200 p-4"><summary className="cursor-pointer text-sm font-semibold">Thông tin bổ sung</summary><div className="mt-4 space-y-4">{field("taxCode","Mã số thuế","text",true)}{field("note","Ghi chú / quy mô / fanpage","text",true)}</div></details>
              <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">Nếu thuộc nhóm khách sỉ tỉnh, đơn hàng cần từ {formatVnd(session.data?.minOrder || 2000000)} tiền hàng theo giá sỉ. Aloha xác nhận khu vực khi duyệt.</p>
              <label className="flex items-start gap-3 text-sm"><input type="checkbox" {...form.register("acceptedTerms")} className="mt-1 h-4 w-4 accent-[var(--aloha-green)]"/><span>Tôi đồng ý <Link href="/dieu-khoan-si" target="_blank" className="text-[var(--aloha-green)] underline">Điều khoản mua sỉ và chính sách bảo mật</Link>.</span></label>
              {form.formState.errors.acceptedTerms && <p role="alert" className="text-sm text-red-700">{form.formState.errors.acceptedTerms.message}</p>}
            </>}
            <div className="flex gap-3 border-t border-slate-100 pt-5">{step===3&&<button type="button" disabled={busy} onClick={()=>{setStep(2);setLookup(null);}} className="min-h-12 rounded-xl border border-slate-200 px-4 font-semibold">Quay lại</button>}<button type={step===2?"button":"submit"} disabled={busy} onClick={step===2?()=>lookupMutation.mutate():undefined} className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-[var(--aloha-green)] px-4 font-bold text-white disabled:opacity-50">{busy&&<LoaderCircle size={18} className="animate-spin"/>}{step===2?"Kiểm tra thông tin":"Gửi hồ sơ mua sỉ"}</button></div>
          </form>}
          {(error || session.error || callbackError) && <div role="alert" className="mt-4 space-y-3 rounded-xl bg-red-50 p-3 text-sm text-red-700">
            <p>{error || session.error?.message || (callbackError === "zalo_account_conflict" ? "Zalo đã liên kết tài khoản khác. Vui lòng dùng tài khoản cũ hoặc liên hệ Aloha." : callbackError === "zalo_cancelled" ? "Bạn đã hủy đăng nhập Zalo. Có thể thử lại khi sẵn sàng." : "Phiên đăng nhập Zalo hết hạn hoặc chưa hoàn tất. Vui lòng thử lại.")}</p>
            {(errorCode === "phone_requires_login" || errorCode === "phone_belongs_to_other") && <button type="button" onClick={() => void continueWithPhoneAccount()} className="inline-flex min-h-10 items-center rounded-lg bg-[var(--aloha-green)] px-3 font-bold text-white">Đăng nhập tài khoản này</button>}
          </div>}
        </>}
        </section>
      </div>
    </div>
  );
}
