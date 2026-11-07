import { getLocale } from "@/lib/locale-server";
import { translateUi } from "@/lib/ui-translation";
import { T } from "@/components/ui-text";
import { desc } from "drizzle-orm";
import Link from "next/link";
import { OfficeBoard, type DeskItem } from "@/components/office-board";
import type { StandupOutput } from "@/agents/schemas";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getDb } from "@/db";
import { agentTasks, orders, projects } from "@/db/schema";
import { AGENT_LABELS } from "@/domain/office";
import { STATUS_LABELS, type ProjectStatus } from "@/domain/workflow";
import { requireAdmin } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";
import { operatingMetrics } from "@/workflow/operating-metrics";
import { loadCoo, loadDepartments, loadOfficeTransfer, officeRevision, OWNER_REMINDER_HOURS, projectAttention } from "@/workflow/office";
import { createStandupReport } from "./reports/actions";
import "./office.css";

export const dynamic = "force-dynamic";
export async function generateMetadata() {
  const locale = await getLocale();
  return { title: translateUi(locale, "首客内部经营台"), robots: { index: false, follow: false } };
}

const money = (fen: number) => `¥${(fen / 100).toFixed(2)}`;

function AttentionList({ items }: { items: DeskItem[] }) {
  return <ul className="flex flex-col gap-2 text-sm">
    {items.map(({ id, title, action, href }) => (
      <li key={id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <Link className="break-all underline" href={href}>{title}</Link>
        <span className="text-muted-foreground"><T>{action}</T></span>
      </li>
    ))}
  </ul>;
}

export default async function AdminPage({ searchParams }: PageProps<"/admin">) {
  await requireAdmin();
  const { project: selectedId, view } = await searchParams;
  const db = getDb();
  const [all, allOrders, tasks, metrics, coo, revision] = await Promise.all([
    db.select().from(projects).orderBy(desc(projects.updatedAt)),
    db.select().from(orders),
    db.select({ projectId: agentTasks.projectId, provider: agentTasks.provider, status: agentTasks.status }).from(agentTasks),
    operatingMetrics(db), loadCoo(db), officeRevision(db),
  ]);
  const selected = all.find(({ id }) => id === selectedId) ?? all[0] ?? null;
  const names = new Map(all.map(({ id, productName }) => [id, productName]));
  const [departments, transfer, pending] = await Promise.all([
    selected ? loadDepartments(db, selected) : [],
    selected ? loadOfficeTransfer(db, selected.id) : null,
    Promise.all(all.map(async (project) => {
      const attention = await projectAttention(db, project);
      return attention ? {
        ...attention, id: project.id, title: project.productName, href: `/admin/projects/${project.id}#${attention.anchor}`,
      } : null;
    })),
  ]);
  const attention = pending.filter((item) => item !== null);
  const todo = [
    ...coo.escalated.map(({ id, amount, since }) => ({
      id: `support-${id}`, title: names.get(id) ?? "客户项目", action: `${amount} 条客服待处理`, href: `/admin/projects/${id}#frontdesk`, since,
    })),
    ...attention.filter((item) => item.owner),
    ...coo.pendingReports.map(({ id, since }) => ({
      id, title: since ? `${formatDateTime(since)} 经营周报` : "经营周报", action: "查看周报并记录决定", href: `/admin/reports?report=${id}`, since,
    })),
  ];
  const waiting = attention.filter((item) => !item.owner);
  const overdue = todo.flatMap((item) => item.since && item.since < coo.reminderCutoff ? [{ ...item, since: item.since }] : [])
    .sort((left, right) => left.since.getTime() - right.since.getTime());
  const stalled = coo.stalled.map(({ id, projectId, productName, agent, at }) => ({
    id, title: productName, action: `${AGENT_LABELS[agent] ?? agent} 自 ${formatDateTime(at)} 运行超过 30 分钟`,
    href: `/admin/projects/${projectId}#task-${id}`,
  }));
  const standup = coo.standup?.output as StandupOutput | null;
  const standupRunning = coo.standup?.status === "queued" || coo.standup?.status === "running";

  return (
    <main className="office-shell office-container">
      <OfficeBoard project={selected} allProjects={all} departments={departments} todo={todo}
        transfer={transfer} cooWorking={coo.standup?.status === "running"}
        waitingCount={waiting.length} overdueCount={overdue.length} stalled={stalled}
        firstPaymentAt={metrics.firstPaymentAt ? new Date(metrics.firstPaymentAt) : null}
        firstLeadAt={metrics.firstLeadAt ? new Date(metrics.firstLeadAt) : null}
        revision={revision} listMode={view === "list"} />
      <div className="office-operations">
      <Card id="standup">
        <CardHeader><CardTitle><T>COO 每日站会</T></CardTitle></CardHeader>
        <CardContent className="space-y-3 text-sm">
          {standup ? (
            <dl className="grid gap-3 sm:grid-cols-3">
              <div><dt className="font-semibold"><T>昨天</T></dt><dd>{standup.yesterday}</dd></div>
              <div><dt className="font-semibold"><T>今天</T></dt><dd>{standup.today}</dd></div>
              <div><dt className="font-semibold"><T>卡点</T></dt><dd>{standup.blockers}</dd></div>
            </dl>
          ) : <p><T>{standupRunning ? "COO 正在汇总站会。" : coo.standup?.status === "failed" ? "站会生成失败，可以重新生成。" : "还没有站会记录。"}</T></p>}
          {standup && coo.standup ? <p className="text-muted-foreground">{formatDateTime(coo.standup.createdAt)}<T>{coo.standup.provider === "stub" ? " · 模拟站会" : ""}</T></p> : null}
          {stalled.length ? (
            <div>
              <p className="font-semibold"><T>已运行超过 30 分钟</T></p>
              <AttentionList items={stalled} />
            </div>
          ) : <p className="text-muted-foreground"><T>当前没有运行超过 30 分钟的任务。</T></p>}
          <div id="overdue">
            <p className="font-semibold"><T>超过 </T>{OWNER_REMINDER_HOURS}<T> 小时的老板待办</T></p>
            {overdue.length ? <AttentionList items={overdue} /> : <p className="text-muted-foreground"><T>当前没有超时待办。</T></p>}
          </div>
          <form action={createStandupReport}><Button type="submit" variant="outline" disabled={standupRunning}><T>生成今日站会</T></Button></form>
        </CardContent>
      </Card>

      <Card id="pending">
        <CardHeader>
          <CardTitle><T>待我决定（</T>{todo.length}）</CardTitle>
        </CardHeader>
        <CardContent>
          {todo.length ? <AttentionList items={todo} /> : (
            <p className="text-sm text-muted-foreground"><T>现在没有要你决定的事。</T></p>
          )}
        </CardContent>
      </Card>

      {waiting.length ? <Card id="waiting">
        <CardHeader><CardTitle><T>等客户处理（</T>{waiting.length}）</CardTitle></CardHeader>
        <CardContent><AttentionList items={waiting} /></CardContent>
      </Card> : null}

      <Card id="projects">
        <CardHeader>
          <CardTitle><T>全部项目</T></CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead><T>产品</T></TableHead>
                <TableHead><T>状态</T></TableHead>
                <TableHead><T>订单</T></TableHead>
                <TableHead><T>Agent 任务</T></TableHead>
                <TableHead><T>打回</T></TableHead>
                <TableHead><T>模型</T></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {all.map((project) => {
                const own = tasks.filter((t) => t.projectId === project.id);
                const order = allOrders.find((o) => o.projectId === project.id);
                const providers = [...new Set(own.map((t) => t.provider).filter(Boolean))];
                return (
                  <TableRow key={project.id}>
                    <TableCell>
                      <Link className="underline" href={`/admin/projects/${project.id}`}>
                        {project.productName}
                      </Link>
                      {project.isOwnProduct ? <Badge variant="outline"><T>自有产品</T></Badge> : null}
                    </TableCell>
                    <TableCell><T>{STATUS_LABELS[project.status as ProjectStatus] ?? project.status}</T></TableCell>
                    <TableCell>
                      <T>{order?.status === "paid"
                        ? "已付款"
                        : order?.status === "quoted" || order?.status === "accepted"
                          ? `${order.status === "accepted" ? "已接受" : "已报价"} ${money(order.quoteFen ?? 0)}`
                          : "未报价"}</T>
                    </TableCell>
                    <TableCell>{own.length}</TableCell>
                    <TableCell>{own.filter((t) => t.status === "sent_back").length}</TableCell>
                    <TableCell><T>{providers.join("、") || "无"}</T></TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          {all.length === 0 ? (
            <p className="pt-3 text-sm text-muted-foreground"><T>还没有项目。</T></p>
          ) : null}
        </CardContent>
      </Card>
      </div>
    </main>
  );
}
