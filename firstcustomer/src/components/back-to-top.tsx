"use client";

import { ArrowUp } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Locale } from "@/lib/locale";

/**
 * 回到顶部按钮（三种形态，全站可复用）：
 * - float：右下角悬浮圆钮，滚过 480px 淡入；自带滚动监听（不依赖 EditorialMotion，
 *   根布局挂载后全站生效），EditorialMotion 的同步 toggle 与其状态一致、互不冲突
 * - pill：页脚胶囊钮
 * - text：分区末尾的文字链
 */
export function BackToTop({ variant = "float", locale = "zh" }: { variant?: "float" | "pill" | "text"; locale?: Locale }) {
  const label = locale === "en" ? "Back to top" : "回到顶部";
  const btnRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (variant !== "float") return;
    const el = btnRef.current;
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        el?.classList.toggle("is-show", window.scrollY > 480);
        raf = 0;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [variant]);

  const go = useCallback(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
  }, []);

  if (variant === "pill") {
    return (
      <button type="button" className="btn btn--ghost btn--sm" onClick={go}>
        {label} <ArrowUp size={14} aria-hidden="true" />
      </button>
    );
  }
  if (variant === "text") {
    return (
      <button type="button" className="backtop-text" onClick={go}>
        {label} <ArrowUp size={13} aria-hidden="true" />
      </button>
    );
  }
  return (
    <button
      ref={btnRef}
      type="button"
      className="backtop-float"
      data-backtop="float"
      aria-label={label}
      onClick={go}
    >
      <ArrowUp size={20} aria-hidden="true" />
    </button>
  );
}
