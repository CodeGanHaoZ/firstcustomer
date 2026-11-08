"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { advanceLoadingAnimal, PageLoading } from "@/components/page-loading";

/**
 * 全站路由过场：拦截站内 <a> 点击，先淡出当前页再跳转，新页淡入。
 * 对 hash 锚点、外链、新窗口、修饰键点击一律放行，不做拦截。
 * prefers-reduced-motion 下退化为直接跳转（无动画）。
 */
export function PageTransition() {
  const router = useRouter();
  const pathname = usePathname();
  const busy = useRef(false);
  const [loading, setLoading] = useState(false);
  const [animalIndex, setAnimalIndex] = useState(0);

  // 每次路由完成（含首次挂载）：移除淡出态，让新页以淡入动画出现
  useEffect(() => {
    busy.current = false;
    const hideTimer = window.setTimeout(() => setLoading(false), 0);
    document.documentElement.classList.remove("page-leaving");
    document.documentElement.classList.add("page-entering");
    const timer = window.setTimeout(() => {
      document.documentElement.classList.remove("page-entering");
    }, 420);
    return () => {
      window.clearTimeout(hideTimer);
      window.clearTimeout(timer);
    };
  }, [pathname]);

  useEffect(() => {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

    function onClick(event: MouseEvent) {
      if (busy.current) return;
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

      const anchor = (event.target as HTMLElement | null)?.closest("a");
      if (!anchor) return;
      if (anchor.target === "_blank" || anchor.hasAttribute("download")) return;

      const raw = anchor.getAttribute("href");
      if (!raw || raw.startsWith("#")) return;

      let url: URL;
      try {
        url = new URL(raw, window.location.href);
      } catch {
        return;
      }
      if (url.origin !== window.location.origin) return;
      // 同页锚点 / 同路径仅 hash 变化，交给浏览器原生滚动
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;

      event.preventDefault();
      const destination = url.pathname + url.search + url.hash;
      busy.current = true;
      setAnimalIndex(advanceLoadingAnimal());
      setLoading(true);

      if (reducedMotion.matches) {
        router.push(destination);
        return;
      }

      document.documentElement.classList.add("page-leaving");
      window.setTimeout(() => {
        router.push(destination);
      }, 240);
    }

    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [router]);

  return <PageLoading visible={loading} animalIndex={animalIndex} />;
}
