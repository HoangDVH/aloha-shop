"use client";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, Button, Drawer, Empty, Input, Select, Table, Tag, Checkbox, message } from "antd";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { siRequest } from "@/lib/siQueries";
import { InviteWholesale } from "./InviteWholesale";
import { PurchasePolicyPanel } from "./PurchasePolicyPanel";

const schema = z.object({ region: z.string(), verified: z.boolean(), reason: z.string().trim().min(3, "Nhập lý do / phương thức xác minh").max(1000) });
export type SiAccountRow = { id: string; fullName: string; phone: string; email: string; siStatus: string; siRegion?: string; siVerificationStatus?: "pending" | "verified" | null; revision: number; siProfile: Record<string, unknown>; candidate?: { code?: string; name?: string; address?: string }; syncStatus?: string; siLookupResult?: string; audit?: Array<{ id: string; action: string; reason: string; at: string }> };
type Row = SiAccountRow;
const labels: Record<string,string> = { cho_duyet: "Chờ xác minh", active: "Đã xác minh", tu_choi: "Cần bổ sung", khoa: "Tạm khóa" };
export function SiAccountsPanel({ initialAccount, onClose }: { initialAccount?: Row; onClose?: () => void } = {}) {
  const [status,setStatus] = useState("cho_duyet");
  const [selected,setSelected] = useState<Row|null>(initialAccount || null);
  const [search,setSearch] = useState("");
  const qc=useQueryClient();
  const close = () => { setSelected(null); onClose?.(); };
  const retryKv = useMutation({ mutationFn: () => siRequest<{status:string;reason?:string}>(`/api/shop/admin/si/${selected!.id}/retry-kv`, {}),
    onSuccess: data => { void qc.invalidateQueries({queryKey:["admin","si"]}); if (data.status === "synced") { close(); void message.success("Đã liên kết khách hàng KiotViet"); } else void message.info(data.status === "disabled" ? "Đồng bộ KV chưa được bật trong cấu hình" : "Đã đối soát. Hồ sơ đang chờ xử lý đồng bộ; kiểm tra lại trước khi thử tiếp."); } });
  const form=useForm<z.infer<typeof schema>>({ resolver:zodResolver(schema),defaultValues:{region:initialAccount?.siRegion || "",verified:false,reason:""} });
  const query=useQuery({queryKey:["admin","si",status],queryFn:()=>siRequest<{items:Row[]}>(`/api/shop/admin/si?status=${status}`),refetchInterval:15000,enabled:!initialAccount});
  const patch=useMutation({mutationFn:({status:next,values}:{status:string;values:z.infer<typeof schema>})=>siRequest(`/api/shop/admin/si/${selected!.id}`,{...values,status:next,revision:selected!.revision},"PATCH"),onSuccess:()=>{void qc.invalidateQueries({queryKey:["admin","si"]});void qc.invalidateQueries({queryKey:["admin","directory"]});close();void message.success("Đã cập nhật hồ sơ");}});
  const resendZalo = useMutation({
    mutationFn: (accountId: string) =>
      siRequest<{ success: boolean; customer?: string }>("/api/shop/zalo-notify/resend-registration", { accountId }, "POST"),
    onSuccess: (data) => {
      if (data?.success) {
        void message.success(`Đã bắn thông báo Zalo cho khách ${data.customer || "sỉ"} thành công!`);
      } else {
        void message.warning("Không thể gửi thông báo Zalo. Vui lòng kiểm tra kết nối bot Zalo.");
      }
    },
    onError: (err: any) => {
      void message.error(err?.message || "Lỗi khi gửi thông báo Zalo");
    },
  });
  const act=(next:string)=>form.handleSubmit(values=>patch.mutate({status:next,values}))();
  return <div className="space-y-5">
    {!initialAccount && <PurchasePolicyPanel />}
    {!initialAccount && <>
    <div className="flex flex-wrap items-center justify-between gap-4"><div><h1 className="text-2xl font-bold">Khách sỉ</h1><p className="mt-1 text-slate-500">Khách đăng ký được xem giá sỉ ngay. Xác minh thông tin và phân nhóm HCM hoặc tỉnh.</p></div><InviteWholesale /></div>
    <div className="flex flex-wrap gap-3"><Select value={status} onChange={setStatus} className="min-w-44" options={[{value:"",label:"Tất cả"},...Object.entries(labels).map(([value,label])=>({value,label}))]}/><Input.Search value={search} onChange={e=>setSearch(e.target.value)} placeholder="Tìm tên hoặc SĐT trong danh sách" className="max-w-sm"/></div>
    {query.error&&<Alert type="error" title={query.error.message}/>}
    <Table rowKey="id" loading={query.isPending} scroll={{x:700}} locale={{emptyText:<Empty description="Chưa có hồ sơ"/>}} dataSource={(query.data?.items||[]).filter(r=>`${r.fullName} ${r.phone}`.toLowerCase().includes(search.toLowerCase()))} columns={[
      {title:"Khách hàng",dataIndex:"fullName",render:(_,r)=><div><strong>{r.fullName}</strong>{r.siLookupResult==="existing_si_candidate"&&<Tag color="cyan" className="ml-2">Khách sỉ cũ KV</Tag>}<div className="text-xs text-slate-500">{r.email}</div></div>},
      {title:"SĐT",dataIndex:"phone"},{title:"Vùng",dataIndex:"siRegion",render:v=>v||"Chờ xác nhận"},
      {title:"Trạng thái",dataIndex:"siStatus",render:(v,r)=><Tag color={r.siVerificationStatus==="pending"?"gold":v==="active"?"green":v==="cho_duyet"?"gold":"default"}>{r.siVerificationStatus==="pending"&&v==="active"?"Đã mở giá sỉ · Chờ xác minh":labels[v]||v}</Tag>},
      {title:"",render:(_,r)=><Button onClick={()=>{setSelected(r);form.reset({region:r.siRegion||"",verified:false,reason:""});patch.reset();}}>Xem hồ sơ</Button>},
    ]}/>
    </>}
    <Drawer open={Boolean(selected)} onClose={close} title={selected?.fullName} size="large">
      {selected && (
        <div className="space-y-5">
          <section className="space-y-3 rounded-xl border border-slate-200/80 bg-slate-50/40 p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-slate-800">Thông tin đã khai</h2>
              <div className="flex items-center gap-2">
                <Button
                  size="small"
                  loading={resendZalo.isPending}
                  onClick={() => resendZalo.mutate(selected.id)}
                  title="Gửi lại thông báo đăng ký sỉ của khách này vào nhóm Zalo"
                  className="!border-emerald-600 !text-emerald-700 hover:!bg-emerald-50"
                >
                  Bắn lại Zalo
                </Button>
                <Button size="small" onClick={() => void navigator.clipboard.writeText(selected.phone)}>
                  Copy SĐT
                </Button>
              </div>
            </div>
            <dl className="grid grid-cols-[minmax(110px,.4fr)_1fr] gap-x-4 gap-y-2 text-sm">
              {Object.entries(selected.siProfile || {}).map(([key, value]) => (
                <div key={key} className="contents">
                  <dt className="text-slate-500">
                    {({
                      fullName: "Họ tên",
                      phone: "SĐT",
                      province: "Tỉnh/TP",
                      ward: "Phường/xã",
                      detail: "Địa chỉ",
                      shopName: "Cửa hàng",
                      businessType: "Loại hình",
                      taxCode: "MST",
                      note: "Ghi chú",
                      acceptedTermsAt: "Đồng ý điều khoản",
                      termsVersion: "Phiên bản",
                    } as Record<string, string>)[key] || key}
                  </dt>
                  <dd className="break-words font-medium text-slate-800">{String(value)}</dd>
                </div>
              ))}
            </dl>
          </section>

          {selected.candidate && (
            <Alert
              type="info"
              title={
                selected.siLookupResult === "existing_si_candidate"
                  ? "Khách sỉ cũ KiotViet — Đã nhận diện qua SĐT"
                  : "Hồ sơ KV đề xuất — chưa phải bằng chứng sở hữu"
              }
              description={`${selected.candidate.code || ""} · ${selected.candidate.name || ""} · ${selected.candidate.address || ""}`}
            />
          )}

          <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 sm:p-5 shadow-xs">
            <div className="border-b border-slate-100 pb-3">
              <h2 className="text-base font-bold text-slate-800">Xác minh và phân nhóm khách sỉ</h2>
              <p className="mt-0.5 text-xs text-slate-500">
                Phân vùng kinh doanh (HCM/Tỉnh) và xác minh tư cách người đại diện.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-600">
                Phân vùng kinh doanh
              </label>
              <Select
                size="large"
                className="w-full"
                placeholder="Chọn vùng kinh doanh đã xác minh"
                value={form.watch("region") || undefined}
                onChange={v => form.setValue("region", v)}
                options={[
                  { value: "HCM", label: "Khách sỉ HCM" },
                  { value: "TINH", label: "Khách sỉ tỉnh — từ 2 triệu" },
                ]}
              />
            </div>

            <div className="rounded-lg border border-slate-200/80 bg-slate-50/60 p-3">
              <Checkbox
                checked={form.watch("verified")}
                onChange={e => form.setValue("verified", e.target.checked)}
                className="text-sm font-medium text-slate-700"
              >
                Đã xác minh người đại diện qua kênh liên hệ đáng tin cậy
              </Checkbox>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-600">
                Phương thức xác minh / lý do
              </label>
              <Input.TextArea
                rows={4}
                value={form.watch("reason")}
                onChange={e => form.setValue("reason", e.target.value)}
                placeholder="Ghi rõ đã đối chiếu với ai, qua kênh nào"
                className="rounded-lg"
              />
              {form.formState.errors.reason && (
                <p className="mt-1 text-xs font-medium text-red-600">
                  {form.formState.errors.reason.message}
                </p>
              )}
            </div>

            {patch.error && <Alert type="error" showIcon title={patch.error.message} />}

            <div className="flex flex-wrap gap-2.5 border-t border-slate-100 pt-3">
              <Button
                type="primary"
                size="middle"
                loading={patch.isPending}
                onClick={() => void act("active")}
                className="!bg-[#456b3c] hover:!bg-[#36552f] font-medium"
              >
                Xác nhận thông tin và khu vực
              </Button>
              <Button
                size="middle"
                disabled={patch.isPending}
                onClick={() => void act("tu_choi")}
              >
                Yêu cầu bổ sung
              </Button>
              <Button
                danger
                size="middle"
                disabled={patch.isPending}
                onClick={() => void act("khoa")}
              >
                Khóa quyền sỉ
              </Button>
            </div>
          </section>

          {selected.siStatus === "active" && selected.siRegion && (
            <section className="space-y-3 rounded-xl border border-slate-200/80 bg-slate-50/40 p-4 sm:p-5">
              <h2 className="font-bold text-slate-800">Liên kết KiotViet</h2>
              <p className="text-sm text-slate-600">
                {selected.syncStatus === "synced"
                  ? "Đã đồng bộ với KiotViet"
                  : "Đang chờ đối soát / đồng bộ"}
              </p>
              {selected.syncStatus !== "synced" && (
                <Button loading={retryKv.isPending} onClick={() => retryKv.mutate()}>
                  Đối soát và thử lại
                </Button>
              )}
              {retryKv.error && <Alert type="error" title={retryKv.error.message} />}
            </section>
          )}

          <section className="space-y-3 rounded-xl border border-slate-200/80 bg-slate-50/40 p-4 sm:p-5">
            <h2 className="font-bold text-slate-800">Lịch sử</h2>
            <div className="space-y-3">
              {(selected.audit || []).slice(-5).reverse().map(a => (
                <div key={a.id} className="border-l-2 border-green-500 pl-3 text-sm">
                  <strong className="text-slate-800">{labels[a.action] || a.action}</strong>
                  <p className="mt-0.5 text-slate-600">{a.reason}</p>
                  <small className="text-slate-400">
                    {new Date(a.at).toLocaleString("vi-VN")}
                  </small>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}
    </Drawer>
  </div>;
}
