import Link from "next/link";
import { desc } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { projects } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";
import { getLocale } from "@/lib/locale-server";
import { translateUi } from "@/lib/ui-translation";
import { STATUS_LABELS, type ProjectStatus } from "@/domain/workflow";
import { AGENT_LABELS } from "@/domain/office";
import { AUDIT_GATES, loadAuditLog } from "@/workflow/audit-log";
import { T } from "@/components/ui-text";
import { Button } from "@/components/ui/button";
import "../owner/owner.css";

export const dynamic = "force-dynamic";
export async function generateMetadata() {
  return { title: `${translateUi(await getLocale(), "决策与操作记录")} · HiFirst`, robots: { index: false, follow: false } };
}
const single = (value: string | string[] | undefined) => typeof value === "string" ? value : "";
const ACTORS: Record<string, string> = { founder: "老板", customer: "客户", system: "系统" };

export default async function AuditPage({ searchParams }: PageProps<"/admin/audit">) {
  await requireAdmin("audit.read", "/admin/audit");
  const locale = await getLocale();
  const label = (value: string) => translateUi(locale, value);
  const params = await searchParams;
  const projectId = z.uuid().safeParse(single(params.project)).data;
  const gate = Object.hasOwn(AUDIT_GATES, single(params.gate)) ? single(params.gate) : "all";
  const actor = ["founder", "customer"].includes(single(params.actor)) ? single(params.actor) : "";
  const [audit, projectList] = await Promise.all([
    loadAuditLog(getDb(), { projectId, gate, actor, page: Number(single(params.page)) }),
    getDb().select({ id: projects.id, name: projects.productName }).from(projects).orderBy(desc(projects.updatedAt)),
  ]);
  const href = (page: number) => `/admin/audit?${new URLSearchParams({ project: projectId ?? "", gate, actor, page: String(page) })}`;
  return <main className="admin-section owner-console">
    <header className="admin-section-heading"><div><h1><T>决策与操作记录</T></h1><p><T>核查谁在何时处理了哪个版本，以及当时的理由与资料。</T></p></div><Link href="/admin/owner"><T>返回老板经营台</T></Link></header>
    <form action="/admin/audit" className="owner-audit-filters">
      <label><T>项目</T><select name="project" defaultValue={projectId ?? ""}><option value="">{label("全部项目与公司")}</option>{projectList.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select></label>
      <label><T>事项</T><select name="gate" defaultValue={gate}>{Object.entries(AUDIT_GATES).map(([key, title]) => <option key={key} value={key}>{label(title)}</option>)}</select></label>
      <label><T>决定人</T><select name="actor" defaultValue={actor}><option value="">{label("全部角色")}</option><option value="founder">{label("老板")}</option><option value="customer">{label("客户")}</option></select></label>
      <Button type="submit" variant="outline"><T>筛选记录</T></Button><Link href="/admin/audit"><T>清除筛选</T></Link>
    </form>
    <section className="owner-panel" aria-label="记录列表">
      <ol className="owner-audit-list">{audit.items.map((item) => <li key={`${item.event}-${item.id}`}>
        <div className="owner-section-title"><h2>{item.projectId ? <Link href={`/admin/projects/${item.projectId}`}>{item.productName}</Link> : <T>首客公司</T>}</h2><time className="meta" dateTime={item.at.toISOString()}>{formatDateTime(item.at)}</time></div>
        <div className="owner-item-flags"><span className="pill pill--line"><T>{AUDIT_GATES[item.event as keyof typeof AUDIT_GATES] ?? item.event}</T></span>
          <span className="meta"><T>{ACTORS[item.actor] ?? AGENT_LABELS[item.actor] ?? item.actor}</T></span>
          <span className={item.outcome === "reject" ? "owner-overdue" : "meta"}><T>{item.event === "transition" ? STATUS_LABELS[item.outcome as ProjectStatus] ?? item.outcome : item.outcome === "approve" ? "确认" : item.outcome === "reject" ? "退回" : item.outcome}</T></span>
          {item.version > 0 ? <span className="meta"><T>版本</T> {item.version}</span> : null}
        </div>
        <p>{item.reason || <T>未填写补充说明</T>}</p>
        {item.snapshot ? <details><summary><T>查看当时的记录快照</T></summary><pre>{JSON.stringify(item.snapshot, null, 2)}</pre></details> : <p className="meta"><T>此历史记录未保存快照，仅保留决定与版本。</T></p>}
      </li>)}</ol>
      {!audit.items.length ? <div className="owner-empty"><h2><T>没有符合条件的记录</T></h2><p><T>调整筛选条件，或在项目中完成一次审批后再查看。</T></p></div> : null}
      <nav className="owner-pagination" aria-label="操作记录分页">
        {audit.page > 1 ? <Link href={href(audit.page - 1)}><T>上一页</T></Link> : <span />}
        <span><T>第</T> {audit.page} <T>页</T> · <T>每页最多 25 条</T></span>
        {audit.hasNext ? <Link href={href(audit.page + 1)}><T>下一页</T></Link> : <span />}
      </nav>
    </section>
    <p className="meta"><T>北京时间 · 决策与项目流转按时间倒序排列。快照从功能上线后开始保存，历史记录不补造。</T></p>
  </main>;
}
