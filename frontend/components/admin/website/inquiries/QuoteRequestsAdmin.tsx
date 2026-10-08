"use client";

import { useEffect, useState } from 'react';
import { Alert, Button, Descriptions, Input, Modal, Select, Table, Tag, message } from 'antd';
import { adminFetch } from '@/components/admin/api/adminFetch';

export const QUOTE_COUNT_EVENT = 'aloha:quote-requests-updated';
const STATUS = [
  { value: 'new', label: 'Mới' }, { value: 'contacted', label: 'Đã liên hệ' },
  { value: 'quoted', label: 'Đã báo giá' }, { value: 'won', label: 'Chốt đơn' },
  { value: 'closed', label: 'Không tiếp tục' },
];
type Inquiry = {
  _id: string; source: string; companyName: string; contactName: string; phone: string; email: string;
  quantity: string; budgetPerSet: string; eventDate: string; occasion: string; notes: string;
  status: string; adminNotes: string; version: number; createdAt: string;
};
type List = { items: Inquiry[]; total: number; newCount: number; limit: number };
const sourceLabel = (s: string) => s === 'b2b' ? 'Báo giá B2B' : 'Tư vấn quà tặng';

export function QuoteRequestsAdmin() {
  const [list, setList] = useState<List>({ items: [], total: 0, newCount: 0, limit: 20 });
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('all');
  const [source, setSource] = useState('all');
  const [page, setPage] = useState(1);
  const [reload, setReload] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<Inquiry | null>(null);
  const [draftStatus, setDraftStatus] = useState('new');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ q, status, source, page: String(page) });
        const data = await adminFetch<List>(`/api/shop/admin/quote-requests?${params}`);
        if (!cancelled) { setList(data); setError(''); window.dispatchEvent(new Event(QUOTE_COUNT_EVENT)); }
      } catch (e) { if (!cancelled) setError(e instanceof Error ? e.message : 'Không thể tải yêu cầu'); }
      finally { if (!cancelled) setLoading(false); }
    }, 250);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [q, status, source, page, reload]);

  const open = (item: Inquiry) => { setSelected(item); setDraftStatus(item.status); setNotes(item.adminNotes); };
  const save = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      await adminFetch(`/api/shop/admin/quote-requests/${selected._id}`, {
        method: 'PATCH', body: JSON.stringify({ version: selected.version, status: draftStatus, adminNotes: notes }),
      });
      message.success('Đã lưu trạng thái và ghi chú');
      setSelected(null); setReload((n) => n + 1); window.dispatchEvent(new Event(QUOTE_COUNT_EVENT));
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Không thể lưu');
      setReload((n) => n + 1);
    } finally { setSaving(false); }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-white p-4">
        <div><h2 className="text-lg font-bold">Yêu cầu báo giá & tư vấn quà tặng</h2><p className="text-sm text-stone-500">{list.newCount} yêu cầu mới cần liên hệ</p></div>
        <Button onClick={() => setReload((n) => n + 1)} loading={loading}>Làm mới</Button>
      </div>
      <div className="flex flex-wrap gap-3">
        <Input.Search allowClear placeholder="Tên, doanh nghiệp, điện thoại hoặc email" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} className="!w-80" />
        <Select value={status} className="w-44" options={[{ value: 'all', label: 'Tất cả trạng thái' }, ...STATUS]} onChange={(s) => { setStatus(s); setPage(1); }} />
        <Select value={source} className="w-44" options={[{ value: 'all', label: 'Tất cả nguồn' }, { value: 'b2b', label: 'Báo giá B2B' }, { value: 'gift_consultation', label: 'Tư vấn quà tặng' }]} onChange={(s) => { setSource(s); setPage(1); }} />
      </div>
      {error ? <Alert type="error" title={error} /> : null}
      <Table<Inquiry> rowKey="_id" dataSource={list.items} loading={loading} scroll={{ x: 950 }}
        locale={{ emptyText: 'Chưa có yêu cầu phù hợp' }}
        pagination={{ current: page, total: list.total, pageSize: list.limit, showSizeChanger: false, onChange: setPage }}
        columns={[
          { title: 'Thời gian gửi', dataIndex: 'createdAt', render: (v: string) => new Date(v).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }) },
          { title: 'Khách hàng', render: (_, r) => <div><strong>{r.companyName || r.contactName}</strong>{r.companyName ? <div>{r.contactName}</div> : null}</div> },
          { title: 'Điện thoại/Zalo', dataIndex: 'phone', render: (v: string) => <a href={`tel:${v}`}>{v}</a> },
          { title: 'Nguồn', dataIndex: 'source', render: sourceLabel },
          { title: 'Nhu cầu', render: (_, r) => <div>{r.quantity || r.occasion || '—'}<div className="text-xs text-stone-500">{r.budgetPerSet}</div></div> },
          { title: 'Trạng thái', dataIndex: 'status', render: (v: string) => <Tag color={v === 'new' ? 'orange' : v === 'won' ? 'green' : 'blue'}>{STATUS.find((s) => s.value === v)?.label}</Tag> },
          { title: 'Chi tiết', render: (_, r) => <Button onClick={() => open(r)}>Xem & xử lý</Button> },
        ]} />
      <Modal title="Chi tiết yêu cầu" open={!!selected} onCancel={() => setSelected(null)} onOk={save} confirmLoading={saving} okText="Lưu cập nhật" cancelText="Đóng" width={720}>
        {selected ? <div className="space-y-4">
          <Descriptions column={1} bordered size="small" items={[
            { key: 'source', label: 'Nguồn', children: sourceLabel(selected.source) },
            { key: 'company', label: 'Doanh nghiệp', children: selected.companyName || '—' },
            { key: 'contact', label: 'Người liên hệ', children: selected.contactName },
            { key: 'phone', label: 'Điện thoại/Zalo', children: <a href={`tel:${selected.phone}`}>{selected.phone}</a> },
            { key: 'email', label: 'Email', children: selected.email || '—' },
            { key: 'qty', label: 'Số lượng', children: selected.quantity || '—' },
            { key: 'budget', label: 'Ngân sách/set', children: selected.budgetPerSet || '—' },
            { key: 'date', label: 'Ngày cần nhận', children: selected.eventDate || '—' },
            { key: 'occasion', label: 'Dịp tặng', children: selected.occasion || '—' },
            { key: 'notes', label: 'Yêu cầu của khách', children: <span className="whitespace-pre-wrap">{selected.notes || '—'}</span> },
          ]} />
          <label className="block">Trạng thái<Select className="mt-1 w-full" options={STATUS} value={draftStatus} onChange={setDraftStatus} /></label>
          <label className="block">Ghi chú chăm sóc khách<Input.TextArea rows={4} maxLength={4000} value={notes} onChange={(e) => setNotes(e.target.value)} className="mt-1" /></label>
        </div> : null}
      </Modal>
    </div>
  );
}
