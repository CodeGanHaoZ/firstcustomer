import { T } from "@/components/ui-text";
import type { CSSProperties } from "react";
import Link from "next/link";
import { ArrowDownLeft, ArrowDownRight, ArrowUpRight, FolderOpen, Grid2X2, List } from "lucide-react";
import { AGENT_LABELS, AGENT_STATE_LABELS, DEPARTMENTS, type DepartmentKey, type DepartmentView, type OfficeTransfer } from "@/domain/office";
import { STATUS_LABELS, type ProjectStatus } from "@/domain/workflow";
import { usesQuoteFlow, type ProjectPlan } from "@/domain/workflow";
import { officeGuidance, type OfficeGuideInput } from "@/domain/office-guide";
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

type ProjectBrief = { id: string; productName: string; status: string; paused: boolean; productPlan?: ProjectPlan; requiresPayment?: boolean; isOwnProduct?: boolean; failedFrom?: string | null };
export type DeskItem = { id: string; title: string; action: string; href: string };

const activeRoom: Partial<Record<ProjectStatus, DepartmentKey>> = {
  submitted: "research", needs_info: "research", awaiting_quote: "frontdesk", awaiting_quote_acceptance: "frontdesk",
  awaiting_payment: "finance", awaiting_positioning: "strategy", awaiting_publish: "launch", reviewing: "growth",
};

export function OfficeBoard({
  project, allProjects, departments, transfer, cooWorking, todo, waitingCount, overdueCount, stalled,
  firstPaymentAt, firstLeadAt, revision, listMode, quotePaid = false,
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
  quotePaid?: boolean;
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
  const roomAgent: Record<DepartmentKey, string> = { frontdesk: "quote", research: "research", strategy: "strategy", finance: "receipt", launch: "launch", growth: "growth" };
  const officeInput: OfficeGuideInput | undefined = project ? { status: project.status, paused: project.paused, plan: project.productPlan,
    runningAgents: departments.filter((item) => item.state === "running").map((item) => roomAgent[item.key]),
    quoteRequired: usesQuoteFlow({ requiresPayment: project.requiresPayment ?? false, isOwnProduct: project.isOwnProduct ?? false, productPlan: project.productPlan }), quotePaid,
    audience: "operator", operatorTurn: todo.some((item) => item.id === project.id),
    reportReady: project.status === "reviewing" && departments.some((item) => item.key === "growth" && item.state === "awaiting_approval"),
    receiptUploaded: project.status === "awaiting_payment" && todo.some((item) => item.id === project.id), failedFrom: project.failedFrom } : undefined;
  const viewControl = listMode
    ? <Link href={modeUrl} className="office-control"><Grid2X2 size={15} aria-hidden="true" /><T>地图</T></Link>
    : <Link href={listUrl} className="office-control"><List size={15} aria-hidden="true" /><T>列表</T></Link>;
  const visibleTodos = listMode ? 4 : 2;
  const pending = (
    <section className="office-decisions" aria-labelledby="office-decisions-title">
      <div className="office-decisions-heading">
        <h2 id="office-decisions-title"><T>待我决定</T></h2>
        <span className="office-task-count">{todo.length}</span>
        {todo.length > visibleTodos ? <Link href="#pending"><T>查看全部 </T><ArrowDownLeft size={14} aria-hidden="true" /></Link> : null}
      </div>
      {todo.length ? (
        <ul className="office-todos">
          {todo.slice(0, visibleTodos).map(({ id, title, action, href }) => (
            <li key={id}>
              <Link href={href}>
                <span><strong><T>{action}</T></strong><small>{title}</small></span>
                <ArrowUpRight size={15} aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
      ) : <p className="office-no-todos"><T>眼下没有待处理的审批。</T></p>}
      <div className="office-decision-links">
        {waitingCount ? <Link href="#waiting" className="office-desk-link"><T>等客户处理（</T>{waitingCount}）<ArrowDownLeft size={15} aria-hidden="true" /></Link> : null}
        {stalled.length ? <Link href={stalled[0].href} className="office-desk-link office-desk-alert"><span><T>{stalled[0].title}</T> · <T>{stalled[0].action}</T><T>{stalled.length > 1 ? `，共 ${stalled.length} 项` : ""}</T></span><ArrowUpRight size={15} aria-hidden="true" /></Link> : null}
        {overdueCount ? <Link href="#overdue" className="office-desk-link office-desk-alert"><T>超时待办（</T>{overdueCount}）<ArrowDownLeft size={15} aria-hidden="true" /></Link> : null}
      </div>
    </section>
  );
  return (
    <section aria-labelledby="office-title" className="office-board">
      <div className="office-heading">
        <div>
          <h1 id="office-title"><T>首客办公室</T></h1>
          <OfficeConnection revision={revision} updatedAt={new Date().toISOString()} />
        </div>
        <div className="office-toolbar">
          <form action="/admin" method="get" className="office-project-picker">
            <label htmlFor="office-project"><T>当前项目</T></label>
            {listMode ? <input type="hidden" name="view" value="list" /> : null}
            <select id="office-project" name="project" defaultValue={project?.id ?? ""} disabled={!allProjects.length}>
              {allProjects.length ? allProjects.map((entry) => (
                <option key={entry.id} value={entry.id}>{entry.productName}</option>
              )) : <option value=""><T>暂无项目</T></option>}
            </select>
            <button type="submit" disabled={!allProjects.length}><T>切换</T></button>
          </form>
          {project ? <span className="office-project-status" data-status={project.status} data-paused={project.paused}><T>{project.paused ? "已暂停 · " : ""}</T><T>{STATUS_LABELS[project.status as ProjectStatus]}</T></span> : null}
        </div>
      </div>

      <div className={`office-layout ${listMode ? "office-layout-list" : ""}`}>
        {listMode ? <div className="office-rooms-list">
          <div className="office-stage-bar">
            <p className="office-transfer-summary"><T>{transfer ? `最近交接 · ${roomName(transfer.from)} → ${roomName(transfer.to)}` : "部门与任务状态"}</T></p>
            {viewControl}
          </div>
          {!project ? <p className="office-empty"><T>新建项目后，就可以在各工位开始工作。</T></p> : null}
          {stations.map(({ key, state, detail, href }) => {
            const room = rooms[key];
            const content = (
              <>
                <div className="office-room-scene" style={{ "--scene": room.scene } as CSSProperties}>
                  <span className="office-state"><i aria-hidden="true" /><T>{AGENT_STATE_LABELS[state]}</T></span>
                </div>
                <div className="office-room-caption">
                  <div>
                    <h2><T>{roomName(key)}</T></h2>
                    <p><T>{room.name}</T></p>
                  </div>
                  {href ? <ArrowUpRight size={18} aria-hidden="true" /> : null}
                </div>
                <p className="office-room-detail"><T>{detail}</T></p>
              </>
            );
            return href
              ? <Link key={key} href={href} className="office-room" data-state={state}>{content}</Link>
              : <article key={key} className="office-room" data-state={state}>{content}</article>;
          })}
        </div> : (
          <>
            <OfficeStage key={project?.id} transfer={transfer} viewControl={viewControl} guidance={officeInput} stations={stations} guideHrefPrefix={base} focusRoom={officeInput ? officeGuidance(officeInput).room ?? undefined : undefined}>
              <OfficeMap stations={stations} cooWorking={cooWorking} />
            </OfficeStage>
            {pending}
          </>
        )}

        <aside className="office-desk" aria-labelledby="office-desk-title">
          {listMode ? <div className="office-owner-scene" aria-hidden="true" /> : null}
          <div className="office-desk-heading">
            <h2 id="office-desk-title">{OFFICE_CHARACTERS.owner.name}<T> · 老板工位</T></h2>
            <span><T>{characterDisplayName("coo")}</T> · COO</span>
          </div>
          <div className="office-milestones">
            <div><span><T>首客首笔服务实收</T></span><strong><T>{firstPaymentAt ? formatDateTime(firstPaymentAt) : "待确认到账"}</T></strong></div>
            <div><span><T>客户项目首条有效线索</T></span><strong><T>{firstLeadAt ? formatDateTime(firstLeadAt) : "等待有效留资"}</T></strong></div>
          </div>
          <div className="office-decision-links">
            {project ? <Link href={`${base}#deliverables`} className="office-desk-link"><FolderOpen size={16} /><T> 交付清单 </T><ArrowDownRight size={15} /></Link> : null}
            <Link href="#standup" className="office-desk-link"><T>COO 每日站会 </T><ArrowDownLeft size={15} /></Link>
            <Link id="metrics" href="/admin/metrics" className="office-desk-link"><T>经营报表 </T><ArrowUpRight size={15} aria-hidden="true" /></Link>
            <Link id="payment-code" href="/admin/payment" className="office-desk-link"><T>收款设置 </T><ArrowUpRight size={15} aria-hidden="true" /></Link>
          </div>
          {listMode ? pending : null}
        </aside>
      </div>
      {handoff ? (
        <Link href={`${base}#task-${handoff.id}`} className="office-handoff">
          <strong><T>最近一次打回 · </T><T>{roomName(handoff.key)}</T> → <T>{roomName(handoff.to)}</T></strong>
          <span><T>{handoff.reason}</T></span>
          <ArrowUpRight size={16} aria-hidden="true" />
        </Link>
      ) : null}
    </section>
  );
}
