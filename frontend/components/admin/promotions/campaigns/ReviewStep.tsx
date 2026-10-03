"use client";

import { useCallback, useEffect, useState } from "react";
import dayjs, { type Dayjs } from "dayjs";
import { Button, Checkbox, DatePicker, Input, Spin, App } from "antd";
import { AlertTriangle, CheckCircle2, CircleAlert, Eye, Info } from "lucide-react";
import {
  campaignAdminApi,
  CampaignAdminError,
  rowGifts,
  type CampaignDocAdmin,
  type CampaignProductAdmin,
  type CheckIssue,
} from "@/lib/campaign/campaignAdminApi";

function giftSummary(products: CampaignProductAdmin[]): string {
  const withGift = products.filter((p) => rowGifts(p).length);
  const total = withGift.reduce((n, p) => n + rowGifts(p).length, 0);
  return withGift.length ? `${withGift.length} sản phẩm có quà (${total} quà)` : "Không có";
}
import { PreviewModal } from "./PreviewModal";
import { stepOfPath } from "./wizardModel";

type Props = {
  doc: CampaignDocAdmin;
  canManage: boolean;
  /** Lưu nháp đang dở rồi trả revision mới nhất (null = lưu lỗi). */
  flush: () => Promise<number | null>;
  onJump: (step: number) => void;
  onDone: (doc: CampaignDocAdmin) => void;
};

const TONE = {
  error: { Icon: CircleAlert, cls: "bg-red-50 text-red-800 ring-red-200", label: "Phải sửa" },
  confirm: { Icon: AlertTriangle, cls: "bg-orange-50 text-orange-800 ring-orange-200", label: "Cần xác nhận" },
  warn: { Icon: Info, cls: "bg-amber-50 text-amber-800 ring-amber-200", label: "Lưu ý" },
} as const;

function IssueRow({ issue, onJump }: { issue: CheckIssue; onJump: (step: number) => void }) {
  const t = TONE[issue.level];
  const step = stepOfPath(issue.path);
  return (
    <div className={`flex items-start justify-between gap-3 rounded-lg px-3 py-2 text-[13px] ring-1 ${t.cls}`}>
      <span className="flex items-start gap-2">
        <t.Icon size={16} className="mt-0.5 shrink-0" />
        <span>
          <b>{t.label}:</b> {issue.message}
        </span>
      </span>
      {step < 4 ? (
        <Button size="small" onClick={() => onJump(step)}>
          Sửa
        </Button>
      ) : null}
    </div>
  );
}

/** Quản lý xác nhận 2 lần + nhập lý do khi có giá dưới vốn (AD05); lý do lưu vào audit. */
function askReason(modal: any, msg: any, confirms: CheckIssue[]): Promise<string | null> {
  return new Promise((resolve) => {
    let reason = "";
    let agreed = false;
    modal.confirm({
      title: `${confirms.length} sản phẩm bán dưới giá vốn`,
      width: 520,
      okText: "Xác nhận và bật",
      cancelText: "Quay lại sửa",
      content: (
        <div className="space-y-2 text-[13px]">
          {confirms.map((c) => <div key={c.message}>• {c.message}</div>)}
          <Checkbox onChange={(e) => (agreed = e.target.checked)}>Tôi đã kiểm tra, đồng ý bán lỗ các sản phẩm trên</Checkbox>
          <Input.TextArea rows={2} maxLength={300} placeholder="Lý do (bắt buộc), ví dụ: xả hàng cuối mùa" onChange={(e) => (reason = e.target.value)} />
        </div>
      ),
      onOk: () => {
        if (!agreed || reason.trim().length < 5) {
          msg.warning("Tích xác nhận và nhập lý do ít nhất 5 ký tự");
          return Promise.reject();
        }
        resolve(reason.trim());
      },
      onCancel: () => resolve(null),
    });
  });
}

function confirmTimeChange(modal: any, doc: CampaignDocAdmin): Promise<boolean> {
  const before = doc.published?.info.endAt;
  const after = doc.draft.info.endAt;
  if (!before || before === after) return Promise.resolve(true);
  const earlier = Date.parse(after) < Date.parse(before);
  return new Promise((resolve) =>
    modal.confirm({
      title: earlier ? "Kết thúc sớm chiến dịch?" : "Kéo dài chiến dịch?",
      content: earlier
        ? `Chiến dịch sẽ kết thúc lúc ${dayjs(after).format("HH:mm DD/MM")}. Sau giờ này giá sale, quà tặng biến mất; đơn đang chờ thanh toán vẫn giữ giá cũ.`
        : `Chiến dịch chạy tới ${dayjs(after).format("HH:mm DD/MM")}. Số lượng bán giá sale không tự tăng thêm.`,
      okText: "Đồng ý",
      cancelText: "Huỷ",
      onOk: () => resolve(true),
      onCancel: () => resolve(false),
    })
  );
}

export function ReviewStep({ doc, canManage, flush, onJump, onDone }: Props) {
  const { message, modal } = App.useApp();
  const [issues, setIssues] = useState<CheckIssue[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [at, setAt] = useState<Dayjs | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const run = useCallback(async () => {
    setIssues(null);
    if ((await flush()) == null) return setIssues([]);
    try {
      setIssues((await campaignAdminApi.check(doc._id)).issues);
    } catch (e: any) {
      message.error(e?.message || "Không kiểm tra được");
      setIssues([]);
    }
  }, [doc._id, flush, message]);
  useEffect(() => {
    void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const errors = (issues || []).filter((i) => i.level === "error");
  const confirms = (issues || []).filter((i) => i.level === "confirm");
  const go = async (mode: "now" | "schedule") => {
    const revision = await flush();
    if (revision == null || !(await confirmTimeChange(modal, doc))) return;
    const reason = confirms.length ? await askReason(modal, message, confirms) : undefined;
    if (reason === null) return;
    setBusy(true);
    try {
      const r = mode === "now"
        ? await campaignAdminApi.publish(doc._id, revision, reason)
        : await campaignAdminApi.schedule(doc._id, revision, at!.toISOString(), reason);
      message.success(mode === "now" ? "Đã bật chiến dịch" : `Đã hẹn bật lúc ${at!.format("HH:mm DD/MM")}`);
      onDone(r.item);
    } catch (e) {
      const err = e as CampaignAdminError;
      message.error(err.message);
      if (err.fields?.length) void run();
    } finally {
      setBusy(false);
    }
  };

  const d = doc.draft;
  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-4">
        {[
          ["Thời gian", `${dayjs(d.info.startAt).format("HH:mm DD/MM")} → ${dayjs(d.info.endAt).format("HH:mm DD/MM")}`],
          ["Sản phẩm giảm giá", `${d.products.length} sản phẩm · ${d.slots.length || "cả ngày"} ${d.slots.length ? "khung giờ" : ""}`],
          ["Quà tặng", giftSummary(d.products)],
          ["Voucher", `${d.voucherIds.length} voucher`],
        ].map(([k, v]) => (
          <div key={k} className="rounded-xl border border-slate-200 bg-white p-3">
            <div className="text-[11px] font-semibold uppercase text-slate-400">{k}</div>
            <div className="text-[13px] font-semibold text-slate-800">{v}</div>
          </div>
        ))}
      </div>
      <div className="space-y-2">
        {issues === null ? (
          <Spin />
        ) : issues.length === 0 ? (
          <div className="flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-[13px] font-medium text-emerald-800 ring-1 ring-emerald-200">
            <CheckCircle2 size={16} /> Mọi thứ đã sẵn sàng.
          </div>
        ) : (
          issues.map((i) => <IssueRow key={`${i.path}-${i.message}`} issue={i} onJump={onJump} />)
        )}
      </div>
      {d.info.testOnly ? <p className="text-[12px] text-slate-500">Đang bật &quot;Chạy thử cho tài khoản test&quot;: bật xong chỉ tài khoản test thấy, dùng để xem trước trên Desktop / Mobile.</p> : null}
      <div className="flex flex-wrap items-center gap-2 border-t border-slate-200 pt-3">
        <Button
          type="primary"
          disabled={!canManage || !!errors.length || issues === null}
          loading={busy}
          onClick={() => void go("now")}
          className="!h-9 !rounded-lg !bg-[#2D5A27] hover:!bg-[#23481e] font-bold text-xs text-white shadow-xs px-4"
        >
          {doc.published ? "Áp dụng thay đổi" : "Bật ngay"}
        </Button>
        <DatePicker
          showTime={{ format: "HH:mm" }}
          format="HH:mm DD/MM/YYYY"
          value={at}
          onChange={setAt}
          disabledDate={(x) => x.isBefore(dayjs(), "day")}
          placeholder="Chọn giờ hẹn bật"
          disabled={!canManage}
          className="!h-9 !rounded-lg text-xs"
        />
        <Button
          disabled={!canManage || !at || !!errors.length || issues === null}
          loading={busy}
          onClick={() => void go("schedule")}
          className="!h-9 !rounded-lg px-3.5 text-xs font-semibold"
        >
          Hẹn giờ
        </Button>
        <Button onClick={() => void run()} className="!h-9 !rounded-lg px-3.5 text-xs font-semibold">
          Kiểm tra lại
        </Button>
        <Button
          icon={<Eye size={14} />}
          onClick={() => void flush().then((r) => r != null && setPreviewOpen(true))}
          className="!h-9 !rounded-lg px-3.5 text-xs font-semibold"
        >
          Xem trước
        </Button>
        {!canManage ? <span className="text-[12px] text-amber-700">Chỉ quản lý được bật chiến dịch.</span> : null}
        {errors.length ? <span className="text-[12px] text-red-600">Còn {errors.length} lỗi, sửa xong mới bật được. Bấm &quot;Sửa&quot; để tới đúng ô.</span> : null}
      </div>
      {confirms.length ? <p className="text-[12px] text-orange-700">Tiền lỗ từng sản phẩm xem ở cột &quot;Lãi còn lại&quot; của bước 2.</p> : null}
      <PreviewModal campaignId={doc._id} draft={d} open={previewOpen} onClose={() => setPreviewOpen(false)} />
    </div>
  );
}
