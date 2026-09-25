"use client";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, Button, Input, InputNumber, Table, Tag } from "antd";
import { siRequest } from "@/lib/siQueries";
import { formatVnd } from "@/lib/api";

type Row = { accountRevision: number; accountName?: string; accountPhone?: string; customerId?: number; customerCode?: string; code: string; kvOrderCode?: string; kvPushStatus: string; kvSyncReason?: string; total: number; revision?: number; shopAccountId: string };
const labels: Record<string, string> = {
  queued: "Chờ gửi", preparing: "Đang kiểm tra", sending: "Đang gửi", synced: "Đã đồng bộ",
  unknown: "Cần đối soát kết quả", awaiting_customer_link: "Chờ liên kết khách", customer_review: "Kiểm tra khách / nhóm sỉ",
  account_review: "Kiểm tra quyền tài khoản", needs_review: "Cần kiểm tra đơn", retry_wait: "Chờ thử tra cứu lại", cancelled: "Đã hủy",
};
export function SiOrderSyncPanel() {
  const qc = useQueryClient();
  const [selected, setSelected] = useState<Row | null>(null);
  const [kvId, setKvId] = useState<number | null>(null);
  const [customerId, setCustomerId] = useState<number | null>(null);
  const [reason, setReason] = useState("");
  const query = useQuery({ queryKey: ["admin", "si-sync"], queryFn: () => siRequest<{ items: Row[]; enabled: boolean }>("/api/shop/admin/si-sync"), refetchOnWindowFocus: false });
  const action = useMutation({ mutationFn: ({ url, body }: { url: string; body: Record<string, unknown> }) => siRequest(url, body),
    onSuccess: () => { setSelected(null); void qc.invalidateQueries({ queryKey: ["admin", "si-sync"] }); } });
  return <section className="space-y-4 rounded-xl bg-white p-4">
    <div className="flex items-center justify-between gap-3"><h2 className="text-lg font-bold">Đồng bộ đơn sỉ KiotViet</h2><Button onClick={() => void query.refetch()}>Làm mới</Button></div>
    <Alert type="info" showIcon title="Đơn chưa rõ kết quả chỉ được đối soát, không gửi lại." description="Tổng tiền dùng giá khách đã xác nhận. Đơn cũ hoặc giá thay đổi cần xử lý qua báo giá; việc liên kết khách không thay đổi nhóm KiotViet." />
    {query.data && !query.data.enabled && <Alert type="warning" title="Chế độ kiểm tra: chưa bật gửi đơn tự động." />}
    {(query.error || action.error) && <Alert type="error" title={(query.error || action.error)?.message} />}
    <Table<Row> rowKey="code" size="small" loading={query.isLoading} dataSource={query.data?.items || []} pagination={{ pageSize: 10 }} scroll={{ x: 700 }} columns={[
      { title: "Mã web", dataIndex: "code" }, { title: "Mã KiotViet", dataIndex: "kvOrderCode" },
      { title: "Tổng đơn", render: (_, r) => formatVnd(r.total) },
      { title: "Trạng thái", render: (_, r) => <Tag>{labels[r.kvPushStatus] || r.kvPushStatus}</Tag> },
      { title: "Xử lý", render: (_, r) => <Button disabled={r.kvPushStatus === "synced" || r.kvPushStatus === "sending"} onClick={() => { setSelected(r); setKvId(null); setReason(""); setCustomerId(r.customerId || null); action.reset(); }}>Kiểm tra</Button> },
    ]} />
    {selected && <div className="space-y-3 rounded-lg border p-4">
      <strong>{selected.code}</strong><p>{selected.accountName} · {selected.accountPhone} · {selected.customerCode || ""}</p><p className="text-sm">Lý do: {selected.kvSyncReason || labels[selected.kvPushStatus]}</p>
      {selected.kvPushStatus === "unknown" ? <>
        <p className="text-sm">Tìm đơn trong KiotViet theo ghi chú ALOHA. Nhập ID đơn tìm được; hệ thống kiểm tra dấu tham chiếu, khách hàng và gian hàng trước khi nhận mã.</p>
        <InputNumber aria-label="ID đơn KiotViet" min={1} precision={0} value={kvId} onChange={setKvId} />
        <Button loading={action.isPending} disabled={!kvId} onClick={() => action.mutate({ url: `/api/shop/admin/si-sync/${selected.code}/reconcile`, body: { kvOrderId: kvId } })}>Đối soát, không tạo đơn mới</Button>
      </> : <>
        <p className="text-sm">Liên kết khách: đối chiếu hồ sơ và nhóm sỉ trước.</p>
        <div className="flex flex-wrap gap-2"><InputNumber placeholder="ID khách KiotViet" min={1} precision={0} value={customerId} onChange={setCustomerId} /></div>
        <Input placeholder="Căn cứ xác minh đúng khách (tối thiểu 10 ký tự)" value={reason} onChange={e => setReason(e.target.value)} />
        <Button loading={action.isPending} disabled={!customerId || reason.trim().length < 10} onClick={() => action.mutate({ url: `/api/shop/admin/si-sync/link/${selected.shopAccountId}`, body: { customerId, revision: selected.accountRevision, reason, verified: true } })}>Xác nhận đã đối chiếu và liên kết</Button>
        <Button loading={action.isPending} disabled={selected.revision === undefined || reason.trim().length < 10} onClick={() => action.mutate({ url: `/api/shop/admin/si-sync/${selected.code}/queue`, body: { revision: selected.revision, confirmedConsent: true, reason } })}>Xác nhận khách đã đồng ý chính sách và đưa vào hàng chờ</Button>
      </>}
      <Button onClick={() => setSelected(null)}>Đóng</Button>
    </div>}
  </section>;
}
