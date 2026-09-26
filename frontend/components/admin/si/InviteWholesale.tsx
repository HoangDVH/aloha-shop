"use client";
import { useState } from "react";
import { Alert, Button, Modal } from "antd";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { siRequest } from "@/lib/siQueries";

const schema = z.object({
  fullName: z.string().trim().min(2, "Nhập họ tên"),
  email: z.string().email("Email chưa hợp lệ"),
  phone: z.string().trim().min(10, "Nhập số điện thoại"),
});

type InviteResult = { url: string; mode?: "create" | "upgrade"; message?: string };

export function InviteWholesale() {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const qc = useQueryClient();
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { fullName: "", email: "", phone: "" },
  });
  const invite = useMutation({
    mutationFn: (body: z.infer<typeof schema>) =>
      siRequest<InviteResult>("/api/shop/admin/si/invite", body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin", "si"] });
      void qc.invalidateQueries({ queryKey: ["admin", "directory"] });
    },
  });

  const successTitle =
    invite.data?.mode === "upgrade"
      ? "Đã nâng cấp tài khoản sẵn có"
      : "Đã tạo lời mời";
  const successDescription =
    invite.data?.message ||
    (invite.data?.mode === "upgrade"
      ? "Email/SĐT đã là khách lẻ — hệ thống gắn quyền sỉ trên cùng tài khoản (không tạo account thứ hai). Gửi link để khách đặt/cập nhật mật khẩu và đồng ý điều khoản; hồ sơ vẫn chờ duyệt."
      : "Gửi riêng liên kết này cho đúng khách qua kênh đã xác minh. Hiệu lực 30 phút, dùng một lần. Khách đặt mật khẩu và đồng ý điều khoản; hồ sơ vẫn cần được duyệt.");

  return (
    <>
      <Button
        onClick={() => {
          invite.reset();
          setCopied(false);
          form.reset();
          setOpen(true);
        }}
      >
        Mời khách sỉ
      </Button>
      <Modal
        open={open}
        onCancel={() => setOpen(false)}
        title="Mời khách mở tài khoản sỉ"
        footer={null}
        destroyOnHidden
      >
        {invite.data ? (
          <div className="space-y-4">
            <Alert type="success" title={successTitle} description={successDescription} />
            <input
              readOnly
              value={invite.data.url}
              aria-label="Liên kết mời"
              className="min-h-11 w-full rounded-lg border p-2"
            />
            <Button
              onClick={async () => {
                await navigator.clipboard.writeText(invite.data!.url);
                setCopied(true);
              }}
            >
              {copied ? "Đã sao chép" : "Sao chép liên kết"}
            </Button>
          </div>
        ) : (
          <form
            className="space-y-4"
            onSubmit={form.handleSubmit((body) => invite.mutate(body))}
          >
            <p className="text-sm text-slate-600">
              Nếu email/SĐT đã là khách lẻ, hệ thống sẽ nâng cấp cùng tài khoản (không tạo
              account mới).
            </p>
            {(
              [
                ["fullName", "Họ tên"],
                ["email", "Email"],
                ["phone", "Số điện thoại"],
              ] as const
            ).map(([name, label]) => (
              <label key={name} className="block text-sm">
                {label}
                <input
                  {...form.register(name)}
                  type={name === "email" ? "email" : name === "phone" ? "tel" : "text"}
                  className="mt-1 min-h-11 w-full rounded-lg border px-3"
                />
                {form.formState.errors[name] && (
                  <span className="text-red-700">{form.formState.errors[name]?.message}</span>
                )}
              </label>
            ))}
            {invite.error && <Alert type="error" title={invite.error.message} />}
            <Button type="primary" htmlType="submit" loading={invite.isPending}>
              Tạo liên kết mời
            </Button>
          </form>
        )}
      </Modal>
    </>
  );
}
