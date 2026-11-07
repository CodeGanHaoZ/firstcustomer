"use client";

import { ArrowUp } from "lucide-react";
import { useCallback } from "react";

/**
 * 回到顶部按钮（三种形态，全站可复用）：
 * - float：右下角悬浮圆钮，滚过 480px 淡入，由 EditorialMotion 控制显隐
 * - pill：页脚胶囊钮
 * - text：分区末尾的文字链
 */
export function BackToTop({ variant = "float" }: { variant?: "float" | "pill" | "text" }) {
  const go = useCallback(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
  }, []);

  if (variant === "pill") {
    return (
      <button type="button" className="btn btn--ghost btn--sm" onClick={go}>
        回到顶部 <ArrowUp size={14} aria-hidden="true" />
      </button>
    );
  }
  if (variant === "text") {
    return (
      <button type="button" className="backtop-text" onClick={go}>
        回到顶部 <ArrowUp size={13} aria-hidden="true" />
      </button>
    );
  }
  return (
    <button
      type="button"
      className="backtop-float"
      data-backtop="float"
      aria-label="回到顶部"
      onClick={go}
    >
      <ArrowUp size={20} aria-hidden="true" />
    </button>
  );
}
