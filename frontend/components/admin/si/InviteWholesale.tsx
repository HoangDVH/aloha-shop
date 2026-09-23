"use client";
import { useState } from "react";
import { Alert, Button, Modal } from "antd";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { siRequest } from "@/lib/siQueries";
const schema = z.object({ fullName: z.string().trim().min(2, "Nhập họ tên"), email: z.string().email("Email chưa hợp lệ"), phone: z.string().trim().min(10, "Nhập số điện thoại") });
export function InviteWholesale() {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const qc = useQueryClient();
  const form = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema), defaultValues: { fullName: "", email: "", phone: "" } });
  const invite = useMutation({ mutationFn: (body: z.infer<typeof schema>) => siRequest<{ url: string }>("/api/shop/admin/si/invite", body),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["admin", "si"] }); } });
  return <><Button onClick={() => { invite.reset(); setCopied(false); form.reset(); setOpen(true); }}>Mời khách sỉ</Button>
    <Modal open={open} onCancel={() => setOpen(false)} title="Mời khách mở tài khoản sỉ" footer={null} destroyOnHidden>
      {invite.data ? <div className="space-y-4"><Alert type="success" title="Đã tạo lời mời" description="Gửi riêng liên kết này cho đúng khách qua kênh đã xác minh. Hiệu lực 30 phút, dùng một lần. Khách đặt mật khẩu và đồng ý điều khoản; hồ sơ vẫn cần được duyệt." />
        <input readOnly value={invite.data.url} aria-label="Liên kết mời" className="min-h-11 w-full rounded-lg border p-2" />
        <Button onClick={async () => { await navigator.clipboard.writeText(invite.data!.url); setCopied(true); }}>{copied ? "Đã sao chép" : "Sao chép liên kết"}</Button></div>
        : <form className="space-y-4" onSubmit={form.handleSubmit(body => invite.mutate(body))}>
          {([['fullName', 'Họ tên'], ['email', 'Email'], ['phone', 'Số điện thoại']] as const).map(([name, label]) => <label key={name} className="block text-sm">{label}<input {...form.register(name)} type={name === "email" ? "email" : name === "phone" ? "tel" : "text"} className="mt-1 min-h-11 w-full rounded-lg border px-3" />{form.formState.errors[name] && <span className="text-red-700">{form.formState.errors[name]?.message}</span>}</label>)}
          {invite.error && <Alert type="error" title={invite.error.message} />}<Button type="primary" htmlType="submit" loading={invite.isPending}>Tạo liên kết mời</Button>
        </form>}
    </Modal></>;
}
