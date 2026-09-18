"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  App,
  Avatar,
  Button,
  Card,
  Col,
  Input,
  Row,
  Tag,
} from "antd";
import { Mail, Pencil, Phone } from "lucide-react";
import { useShopAuth } from "@/components/ShopAuthProvider";
import {
  useCtvMePayoutBank,
  useSaveCtvPayoutBank,
} from "../ctvPortalQueries";
import {
  payoutBankSchema,
  profileFormSchema,
  type PayoutBankInput,
  type ProfileFormInput,
} from "../schemas";

export function AccountPanel() {
  const { message } = App.useApp();
  const { user, updateMe } = useShopAuth();
  const bankQ = useCtvMePayoutBank();
  const saveBank = useSaveCtvPayoutBank();

  const profileForm = useForm<ProfileFormInput>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: { fullName: "", phone: "" },
  });

  const bankForm = useForm<PayoutBankInput>({
    resolver: zodResolver(payoutBankSchema),
    defaultValues: {
      bankBin: "",
      bankName: "",
      accountNumber: "",
      accountName: "",
    },
  });

  useEffect(() => {
    if (!user) return;
    profileForm.reset({
      fullName: user.fullName || "",
      phone: user.phone || "",
    });
  }, [user, profileForm]);

  useEffect(() => {
    if (!bankQ.data) return;
    bankForm.reset({
      bankBin: bankQ.data.bankBin || "",
      bankName: bankQ.data.bankName || "",
      accountNumber: bankQ.data.accountNumber || "",
      accountName: bankQ.data.accountName || "",
    });
  }, [bankQ.data, bankForm]);

  if (!user) return null;

  return (
    <div className="space-y-4">
      <h1 className="m-0 text-xl font-extrabold text-[#163A2A]">
        Thông tin tài khoản
      </h1>

      <Card className="shadow-sm">
        <div className="flex flex-wrap items-start gap-4">
          <Avatar size={72} src={user.avatarUrl || undefined}>
            {(user.fullName || "?").slice(0, 1).toUpperCase()}
          </Avatar>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="m-0 text-lg font-extrabold text-[#163A2A]">
                {user.fullName}
              </h2>
              <Tag color="green">CTV</Tag>
              {user.ctvCode ? (
                <Tag>{user.ctvCode}</Tag>
              ) : null}
            </div>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600">
              <span className="inline-flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5" />
                {user.email}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Phone className="h-3.5 w-3.5" />
                {user.phone || "—"}
              </span>
            </div>
          </div>
        </div>
      </Card>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <Card
            title="Thông tin cá nhân"
            className="h-full shadow-sm"
            extra={<Pencil className="h-4 w-4 text-[#0F9D58]" />}
          >
            <form
              className="space-y-3"
              onSubmit={profileForm.handleSubmit(async (values) => {
                try {
                  await updateMe({
                    fullName: values.fullName,
                    phone: values.phone || undefined,
                  });
                  message.success("Đã cập nhật hồ sơ");
                } catch (e: any) {
                  message.error(e?.message || "Cập nhật thất bại");
                }
              })}
            >
              <label className="block text-xs font-semibold text-slate-600">
                Họ và tên
                <Input className="mt-1" {...profileForm.register("fullName")} />
              </label>
              {profileForm.formState.errors.fullName ? (
                <p className="text-xs text-red-600">
                  {profileForm.formState.errors.fullName.message}
                </p>
              ) : null}
              <label className="block text-xs font-semibold text-slate-600">
                Số điện thoại
                <Input className="mt-1" {...profileForm.register("phone")} />
              </label>
              {profileForm.formState.errors.phone ? (
                <p className="text-xs text-red-600">
                  {profileForm.formState.errors.phone.message}
                </p>
              ) : null}
              <label className="block text-xs font-semibold text-slate-600">
                Email
                <Input className="mt-1" value={user.email} disabled />
              </label>
              <label className="block text-xs font-semibold text-slate-600">
                Mã CTV
                <Input className="mt-1" value={user.ctvCode || "—"} disabled />
              </label>
              <Button type="primary" htmlType="submit">
                Lưu thay đổi
              </Button>
            </form>
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card title="Thông tin ngân hàng" className="h-full shadow-sm">
            <form
              className="space-y-3"
              onSubmit={bankForm.handleSubmit(async (values) => {
                try {
                  await saveBank.mutateAsync(values);
                  message.success("Đã cập nhật STK");
                } catch (e: any) {
                  message.error(e?.message || "Lưu thất bại");
                }
              })}
            >
              <label className="block text-xs font-semibold text-slate-600">
                Ngân hàng
                <Input className="mt-1" {...bankForm.register("bankName")} />
              </label>
              <label className="block text-xs font-semibold text-slate-600">
                Mã BIN
                <Input className="mt-1" {...bankForm.register("bankBin")} />
              </label>
              <label className="block text-xs font-semibold text-slate-600">
                Số tài khoản
                <Input className="mt-1" {...bankForm.register("accountNumber")} />
              </label>
              <label className="block text-xs font-semibold text-slate-600">
                Chủ tài khoản
                <Input className="mt-1" {...bankForm.register("accountName")} />
              </label>
              {Object.values(bankForm.formState.errors)[0] ? (
                <p className="text-xs text-red-600">
                  {Object.values(bankForm.formState.errors)[0]?.message}
                </p>
              ) : null}
              <Button
                type="primary"
                htmlType="submit"
                loading={saveBank.isPending}
              >
                Thay đổi
              </Button>
            </form>
          </Card>
        </Col>
      </Row>
    </div>
  );
}
