"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Check, Leaf, ShieldCheck, Truck, LoaderCircle } from "lucide-react";
import { siRegisterSchema, type SiRegisterInput } from "@/lib/siRegisterSchema";
import { siRequest, useSiSession } from "@/lib/siQueries";
import { shopMeQueryKey, useShopMeQuery } from "@/lib/authQueries";
import { formatVnd } from "@/lib/api";
import { useSiDraft } from "./siRegisterDraftStore";
import type { ShopUser } from "@/lib/auth";

const defaults: SiRegisterInput = { phone: "", province: "", ward: "", detail: "", fullName: "", shopName: "", businessType: "", taxCode: "", note: "", email: "", password: "", acceptedTerms: false };
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
  const form = useForm<SiRegisterInput>({ resolver: zodResolver(siRegisterSchema), defaultValues: defaults });
  const account = me.data;
  const status = account?.siStatus;
  useEffect(() => {
    if (session.data?.verified) setStep(s => Math.max(2, s));
  }, [session.data?.verified]);
  useEffect(() => {
    const saved = useSiDraft.getState();
    const owner = account?.id || "onboarding";
    if (saved.owner && saved.owner !== owner) saved.clear();
    const draft = saved.owner === owner && Date.now() - saved.savedAt < 86400000 ? saved.draft : {};
    form.reset({ ...defaults, ...draft, fullName: account?.fullName || draft.fullName || "", phone: account?.phone || draft.phone || "", email: account?.email || "" });
  }, [account?.id, form]);
  const saveDraft = () => {
    const { email, password, acceptedTerms, ...draft } = form.getValues();
    useSiDraft.getState().save(draft, account?.id || "onboarding");
  };
  const lookupMutation = useMutation({ mutationFn: async () => {
    if (!await form.trigger(["phone", "province", "ward", "detail"])) throw new Error("Vui lòng kiểm tra SĐT và địa chỉ");
    saveDraft();
    const v = form.getValues();
    return siRequest<{ lookupId: string; result: string }>("/api/shop/auth/si/lookup", { phone: v.phone, province: v.province, ward: v.ward, detail: v.detail });
  }, onSuccess: data => { setLookup(data); setStep(3); setError(""); }, onError: e => setError(e.message) });
  const register = useMutation({ mutationFn: async (values: SiRegisterInput) => {
    if (!lookup) throw new Error("Vui lòng kiểm tra thông tin lại");
    return siRequest<{ user: ShopUser }>("/api/shop/auth/si/register", { ...values, lookupId: lookup.lookupId,
      email: account ? undefined : values.email, password: account ? undefined : values.password });
  }, onSuccess: data => { qc.setQueryData(shopMeQueryKey, data.user); void qc.invalidateQueries({ queryKey: ["shop", "si"] }); useSiDraft.getState().clear(); setError(""); }, onError: e => setError(e.message) });
  const field = (name: keyof SiRegisterInput, label: string, type = "text", optional = false) => <label className="block text-sm font-semibold text-slate-700" key={name}>
    {label} {optional && <span className="font-normal text-slate-400">(không bắt buộc)</span>}
    <input {...form.register(name)} type={type} autoComplete={name === "password" ? "new-password" : undefined} aria-invalid={Boolean(form.formState.errors[name])}
      className="mt-2 min-h-12 w-full rounded-xl border border-slate-200 bg-white px-3 text-base font-normal outline-none transition focus:border-[var(--aloha-green)] focus:ring-2 focus:ring-[var(--aloha-green-light)]" />
    {form.formState.errors[name] && <span role="alert" className="mt-1 block text-xs text-red-700">{form.formState.errors[name]?.message}</span>}
  </label>;
  const busy = lookupMutation.isPending || register.isPending;

  return <main className="min-h-[75vh] bg-[var(--aloha-cream)] px-4 py-8 sm:py-14">
    <div className="mx-auto grid max-w-[1120px] gap-8 lg:grid-cols-[.8fr_1.2fr] lg:gap-14">
      <section className="lg:pt-8">
        <Link href="/" className="text-sm font-semibold text-[var(--aloha-green)]">← Về cửa hàng Aloha</Link>
        <p className="mt-7 flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-[var(--aloha-green)]"><Leaf size={18} /> Dành cho đối tác</p>
        <h1 className="mt-4 text-3xl font-bold leading-tight text-[var(--aloha-ink)] sm:text-4xl">Mua sỉ cùng Aloha</h1>
        <p className="mt-4 max-w-md leading-relaxed text-slate-600">Từ cửa hàng nhỏ đến những đơn hàng lớn. Gửi hồ sơ để Aloha đồng hành cùng công việc kinh doanh của bạn.</p>
        <div className="mt-8 hidden space-y-5 lg:block">{[[ShieldCheck,"Chính sách giá sỉ rõ ràng","Xem giá dành cho đối tác sau khi hồ sơ được duyệt."],[Leaf,"Lựa chọn phù hợp cửa hàng","Khám phá cây xanh, chậu và sản phẩm của Aloha."],[Truck,"Hỗ trợ đơn hàng của bạn","Trao đổi với Aloha về hàng sẵn và nhu cầu đặt thêm."]].map(([Icon,title,desc]) => { const I = Icon as typeof Leaf; return <div key={String(title)} className="flex gap-3"><span className="h-fit rounded-xl bg-white p-3 text-[var(--aloha-green)]"><I size={22}/></span><div><h2 className="font-semibold">{String(title)}</h2><p className="mt-1 text-sm text-slate-500">{String(desc)}</p></div></div>; })}</div>
      </section>
      <section className="rounded-[20px] border border-slate-100 bg-white p-5 shadow-[var(--aloha-shadow)] sm:p-8">
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
            {step===2 ? <>{field("phone","Số điện thoại","tel")}<div className="grid gap-4 sm:grid-cols-2">{field("province","Tỉnh / thành phố")}{field("ward","Phường / xã")}</div>{field("detail","Số nhà, tên đường")}</> : <>
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
          {(error || session.error || callbackError) && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error || session.error?.message || (callbackError === "zalo_account_conflict" ? "Zalo đã liên kết tài khoản khác. Vui lòng dùng tài khoản cũ hoặc liên hệ Aloha." : callbackError === "zalo_cancelled" ? "Bạn đã hủy đăng nhập Zalo. Có thể thử lại khi sẵn sàng." : "Phiên đăng nhập Zalo hết hạn hoặc chưa hoàn tất. Vui lòng thử lại.")}</p>}
        </>}
      </section>
    </div>
  </main>;
}
