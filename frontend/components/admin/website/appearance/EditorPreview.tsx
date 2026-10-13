"use client";

import React, { useEffect, useRef, useState } from "react";
import { Grid, Modal } from "antd";
import { ExternalLink, Maximize2, Monitor, Smartphone, X } from "lucide-react";
import { WbIconSegment } from "../ui";

export function EditorPreview({ device, setDevice, onClose, previewKey, previewSrc, iframeRef, shopPreviewUrl }: {
  device: "desktop" | "mobile";
  setDevice: (device: "desktop" | "mobile") => void;
  onClose: () => void;
  previewKey: number;
  previewSrc: string;
  iframeRef: React.RefObject<HTMLIFrameElement | null>;
  shopPreviewUrl: string;
}) {
  const screens = Grid.useBreakpoint();
  const [expanded, setExpanded] = useState(false);
  const overlay = screens.lg === false || expanded;
  const content = <div className="flex h-full min-h-0 flex-col bg-slate-50">
    <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-white px-3 py-2">
      <h3 className="text-xs font-semibold text-slate-700">Website hiện tại</h3>
      <div className="flex items-center gap-1">
        <WbIconSegment value={device} onChange={setDevice} options={[
          { id: "desktop", title: "Desktop", Icon: Monitor },
          { id: "mobile", title: "Mobile", Icon: Smartphone },
        ]} />
        {!overlay && <button type="button" onClick={() => setExpanded(true)} aria-label="Mở rộng website hiện tại" title="Mở rộng" className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"><Maximize2 size={16} /></button>}
        <button type="button" onClick={onClose} aria-label="Đóng website hiện tại" className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"><X size={17} /></button>
      </div>
    </div>
    <div className="flex shrink-0 items-center justify-between gap-2 px-3 py-2 text-[11px] text-slate-500">
      <span>Bản đã áp dụng · {device === "desktop" ? "Desktop 1280px" : "Mobile 390px"}</span>
      <a href={shopPreviewUrl} target="_blank" rel="noopener noreferrer" aria-label="Mở website trong tab mới" title="Mở trong tab mới"><ExternalLink size={14} /></a>
    </div>
    <PreviewViewport device={device} previewKey={previewKey} previewSrc={previewSrc} iframeRef={iframeRef} />
  </div>;
  if (overlay) return <Modal open onCancel={onClose} footer={null} closable={false} width="calc(100vw - 24px)" styles={{ body: { height: "calc(100dvh - 100px)" } }} style={{ top: 16 }} destroyOnHidden>{content}</Modal>;
  return <aside aria-label="Website hiện tại" className="flex min-w-0 w-[35%] shrink-0 flex-col border-l border-slate-200">{content}</aside>;
}

/** Preserve the device viewport while scaling its visual preview to the available panel. */
function PreviewViewport({ device, previewKey, previewSrc, iframeRef }: {
  device: "desktop" | "mobile"; previewKey: number; previewSrc: string;
  iframeRef: React.RefObject<HTMLIFrameElement | null>;
}) {
  const host = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 390, height: 600 });
  useEffect(() => {
    if (!host.current) return;
    const observer = new ResizeObserver(entries => {
      const rect = entries[0]?.contentRect;
      if (rect && rect.width > 0 && rect.height > 0) setSize({ width: rect.width, height: rect.height });
    });
    observer.observe(host.current);
    return () => observer.disconnect();
  }, []);
  const width = device === "desktop" ? 1280 : 390;
  const scale = Math.min(1, size.width / width);
  return <div ref={host} className="flex min-h-0 flex-1 justify-center overflow-hidden">
    <div className="relative h-full shrink-0 bg-white" style={{ width: width * scale }}>
      <iframe key={previewKey} ref={iframeRef} src={previewSrc} title="Website hiện tại — bản đã áp dụng" className="absolute left-0 top-0 border-0 bg-white" style={{ width, height: size.height / scale, transform: `scale(${scale})`, transformOrigin: "top left" }} />
    </div>
  </div>;
}
