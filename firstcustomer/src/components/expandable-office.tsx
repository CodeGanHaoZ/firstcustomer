"use client";

import { Maximize2, Minimize2 } from "lucide-react";
import { useEffect, useId, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import type { DepartmentKey, OfficeTransfer } from "@/domain/office";
import { OFFICE_CHARACTERS } from "@/lib/brand";
import { useLocale } from "./locale-provider";
import { OfficeMap, desks, type OfficeStation } from "./office-map";
import { OfficeStage } from "./office-stage";

export function ExpandableOffice({ stations, transfer = null, focusRoom = "frontdesk", title, detail, ambientHandoffs = false }: {
  stations: OfficeStation[]; transfer?: OfficeTransfer | null; focusRoom?: DepartmentKey; title: string; detail: string; ambientHandoffs?: boolean;
}) {
  const en = useLocale() === "en";
  const [expanded, setExpanded] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const active = stations.find((item) => item.state === "running")?.key ?? focusRoom;
  const [x, y] = desks[active].home;
  useEffect(() => {
    if (!expanded || !dialog.current) return;
    const modal = dialog.current;
    const triggerButton = trigger.current;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    modal.showModal();
    return () => { modal.close(); document.body.style.overflow = previous; triggerButton?.focus(); };
  }, [expanded]);
  return <>
    <section className="office-peek" aria-label={en ? "Office status" : "办公室状态"}>
      <div className="office-peek__scene" aria-hidden="true" inert style={{ "--desk-x": `${x * 8.4}px`, "--desk-y": `${y * 8.4 * 936 / 1681}px` } as CSSProperties}>
        <OfficeMap stations={stations.filter((item) => item.key === active)} customerView />
      </div>
      <div className="office-peek__copy"><p>{OFFICE_CHARACTERS[active].name} · {title}</p><span>{detail}</span></div>
      <button ref={trigger} type="button" className="office-peek__expand" onClick={() => setExpanded(true)} aria-haspopup="dialog" aria-expanded={expanded}>
        <Maximize2 size={17} aria-hidden="true" /><span>{en ? "Expand office" : "放大办公室"}</span>
      </button>
    </section>
    {expanded ? createPortal(<dialog ref={dialog} className="office-fullscreen" aria-labelledby={titleId}
      onCancel={(event) => { event.preventDefault(); setExpanded(false); }}
      onClick={(event) => { if (event.target === event.currentTarget) setExpanded(false); }}>
      <header className="office-fullscreen__header"><div><h2 id={titleId}>{en ? "Inside the office" : "办公室全景"}</h2><p>{title} · {detail}</p></div>
        <button type="button" onClick={() => setExpanded(false)} autoFocus><Minimize2 size={18} aria-hidden="true" />{en ? "Minimize" : "缩小办公室"}</button>
      </header>
      <div className="office-fullscreen__scene"><OfficeStage transfer={transfer} customerView focusRoom={active} stations={stations} ambientHandoffs={ambientHandoffs}>
        <OfficeMap stations={stations} customerView />
      </OfficeStage></div>
    </dialog>, document.body) : null}
  </>;
}
