"use client";

import { useEffect, useMemo, useState } from "react";
import dayjs, { type Dayjs } from "dayjs";
import { Button, DatePicker, Modal, Segmented, Spin, App } from "antd";
import { ExternalLink, Monitor, Smartphone } from "lucide-react";
import { campaignAdminApi, type CampaignContentAdmin } from "@/lib/campaign/campaignAdminApi";
import { exitPreview } from "@/lib/campaign/previewMode";

const DAY_MS = 86_400_000;
const LAST_HOURS_MS = 6 * 3_600_000;

type Props = { campaignId: string; draft: CampaignContentAdmin; open: boolean; onClose: () => void };

/** Mốc giờ hay cần xem: khởi động, bắt đầu, giờ chót, sau khi kết thúc (CP11). */
function moments(info: CampaignContentAdmin["info"]) {
  const start = Date.parse(info.startAt);
  const end = Date.parse(info.endAt);
  const list = [
    { key: "teaser", label: "Khởi động", at: start - Math.max(0, info.teaserDays) * DAY_MS + 60_000 },
    { key: "live", label: "Bắt đầu", at: start + 60_000 },
    { key: "last", label: "Giờ chót", at: Math.max(start, end - LAST_HOURS_MS) + 60_000 },
    { key: "ended", label: "Đã kết thúc", at: end + 60_000 },
  ];
  return info.teaserDays > 0 ? list : list.filter((m) => m.key !== "teaser");
}

/** Xem trước bản nháp trên cửa hàng như khách thấy; token 30 phút, giá mua thật không đổi (CP10). */
export function PreviewModal({ campaignId, draft, open, onClose }: Props) {
  const { message } = App.useApp();
  const [token, setToken] = useState<string | null>(null);
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const marks = useMemo(() => moments(draft.info), [draft.info]);
  const [at, setAt] = useState<Dayjs>(() => dayjs(marks[0]?.at));

  useEffect(() => {
    if (!open) return;
    setToken(null);
    campaignAdminApi
      .previewToken(campaignId)
      .then((r) => setToken(r.token))
      .catch((e) => message.error(e?.message || "Không tạo được link xem trước"));
  }, [open, campaignId]);

  const close = () => {
    exitPreview();
    onClose();
  };
  const src = token ? `/?campaignPreview=${encodeURIComponent(token)}&campaignPreviewAt=${encodeURIComponent(at.toISOString())}` : "";
  const width = device === "mobile" ? 390 : "100%";

  return (
    <Modal open={open} onCancel={close} footer={null} width={device === "mobile" ? 480 : "min(1280px, 96vw)"} title="Xem trước như khách hàng" destroyOnHidden>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Segmented
          value={device}
          onChange={(v) => setDevice(v as "desktop" | "mobile")}
          options={[
            { value: "desktop", label: <span className="inline-flex items-center gap-1"><Monitor size={14} /> Máy tính</span> },
            { value: "mobile", label: <span className="inline-flex items-center gap-1"><Smartphone size={14} /> Điện thoại</span> },
          ]}
        />
        {marks.map((m) => (
          <Button key={m.key} size="small" type={at.valueOf() === m.at ? "primary" : "default"} onClick={() => setAt(dayjs(m.at))}>
            {m.label}
          </Button>
        ))}
        <DatePicker showTime={{ format: "HH:mm" }} format="HH:mm DD/MM/YYYY" value={at} onChange={(v) => v && setAt(v)} allowClear={false} size="small" />
        {src ? (
          <a href={src} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[12px] text-[#2D5A27] font-medium hover:underline">
            <ExternalLink size={12} /> Mở tab mới
          </a>
        ) : null}
      </div>
      <p className="mb-2 text-[12px] text-slate-500">Link có hiệu lực 30 phút, chỉ để xem. Giá khi đặt hàng vẫn là giá đang bán thật.</p>
      <div className="flex justify-center rounded-lg bg-slate-100 p-2">
        {src ? (
          <iframe key={src} src={src} title="Xem trước chiến dịch" className="h-[70vh] rounded-md border border-slate-200 bg-white" style={{ width }} />
        ) : (
          <div className="flex h-[70vh] items-center">
            <Spin />
          </div>
        )}
      </div>
    </Modal>
  );
}
