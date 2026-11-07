"use client";

import { Dialog } from "@base-ui/react/dialog";
import { ArrowRight, MessageCircle, Pause, Play } from "lucide-react";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { BRAND } from "@/lib/brand";

const poster = "/brand/lumi-welcome-poster.webp";
const motion = "/brand/lumi-welcome.mp4";

export function LumiWelcome({ paused }: { paused: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [motionPaused, setMotionPaused] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let visible = false;

    function syncPlayback() {
      if (!video) return;
      if (paused || motionPaused || !visible || document.hidden || reducedMotion.matches) {
        video.pause();
        return;
      }
      // Keep the poster without downloading video when motion is reduced.
      if (!video.getAttribute("src")) video.src = motion;
      void video.play().catch(() => {
        // Autoplay can be blocked by device settings; the poster stays usable.
      });
    }

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
  }, [paused, motionPaused]);

  const motionLabel = motionPaused ? "播放兔子动画" : "暂停兔子动画";

  return (
    <div className="brand-welcome-shell">
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
          <strong lang="en">{BRAND.mascotName}</strong><span>首客办公室 · 前台</span>
        </span>
        <span className="brand-welcome-cta">
          <MessageCircle size={16} aria-hidden="true" /> 聊聊你的产品 <ArrowRight size={15} aria-hidden="true" />
        </span>
      </Dialog.Trigger>
      <button
        className="brand-welcome-motion"
        type="button"
        aria-label={motionLabel}
        title={motionLabel}
        onClick={() => setMotionPaused((value) => !value)}
      >
        {motionPaused ? <Play size={16} aria-hidden="true" /> : <Pause size={16} aria-hidden="true" />}
      </button>
    </div>
  );
}
