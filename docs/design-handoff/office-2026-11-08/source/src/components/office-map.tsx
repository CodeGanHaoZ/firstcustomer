import { LocalizedLink, LocalizedTag } from "@/components/localized-controls";
import { T } from "@/components/ui-text";
import { Check, FileText, Search, ChartNoAxesCombined, PencilLine, Keyboard, ClipboardCheck, Send } from "lucide-react";
import type { CSSProperties } from "react";
import { AGENT_STATE_LABELS, DEPARTMENTS, type AgentState, type DepartmentKey } from "@/domain/office";
import { OFFICE_CHARACTERS } from "@/lib/brand";

export type OfficeStation = {
  key: DepartmentKey;
  state: AgentState;
  detail: string;
  href?: string;
};

export type Point = readonly [x: number, y: number];
type Desk = {
  sprite: number;
  home: Point;
  screen: Point;
};
type Workstation = Desk & { exit: Point; label: Point };
type Person = DepartmentKey | "owner" | "coo";

// Coordinates are percentages of floor-map.webp, measured at each character's feet.
export const desks: Record<DepartmentKey, Workstation> & Record<"owner" | "coo", Desk> = {
  frontdesk: { sprite: 0, home: [18.5, 35], screen: [15.4, 27.7], exit: [25.4, 35.8], label: [16, 10.2] },
  research: { sprite: 1, home: [40, 34.1], screen: [36.5, 25.5], exit: [47.3, 34.6], label: [37.5, 10.2] },
  strategy: { sprite: 2, home: [60.8, 34.1], screen: [57.1, 25.2], exit: [68.8, 37.2], label: [59.7, 10.2] },
  finance: { sprite: 3, home: [16.2, 85.7], screen: [12.9, 77.6], exit: [24.1, 83.1], label: [15.5, 62] },
  launch: { sprite: 4, home: [35.7, 85.6], screen: [31.9, 77.5], exit: [47.8, 83.1], label: [34.8, 62] },
  growth: { sprite: 5, home: [57.5, 85.6], screen: [54, 77.6], exit: [71.6, 83.1], label: [58, 62] },
  owner: { sprite: 6, home: [81.6, 34.3], screen: [78.4, 25.5] },
  coo: { sprite: 7, home: [93, 34.3], screen: [89.5, 25.2] },
};

export const roomName = (key: DepartmentKey) => DEPARTMENTS.find((department) => department.key === key)?.room ?? key;
const workingTitles: Record<DepartmentKey, string> = { frontdesk: "整理任务 · 工作中", research: "查证据 · 工作中", strategy: "写定位 · 工作中", finance: "读凭证 · 工作中", launch: "做页面 · 工作中", growth: "做复盘 · 工作中" };
const position = ([x, y]: Point) => ({ "--at-x": `${x}%`, "--at-y": `${y}%` }) as CSSProperties;

function Actor({ person, working }: { person: Person; working: boolean }) {
  const desk = desks[person];
  const Tool = { research: Search, strategy: PencilLine, finance: ClipboardCheck, launch: Send, growth: ChartNoAxesCombined, frontdesk: Keyboard, owner: ClipboardCheck, coo: ChartNoAxesCombined }[person];
  return (
    <>
      <span className="office-map-screen" style={position(desk.screen)} data-working={working} aria-hidden="true" />
      <span className="office-actor" data-person={person} data-working={working} aria-hidden="true"
        style={{ "--home-x": `${desk.home[0]}%`, "--home-y": `${desk.home[1]}%`, "--sprite-x": `${desk.sprite * 100 / 7}%`, "--idle-delay": `${-desk.sprite * .61}s` } as CSSProperties}>
        <span className="office-actor-shadow" />
        <span className="office-work-tool"><Tool strokeWidth={2} /></span>
        <span className="office-actor-facing">
          <span className="office-actor-body" />
          <span className="office-actor-head" />
          <span className="office-actor-paws" />
          <span className="office-carried-file"><FileText strokeWidth={2.1} /></span>
        </span>
      </span>
    </>
  );
}

export function OfficeMap({ stations, cooWorking = false, customerView = false }: {
  stations?: OfficeStation[];
  cooWorking?: boolean;
  customerView?: boolean;
}) {
  return (
    <div className={stations ? "office-map" : "office-map office-map-static"} aria-hidden={stations ? undefined : true}>
      {stations?.map(({ key, state, detail, href }) => {
        const label = <><i aria-hidden="true">{state === "running" ? <><span /><span /><span /></> : null}</i><strong>{OFFICE_CHARACTERS[key].name} · <T>{roomName(key)}</T></strong>{!customerView || state !== "idle" ? <small><T>{state === "running" ? workingTitles[key] : AGENT_STATE_LABELS[state]}</T></small> : null}</>;
        const props = { className: "office-map-label", "data-state": state, "data-office-room": key, style: position(desks[key].label), title: `${OFFICE_CHARACTERS[key].name} · ${detail}` };
        return href ? <LocalizedLink key={key} href={href} {...props}>{label}</LocalizedLink> : <LocalizedTag as="button" type="button" key={key} {...props}>{label}</LocalizedTag>;
      })}
      {stations && !customerView ? <a className="office-map-label" style={position([85.5, 10.2])} href="#office-desk-title"><strong>{OFFICE_CHARACTERS.owner.name}<T> · 老板 / </T>{OFFICE_CHARACTERS.coo.name} · COO</strong></a> : null}
      {(stations ?? DEPARTMENTS).map((entry) => <Actor key={entry.key} person={entry.key} working={"state" in entry && entry.state === "running"} />)}
      <Actor person="owner" working={false} />
      <Actor person="coo" working={cooWorking} />
      <span className="office-receipt" aria-hidden="true"><Check size={16} strokeWidth={2.7} /></span>
    </div>
  );
}
