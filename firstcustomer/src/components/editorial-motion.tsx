"use client";

import { useEffect } from "react";

/**
 * Editorial Paper UI 交互层（React 移植版）
 * 对应技能 theme.js 的 6 个模块：
 * 1 吸顶导航状态（滚过 8px 加 .is-scrolled）
 * 2 移动端菜单开合
 * 3 滚动揭示（同组元素按 DOM 顺序 80ms 错峰）
 * 4 数字滚动（进视口后 0 → 目标值，easeOutCubic）
 * 5 指针视差（[data-parallax] 内 [data-parallax-layer]，±14px）
 * 6 回到顶部悬浮钮显隐（滚过 480px 显示）
 * 7 反白圆盘随指针移动（lerp 跟随，离开回中）
 * 全部遵守 prefers-reduced-motion；任何一项缺失不影响其余项。
 */
export function EditorialMotion() {
  useEffect(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const cleanups: Array<() => void> = [];

    /* ---------- 1. 吸顶导航状态 + 6. 回到顶部悬浮钮显隐 ---------- */
    const nav = document.querySelector<HTMLElement>(".nav");
    const float = document.querySelector<HTMLElement>('[data-backtop="float"]');
    let navRaf = 0;
    const onScroll = () => {
      if (navRaf) return;
      navRaf = requestAnimationFrame(() => {
        nav?.classList.toggle("is-scrolled", window.scrollY > 8);
        float?.classList.toggle("is-show", window.scrollY > 480);
        navRaf = 0;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    cleanups.push(() => window.removeEventListener("scroll", onScroll));

    /* ---------- 2. 移动端菜单 ---------- */
    const toggle = document.querySelector<HTMLElement>("[data-nav-toggle]");
    const menu = document.querySelector<HTMLElement>(".nav__menu");
    const onToggle = () => {
      const open = menu?.classList.toggle("is-open") ?? false;
      toggle?.setAttribute("aria-expanded", String(open));
    };
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && menu?.classList.contains("is-open")) {
        menu.classList.remove("is-open");
        toggle?.setAttribute("aria-expanded", "false");
        toggle?.focus();
      }
    };
    toggle?.addEventListener("click", onToggle);
    document.addEventListener("keydown", onEscape);
    cleanups.push(() => {
      toggle?.removeEventListener("click", onToggle);
      document.removeEventListener("keydown", onEscape);
    });

    /* ---------- 3. 滚动揭示：同组自动错峰 ---------- */
    const items = Array.from(document.querySelectorAll<HTMLElement>("[data-reveal]"));
    if (items.length) {
      if (reduceMotion || !("IntersectionObserver" in window)) {
        items.forEach((el) => el.classList.add("is-visible"));
      } else {
        const groups = new Map<string, HTMLElement[]>();
        items.forEach((el) => {
          const key = el.getAttribute("data-reveal-group") || "__default";
          const list = groups.get(key) ?? [];
          list.push(el);
          groups.set(key, list);
        });
        groups.forEach((list) => {
          list.forEach((el, i) => {
            if (!el.style.getPropertyValue("--reveal-delay")) {
              el.style.setProperty("--reveal-delay", `${Math.min(i, 6) * 80}ms`);
            }
          });
        });
        const io = new IntersectionObserver(
          (entries) => {
            entries.forEach((entry) => {
              if (entry.isIntersecting) {
                entry.target.classList.add("is-visible");
                io.unobserve(entry.target);
              }
            });
          },
          { rootMargin: "0px 0px -12% 0px", threshold: 0.08 },
        );
        items.forEach((el) => io.observe(el));
        cleanups.push(() => io.disconnect());
      }
    }

    /* ---------- 4. 数字滚动 ---------- */
    const counters = Array.from(document.querySelectorAll<HTMLElement>("[data-count]"));
    if (counters.length) {
      const fmt = (el: HTMLElement, v: number) => {
        const decimals = parseInt(el.getAttribute("data-count-decimals") ?? "0", 10) || 0;
        return (
          (el.getAttribute("data-count-prefix") || "") +
          v.toFixed(decimals) +
          (el.getAttribute("data-count-suffix") || "")
        );
      };
      const run = (el: HTMLElement) => {
        const target = parseFloat(el.getAttribute("data-count") || "0") || 0;
        const statBox = el.closest<HTMLElement>(".stat");
        statBox?.classList.add("is-live");
        if (reduceMotion) {
          el.textContent = fmt(el, target);
          statBox?.classList.add("is-done");
          return;
        }
        const dur = 1100;
        let start: number | null = null;
        const frame = (ts: number) => {
          if (start === null) start = ts;
          const p = Math.min((ts - start) / dur, 1);
          const eased = 1 - Math.pow(1 - p, 3);
          el.textContent = fmt(el, target * eased);
          if (p < 1) requestAnimationFrame(frame);
          else statBox?.classList.add("is-done");
        };
        requestAnimationFrame(frame);
      };
      if (!reduceMotion) counters.forEach((n) => (n.textContent = fmt(n, 0)));
      if (!("IntersectionObserver" in window)) {
        counters.forEach(run);
      } else {
        const io = new IntersectionObserver(
          (entries) => {
            entries.forEach((entry) => {
              if (entry.isIntersecting) {
                run(entry.target as HTMLElement);
                io.unobserve(entry.target);
              }
            });
          },
          { threshold: 0.6 },
        );
        counters.forEach((n) => io.observe(n));
        cleanups.push(() => io.disconnect());
      }
    }

    /* ---------- 5. 指针视差 ---------- */
    if (!reduceMotion && !window.matchMedia("(pointer: coarse)").matches) {
      const hosts = Array.from(document.querySelectorAll<HTMLElement>("[data-parallax]"));
      hosts.forEach((host) => {
        const layers = Array.from(host.querySelectorAll<HTMLElement>("[data-parallax-layer]"));
        let raf = 0;
        let tx = 0;
        let ty = 0;
        const onMove = (event: MouseEvent) => {
          const r = host.getBoundingClientRect();
          tx = (event.clientX - r.left) / r.width - 0.5;
          ty = (event.clientY - r.top) / r.height - 0.5;
          if (!raf) {
            raf = requestAnimationFrame(() => {
              layers.forEach((layer) => {
                const depth = parseFloat(layer.getAttribute("data-parallax-layer") || "1") || 1;
                layer.style.transform =
                  `translate3d(${(-tx * depth * 14).toFixed(2)}px, ${(-ty * depth * 14).toFixed(2)}px, 0)`;
              });
              raf = 0;
            });
          }
        };
        const onLeave = () => {
          layers.forEach((layer) => (layer.style.transform = "translate3d(0,0,0)"));
        };
        host.addEventListener("mousemove", onMove);
        host.addEventListener("mouseleave", onLeave);
        cleanups.push(() => {
          host.removeEventListener("mousemove", onMove);
          host.removeEventListener("mouseleave", onLeave);
        });
      });
    }

    /* ---------- 7. 反白圆盘：弹簧跟随 + 水滴形变 + 拖影，移出即淡出 ---------- */
    const discBand = document.querySelector<HTMLElement>(".disc-band");
    const disc = discBand?.querySelector<HTMLElement>(".disc");
    if (discBand && disc) {
      const bandRect = discBand.getBoundingClientRect();
      // 归位点：区块右下角（此时圆盘隐藏，仅作重新进入前的默认位置）
      const homeX = bandRect.width * 0.34;
      const homeY = bandRect.height * 0.22;
      const place = (el: HTMLElement, x: number, y: number, extra = "") => {
        el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)${extra}`;
      };
      place(disc, homeX, homeY);

      // 圆盘覆盖到的按钮：切换反色（黑圆盘上浮出白底深字）
      const invertibles = Array.from(
        discBand.querySelectorAll<HTMLElement>(".disc-band__actions .btn"),
      );
      const clearInvert = () => invertibles.forEach((btn) => btn.classList.remove("is-disc-over"));
      const applyInvert = (cx: number, cy: number) => {
        const band = discBand.getBoundingClientRect();
        const radius = disc.offsetWidth / 2;
        // 圆盘中心（相对区块左上角）
        const px = band.width / 2 + cx;
        const py = band.height / 2 + cy;
        invertibles.forEach((btn) => {
          const r = btn.getBoundingClientRect();
          const bx = r.left - band.left;
          const by = r.top - band.top;
          // 圆心到矩形最近点距离
          const nx = Math.max(bx, Math.min(px, bx + r.width));
          const ny = Math.max(by, Math.min(py, by + r.height));
          btn.classList.toggle("is-disc-over", Math.hypot(px - nx, py - ny) < radius);
        });
      };
      // 初始隐藏态，不产生任何颜色重叠
      disc.removeAttribute("data-active");
      clearInvert();

      let targetX = homeX;
      let targetY = homeY;
      let currentX = homeX;
      let currentY = homeY;
      let velX = 0;
      let velY = 0;
      let clock = 0;
      let rafId = 0;
      let active = false;

      const clampToBand = (clientX: number, clientY: number) => {
        const rect = discBand.getBoundingClientRect();
        const size = disc.offsetWidth;
        // 限幅：圆盘不出区块（留一半直径在内）
        const maxX = Math.max(0, rect.width / 2 - size / 2);
        const maxY = Math.max(0, rect.height / 2 - size / 2);
        const relX = clientX - (rect.left + rect.width / 2);
        const relY = clientY - (rect.top + rect.height / 2);
        targetX = Math.min(maxX, Math.max(-maxX, relX));
        targetY = Math.min(maxY, Math.max(-maxY, relY));
      };

      const tick = () => {
        // 弹簧：带惯性与轻微回弹，替代线性 lerp 的生硬直线跟随
        velX = (velX + (targetX - currentX) * 0.13) * 0.74;
        velY = (velY + (targetY - currentY) * 0.13) * 0.74;
        currentX += velX;
        currentY += velY;

        const speed = Math.hypot(velX, velY);
        const intensity = Math.min(1, speed / 20);
        // 按速度分量分别拉伸：不用 rotate，box-shadow 的拖影方向才不会被一起旋转
        const kx = Math.min(1, Math.abs(velX) / 20);
        const ky = Math.min(1, Math.abs(velY) / 20);
        const sx = 1 + 0.2 * kx - 0.09 * ky;
        const sy = 1 + 0.2 * ky - 0.09 * kx;
        // 低频边缘波动，幅度随速度增强，静止时归零
        clock += 1;
        const wob = Math.sin(clock * 0.11) * (0.5 + 3.2 * intensity);
        const a = (50 + wob).toFixed(1);
        const b = (50 - wob * 0.7).toFixed(1);
        const c = (50 + wob * 0.45).toFixed(1);
        const d = (50 - wob * 0.45).toFixed(1);

        place(disc, currentX, currentY, ` scale(${sx.toFixed(3)}, ${sy.toFixed(3)})`);
        disc.style.borderRadius = `${a}% ${b}% ${c}% ${d}% / ${b}% ${a}% ${d}% ${c}%`;
        // 同元素双层白影 = 拖尾：外阴影不落在圆盘内部，不会污染 difference 反色；
        // 朝运动反方向偏移、透明度递减，快移时拖出渐淡残影，停下自动收拢。
        const dx = -velX * 1.7;
        const dy = -velY * 1.7;
        disc.style.boxShadow = intensity > 0.03
          ? `${dx.toFixed(1)}px ${dy.toFixed(1)}px 0 rgba(255,255,255,${(0.24 * intensity).toFixed(3)}), ` +
            `${(dx * 2).toFixed(1)}px ${(dy * 2).toFixed(1)}px 0 rgba(255,255,255,${(0.12 * intensity).toFixed(3)})`
          : "none";

        applyInvert(currentX, currentY);

        const settled =
          Math.abs(targetX - currentX) < 0.4 &&
          Math.abs(targetY - currentY) < 0.4 &&
          speed < 0.4;
        if (settled) {
          velX = 0;
          velY = 0;
          currentX = targetX;
          currentY = targetY;
          place(disc, currentX, currentY, " scale(1, 1)");
          disc.style.borderRadius = "50%";
          disc.style.boxShadow = "none";
          applyInvert(currentX, currentY);
          rafId = 0;
          return;
        }
        rafId = requestAnimationFrame(tick);
      };
      const kick = () => {
        if (!rafId) rafId = requestAnimationFrame(tick);
      };

      const activate = (event: PointerEvent) => {
        active = true;
        disc.setAttribute("data-active", "");
        if (reduceMotion) {
          // 减少动效：不做跟随位移与形变，仅静态显隐
          applyInvert(currentX, currentY);
          return;
        }
        clampToBand(event.clientX, event.clientY);
        // 首次进入直接落到指针处再淡入，避免从角落拖出一条长轨迹
        currentX = targetX;
        currentY = targetY;
        velX = 0;
        velY = 0;
        place(disc, currentX, currentY);
        applyInvert(currentX, currentY);
      };
      const onMove = (event: PointerEvent) => {
        if (!active) {
          activate(event);
          return;
        }
        if (reduceMotion) return;
        clampToBand(event.clientX, event.clientY);
        kick();
      };
      const onLeave = () => {
        active = false;
        // 完全移出模块：圆盘原地淡出，颜色重叠与按钮反色一并清除
        disc.removeAttribute("data-active");
        clearInvert();
        if (rafId) {
          cancelAnimationFrame(rafId);
          rafId = 0;
        }
        velX = 0;
        velY = 0;
        currentX = targetX;
        currentY = targetY;
        // 形变与拖影归位，避免下次进入时残留上一次的拉伸
        place(disc, currentX, currentY, " scale(1, 1)");
        disc.style.borderRadius = "50%";
        disc.style.boxShadow = "none";
      };

      discBand.addEventListener("pointerenter", activate);
      discBand.addEventListener("pointermove", onMove);
      discBand.addEventListener("pointerleave", onLeave);
      cleanups.push(() => {
        discBand.removeEventListener("pointerenter", activate);
        discBand.removeEventListener("pointermove", onMove);
        discBand.removeEventListener("pointerleave", onLeave);
        if (rafId) cancelAnimationFrame(rafId);
      });
    }

    /* 跨页跳转携带 hash（如 /account → /#cta）时，路由过场后浏览器可能不重放
       锚点滚动，这里在挂载后兜底滚一次，保证「开始」入口稳定落到目标区块。 */
    if (window.location.hash) {
      const hashId = window.location.hash.slice(1);
      const timer = window.setTimeout(() => {
        document
          .getElementById(hashId)
          ?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
      }, 80);
      cleanups.push(() => window.clearTimeout(timer));
    }

    return () => cleanups.forEach((fn) => fn());
  }, []);

  return null;
}
