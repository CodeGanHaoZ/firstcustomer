"use client";

import { T, I18n } from "@/components/ui-text";

import { ArrowRight, Pause, Play, RotateCcw } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import type { DepartmentKey, OfficeTransfer } from "@/domain/office";
import { desks, roomName, type Point } from "./office-map";

const aisle = 52.1;
const recentTransferMs = 20_000;
const previewRoute = { from: "strategy", to: "launch" } as const;
const reducedMotionQuery = "(prefers-reduced-motion: reduce)";
const reducedMotionSnapshot = () => window.matchMedia(reducedMotionQuery).matches;
const reducedMotionServerSnapshot = () => false;
function subscribeReducedMotion(listener: () => void) {
  const query = window.matchMedia(reducedMotionQuery);
  query.addEventListener("change", listener);
  return () => query.removeEventListener("change", listener);
}

function route(points: Point[]) {
  let length = 0;
  let face = -1;
  const legs = points.slice(1).map((to, index) => {
    const from = points[index];
    const dx = to[0] - from[0];
    const dy = to[1] - from[1];
    const distance = Math.hypot(dx, dy * 936 / 1681);
    const start = length;
    length += distance;
    if (Math.abs(dx) > .1) face = Math.sign(dx);
    return { from, dx, dy, distance, start, face };
  });
  return { length, legs };
}

function pose(path: ReturnType<typeof route>, fraction: number, returning = false) {
  const traveled = Math.max(0, Math.min(1, fraction)) * path.length;
  const distance = returning ? path.length - traveled : traveled;
  const leg = path.legs.find(({ start, distance: span }) => distance <= start + span) ?? path.legs[path.legs.length - 1];
  const progress = (distance - leg.start) / leg.distance;
  return {
    point: [leg.from[0] + leg.dx * progress, leg.from[1] + leg.dy * progress] as Point,
    face: returning ? -leg.face : leg.face,
    // The desk conceals the lower body until the character is near its edge.
    cut: leg === path.legs[0] ? Math.min(24, 68 * (1 - progress)) : 0,
  };
}

function move(actor: HTMLElement, point: Point, face: number, cut: number, walking: boolean, carrying: boolean) {
  actor.style.setProperty("--at-x", `${point[0]}%`);
  actor.style.setProperty("--at-y", `${point[1]}%`);
  actor.style.setProperty("--face", String(face));
  actor.style.setProperty("--cut", `${cut}%`);
  actor.dataset.moving = "true";
  actor.dataset.walking = String(walking);
  actor.dataset.carrying = String(carrying);
}

function reset(actor: HTMLElement) {
  for (const property of ["--at-x", "--at-y", "--face", "--cut"]) actor.style.removeProperty(property);
  delete actor.dataset.moving;
  delete actor.dataset.walking;
  delete actor.dataset.carrying;
}

export function OfficeStage({ transfer, viewControl, children, customerView = false, focusRoom }: {
  transfer: OfficeTransfer | null;
  viewControl?: ReactNode;
  children: ReactNode;
  customerView?: boolean;
  focusRoom?: DepartmentKey;
}) {
  const hintId = useId();
  const motionHintId = useId();
  const viewport = useRef<HTMLDivElement>(null);
  const active = useRef<(() => void) | null>(null);
  const seen = useRef<string | null>(null);
  const follow = useRef(false);
  const [playing, setPlaying] = useState<"demo" | "handoff" | null>(null);
  const [paused, setPaused] = useState(false);
  const [inView, setInView] = useState(false);
  const reducedMotion = useSyncExternalStore(subscribeReducedMotion, reducedMotionSnapshot, reducedMotionServerSnapshot);
  const motionEnabled = inView && !paused && !reducedMotion;

  const play = useCallback((from: DepartmentKey, to: DepartmentKey, mode: "demo" | "handoff", reveal = false) => {
    const reduce = window.matchMedia(reducedMotionQuery);
    if (!motionEnabled || reduce.matches || from === to) return;
    const scroll = viewport.current;
    const map = scroll?.querySelector<HTMLElement>(".office-map");
    const check = map?.querySelector<HTMLElement>(".office-receipt");
    const sender = map?.querySelector<HTMLElement>(`[data-person="${from}"]`);
    const receiver = map?.querySelector<HTMLElement>(`[data-person="${to}"]`);
    const fromDesk = desks[from];
    const toDesk = desks[to];
    if (!map || !scroll || !check || !sender || !receiver) return;
    active.current?.();
    follow.current = reveal;
    setPlaying(mode);

    const [fromDoor] = fromDesk.exit;
    const [toDoor] = toDesk.exit;
    const side = fromDoor < toDoor ? -1 : 1;
    const meet: Point = [toDoor, toDesk.home[1] < aisle ? 45.7 : 55.6];
    const delivery: Point = [meet[0] + side * 4.8, meet[1] + (meet[1] < aisle ? .75 : -.5)];
    const outbound = route([fromDesk.home, fromDesk.exit, [fromDoor, aisle], [delivery[0], aisle], delivery]);
    const pickup = route([toDesk.home, toDesk.exit, meet]);
    const walkTime = Math.max(1050, outbound.length * 48);
    const pickupTime = pickup.length * 48;
    const leaveAt = 430;
    const meetAt = leaveAt + Math.max(walkTime, pickupTime);
    const handAt = meetAt + 410;
    const returnAt = handAt + 510;
    const doneAt = returnAt + walkTime + 150;
    check.style.setProperty("--at-x", `${(delivery[0] + meet[0]) / 2}%`);
    check.style.setProperty("--at-y", `${meet[1] - 12}%`);

    let frame = 0;
    let start: number | undefined;
    const stop = () => {
      window.cancelAnimationFrame(frame);
      reset(sender);
      reset(receiver);
      delete check.dataset.visible;
      active.current = null;
    };
    active.current = stop;
    const tick = (now: number) => {
      start ??= now;
      const t = now - start;
      if (t >= doneAt || reduce.matches || document.visibilityState !== "visible" || scroll.dataset.inView !== "true") {
        stop();
        setPlaying(null);
        return;
      }

      const returning = t >= returnAt;
      const senderProgress = returning ? (t - returnAt) / walkTime : (t - meetAt + walkTime) / walkTime;
      const receiverProgress = returning ? (t - returnAt) / pickupTime : (t - meetAt + pickupTime) / pickupTime;
      const courier = pose(outbound, senderProgress, returning);
      const colleague = pose(pickup, receiverProgress, returning);
      const exchanging = t >= meetAt && !returning;
      if (follow.current) {
        const viewWidth = scroll.clientWidth;
        const x = courier.point[0] * map.offsetWidth / 100;
        const left = scroll.scrollLeft;
        if (x > left + viewWidth * .73) scroll.scrollLeft = x - viewWidth * .73;
        if (x < left + viewWidth * .27) scroll.scrollLeft = x - viewWidth * .27;
      }

      move(sender, courier.point, exchanging ? -side : senderProgress <= 0 ? -1 : courier.face,
        courier.cut, senderProgress > 0 && senderProgress < 1, t > 150 && t < handAt);
      if (receiverProgress > 0) {
        move(receiver, colleague.point, exchanging ? side : colleague.face,
          colleague.cut, receiverProgress < 1, t >= handAt && !(returning && receiverProgress >= 1));
      }
      check.dataset.visible = String(t >= handAt && t < returnAt + 230);
      frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);
  }, [motionEnabled]);

  useEffect(() => {
    if (!transfer || !motionEnabled) return;
    const frame = window.requestAnimationFrame(() => {
      if (seen.current === transfer.id) return;
      seen.current = transfer.id;
      const online = !viewport.current?.closest(".office-board")?.querySelector('.office-connection[data-offline="true"]');
      if (online && Date.now() - Date.parse(transfer.at) < recentTransferMs) play(transfer.from, transfer.to, "handoff");
    });
    return () => window.cancelAnimationFrame(frame);
  }, [transfer, play, motionEnabled]);
  useEffect(() => () => active.current?.(), []);

  useEffect(() => {
    const scroll = viewport.current;
    if (!scroll) return;
    let intersecting = false;
    const update = () => {
      const visible = intersecting && document.visibilityState === "visible";
      scroll.dataset.inView = String(visible);
      setInView(visible);
      if (!visible) {
        active.current?.();
        setPlaying(null);
      }
    };
    const observer = new IntersectionObserver(([entry]) => {
      intersecting = entry.isIntersecting;
      update();
    });
    const visibility = () => {
      update();
    };
    observer.observe(scroll);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", visibility);
    };
  }, []);

  useEffect(() => {
    const scroll = viewport.current;
    if (!customerView || !scroll || !focusRoom || scroll.scrollWidth <= scroll.clientWidth) return;
    const [x] = desks[focusRoom].home;
    scroll.scrollLeft = scroll.scrollWidth * x / 100 - scroll.clientWidth / 2;
  }, [customerView, focusRoom]);

  return (
    <div className="office-stage" data-motion-demo={playing === "demo"} data-customer-view={customerView} data-motion-paused={!motionEnabled}>
      <div className="office-stage-bar">
        <p className="office-transfer-summary" role="status">
          {playing === "demo" ? (
            <><T>交接演示 </T><strong><T>{roomName(previewRoute.from)}</T></strong><ArrowRight size={14} aria-hidden="true" /><strong><T>{roomName(previewRoute.to)}</T></strong></>
          ) : transfer ? (
            <><T>最近交接 </T><strong><T>{roomName(transfer.from)}</T></strong><ArrowRight size={14} aria-hidden="true" /><strong><T>{roomName(transfer.to)}</T></strong></>
          ) : <T>工位动作随任务状态更新。</T>}
        </p>
        <div className="office-stage-actions">
          {viewControl}
          <div className="office-motion-controls" aria-describedby={motionHintId}>
            {reducedMotion ? <span className="office-motion-preference"><T>系统已减少动态</T></span> : <button className="office-control" type="button" aria-pressed={paused} onClick={() => {
              active.current?.();
              setPlaying(null);
              setPaused((value) => !value);
            }}>{paused ? <Play size={14} aria-hidden="true" /> : <Pause size={14} aria-hidden="true" />}<T>{paused ? "恢复动效" : "暂停动效"}</T></button>}
            {transfer ? <button className="office-control" type="button" disabled={!motionEnabled || playing !== null} onClick={() => play(transfer.from, transfer.to, "handoff", true)}><RotateCcw size={14} aria-hidden="true" /><T>重播上次交接</T></button> : null}
            <button className="office-control office-control-primary" type="button" disabled={!motionEnabled || playing !== null} onClick={() => play(previewRoute.from, previewRoute.to, "demo", true)}><Play size={14} aria-hidden="true" /><T>演示交接</T></button>
          </div>
        </div>
      </div>
      <p className="office-motion-note" id={motionHintId}><T>{reducedMotion ? "已按系统设置减少动态，工位与交接信息仍可查看。" : paused ? "动效已暂停，恢复后继续显示工位状态。" : "待机时轻轻活动，工作时敲键盘。演示交接仅预览动作，不会推进项目。"}</T></p>
      <p className="office-pan-hint" id={hintId}><T>左右滑动查看整间办公室</T></p>
      <I18n><div className="office-map-viewport" role="region" aria-label={customerView ? "当前项目的办公室地图" : "首客办公室地图"} aria-describedby={hintId} tabIndex={0} ref={viewport}
        onPointerDown={() => { follow.current = false; }} onWheel={() => { follow.current = false; }}>
        {children}
      </div></I18n>
    </div>
  );
}
