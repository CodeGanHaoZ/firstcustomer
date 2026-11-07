"use client";

import { ArrowRight, ArrowUpRight, Pause, Play, RotateCcw, SkipForward } from "lucide-react";
import Image from "next/image";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type CSSProperties } from "react";
import type { DepartmentKey } from "@/domain/office";
import { DEMO_DURATION, OFFICE_MEMBERS, OFFICE_SCENES, demoMember } from "@/lib/office-showcase";
import { desks } from "./office-map";
import { drawOfficeActors } from "./office-showcase-canvas";

const motionQuery = "(prefers-reduced-motion: reduce)";
const subscribeMotion = (notify: () => void) => {
  const media = window.matchMedia(motionQuery);
  media.addEventListener("change", notify);
  return () => media.removeEventListener("change", notify);
};
const reducedSnapshot = () => window.matchMedia(motionQuery).matches;
const serverSnapshot = () => true;
const beatLabels = ["整理任务", "当面交接", "接收后继续工作"];

export function OfficeShowcase() {
  const reduced = useSyncExternalStore(subscribeMotion, reducedSnapshot, serverSnapshot);
  const [sceneIndex, setSceneIndex] = useState(0);
  const [beat, setBeat] = useState(0);
  const [paused, setPaused] = useState(false);
  const [replay, setReplay] = useState(0);
  const [selected, setSelected] = useState<DepartmentKey | null>(null);
  const stage = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const progress = useRef<HTMLSpanElement>(null);
  const bubbles = useRef<(HTMLDivElement | null)[]>([]);
  const hotspots = useRef<Partial<Record<DepartmentKey, HTMLButtonElement | null>>>({});
  const clock = useRef({ key: "", elapsed: 0 });
  const scene = OFFICE_SCENES[sceneIndex];
  const activeMember = selected ?? scene.from;
  const nextScene = useCallback(() => {
    setSceneIndex((current) => (current + 1) % OFFICE_SCENES.length);
    setSelected(null);
    setBeat(0);
  }, []);

  const chooseScene = (index: number, member: DepartmentKey | null = null) => {
    setSceneIndex(index);
    setSelected(member);
    setBeat(0);
    setReplay((value) => value + 1);
    setPaused(false);
  };
  const watchMember = (index: number, member: DepartmentKey) => {
    chooseScene(index, member);
    const theatre = stage.current?.closest<HTMLElement>("figure");
    theatre?.scrollIntoView({ behavior: reduced ? "instant" : "smooth", block: "start" });
    theatre?.focus({ preventScroll: true });
  };

  useEffect(() => {
    const surface = stage.current;
    const drawing = canvas.current;
    const ctx = drawing?.getContext("2d");
    if (!surface || !drawing || !ctx) {
      if (surface) surface.dataset.canvas = "unavailable";
      return;
    }
    const key = `${sceneIndex}:${replay}`;
    if (clock.current.key !== key) clock.current = { key, elapsed: 0 };
    const atlas = new window.Image();
    let ready = false;
    let disposed = false;
    let visible = false;
    let frame = 0;
    let previous = 0;
    let lastPaint = 0;
    let lastBeat = -1;
    const moving = !paused && !reduced;

    const paint = () => {
      if (!ready || disposed) return;
      const pose = drawOfficeActors(ctx, atlas, scene, clock.current.elapsed, moving);
      surface.dataset.beat = String(pose.beat);
      if (lastBeat !== pose.beat) { lastBeat = pose.beat; setBeat(pose.beat); }
      if (progress.current) progress.current.style.transform = `scaleX(${pose.progress})`;
      for (const member of OFFICE_MEMBERS) {
        const actor = member.key === scene.from ? pose.sender : member.key === scene.to ? pose.receiver : { point: desks[member.key].home };
        const button = hotspots.current[member.key];
        if (button) { button.style.left = `${actor.point[0]}%`; button.style.top = `${actor.point[1] - 7}%`; }
      }
      for (const [index, actor] of [pose.sender, pose.receiver].entries()) {
        const bubble = bubbles.current[index];
        if (bubble) { bubble.style.left = `${Math.max(13, Math.min(86, actor.point[0]))}%`; bubble.style.top = `${actor.point[1] - 15}%`; }
      }
    };
    const tick = (now: number) => {
      frame = 0;
      if (disposed || !ready || !visible || document.hidden || !moving) return;
      if (previous) clock.current.elapsed += Math.min(now - previous, 100);
      previous = now;
      if (clock.current.elapsed >= DEMO_DURATION) { nextScene(); return; }
      if (now - lastPaint >= 1000 / 30) { paint(); lastPaint = now; }
      frame = requestAnimationFrame(tick);
    };
    const resume = () => {
      cancelAnimationFrame(frame);
      frame = 0;
      previous = 0;
      if (ready && visible && !document.hidden && moving) frame = requestAnimationFrame(tick);
    };
    const resize = () => {
      const width = surface.getBoundingClientRect().width;
      if (!width) return;
      const ratio = Math.min(window.devicePixelRatio || 1, 1.5);
      drawing.width = Math.round(width * ratio);
      drawing.height = Math.round(width * 936 / 1681 * ratio);
      ctx.setTransform(drawing.width / 1681, 0, 0, drawing.height / 936, 0, 0);
      paint();
    };
    const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; resume(); }, { threshold: .05 });
    observer.observe(surface);
    const sizeObserver = new ResizeObserver(resize);
    sizeObserver.observe(surface);
    document.addEventListener("visibilitychange", resume);
    atlas.onload = () => {
      if (disposed) return;
      ready = true;
      surface.dataset.canvas = "ready";
      resize();
      resume();
    };
    atlas.onerror = () => { if (!disposed) surface.dataset.canvas = "unavailable"; };
    atlas.src = "/office/map-staff.webp";
    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      sizeObserver.disconnect();
      document.removeEventListener("visibilitychange", resume);
      atlas.onload = null;
      atlas.onerror = null;
    };
  }, [scene, sceneIndex, paused, reduced, replay, nextScene]);

  return <div className="office-showcase">
    <figure className="showcase-theatre" tabIndex={-1} aria-label="首客办公室协作情景演示" aria-describedby="office-demo-note">
      <div className="showcase-toolbar">
        <p><span className="showcase-demo-mark" aria-hidden="true" />协作情景演示<span className="showcase-toolbar-separator">/</span><span>{reduced ? "静态浏览" : paused ? "已暂停" : beatLabels[beat]}</span></p>
        <div className="showcase-controls">
          {!reduced ? <button type="button" onClick={() => setPaused((value) => !value)} aria-label={paused ? "播放办公室演示" : "暂停办公室演示"}>{paused ? <Play size={15} /> : <Pause size={15} />}<span>{paused ? "播放" : "暂停"}</span></button> : null}
          <button type="button" onClick={() => chooseScene(sceneIndex)} aria-label="重播当前协作片段"><RotateCcw size={15} /><span>重播</span></button>
          <button type="button" onClick={nextScene} aria-label="查看下一幕协作"><SkipForward size={15} /><span>下一幕</span></button>
        </div>
      </div>
      <div className="showcase-scene" ref={stage} data-canvas="loading" data-beat="0">
        <Image className="showcase-background" src="/office/floor-map.webp" width={1681} height={936} sizes="(max-width: 1200px) 94vw, 1180px" alt="" />
        <div className="showcase-fallback" aria-hidden="true">{Object.entries(desks).map(([key, desk]) => <span key={key} style={{ left: `${desk.home[0]}%`, top: `${desk.home[1]}%`, "--sprite": `${desk.sprite * 100 / 7}%` } as CSSProperties} />)}</div>
        <canvas ref={canvas} aria-hidden="true" className="showcase-actors" />
        {OFFICE_MEMBERS.map((member) => <button key={member.key} type="button" className="showcase-hotspot"
          ref={(element) => { hotspots.current[member.key] = element; }}
          style={{ left: `${desks[member.key].home[0]}%`, top: `${desks[member.key].home[1] - 7}%` }}
          aria-label={`观看${member.name}的${member.room}协作`} onClick={() => chooseScene(member.scene, member.key)}>
          <span>{member.name} · {member.room}</span>
        </button>)}
        {[scene.from, scene.to].map((key, index) => <div key={`${sceneIndex}-${index}`} ref={(element) => { bubbles.current[index] = element; }}
          className={`showcase-speech showcase-speech--${index}`} aria-hidden="true"
          style={{ left: `${desks[key].home[0]}%`, top: `${desks[key].home[1] - 15}%` }}>
          <strong>{demoMember(key).name}</strong><span>{scene.lines[index]}</span>
        </div>)}
        <span className="showcase-handoff" aria-hidden="true">{scene.document}<ArrowRight size={13} />交接中</span>
      </div>
      <div className="showcase-story">
        <div className="showcase-story-heading"><span>{String(sceneIndex + 1).padStart(2, "0")} / 06</span><h3>{scene.title}</h3></div>
        <div className="showcase-dialogue" aria-live="off">{[scene.from, scene.to].map((key, index) => <p key={`${sceneIndex}-${key}`} data-speaking={index === (beat < 2 ? 0 : 1)}><strong>{demoMember(key).name}</strong><span>{scene.lines[index]}</span></p>)}</div>
        <div className="showcase-time" aria-hidden="true"><span ref={progress} /></div>
      </div>
      <nav className="showcase-chapters" aria-label="选择办公室协作片段">{OFFICE_SCENES.map((item, index) => <button key={item.chapter} type="button" onClick={() => chooseScene(index)} aria-current={sceneIndex === index ? "step" : undefined}><span>{index + 1}</span>{item.chapter}</button>)}</nav>
      <p className="showcase-fallback-note">当前显示静态场景，仍可点选角色与片段查看协作内容。<button type="button" onClick={() => chooseScene(sceneIndex)}>重新加载动画</button></p>
      <figcaption id="office-demo-note">点击工位或下方角色，看看他们怎样配合。这里是情景演示，实际项目进度以工作台记录为准。</figcaption>
    </figure>
    <div className="showcase-team-heading"><h3>认识你的 AI 同事</h3><p>六种分工，一起把想法推进到真实验证。</p></div>
    <div className="showcase-team">{OFFICE_MEMBERS.map((member) => <article key={member.key} className="showcase-member" data-active={member.key === activeMember}>
      <div className="showcase-portrait" data-person={member.key} role="img" aria-label={`${member.animal}形象，${member.name}`} style={{ "--portrait-x": `${member.portrait[0] * 100 / 3}%`, "--portrait-y": `${member.portrait[1] * 100}%` } as CSSProperties} />
      <div className="showcase-member-copy"><p className="showcase-member-room">{member.room}</p><h4>{member.name}<span>{member.role}</span></h4>
        <p className="showcase-member-description">{member.description}</p><dl><div><dt>交付</dt><dd>{member.output}</dd></div><div><dt>协作</dt><dd>{member.collaboration}</dd></div></dl>
        <button type="button" onClick={() => watchMember(member.scene, member.key)} aria-pressed={member.key === activeMember} aria-label={`观看${member.name}的协作片段`}>{member.key === activeMember ? "正在了解" : "观看协作"}<ArrowUpRight size={16} aria-hidden="true" /></button>
      </div>
    </article>)}</div>
    <p className="showcase-owner-note">右上角还有金毛老板与绵羊 COO：一位把关关键审批，一位整理站会与经营复盘。</p>
  </div>;
}
