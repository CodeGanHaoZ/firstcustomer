import type { CSSProperties } from "react";
import Link from "next/link";
import { ArrowDownLeft, ArrowDownRight, ArrowUpRight, FolderOpen, Grid2X2, List } from "lucide-react";
import { AGENT_LABELS, AGENT_STATE_LABELS, DEPARTMENTS, type DepartmentKey, type DepartmentView, type OfficeTransfer } from "@/domain/office";
import { STATUS_LABELS, type ProjectStatus } from "@/domain/workflow";
import { OFFICE_CHARACTERS, characterDisplayName } from "@/lib/brand";
import { formatDateTime } from "@/lib/format";
import { OfficeConnection } from "./office-connection";
import { OfficeMap, roomName, type OfficeStation } from "./office-map";
import { OfficeStage } from "./office-stage";

const rooms: Record<DepartmentKey, { scene: string; name: string }> = {
  frontdesk: { scene: "0 0", name: AGENT_LABELS.quote },
  research: { scene: "50% 0", name: AGENT_LABELS.research },
  strategy: { scene: "100% 0", name: AGENT_LABELS.strategy },
  finance: { scene: "0 100%", name: AGENT_LABELS.receipt },
  launch: { scene: "50% 100%", name: AGENT_LABELS.launch },
  growth: { scene: "100% 100%", name: AGENT_LABELS.growth },
};

type ProjectBrief = { id: string; productName: string; status: string; paused: boolean };
export type DeskItem = { id: string; title: string; action: string; href: string };

const activeRoom: Partial<Record<ProjectStatus, DepartmentKey>> = {
  submitted: "research", needs_info: "research", awaiting_quote: "frontdesk", awaiting_quote_acceptance: "frontdesk",
  awaiting_payment: "finance", awaiting_positioning: "strategy", awaiting_publish: "launch", reviewing: "growth",
};

export function OfficeBoard({
  project, allProjects, departments, transfer, cooWorking, todo, waitingCount, overdueCount, stalled,
  firstPaymentAt, firstLeadAt, revision, listMode,
}: {
  project: ProjectBrief | null;
  allProjects: ProjectBrief[];
  departments: DepartmentView[];
  transfer: OfficeTransfer | null;
  cooWorking: boolean;
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
  const stations: OfficeStation[] = DEPARTMENTS.map(({ key, duty }) => {
    const entry = departments.find((department) => department.key === key);
    const state = entry?.state ?? "idle";
    const anchor = state === "failed" || activeRoom[project?.status as ProjectStatus] === key ? "decisions" : key;
    const since = entry?.runningSince ? ` · ${formatDateTime(entry.runningSince)} 开始` : "";
    return { key, state, detail: (entry?.detail ?? duty) + since, href: project ? `${base}#${anchor}` : undefined };
  });
  const handoff = departments.flatMap(({ key, handoff }) => handoff ? [{ key, ...handoff }] : [])
    .sort((left, right) => right.at.getTime() - left.at.getTime())[0];
  const viewControl = listMode
    ? <Link href={modeUrl} className="office-control"><Grid2X2 size={15} aria-hidden="true" />地图</Link>
    : <Link href={listUrl} className="office-control"><List size={15} aria-hidden="true" />列表</Link>;
  const visibleTodos = listMode ? 4 : 2;
  const pending = (
    <section className="office-decisions" aria-labelledby="office-decisions-title">
      <div className="office-decisions-heading">
        <h2 id="office-decisions-title">待我决定</h2>
        <span className="office-task-count">{todo.length}</span>
        {todo.length > visibleTodos ? <Link href="#pending">查看全部 <ArrowDownLeft size={14} aria-hidden="true" /></Link> : null}
      </div>
      {todo.length ? (
        <ul className="office-todos">
          {todo.slice(0, visibleTodos).map(({ id, title, action, href }) => (
            <li key={id}>
              <Link href={href}>
                <span><strong>{action}</strong><small>{title}</small></span>
                <ArrowUpRight size={15} aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
      ) : <p className="office-no-todos">眼下没有待处理的审批。</p>}
      <div className="office-decision-links">
        {waitingCount ? <Link href="#waiting" className="office-desk-link">等客户处理（{waitingCount}）<ArrowDownLeft size={15} aria-hidden="true" /></Link> : null}
        {stalled.length ? <Link href={stalled[0].href} className="office-desk-link office-desk-alert"><span>{stalled[0].title} · {stalled[0].action}{stalled.length > 1 ? `，共 ${stalled.length} 项` : ""}</span><ArrowUpRight size={15} aria-hidden="true" /></Link> : null}
        {overdueCount ? <Link href="#overdue" className="office-desk-link office-desk-alert">超时待办（{overdueCount}）<ArrowDownLeft size={15} aria-hidden="true" /></Link> : null}
      </div>
    </section>
  );
  return (
    <section aria-labelledby="office-title" className="office-board">
      <div className="office-heading">
        <div>
          <h1 id="office-title">首客办公室</h1>
          <OfficeConnection revision={revision} updatedAt={new Date().toISOString()} />
        </div>
        <div className="office-toolbar">
          <form action="/admin" method="get" className="office-project-picker">
            <label htmlFor="office-project">当前项目</label>
            {listMode ? <input type="hidden" name="view" value="list" /> : null}
            <select id="office-project" name="project" defaultValue={project?.id ?? ""} disabled={!allProjects.length}>
              {allProjects.length ? allProjects.map((entry) => (
                <option key={entry.id} value={entry.id}>{entry.productName}</option>
              )) : <option value="">暂无项目</option>}
            </select>
            <button type="submit" disabled={!allProjects.length}>切换</button>
          </form>
          {project ? <span className="office-project-status" data-status={project.status} data-paused={project.paused}>{project.paused ? "已暂停 · " : ""}{STATUS_LABELS[project.status as ProjectStatus]}</span> : null}
        </div>
      </div>

      <div className={`office-layout ${listMode ? "office-layout-list" : ""}`}>
        {listMode ? <div className="office-rooms-list">
          <div className="office-stage-bar">
            <p className="office-transfer-summary">{transfer ? `最近交接 · ${roomName(transfer.from)} → ${roomName(transfer.to)}` : "部门与任务状态"}</p>
            {viewControl}
          </div>
          {!project ? <p className="office-empty">新建项目后，就可以在各工位开始工作。</p> : null}
          {stations.map(({ key, state, detail, href }) => {
            const room = rooms[key];
            const content = (
              <>
                <div className="office-room-scene" style={{ "--scene": room.scene } as CSSProperties}>
                  <span className="office-state"><i aria-hidden="true" />{AGENT_STATE_LABELS[state]}</span>
                </div>
                <div className="office-room-caption">
                  <div>
                    <h2>{roomName(key)}</h2>
                    <p>{room.name}</p>
                  </div>
                  {href ? <ArrowUpRight size={18} aria-hidden="true" /> : null}
                </div>
                <p className="office-room-detail">{detail}</p>
              </>
            );
            return href
              ? <Link key={key} href={href} className="office-room" data-state={state}>{content}</Link>
              : <article key={key} className="office-room" data-state={state}>{content}</article>;
          })}
        </div> : (
          <>
            <OfficeStage key={project?.id} transfer={transfer} viewControl={viewControl}>
              <OfficeMap stations={stations} cooWorking={cooWorking} />
            </OfficeStage>
            {pending}
          </>
        )}

        <aside className="office-desk" aria-labelledby="office-desk-title">
          {listMode ? <div className="office-owner-scene" aria-hidden="true" /> : null}
          <div className="office-desk-heading">
            <h2 id="office-desk-title">{OFFICE_CHARACTERS.owner.name} · 老板工位</h2>
            <span>{characterDisplayName("coo")} · COO</span>
          </div>
          <div className="office-milestones">
            <div><span>首客首笔服务实收</span><strong>{firstPaymentAt ? formatDateTime(firstPaymentAt) : "待确认到账"}</strong></div>
            <div><span>客户项目首条有效线索</span><strong>{firstLeadAt ? formatDateTime(firstLeadAt) : "等待有效留资"}</strong></div>
          </div>
          <div className="office-decision-links">
            {project ? <Link href={`${base}#deliverables`} className="office-desk-link"><FolderOpen size={16} /> 交付清单 <ArrowDownRight size={15} /></Link> : null}
            <Link href="#standup" className="office-desk-link">COO 每日站会 <ArrowDownLeft size={15} /></Link>
            <Link id="metrics" href="/admin/metrics" className="office-desk-link">经营报表 <ArrowUpRight size={15} aria-hidden="true" /></Link>
            <Link id="payment-code" href="/admin/payment" className="office-desk-link">收款设置 <ArrowUpRight size={15} aria-hidden="true" /></Link>
          </div>
          {listMode ? pending : null}
        </aside>
      </div>
      {handoff ? (
        <Link href={`${base}#task-${handoff.id}`} className="office-handoff">
          <strong>最近一次打回 · {roomName(handoff.key)} → {roomName(handoff.to)}</strong>
          <span>{handoff.reason}</span>
          <ArrowUpRight size={16} aria-hidden="true" />
        </Link>
      ) : null}
    </section>
  );
}
