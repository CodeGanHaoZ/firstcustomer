import type { CSSProperties } from "react";
import Link from "next/link";
import { ArrowDownLeft, ArrowDownRight, ArrowUpRight, ClipboardList, FolderOpen, Grid2X2, Leaf, List, MapPin } from "lucide-react";
import { AGENT_STATE_LABELS, DEPARTMENTS, type DepartmentKey, type DepartmentView } from "@/domain/office";
import { STATUS_LABELS, type ProjectStatus } from "@/domain/workflow";
import { formatDateTime } from "@/lib/format";
import { OfficeConnection } from "./office-connection";

const rooms: Record<DepartmentKey, { scene: [number, number]; staff: [number, number]; name: string; anchor: string }> = {
  frontdesk: { scene: [0, 0], staff: [0, 0], name: "兔兔 · 接待报价", anchor: "frontdesk" },
  research: { scene: [50, 0], staff: [33.333, 0], name: "小枭 · Research", anchor: "research" },
  strategy: { scene: [100, 0], staff: [66.667, 0], name: "赤狐 · Strategy", anchor: "strategy" },
  finance: { scene: [0, 100], staff: [33.333, 100], name: "松栗 · 票据员", anchor: "finance" },
  launch: { scene: [50, 100], staff: [100, 0], name: "蓝狸 · Launch", anchor: "launch" },
  growth: { scene: [100, 100], staff: [0, 100], name: "芽芽 · Growth", anchor: "growth" },
};

const position = ([x, y]: [number, number]) => `${x}% ${y}%`;
const departmentTitle = (key: DepartmentKey) => DEPARTMENTS.find((room) => room.key === key)?.room ?? key;

type ProjectBrief = { id: string; productName: string; status: string; paused: boolean };
export type DeskItem = { id: string; title: string; action: string; href: string };

const activeRoom: Partial<Record<ProjectStatus, DepartmentKey>> = {
  submitted: "research", needs_info: "research", awaiting_quote: "frontdesk", awaiting_quote_acceptance: "frontdesk",
  awaiting_payment: "finance", awaiting_positioning: "strategy", awaiting_publish: "launch", reviewing: "growth",
};

function StaffSprite({ slot, className = "" }: { slot: [number, number]; className?: string }) {
  return <span aria-hidden="true" className={`office-sprite ${className}`} style={{ backgroundPosition: position(slot) }} />;
}

export function OfficeBoard({
  project, allProjects, departments, todo, waitingCount, overdueCount, stalled, firstPaymentAt, firstLeadAt, revision, listMode,
}: {
  project: ProjectBrief | null;
  allProjects: ProjectBrief[];
  departments: DepartmentView[];
  todo: DeskItem[];
  waitingCount: number;
  overdueCount: number;
  stalled: DeskItem[];
  firstPaymentAt: Date | null;
  firstLeadAt: Date | null;
  revision: string;
  listMode: boolean;
}) {
  const base = project ? `/admin/projects/${project.id}` : "/admin#projects";
  const modeUrl = project ? `/admin?project=${project.id}` : "/admin";
  const listUrl = project ? `${modeUrl}&view=list` : "/admin?view=list";
  const handoff = departments.flatMap(({ key, handoff }) => handoff ? [{ key, ...handoff }] : [])
    .sort((left, right) => right.at.getTime() - left.at.getTime())[0];
  return (
    <section aria-labelledby="office-title" className="office-board">
      <div className="office-heading">
        <div>
          <div className="office-title-row">
            <span className="office-emblem" aria-hidden="true"><Leaf size={26} strokeWidth={2.3} /></span>
            <h1 id="office-title">首客办公室</h1>
          </div>
          <OfficeConnection revision={revision} updatedAt={new Date().toISOString()} />
        </div>
        <div className="office-view-controls">
          <Link href={modeUrl} aria-current={listMode ? undefined : "page"} className="office-scene-switch"><Grid2X2 size={15} /> 办公室</Link>
          <Link href={listUrl} aria-current={listMode ? "page" : undefined}><List size={17} /> 列表</Link>
        </div>
      </div>

      <div className="office-toolbar">
        <form action="/admin" method="get" className="office-project-picker">
          <MapPin size={18} aria-hidden="true" />
          <label htmlFor="office-project">当前项目</label>
          {listMode ? <input type="hidden" name="view" value="list" /> : null}
          <select id="office-project" name="project" defaultValue={project?.id ?? ""} disabled={!allProjects.length}>
            {allProjects.length ? allProjects.map((entry) => (
              <option key={entry.id} value={entry.id}>{entry.productName}</option>
            )) : <option value="">暂无项目</option>}
          </select>
          <button type="submit" disabled={!allProjects.length}>切换</button>
        </form>
        {project ? <span className="office-project-status">{project.paused ? "已暂停 · " : ""}{STATUS_LABELS[project.status as ProjectStatus]}</span> : null}
      </div>

      <div className="office-layout">
        <div className={`office-rooms ${listMode ? "office-rooms-list" : ""}`}>
          {!project ? <p className="office-empty">新建项目后，就可以在各工位开始工作。</p> : null}
          {DEPARTMENTS.map(({ key, duty }) => {
            const room = rooms[key];
            const entry = departments.find((department) => department.key === key);
            const state = entry?.state ?? "idle";
            const anchor = state === "failed" || activeRoom[project?.status as ProjectStatus] === key ? "decisions" : room.anchor;
            const content = (
              <>
                <div className="office-room-scene" style={{ "--scene": position(room.scene) } as CSSProperties}>
                  <span className="office-room-set" aria-hidden="true" />
                  <StaffSprite slot={room.staff} className="office-room-mascot" />
                  <span className="office-state"><i aria-hidden="true" />{AGENT_STATE_LABELS[state]}</span>
                </div>
                <div className="office-room-caption">
                  <div>
                    <h2>{departmentTitle(key)}</h2>
                    <p>{room.name}</p>
                  </div>
                  {project ? <ArrowUpRight size={18} aria-hidden="true" /> : null}
                </div>
                <p className="office-room-detail">
                  {entry?.detail ?? duty}
                  {entry?.runningSince ? ` · ${formatDateTime(entry.runningSince)} 开始` : ""}
                </p>
              </>
            );
            return project
              ? <Link key={key} href={`${base}#${anchor}`} className="office-room" data-state={state}>{content}</Link>
              : <article key={key} className="office-room" data-state={state}>{content}</article>;
          })}
        </div>

        <aside className="office-desk" aria-labelledby="office-desk-title">
          <div className="office-desk-staff">
            <StaffSprite slot={[100, 100]} />
            <StaffSprite slot={[66.667, 100]} />
          </div>
          <div className="office-desk-heading">
            <h2 id="office-desk-title">老板工位</h2>
            <span>COO · 云团</span>
          </div>
          <div className="office-milestones">
            <div><span>首客第一单</span><strong>{firstPaymentAt ? formatDateTime(firstPaymentAt) : "待确认到账"}</strong></div>
            <div><span>客户第一单</span><strong>{firstLeadAt ? formatDateTime(firstLeadAt) : "等待有效留资"}</strong></div>
          </div>
          <div className="office-desk-heading">
            <h3>待我决定</h3>
            <span className="office-task-count">{todo.length}</span>
          </div>
          {todo.length ? (
            <ul className="office-todos">
              {todo.slice(0, 4).map(({ id, title, action, href }) => (
                <li key={id}>
                  <Link href={href}>
                    <span><strong>{action}</strong><small>{title}</small></span>
                    <ArrowUpRight size={15} aria-hidden="true" />
                  </Link>
                </li>
              ))}
            </ul>
          ) : <p className="office-no-todos">眼下没有待处理的审批。</p>}
          {waitingCount ? <Link href="#waiting" className="office-desk-link">等客户处理（{waitingCount}）<ArrowDownLeft size={15} /></Link> : null}
          {stalled.length ? <Link href={stalled[0].href} className="office-desk-link office-desk-alert"><span>{stalled[0].title} · {stalled[0].action}{stalled.length > 1 ? `，共 ${stalled.length} 项` : ""}</span><ArrowUpRight size={15} /></Link> : null}
          {overdueCount ? <Link href="#overdue" className="office-desk-link office-desk-alert">超时待办（{overdueCount}）<ArrowDownLeft size={15} /></Link> : null}
          <Link href="/admin/tasks" className="office-desk-link"><ClipboardList size={16} /> 任务板 <ArrowUpRight size={15} /></Link>
          {project ? <Link href={`${base}#deliverables`} className="office-desk-link"><FolderOpen size={16} /> 交付清单 <ArrowDownRight size={15} /></Link> : null}
          <Link href="#standup" className="office-desk-link">COO 每日站会 <ArrowDownLeft size={15} /></Link>
          {todo.length > 2 ? <Link href="#pending" className="office-desk-link">查看全部待办 <ArrowDownLeft size={15} /></Link> : null}
        </aside>
      </div>
      {handoff ? (
        <Link href={`${base}#task-${handoff.id}`} className="office-handoff">
          <strong>最近一次打回 · {departmentTitle(handoff.key)} → {departmentTitle(handoff.to)}</strong>
          <span>{handoff.reason}</span>
          <ArrowUpRight size={16} aria-hidden="true" />
        </Link>
      ) : null}
    </section>
  );
}
