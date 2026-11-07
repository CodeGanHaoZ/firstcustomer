"use client";

import { ArrowRight, ArrowUpRight, Focus, CircleCheck, UserRound, Pause, Play, RotateCcw, SkipForward } from "lucide-react";
import Image from "next/image";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type CSSProperties } from "react";
import type { DepartmentKey } from "@/domain/office";
import { characterDisplayName } from "@/lib/brand";
import { DEMO_DURATION, OFFICE_TIMING, OFFICE_MEMBERS, getOfficeMembers, getOfficeScenes, demoMember } from "@/lib/office-showcase";
import { OFFICE_PHASES, officeStory } from "@/lib/office-story";
import { OFFICE_COPY } from "@/lib/home-copy";
import type { Locale } from "@/lib/locale";
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

export function OfficeShowcase({ locale = "zh" }: { locale?: Locale }) {
  const copy = OFFICE_COPY[locale];
  const members = getOfficeMembers(locale);
  const scenes = getOfficeScenes(locale);
  const sceneCount = scenes.length;
  const reduced = useSyncExternalStore(subscribeMotion, reducedSnapshot, serverSnapshot);
  const [sceneIndex, setSceneIndex] = useState(0);
  const [beat, setBeat] = useState(0);
  const [phase, setPhase] = useState(0);
  const [paused, setPaused] = useState(false);
  const [replay, setReplay] = useState(0);
  const stage = useRef<HTMLDivElement>(null);
  const windowRef = useRef<HTMLDivElement>(null);
  const followCamera = useRef(true);
  const canvas = useRef<HTMLCanvasElement>(null);
  const progress = useRef<HTMLSpanElement>(null);
  const bubbles = useRef<(HTMLDivElement | null)[]>([]);
  const hotspots = useRef<Partial<Record<DepartmentKey, HTMLButtonElement | null>>>({});
  const clock = useRef({ key: "", elapsed: 0 });
  const requestedElapsed = useRef<number | null>(null);
  const scene = scenes[sceneIndex];
  const story = officeStory(sceneIndex, locale);
  const currentActor = phase >= 3 ? scene.to : scene.from;
  const activeMember = currentActor;
  const t = (zh: string, en: string) => locale === "en" ? en : zh;
  const nextScene = useCallback(() => {
    requestedElapsed.current = null;
    setSceneIndex((current) => (current + 1) % sceneCount);
    setBeat(0);
    setPhase(0);
    followCamera.current = true;
  }, [sceneCount]);

  const chooseScene = (index: number) => {
    requestedElapsed.current = null;
    setSceneIndex(index);
    setBeat(0);
    setPhase(0);
    followCamera.current = true;
    setReplay((value) => value + 1);
    setPaused(false);
    windowRef.current?.scrollIntoView({ block: "nearest", behavior: reduced ? "instant" : "smooth" });
  };
  const jumpToStage = (step: number) => {
    requestedElapsed.current = [0, OFFICE_TIMING.meet, OFFICE_TIMING.home][step];
    followCamera.current = true;
    setReplay((value) => value + 1);
    setPaused(false);
  };
  const watchMember = (index: number) => {
    chooseScene(index);
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
    if (clock.current.key !== key) {
      clock.current = { key, elapsed: requestedElapsed.current ?? 0 };
      requestedElapsed.current = null;
    }
    const atlas = new window.Image();
    let ready = false;
    let disposed = false;
    let visible = false;
    let frame = 0;
    let previous = 0;
    let lastPaint = 0;
    let lastBeat = -1;
    let lastPhase = -1;
    const moving = !paused && !reduced;

    const paint = () => {
      if (!ready || disposed) return;
      const pose = drawOfficeActors(ctx, atlas, scene, clock.current.elapsed, moving);
      surface.dataset.beat = String(pose.beat);
      surface.dataset.phase = String(pose.phase);
      if (lastPhase !== pose.phase) { lastPhase = pose.phase; setPhase(pose.phase); }
      const camera = windowRef.current;
      if (camera && followCamera.current && camera.scrollWidth > camera.clientWidth) {
        const target = pose.phase >= 3 ? pose.receiver : pose.sender;
        const desired = target.point[0] * surface.offsetWidth / 100 - camera.clientWidth / 2;
        camera.scrollLeft = moving ? camera.scrollLeft + (desired - camera.scrollLeft) * .12 : desired;
      }
      if (lastBeat !== pose.beat) { lastBeat = pose.beat; setBeat(pose.beat); }
      if (progress.current) progress.current.style.transform = `scaleX(${pose.progress})`;
      for (const member of OFFICE_MEMBERS) {
        const actor = member.key === scene.from ? pose.sender : member.key === scene.to ? pose.receiver : { point: desks[member.key].home };
        const button = hotspots.current[member.key];
        if (button) { button.style.left = `${actor.point[0]}%`; button.style.top = `${actor.point[1] - 7}%`; }
      }
      for (const [index, actor] of [pose.sender, pose.receiver].entries()) {
        const bubble = bubbles.current[index];
        if (bubble) { bubble.style.left = `${Math.max(13, Math.min(86, actor.point[0]))}%`; bubble.style.top = `${actor.point[1] > 65 ? 43 : actor.point[1] + 5}%`; }
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
    <figure className="showcase-theatre" tabIndex={-1} aria-label={copy.label}>
      <div className="showcase-toolbar">
        <p><span className="showcase-demo-mark" aria-hidden="true" />{copy.demo}<span className="showcase-toolbar-separator">/</span><span>{reduced ? copy.static : paused ? copy.paused : copy.beats[beat]}</span></p>
        <div className="showcase-controls">
          {!reduced ? <button type="button" onClick={() => setPaused((value) => !value)} aria-label={paused ? copy.playLabel : copy.pauseLabel}>{paused ? <Play size={15} /> : <Pause size={15} />}<span>{paused ? copy.play : copy.pause}</span></button> : null}
          <button type="button" onClick={() => chooseScene(sceneIndex)} aria-label={copy.replayLabel}><RotateCcw size={15} /><span>{copy.replay}</span></button>
          <button type="button" onClick={nextScene} aria-label={copy.nextLabel}><SkipForward size={15} /><span>{copy.next}</span></button>
        </div>
      </div>
      <div className="showcase-guide" aria-label={t("协作流程说明", "How this collaboration works")}>
        <div className="showcase-guide-now"><span className="showcase-working-label"><span aria-hidden="true" />{t("本段演示任务", "Task in this demo")}</span><h3>{demoMember(scene.from, locale).name} · {story.task}</h3><p><strong>{t("完成后交出", "Delivers")}</strong>{story.output}</p></div>
        <div className="showcase-guide-next"><ArrowRight size={22} aria-hidden="true" /><div><span>{t("下一位伙伴", "Next teammate")}</span><h4>{story.next}</h4><p>{story.condition}</p></div></div>
      </div>
      <nav className="showcase-steps" aria-label={t("查看协作演示的三个阶段", "Explore the three stages of the demo")}>{[t("处理任务", "Working"), t("当面交接", "Handoff"), t("接手开工", "Next task")].map((label, index) => <button type="button" key={index} aria-current={(phase < 2 ? 0 : phase < 5 ? 1 : 2) === index ? "step" : undefined} onClick={() => jumpToStage(index)}><span>{index + 1}</span>{label}<ArrowRight size={14} aria-hidden="true" /></button>)}</nav>
      <div className="showcase-phase-line" aria-live="off"><strong>{OFFICE_PHASES[locale][phase]}</strong><span>{phase === 5 ? story.next : phase >= 2 ? `${demoMember(scene.from, locale).name} → ${demoMember(scene.to, locale).name} · ${scene.document}` : `${demoMember(scene.from, locale).name} · ${story.task}`}</span><button type="button" onClick={() => { followCamera.current = true; const view = windowRef.current; if (view) view.scrollLeft = desks[currentActor].home[0] * view.scrollWidth / 100 - view.clientWidth / 2; }}><Focus size={15} />{t("跟随当前 Agent", "Follow current agent")}</button></div>
      <div className="showcase-window" ref={windowRef} tabIndex={0} role="region" aria-label={t("可左右滑动的办公室演示", "Office demo. Scroll horizontally to explore")} onPointerDown={() => { followCamera.current = false; }} onWheel={() => { followCamera.current = false; }}>
      <div className="showcase-scene" ref={stage} data-canvas="loading" data-beat="0">
        <Image className="showcase-background" src="/office/floor-map.webp" width={1681} height={936} sizes="(max-width: 1200px) 94vw, 1180px" alt="" />
        <div className="showcase-fallback" aria-hidden="true">{Object.entries(desks).map(([key, desk]) => <span key={key} style={{ left: `${desk.home[0]}%`, top: `${desk.home[1]}%`, "--sprite": `${desk.sprite * 100 / 7}%` } as CSSProperties} />)}</div>
        <canvas ref={canvas} aria-hidden="true" className="showcase-actors" />
        {members.map((member) => <button key={member.key} type="button" className="showcase-hotspot" data-participant={member.key === scene.from ? "sender" : member.key === scene.to ? "receiver" : "other"}
          ref={(element) => { hotspots.current[member.key] = element; }}
          style={{ left: `${desks[member.key].home[0]}%`, top: `${desks[member.key].home[1] - 7}%` }}
          aria-label={locale === "en" ? `Watch ${member.name} collaborate in the ${member.room}` : `观看${member.name}的${member.room}协作`} onClick={() => chooseScene(member.scene)}>
          <span className="showcase-desk-title" data-active={member.key === currentActor}>{member.name}<small>{member.key === scene.from ? phase === 0 ? t("正在工作", "Working") : phase < 4 ? t("正在交接", "Handing off") : t("本步已完成", "Step complete") : member.key === scene.to ? phase === 5 ? t("接手开工", "Working next") : phase >= 2 ? t("正在接收", "Receiving") : t("下一位接手", "Up next") : member.room}</small></span>
        </button>)}
        {[scene.from, scene.to].map((key, index) => <div key={`${sceneIndex}-${index}`} ref={(element) => { bubbles.current[index] = element; }}
          className={`showcase-speech showcase-speech--${index}`} aria-hidden="true"
          style={{ left: `${desks[key].home[0]}%`, top: `${desks[key].home[1] > 65 ? 43 : desks[key].home[1] + 5}%` }}>
          <strong>{demoMember(key, locale).name}</strong><span>{scene.lines[index]}</span>
        </div>)}
        <span className="showcase-handoff" aria-hidden="true">{scene.document}<ArrowRight size={13} />{copy.handoff}</span>
      </div>
      </div>
      <div className="showcase-user-step"><UserRound size={18} aria-hidden="true" /><p><strong>{t("流程中，你来决定", "Your part in the process")}</strong>{story.action}</p><CircleCheck size={18} aria-hidden="true" /></div>
      <div className="showcase-story">
        <div className="showcase-story-heading"><span>{String(sceneIndex + 1).padStart(2, "0")} / 06</span><h3>{scene.title}</h3></div>
        <div className="showcase-dialogue" aria-live="off">{[scene.from, scene.to].map((key, index) => <p key={`${sceneIndex}-${key}`} data-speaking={index === (beat < 2 ? 0 : 1)}><strong>{demoMember(key, locale).name}</strong><span>{scene.lines[index]}</span></p>)}</div>
        <div className="showcase-time" aria-hidden="true"><span ref={progress} /></div>
      </div>
      <nav className="showcase-chapters" aria-label={copy.chapters}>{scenes.map((item, index) => <button key={index} type="button" onClick={() => chooseScene(index)} aria-current={sceneIndex === index ? "step" : undefined}><span>{index + 1}</span>{item.chapter}</button>)}</nav>
      <p className="showcase-fallback-note">{copy.fallback}<button type="button" onClick={() => chooseScene(sceneIndex)}>{copy.retry}</button></p>
    </figure>
    <div className="showcase-team-heading"><h3>{copy.team}</h3><p>{copy.teamDescription}</p></div>
    <div className="showcase-team">{members.map((member) => <article key={member.key} className="showcase-member" data-active={member.key === activeMember}>
      <div className="showcase-portrait" data-person={member.key} role="img" aria-label={locale === "en" ? `${member.name}, ${member.animal}` : `${member.animal}形象，${member.name}`} style={{ "--portrait-x": `${member.portrait[0] * 100 / 3}%`, "--portrait-y": `${member.portrait[1] * 100}%` } as CSSProperties} />
      <div className="showcase-member-copy"><p className="showcase-member-room">{member.room}</p><h4>{member.name}<span>{member.role}</span></h4>
        <p className="showcase-member-description">{member.description}</p><dl><div><dt>{copy.output}</dt><dd>{member.output}</dd></div><div><dt>{copy.collaboration}</dt><dd>{member.collaboration}</dd></div></dl>
        <button type="button" onClick={() => watchMember(member.scene)} aria-pressed={member.key === activeMember} aria-label={locale === "en" ? `Watch ${member.name}'s collaboration scene` : `观看${member.name}的协作片段`}>{member.key === activeMember ? copy.selected : copy.watch}<ArrowUpRight size={16} aria-hidden="true" /></button>
      </div>
    </article>)}</div>
    <p className="showcase-owner-note">{copy.supporting} <strong>{characterDisplayName("owner", locale)}</strong> · {copy.owner}{locale === "en" ? "; " : "；"}<strong>{characterDisplayName("coo", locale)}</strong> · {copy.coo}{locale === "en" ? "." : "。"}</p>
  </div>;
}
