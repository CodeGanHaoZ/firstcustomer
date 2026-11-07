"use client";

import { useEffect, useRef } from "react";

/**
 * 全页氛围动效层：
 * 1. 固定定位的 canvas —— 「纸尘颗粒」缓慢上浮（松绿/暖棕双色，呼吸透明度）
 * 2. .ambient-glow 光斑呼吸漂移（纯 CSS，见 ambient.css）
 * 遵守 prefers-reduced-motion：减少动效时不渲染任何东西；
 * 页面不可见时暂停 rAF，节省电量。
 */
export function AmbientMotion() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    type Grain = { x: number; y: number; r: number; vy: number; drift: number; phase: number; speed: number; tone: number; alpha: number };
    const TONES: [number, number, number][] = [
      [36, 59, 45],     // 松绿（品牌正文色）
      [173, 135, 90],   // 暖棕纸尘
      [120, 132, 104],  // 灰绿过渡
    ];
    let grains: Grain[] = [];
    let raf = 0;
    let dpr = 1;

    const seed = () => {
      const count = Math.min(110, Math.max(50, Math.round(window.innerWidth / 17)));
      grains = Array.from({ length: count }, () => ({
        x: Math.random(),
        y: Math.random(),
        r: 0.9 + Math.random() * 2.1,
        vy: 0.05 + Math.random() * 0.14,
        drift: 14 + Math.random() * 34,
        phase: Math.random() * Math.PI * 2,
        speed: 0.0012 + Math.random() * 0.002,
        tone: Math.floor(Math.random() * TONES.length),
        alpha: 0.22 + Math.random() * 0.34,
      }));
    };

    const fit = () => {
      dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.round(window.innerWidth * dpr);
      canvas.height = Math.round(window.innerHeight * dpr);
    };

    let t0 = performance.now();
    const tick = (now: number) => {
      const t = now - t0;
      const { width: w, height: h } = canvas;
      ctx.clearRect(0, 0, w, h);
      for (const g of grains) {
        g.y -= (g.vy * 16) / h; // 归一化上浮
        if (g.y < -0.02) { g.y = 1.02; g.x = Math.random(); }
        const px = (g.x + Math.sin(t * g.speed + g.phase) * g.drift / window.innerWidth) * w;
        const py = g.y * h;
        const breathe = 0.55 + 0.45 * Math.sin(t * g.speed * 2.4 + g.phase * 1.7);
        const [r, gg, b] = TONES[g.tone];
        ctx.beginPath();
        ctx.arc(px, py, g.r * dpr, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${r},${gg},${b},${(g.alpha * breathe).toFixed(3)})`;
        ctx.fill();
      }
      raf = requestAnimationFrame(tick);
    };

    const onVisibility = () => {
      cancelAnimationFrame(raf);
      if (!document.hidden) { t0 = performance.now(); raf = requestAnimationFrame(tick); }
    };

    seed();
    fit();
    raf = requestAnimationFrame(tick);
    window.addEventListener("resize", () => { fit(); seed(); });
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("resize", fit);
    };
  }, []);

  return (
    <div className="ambient-layer" aria-hidden="true">
      <div className="ambient-glow" />
      <canvas ref={canvasRef} className="ambient-canvas" />
    </div>
  );
}
