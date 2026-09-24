"use client";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, Button, Drawer, Empty, Input, Select, Table, Tag, Checkbox, message } from "antd";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { siRequest } from "@/lib/siQueries";
import { InviteWholesale } from "./InviteWholesale";

const schema = z.object({ region: z.string(), verified: z.boolean(), reason: z.string().trim().min(3, "Nhập lý do / phương thức xác minh").max(1000) });
type Row = { id: string; fullName: string; phone: string; email: string; siStatus: string; siRegion?: string; revision: number; siProfile: Record<string, unknown>; candidate?: { code?: string; name?: string; address?: string }; syncStatus?: string; siLookupResult?: string; audit?: Array<{ id: string; action: string; reason: string; at: string }> };
const labels: Record<string,string> = { cho_duyet: "Chờ duyệt", active: "Đã duyệt", tu_choi: "Cần bổ sung", khoa: "Tạm khóa" };
export function SiAccountsPanel() {
  const [status,setStatus] = useState("cho_duyet");
  const [selected,setSelected] = useState<Row|null>(null);
  const [search,setSearch] = useState("");
  const qc=useQueryClient();
  const retryKv = useMutation({ mutationFn: () => siRequest<{status:string;reason?:string}>(`/api/shop/admin/si/${selected!.id}/retry-kv`, {}),
    onSuccess: data => { void qc.invalidateQueries({queryKey:["admin","si"]}); if (data.status === "synced") { setSelected(null); void message.success("Đã liên kết khách hàng KiotViet"); } else void message.info(data.status === "disabled" ? "Đồng bộ KV chưa được bật trong cấu hình" : "Đã đối soát. Hồ sơ đang chờ xử lý đồng bộ; kiểm tra lại trước khi thử tiếp."); } });
  const form=useForm<z.infer<typeof schema>>({ resolver:zodResolver(schema),defaultValues:{region:"",verified:false,reason:""} });
  const query=useQuery({queryKey:["admin","si",status],queryFn:()=>siRequest<{items:Row[]}>(`/api/shop/admin/si?status=${status}`),refetchInterval:15000});
  const patch=useMutation({mutationFn:({status:next,values}:{status:string;values:z.infer<typeof schema>})=>siRequest(`/api/shop/admin/si/${selected!.id}`,{...values,status:next,revision:selected!.revision},"PATCH"),onSuccess:()=>{void qc.invalidateQueries({queryKey:["admin","si"]});setSelected(null);void message.success("Đã cập nhật hồ sơ");}});
  const act=(next:string)=>form.handleSubmit(values=>patch.mutate({status:next,values}))();
  return <div className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-4"><div><h1 className="text-2xl font-bold">Khách sỉ</h1><p className="mt-1 text-slate-500">Xét duyệt hồ sơ, xác minh thông tin và quản lý quyền mua sỉ.</p></div><InviteWholesale /></div>
    <div className="flex flex-wrap gap-3"><Select value={status} onChange={setStatus} className="min-w-44" options={[{value:"",label:"Tất cả"},...Object.entries(labels).map(([value,label])=>({value,label}))]}/><Input.Search value={search} onChange={e=>setSearch(e.target.value)} placeholder="Tìm tên hoặc SĐT trong danh sách" className="max-w-sm"/></div>
    {query.error&&<Alert type="error" title={query.error.message}/>}
    <Table rowKey="id" loading={query.isPending} scroll={{x:700}} locale={{emptyText:<Empty description="Chưa có hồ sơ"/>}} dataSource={(query.data?.items||[]).filter(r=>`${r.fullName} ${r.phone}`.toLowerCase().includes(search.toLowerCase()))} columns={[
      {title:"Khách hàng",dataIndex:"fullName",render:(_,r)=><div><strong>{r.fullName}</strong>{r.siLookupResult==="existing_si_candidate"&&<Tag color="cyan" className="ml-2">Khách sỉ cũ KV</Tag>}<div className="text-xs text-slate-500">{r.email}</div></div>},
      {title:"SĐT",dataIndex:"phone"},{title:"Vùng",dataIndex:"siRegion",render:v=>v||"Chờ xác nhận"},
      {title:"Trạng thái",dataIndex:"siStatus",render:v=><Tag color={v==="active"?"green":v==="cho_duyet"?"gold":"default"}>{labels[v]||v}</Tag>},
      {title:"",render:(_,r)=><Button onClick={()=>{setSelected(r);form.reset({region:r.siRegion||"",verified:false,reason:""});patch.reset();}}>Xem hồ sơ</Button>},
    ]}/>
    <Drawer open={Boolean(selected)} onClose={()=>setSelected(null)} title={selected?.fullName} size="large">
      {selected&&<div className="space-y-6"><section><h2 className="mb-3 font-bold">Thông tin đã khai</h2><dl className="grid grid-cols-[minmax(90px,.5fr)_1fr] gap-3 text-sm">{Object.entries(selected.siProfile||{}).map(([key,value])=><div key={key} className="contents"><dt className="text-slate-500">{({fullName:"Họ tên",phone:"SĐT",province:"Tỉnh/TP",ward:"Phường/xã",detail:"Địa chỉ",shopName:"Cửa hàng",businessType:"Loại hình",taxCode:"MST",note:"Ghi chú",acceptedTermsAt:"Đồng ý điều khoản",termsVersion:"Phiên bản"} as Record<string,string>)[key]||key}</dt><dd className="break-words">{String(value)}</dd></div>)}</dl><Button className="mt-3" onClick={()=>void navigator.clipboard.writeText(selected.phone)}>Copy SĐT</Button></section>
        {selected.candidate&&<Alert type="info" title={selected.siLookupResult==="existing_si_candidate"?"Khách sỉ cũ KiotViet — Đã nhận diện qua SĐT":"Hồ sơ KV đề xuất — chưa phải bằng chứng sở hữu"} description={`${selected.candidate.code||""} · ${selected.candidate.name||""} · ${selected.candidate.address||""}`}/>}
        <section className="space-y-4 border-t pt-5"><h2 className="font-bold">Xác minh và duyệt</h2><Select className="w-full" placeholder="Chọn vùng kinh doanh đã xác minh" value={form.watch("region")||undefined} onChange={v=>form.setValue("region",v)} options={[{value:"HCM",label:"Khách sỉ HCM"},{value:"TINH",label:"Khách sỉ tỉnh — từ 2 triệu"}]}/>
          <Checkbox checked={form.watch("verified")} onChange={e=>form.setValue("verified",e.target.checked)}>Đã xác minh người đại diện qua kênh liên hệ đáng tin cậy</Checkbox>
          <label className="block text-sm">Phương thức xác minh / lý do<Input.TextArea rows={4} value={form.watch("reason")} onChange={e=>form.setValue("reason",e.target.value)} placeholder="Ghi rõ đã đối chiếu với ai, qua kênh nào"/></label>
          {form.formState.errors.reason&&<p className="text-red-700">{form.formState.errors.reason.message}</p>}
          {patch.error&&<Alert type="error" title={patch.error.message}/>}
          <div className="flex flex-wrap gap-2"><Button type="primary" loading={patch.isPending} onClick={()=>void act("active")}>Duyệt hồ sơ</Button><Button disabled={patch.isPending} onClick={()=>void act("tu_choi")}>Yêu cầu bổ sung</Button><Button danger disabled={patch.isPending} onClick={()=>void act("khoa")}>Khóa quyền sỉ</Button></div>
        </section>
        {selected.siStatus === "active" && <section className="space-y-3"><h2 className="font-bold">Liên kết KiotViet</h2><p className="text-sm">{selected.syncStatus === "synced" ? "Đã đồng bộ" : "Đang chờ đối soát / đồng bộ"}</p>{selected.syncStatus !== "synced" && <Button loading={retryKv.isPending} onClick={() => retryKv.mutate()}>Đối soát và thử lại</Button>}{retryKv.error && <Alert type="error" title={retryKv.error.message} />}</section>}
        <section><h2 className="mb-3 font-bold">Lịch sử</h2>{(selected.audit||[]).slice(-5).reverse().map(a=><div key={a.id} className="mb-3 border-l-2 border-green-200 pl-3 text-sm"><strong>{labels[a.action]||a.action}</strong><p>{a.reason}</p><small className="text-slate-400">{new Date(a.at).toLocaleString("vi-VN")}</small></div>)}</section>
      </div>}
    </Drawer>
  </div>;
}
