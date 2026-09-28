"use client";

import React from "react";

export function EditorPreview({
  device,
  previewKey,
  previewSrc,
  iframeRef,
  shopPreviewUrl,
}: {
  device: "desktop" | "mobile";
  previewKey: number;
  previewSrc: string;
  iframeRef: React.RefObject<HTMLIFrameElement | null>;
  shopPreviewUrl: string;
}) {
  return (
    <div className="relative hidden min-w-0 flex-1 flex-col bg-white md:flex">
      <div className="flex h-9 shrink-0 items-center justify-between border-b border-gray-200 px-4 text-[11px] text-gray-500">
        <span className="font-medium">
          Xem trước · {device === "mobile" ? "Mobile 390px" : "Desktop"}
        </span>
        <span className="truncate font-mono text-[10px] text-gray-400">
          {shopPreviewUrl}
        </span>
      </div>
      <div className="flex min-h-0 flex-1 justify-center overflow-hidden p-0">
        <div
          className={`flex h-full overflow-hidden border-0 bg-white transition-all duration-300 ${
            device === "mobile"
              ? "mx-auto w-[390px] max-w-full border-x border-gray-200"
              : "w-full"
          }`}
        >
          <iframe
            ref={iframeRef}
            key={previewKey}
            src={previewSrc}
            title="Shop preview"
            className="h-full w-full border-0 bg-white"
          />
        </div>
      </div>
    </div>
  );
}
