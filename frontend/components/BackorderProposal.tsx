"use client";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { siRequest } from "@/lib/siQueries";
import { formatVnd } from "@/lib/api";
export function BackorderProposal({ order, onAccepted }: { order: any; onAccepted: () => void }) {
  const [agree,setAgree]=useState(false);
  const accept=useMutation({mutationFn:()=>siRequest(`/api/shop/orders/me/${encodeURIComponent(order.code)}/accept-proposal`,{version:order.proposal.version}),onSuccess:onAccepted});
  if(!order.backorderStatus)return null;
  if(order.backorderStatus === "cancelled") return <p className="my-5 rounded-2xl bg-slate-50 p-5 text-sm">Yêu cầu đã hủy. {order.cancelReason}</p>;
  const proposal=order.proposal;
  return <section className="my-5 space-y-3 rounded-2xl border border-green-200 bg-[var(--aloha-green-light)] p-5 text-sm">
    <h2 className="text-lg font-bold">{proposal?"Thông tin Aloha xác nhận":order.hasPreOrder?"Yêu cầu đặt trước của bạn":"Yêu cầu đặt hàng đang chờ xác nhận"}</h2>
    {!proposal?<p>Aloha sẽ kiểm tra tình trạng hàng và liên hệ xác nhận với bạn. Bạn chưa cần thanh toán lúc này.</p>:<>
      <p className="whitespace-pre-wrap">{proposal.deliveryNote}</p>
      <dl className="grid grid-cols-2 gap-2"><dt>Tiền hàng</dt><dd className="text-right">{formatVnd(proposal.subtotal)}</dd><dt>Phí giao hàng</dt><dd className="text-right">{formatVnd(proposal.shippingFee)}</dd><dt className="font-bold">Tổng đơn</dt><dd className="text-right font-bold">{formatVnd(proposal.total)}</dd><dt>Khoản thanh toán / cọc đầu tiên</dt><dd className="text-right">{formatVnd(proposal.depositDue)}</dd><dt>Đã thu và đối soát</dt><dd className="text-right">{formatVnd(order.paidAmount||0)}</dd><dt>Còn lại</dt><dd className="text-right">{formatVnd(Math.max(0,proposal.total-(order.paidAmount||0)))}</dd></dl>
      {order.backorderStatus==="awaiting_customer"?<><label className="flex items-start gap-2"><input type="checkbox" checked={agree} onChange={e=>setAgree(e.target.checked)} className="mt-1"/>Tôi đồng ý số lượng, giá, phí giao và thời gian chuẩn bị Aloha đã xác nhận.</label><button disabled={!agree||accept.isPending} onClick={()=>accept.mutate()} className="min-h-11 rounded-xl bg-[var(--aloha-green)] px-5 font-semibold text-white disabled:opacity-40">{accept.isPending?"Đang xác nhận…":"Xác nhận thông tin đặt hàng"}</button></>:<p>Aloha sẽ liên hệ hướng dẫn thanh toán hoặc đặt cọc theo thông tin đã xác nhận.</p>}
      {accept.error&&<p role="alert" className="text-red-700">{accept.error.message}</p>}
    </>}
  </section>;
}
