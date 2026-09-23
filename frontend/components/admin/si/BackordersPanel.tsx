"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Alert, Button, Checkbox, Drawer, Input, Table, Tag } from "antd";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { siRequest } from "@/lib/siQueries";
import { formatVnd } from "@/lib/api";
const schema=z.object({shippingFee:z.number().int().min(0),depositDue:z.number().int().positive(),deliveryNote:z.string().min(10)});
const statusLabels:Record<string,string>={pending_confirmation:"Chờ shop xác nhận",awaiting_customer:"Chờ khách đồng ý",awaiting_payment:"Chờ thu tiền",deposit_received:"Đã ghi nhận thu",confirmed_paid:"Đang hoàn tất thanh toán",ready:"Sẵn sàng giao"};
export function BackordersPanel(){
  const [cancelReason, setCancelReason] = useState("");
  const [refundReference, setRefundReference] = useState("");
  const [refundConfirmed, setRefundConfirmed] = useState(false);
  const [selected,setSelected]=useState<any>(null);const [reference,setReference]=useState("");const [amount,setAmount]=useState(0);
  const qc=useQueryClient();const form=useForm<z.infer<typeof schema>>({resolver:zodResolver(schema),defaultValues:{shippingFee:0,depositDue:0,deliveryNote:""}});
  const query=useQuery({queryKey:["admin","backorders"],queryFn:()=>siRequest<{items:any[]}>("/api/shop/admin/backorders"),refetchInterval:15000});
  const mutation=useMutation({mutationFn:({action,body}:{action:string;body:object})=>siRequest(`/api/shop/admin/backorders/${encodeURIComponent(selected.code)}/${action}`,{...body,revision:selected.revision||0}),onSuccess:()=>{setSelected(null);void qc.invalidateQueries({queryKey:["admin","backorders"]});}});
  return <div className="space-y-5"><h1 className="text-2xl font-bold">Đơn đặt trước</h1><p className="text-slate-500">Kiểm tra hàng, xác nhận với khách và đối soát khoản thanh toán / cọc.</p>
    {query.error&&<Alert type="error" title={query.error.message}/>}
    <Table rowKey="code" loading={query.isPending} scroll={{x:750}} dataSource={query.data?.items||[]} columns={[{title:"Mã đơn",dataIndex:"code"},{title:"Khách",dataIndex:"customerName"},{title:"SĐT",dataIndex:"customerPhone"},{title:"Tiền hàng",dataIndex:"subtotal",render:v=>formatVnd(v)},{title:"Trạng thái",dataIndex:"backorderStatus",render:v=><Tag>{statusLabels[v]||v}</Tag>},{title:"",render:(_,r)=><Button onClick={()=>{setSelected(r);mutation.reset();setReference("");setAmount(0);form.reset({shippingFee:r.proposal?.shippingFee||0,depositDue:r.proposal?.depositDue||r.total,deliveryNote:r.proposal?.deliveryNote||""});}}>Xử lý</Button>}]}/>
    <Drawer title={`Đơn ${selected?.code||""}`} size="large" open={Boolean(selected)} onClose={()=>setSelected(null)}>{selected&&<div className="space-y-6">
      <p><strong>{selected.customerName}</strong> · {selected.customerPhone}</p>
      <div className="space-y-3">{selected.orderDetails?.map((d:any)=><div key={d.productCode} className="rounded-xl bg-slate-50 p-3 text-sm"><strong>{d.productName}</strong><p>Đặt {d.quantity} · Sẵn tại lúc đặt {d.availableQty||0} · Cần bổ sung {d.pendingQty||0}</p></div>)}</div>
      {!selected.proposalAcceptedAt&&<form onSubmit={form.handleSubmit(v=>mutation.mutate({action:"proposal",body:v}))} className="space-y-4"><h2 className="font-bold">Gửi thông tin để khách xác nhận</h2>
        <label className="block text-sm">Phí giao hàng (đ)<input type="number" {...form.register("shippingFee",{valueAsNumber:true})} className="mt-1 block min-h-11 w-full rounded-lg border px-3"/></label>
        <label className="block text-sm">Khoản yêu cầu thanh toán / cọc (đ)<input type="number" {...form.register("depositDue",{valueAsNumber:true})} className="mt-1 block min-h-11 w-full rounded-lg border px-3"/></label>
        <label className="block text-sm">Lịch chuẩn bị/giao hàng và điều kiện<textarea {...form.register("deliveryNote")} rows={4} className="mt-1 block w-full rounded-lg border p-3"/></label>
        {Object.values(form.formState.errors).map((e,i)=><p key={i} className="text-sm text-red-700">{e.message}</p>)}
        <Button htmlType="submit" type="primary" loading={mutation.isPending}>Gửi xác nhận cho khách</Button>
      </form>}
      {selected.proposalAcceptedAt&&<section className="space-y-3 border-t pt-4"><h2 className="font-bold">Đối soát khoản đã thu</h2><p>Tổng {formatVnd(selected.total)} · Đã thu {formatVnd(selected.paidAmount||0)}</p>
        <Input value={reference} onChange={e=>setReference(e.target.value)} placeholder="Mã giao dịch / chứng từ duy nhất"/>
        <Input type="number" value={amount} onChange={e=>setAmount(Number(e.target.value))} placeholder="Số tiền thực đã nhận"/>
        <Button loading={mutation.isPending} onClick={()=>mutation.mutate({action:"payment",body:{reference,amount}})}>Ghi nhận khoản thu đã kiểm tra</Button>
        <p className="text-xs text-slate-500">Chỉ ghi nhận sau khi kiểm tra ngân hàng/chứng từ. Thu cọc không đánh dấu đã thanh toán đủ.</p>
        <Button type="primary" loading={mutation.isPending} onClick={()=>mutation.mutate({action:"ready",body:{}})}>Hàng đã đủ + thu đủ tiền → chuẩn bị giao</Button>
      </section>}
      {!["ready","confirmed_paid","cancelled"].includes(selected.backorderStatus) && <section className="space-y-3 border-t pt-4"><h2 className="font-bold">Hủy yêu cầu</h2>
        <Input.TextArea value={cancelReason} onChange={e => setCancelReason(e.target.value)} placeholder="Lý do hủy đã trao đổi với khách" />
        {Number(selected.paidAmount) > 0 && <><Input value={refundReference} onChange={e => setRefundReference(e.target.value)} placeholder="Mã chứng từ hoàn tiền" />
          <Checkbox checked={refundConfirmed} onChange={e => setRefundConfirmed(e.target.checked)}>Đã thực hiện và đối soát hoàn đủ {formatVnd(selected.paidAmount)} cho khách</Checkbox>
          <p className="text-xs text-slate-500">Thao tác này lưu kết quả đối soát. Tiền phải được hoàn qua ngân hàng trước.</p></>}
        <Button danger loading={mutation.isPending} disabled={!cancelReason.trim() || (Number(selected.paidAmount) > 0 && (!refundConfirmed || refundReference.trim().length < 6))} onClick={() => mutation.mutate({ action: "cancel", body: { reason: cancelReason, refundReference, refundConfirmed } })}>Xác nhận hủy yêu cầu</Button>
      </section>}
      {mutation.error&&<Alert type="error" title={mutation.error.message}/>}
    </div>}</Drawer>
  </div>;
}
