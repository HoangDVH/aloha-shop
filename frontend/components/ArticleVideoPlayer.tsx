"use client";

import { useEffect, useRef, useState } from "react";
import { Expand, Minimize } from "lucide-react";

type SafariVideo = HTMLVideoElement & { webkitEnterFullscreen?: () => void };

/** One media stream: a small canvas supplies the ambient background. */
export function ArticleVideoPlayer({ src, title }: { src: string; title?: string }) {
  const frameRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [fullscreenError, setFullscreenError] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    const context = canvas.getContext("2d");
    const draw = () => {
      if (!context || video.readyState < 2 || !video.videoWidth || !video.videoHeight) return;
      const scale = Math.max(canvas.width / video.videoWidth, canvas.height / video.videoHeight);
      const width = video.videoWidth * scale;
      const height = video.videoHeight * scale;
      try {
        context.drawImage(video, (canvas.width - width) / 2, (canvas.height - height) / 2, width, height);
      } catch { /* The main player remains usable if a frame cannot be drawn. */ }
    };
    const events = ["loadeddata", "seeked", "timeupdate"] as const;
    for (const event of events) video.addEventListener(event, draw);
    draw();
    return () => { for (const event of events) video.removeEventListener(event, draw); };
  }, [src]);

  useEffect(() => {
    const update = () => setFullscreen(document.fullscreenElement === frameRef.current);
    document.addEventListener("fullscreenchange", update);
    return () => document.removeEventListener("fullscreenchange", update);
  }, []);

  const toggleFullscreen = async () => {
    setFullscreenError(false);
    try {
      if (document.fullscreenElement === frameRef.current) {
        await document.exitFullscreen();
      } else if (frameRef.current?.requestFullscreen) {
        await frameRef.current.requestFullscreen();
      } else if ((videoRef.current as SafariVideo | null)?.webkitEnterFullscreen) {
        (videoRef.current as SafariVideo).webkitEnterFullscreen?.();
      } else {
        setFullscreenError(true);
      }
    } catch {
      const video = videoRef.current as SafariVideo | null;
      try {
        if (video?.webkitEnterFullscreen) video.webkitEnterFullscreen();
        else setFullscreenError(true);
      } catch { setFullscreenError(true); }
    }
  };

  return (
    <div ref={frameRef} className="article-video-player" aria-label={title || "Video bài viết"}>
      <canvas ref={canvasRef} width={320} height={180} className="article-video-player__ambient" aria-hidden="true" />
      <video ref={videoRef} src={src} controls controlsList="nofullscreen" playsInline preload="metadata" className="article-video-player__video" aria-label={title || "Video bài viết"} />
      <button type="button" onClick={toggleFullscreen} aria-label={fullscreen ? "Thoát toàn màn hình" : "Xem toàn màn hình"} title={fullscreen ? "Thoát toàn màn hình" : "Xem toàn màn hình"} className="absolute right-3 top-3 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-black/50 text-white transition hover:bg-black/70 focus-visible:outline-2 focus-visible:outline-white">
        {fullscreen ? <Minimize size={20} /> : <Expand size={20} />}
      </button>
      {fullscreenError ? <p role="status" className="absolute left-3 right-16 top-3 rounded-lg bg-black/75 p-2 text-xs text-white">Trình duyệt chưa hỗ trợ mở toàn màn hình. Bạn có thể dùng nút phóng to của trình phát.</p> : null}
    </div>
  );
}
