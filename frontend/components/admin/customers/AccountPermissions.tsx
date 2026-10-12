"use client";
import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Alert, Button, Checkbox, Input, Radio, message } from "antd";
import { ShieldCheck } from "lucide-react";
import { siRequest } from "@/lib/siQueries";

type Account = { id: string; roles: string[]; siStatus?: string | null; ctvStatus?: string | null;
  ctvCode?: string | null; active: boolean; permissionsRevision?: number };
export function AccountPermissions({ account, onChanged, onWholesale }: { account: Account; onChanged: () => void; onWholesale: () => void }) {
  const qc = useQueryClient();
  const [type, setType] = useState(account.roles.includes("si") ? "wholesale" : "retail");
  const [ctv, setCtv] = useState(account.roles.includes("ctv"));
  const [activateCtv, setActivateCtv] = useState(false);
  const [code, setCode] = useState(account.ctvCode || "");
  const [reason, setReason] = useState("");
  useEffect(() => {
    setType(account.roles.includes("si") ? "wholesale" : "retail"); setCtv(account.roles.includes("ctv"));
    setCode(account.ctvCode || ""); setReason(""); setActivateCtv(false);
  }, [account.id, account.permissionsRevision, account.siStatus, account.ctvStatus, account.ctvCode, account.roles]);
  const save = useMutation({
    mutationFn: () => siRequest<{ user: Account }>(`/api/shop/admin/accounts/${account.id}/permissions`, {
      customerType: type, ctv, activateCtv, ...(ctv ? { ctvCode: code.trim() } : {}), reason: reason.trim(),
      expected: { roles: account.roles, siStatus: account.siStatus ?? null, ctvStatus: account.ctvStatus ?? null, revision: account.permissionsRevision || 0 },
    }, "PATCH"),
    onSuccess: data => {
      qc.setQueryData<{ user: Account }>(["admin", "directory", "detail", account.id], old => old ? { ...old, user: { ...old.user, ...data.user } } : { user: data.user });
      onChanged(); void qc.invalidateQueries({ queryKey: ["admin", "si"] });
      void qc.invalidateQueries({ queryKey: ["admin", "ctv"] });
      void message.success("Đã lưu phân quyền tài khoản");
    },
  });
  const changed = type !== (account.roles.includes("si") ? "wholesale" : "retail") || ctv !== account.roles.includes("ctv") || activateCtv;
  const validCode = !ctv || !code.trim() || /^[A-Za-z0-9_-]{3,20}$/.test(code.trim());
  return <section className="space-y-4 rounded-xl border border-green-200 bg-green-50/30 p-4" aria-label="Phân quyền tài khoản">
    <h3 className="flex items-center gap-2 font-semibold"><ShieldCheck size={18} className="text-green-700" />Phân quyền tài khoản</h3>
    <div className="space-y-2"><p className="text-sm font-medium">Loại khách hàng</p>
      <Radio.Group aria-label="Loại khách hàng" value={type} disabled={save.isPending} onChange={e => setType(e.target.value)} options={[
        { value: "retail", label: "Khách lẻ" }, { value: "wholesale", label: "Khách sỉ" },
      ]} />
      <p className="text-xs leading-5 text-slate-500">Khách lẻ dùng giá bán lẻ. Khách sỉ cần được xác minh, duyệt vùng HCM/tỉnh và đồng ý điều khoản để dùng giá sỉ.</p>
      {type === "wholesale" && account.roles.includes("si") && <Button size="small" onClick={onWholesale} disabled={save.isPending}>Xem và duyệt quyền mua sỉ</Button>}
      {type === "wholesale" && !account.roles.includes("si") && <Alert type="info" showIcon title="Tài khoản được gán loại khách sỉ; giá sỉ chỉ có hiệu lực sau khi duyệt." description="Nếu chưa có điều khoản hợp lệ, hồ sơ ở trạng thái Cần bổ sung để khách hoàn tất đăng ký mua sỉ. Sau đó bạn xác minh vùng và duyệt hồ sơ." />}
    </div>
    <div className="space-y-2 border-t border-green-100 pt-3">
      <Checkbox checked={ctv} disabled={save.isPending} onChange={e => { setCtv(e.target.checked); setActivateCtv(e.target.checked); }}>Cộng tác viên (CTV)</Checkbox>
      <p className="text-xs text-slate-500">CTV có thể đồng thời là khách lẻ hoặc khách sỉ. Tắt quyền vẫn giữ mã và lịch sử hoa hồng.</p>
      {ctv && <>
        <label className="block text-xs text-slate-600">Mã CTV<Input aria-label="Mã CTV" className="mt-1" value={code} disabled={Boolean(account.ctvCode) || save.isPending} maxLength={20} placeholder="Để trống để tự cấp mã" onChange={e => setCode(e.target.value.toUpperCase())} /></label>
        {!validCode && <p role="alert" className="text-xs text-red-600">Mã gồm 3–20 ký tự chữ, số, gạch dưới hoặc gạch ngang.</p>}
        {account.roles.includes("ctv") && account.ctvStatus !== "active" && <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-slate-500">{activateCtv ? "Sẽ kích hoạt CTV khi lưu." : "Quyền CTV chưa hoạt động; trạng thái hiện tại được giữ nguyên."}</span>
          {!activateCtv && <Button size="small" disabled={save.isPending} onClick={() => setActivateCtv(true)}>Kích hoạt quyền CTV</Button>}
        </div>}
      </>}
    </div>
    {account.active === false && <Alert type="warning" showIcon title="Tài khoản đang bị khóa. Lưu quyền không tự mở khóa tài khoản." />}
    <label className="block text-sm">Lý do thay đổi<Input.TextArea aria-label="Lý do thay đổi quyền" className="mt-1" rows={2} maxLength={1000} value={reason} disabled={save.isPending} onChange={e => setReason(e.target.value)} placeholder="Ví dụ: đã xác nhận khách đăng ký làm CTV…" /></label>
    {save.error && <Alert type="error" showIcon title={save.error.message} action={<Button size="small" onClick={onChanged}>Tải lại hồ sơ</Button>} />}
    <Button type="primary" loading={save.isPending} disabled={!changed || reason.trim().length < 3 || !validCode} onClick={() => save.mutate()}>Lưu phân quyền</Button>
  </section>;
}
