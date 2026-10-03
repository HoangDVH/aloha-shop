"use client";

import { useCallback, useEffect, useState } from "react";
import { Button, Collapse, Input, Spin, App } from "antd";
import { ArrowLeft, FileDown, OctagonPause, Pencil, Play, RefreshCw } from "lucide-react";
import { campaignAdminApi, type CampaignSummary, type RunningData } from "@/lib/campaign/campaignAdminApi";
import { vnd } from "./wizardModel";

type Props = {
  summary: CampaignSummary;
  canManage: boolean;
  onBack: () => void;
  onEdit: () => void;
  onChanged: () => void;
};

const REFRESH_MS = 30_000;

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <div className="text-[11px] font-semibold uppercase text-slate-400">{label}</div>
      <div className="text-xl font-bold text-slate-900">{value}</div>
      {sub ? <div className="text-[11px] text-slate-500">{sub}</div> : null}
    </div>
  );
}

function NeedsAction({ data, canManage, reload }: { data: RunningData; canManage: boolean; reload: () => void }) {
  const { message, modal } = App.useApp();

  const resolvePrompt = (code: string) => {
    let note = "";
    modal.confirm({
      title: `Đã xử lý đơn ${code}?`,
      content: <Input.TextArea rows={2} placeholder="Ghi chú: đã gọi khách, hoàn tiền / đổi giá thường…" onChange={(e) => (note = e.target.value)} />,
      okText: "Đã xử lý",
      cancelText: "Huỷ",
      onOk: async () => {
        await campaignAdminApi.resolveReview(code, note);
        message.success("Đã đánh dấu xử lý");
        reload();
      },
    });
  };
  const diffs = data.reconcile?.diffs || [];
  const fix = async () => {
    const r = await campaignAdminApi.fixCounters();
    message.success(r.fixed ? `Đã sửa ${r.fixed} bộ đếm lệch` : "Không còn lệch");
    reload();
  };
  if (!data.needsReview.length && !diffs.length) {
    return <div className="rounded-xl bg-emerald-50 px-3 py-2 text-[13px] font-medium text-emerald-800 ring-1 ring-emerald-200">Không có việc cần xử lý.</div>;
  }
  return (
    <div className="space-y-2 rounded-xl border border-amber-200 bg-amber-50/60 p-3">
      <div className="text-[13px] font-bold text-amber-900">Cần xử lý</div>
      {data.needsReview.map((o) => (
        <div key={o.code} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white px-3 py-2 text-[13px]">
          <span>
            Đơn <b>{o.code}</b> ({o.buyer || "khách"}, {vnd(o.total)}) đã trả tiền khi suất giá sale đã hết — gọi khách chọn giá thường hoặc hoàn tiền.
          </span>
          {canManage ? <Button size="small" onClick={() => resolvePrompt(o.code)}>Đã xử lý</Button> : null}
        </div>
      ))}
      {diffs.length ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white px-3 py-2 text-[13px]">
          <span>
            Đối soát lúc {new Date(data.reconcile!.at).toLocaleString("vi-VN")}: {diffs.length} bộ đếm giữ suất lệch với đơn thật
            (tổng lệch {diffs.reduce((s, d) => s + d.held - d.expected, 0)} suất){data.reconcile!.fixed ? `, đã tự sửa ${data.reconcile!.fixed}` : ""}.
          </span>
          {canManage ? <Button size="small" onClick={() => void fix()}>Chạy sửa lệch</Button> : null}
        </div>
      ) : null}
    </div>
  );
}

function Details({ data }: { data: RunningData }) {
  const t = data.stats.totals || {};
  const reminds = Object.entries(data.stats.reminds || {}).sort((a, b) => b[1] - a[1]).slice(0, 10);
  return (
    <div className="grid gap-3 text-[13px] md:grid-cols-2">
      <div>
        <div>Lượt xem banner: <b>{t.bannerView || 0}</b></div>
        <div>Lượt bấm banner: <b>{t.bannerClick || 0}</b> {t.bannerView ? `(${Math.round(((t.bannerClick || 0) / t.bannerView) * 100)}%)` : ""}</div>
        <div>Lượt &quot;Nhắc tôi&quot;: <b>{t.remind || 0}</b></div>
        <div>Suất đang giữ chờ thanh toán: <b>{data.summary.flashHeld}</b></div>
      </div>
      <div>
        <div className="mb-1 font-semibold text-slate-700">Sản phẩm được nhắc nhiều</div>
        {reminds.length ? reminds.map(([ma, n]) => <div key={ma}>{ma}: {n}</div>) : <div className="text-slate-400">Chưa có</div>}
      </div>
    </div>
  );
}

export function RunningCampaign({ summary, canManage, onBack, onEdit, onChanged }: Props) {
  const { message, modal } = App.useApp();
  const [data, setData] = useState<RunningData | null>(null);
  const load = useCallback(() => {
    void campaignAdminApi.running(summary.id).then(setData).catch((e) => message.error(e?.message || "Không tải được số liệu"));
  }, [summary.id, message]);
  useEffect(() => {
    load();
    const t = setInterval(load, REFRESH_MS);
    return () => clearInterval(t);
  }, [load]);

  const [exporting, setExporting] = useState(false);
  const exportReport = async () => {
    setExporting(true);
    try {
      await campaignAdminApi.downloadReport(summary.id);
    } catch (e: any) {
      message.error(e?.message || "Không xuất được báo cáo");
    } finally {
      setExporting(false);
    }
  };

  const paused = summary.status === "paused";
  const togglePause = () =>
    modal.confirm({
      title: paused ? "Chạy tiếp chiến dịch?" : "Tạm dừng khẩn cấp?",
      content: paused
        ? "Giá sale, quà và banner chiến dịch hiện lại ngay cho khách."
        : "Giá sale, quà tặng và banner chiến dịch tắt ngay trên web. Đơn đã đặt vẫn giữ giá cũ; khách đang ở trang thanh toán sẽ được báo giá mới.",
      okText: paused ? "Chạy tiếp" : "Tạm dừng ngay",
      okButtonProps: { danger: !paused },
      cancelText: "Huỷ",
      onOk: async () => {
        await campaignAdminApi.pause(summary.id, !paused);
        message.success(paused ? "Đã chạy tiếp" : "Đã tạm dừng");
        onChanged();
      },
    });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button type="button" onClick={onBack} className="flex items-center gap-1 text-[13px] font-semibold text-slate-600 hover:text-slate-900">
          <ArrowLeft size={15} /> Danh sách chiến dịch
        </button>
        <div className="flex flex-wrap items-center gap-2">
          <Button icon={<RefreshCw size={14} />} onClick={load} className="!h-9 !rounded-lg text-xs font-semibold">Làm mới</Button>
          <Button icon={<FileDown size={14} />} loading={exporting} onClick={() => void exportReport()} className="!h-9 !rounded-lg text-xs font-semibold">Xuất Excel</Button>
          <Button icon={<Pencil size={14} />} onClick={onEdit} className="!h-9 !rounded-lg text-xs font-semibold">Sửa</Button>
          {canManage ? (
            <Button danger={!paused} type="primary" icon={paused ? <Play size={16} /> : <OctagonPause size={16} />} onClick={togglePause} className="!h-9 !rounded-lg !bg-[#2D5A27] hover:!bg-[#23481e] font-bold text-xs text-white shadow-xs px-4">
              {paused ? "Chạy tiếp" : "Tạm dừng khẩn cấp"}
            </Button>
          ) : null}
        </div>
      </div>
      <div>
        <h2 className="text-lg font-bold text-slate-900">{summary.name}</h2>
        <div className="text-[13px] text-slate-500">{summary.statusView.text}</div>
      </div>
      {!data ? (
        <Spin />
      ) : (
        <>
          <NeedsAction data={data} canManage={canManage} reload={load} />
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatCard label="Doanh thu" value={vnd(data.summary.revenue)} sub="Đơn có giá sale / quà" />
            <StatCard label="Đơn" value={String(data.summary.orders)} />
            <StatCard label="Đã bán giá sale" value={String(data.summary.flashSold)} sub={`${data.summary.flashHeld} đang chờ thanh toán`} />
            <StatCard label="Voucher đã dùng" value={String(data.summary.vouchersUsed)} />
          </div>
          <Collapse items={[{ key: "d", label: "Chi tiết: lượt bấm, lượt Nhắc tôi", children: <Details data={data} /> }]} />
        </>
      )}
    </div>
  );
}
