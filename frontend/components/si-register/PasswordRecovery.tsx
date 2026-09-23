"use client";
import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { siRequest } from "@/lib/siQueries";
const schema=z.object({email:z.string(),password:z.string(),acceptedTerms:z.boolean()});
export function PasswordRecovery({reset=false}:{reset?:boolean}){
  const search=useSearchParams();const [done,setDone]=useState(false);
  const form=useForm<z.infer<typeof schema>>({resolver:zodResolver(schema),defaultValues:{email:"",password:"",acceptedTerms:false}});
  const mutation=useMutation({mutationFn:(values:z.infer<typeof schema>)=>siRequest(`/api/shop/auth/password/${reset?"reset":"forgot"}`,reset?{token:search.get("token"),password:values.password,acceptedTerms:values.acceptedTerms}:{email:values.email}),onSuccess:()=>setDone(true)});
  return <main className="mx-auto max-w-lg px-4 py-12"><section className="rounded-2xl border bg-white p-7 shadow-sm"><h1 className="mb-5 text-2xl font-bold">{reset?"Đặt mật khẩu":"Quên mật khẩu"}</h1>{done?<><p className="leading-relaxed">{reset?"Mật khẩu đã cập nhật. Hãy đăng nhập lại.":"Nếu email có tài khoản, Aloha sẽ gửi hướng dẫn khôi phục. Nếu chưa nhận được, vui lòng liên hệ hỗ trợ."}</p><Link href="/dang-nhap" className="mt-5 inline-block text-[var(--aloha-green)] underline">Đăng nhập</Link></>:<form onSubmit={form.handleSubmit(v=>mutation.mutate(v))} className="space-y-4"><label className="block text-sm">{reset?"Mật khẩu mới (ít nhất 8 ký tự)":"Email tài khoản"}<input {...form.register(reset?"password":"email")} type={reset?"password":"email"} required minLength={reset?8:undefined} autoComplete={reset?"new-password":"email"} className="mt-2 min-h-12 w-full rounded-xl border px-3 text-base"/></label>{reset&&<label className="flex gap-2 text-sm"><input type="checkbox" {...form.register("acceptedTerms")}/><span>Tôi đồng ý <Link href="/dieu-khoan-si" target="_blank" className="underline">điều khoản mua sỉ</Link> nếu kích hoạt tài khoản theo lời mời.</span></label>}{mutation.error&&<p role="alert" className="text-sm text-red-700">{mutation.error.message}</p>}<button disabled={mutation.isPending} className="min-h-12 w-full rounded-xl bg-[var(--aloha-green)] font-bold text-white disabled:opacity-50">{mutation.isPending?"Đang xử lý…":reset?"Lưu mật khẩu":"Gửi hướng dẫn"}</button></form>}</section></main>;
}
