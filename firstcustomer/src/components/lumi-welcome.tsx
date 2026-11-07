"use client";

import { Dialog } from "@base-ui/react/dialog";
import { ArrowRight, MessageCircle } from "lucide-react";
import Image from "next/image";
import { useEffect, useRef } from "react";
import { BRAND } from "@/lib/brand";
import type { Locale } from "@/lib/locale";

const poster = "/brand/lumi-welcome-poster.webp";
const motion = "/brand/lumi-welcome.mp4";

export function LumiWelcome({ paused, locale = "zh" }: { paused: boolean; locale?: Locale }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const pausedRef = useRef(paused);
  const syncRef = useRef<() => void>(() => {});

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let visible = false;

    // 播放控制只建立一次监听。开关弹窗时不再销毁/重建 IntersectionObserver，
    // 否则重建瞬间的 play/pause 竞态会让视频在「当前帧 ↔ poster」之间闪一下。
    function syncPlayback() {
      if (pausedRef.current || !visible || document.hidden || reducedMotion.matches) {
        video!.pause();
        return;
      }
      // 减少动效偏好下保留 poster，不下载视频。
      if (!video!.getAttribute("src")) video!.src = motion;
      void video!.play().catch(() => {
        // 设备可能禁止自动播放；poster 仍可正常展示。
      });
    }
    syncRef.current = syncPlayback;

    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      syncPlayback();
    }, { threshold: 0.15 });
    observer.observe(video);
    document.addEventListener("visibilitychange", syncPlayback);
    reducedMotion.addEventListener("change", syncPlayback);

    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", syncPlayback);
      reducedMotion.removeEventListener("change", syncPlayback);
      video.pause();
    };
  }, []);

  // 弹窗开关时只同步一次播放状态，不重建监听器。
  useEffect(() => { pausedRef.current = paused; syncRef.current(); }, [paused]);

  return (
    <div className="brand-welcome-shell" data-open={paused ? "" : undefined}>
      <Dialog.Trigger className="brand-welcome">
        <video
          className="brand-welcome-rabbit"
          ref={videoRef}
          width={640}
          height={640}
          poster={poster}
          muted
          loop
          playsInline
          preload="none"
          disablePictureInPicture
          aria-hidden="true"
        >
          <Image src={poster} alt="" width={640} height={640} unoptimized />
        </video>
        <span className="brand-welcome-caption">
          <strong lang="en">{BRAND.mascotName}</strong><span>{locale === "en" ? "HiFirst office · Front desk" : "首客办公室 · 前台"}</span>
        </span>
        <span className="brand-welcome-cta">
          <MessageCircle size={16} aria-hidden="true" /> {locale === "en" ? "Tell me about your product" : "聊聊你的产品"} <ArrowRight size={15} aria-hidden="true" />
        </span>
        </Dialog.Trigger>
    </div>
  );
}
