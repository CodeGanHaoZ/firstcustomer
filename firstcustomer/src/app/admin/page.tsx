import { desc } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { OfficeBoard, type DeskItem } from "@/components/office-board";
import { OperatingNumbers } from "@/components/operating-numbers";
import type { StandupOutput } from "@/agents/schemas";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getDb } from "@/db";
import { agentTasks, orders, projects } from "@/db/schema";
import { AGENT_LABELS } from "@/domain/office";
import { STATUS_LABELS, type ProjectStatus } from "@/domain/workflow";
import { requireAdmin } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";
import { hasPaymentCode } from "@/workflow/commerce";
import { operatingMetrics } from "@/workflow/operating-metrics";
import { loadCoo, loadDepartments, officeRevision, OWNER_REMINDER_HOURS, projectAttention } from "@/workflow/office";
import { logoutAction, uploadPaymentCodeAction } from "./actions";
import { createStandupReport } from "./reports/actions";
import "./office.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "OPC 经营台", robots: { index: false, follow: false } };

const money = (fen: number) => `¥${(fen / 100).toFixed(2)}`;

function AttentionList({ items }: { items: DeskItem[] }) {
  return <ul className="flex flex-col gap-2 text-sm">
    {items.map(({ id, title, action, href }) => (
      <li key={id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <Link className="break-all underline" href={href}>{title}</Link>
        <span className="text-muted-foreground">{action}</span>
      </li>
    ))}
  </ul>;
}

export default async function AdminPage({ searchParams }: PageProps<"/admin">) {
  await requireAdmin();
  const { error, project: selectedId, view } = await searchParams;
  const db = getDb();
  const [all, allOrders, tasks, codeReady, metrics, coo, revision] = await Promise.all([
    db.select().from(projects).orderBy(desc(projects.updatedAt)),
    db.select().from(orders),
    db.select({ projectId: agentTasks.projectId, provider: agentTasks.provider, status: agentTasks.status }).from(agentTasks),
    hasPaymentCode(db), operatingMetrics(db), loadCoo(db), officeRevision(db),
  ]);
  const selected = all.find(({ id }) => id === selectedId) ?? all[0] ?? null;
  const names = new Map(all.map(({ id, productName }) => [id, productName]));
  const [departments, pending] = await Promise.all([
    selected ? loadDepartments(db, selected) : [],
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
    <main className="office-shell"><div className="office-container">
      <header className="office-nav">
        <p className="office-brand">FIRSTCUSTOMER <small>首客经营台</small></p>
        <nav className="office-nav-links" aria-label="经营台导航">
          <Link href="/admin/projects/new">新建项目</Link>
          <Link href="#projects">全部项目</Link>
          <Link href="/admin/tasks">任务板</Link>
          <Link href="#metrics">经营报表</Link>
          <Link href="/admin/reports">周报</Link>
          <Link href="/admin/context">公司卷宗</Link>
          <Link href="#payment-code">收款设置</Link>
        </nav>
        <form action={logoutAction}>
          <Button type="submit" variant="ghost">
            退出
          </Button>
        </form>
      </header>
      <OfficeBoard project={selected} allProjects={all} departments={departments} todo={todo}
        waitingCount={waiting.length} overdueCount={overdue.length} stalled={stalled}
        firstPaymentAt={metrics.firstPaymentAt ? new Date(metrics.firstPaymentAt) : null}
        firstLeadAt={metrics.firstLeadAt ? new Date(metrics.firstLeadAt) : null}
        revision={revision} listMode={view === "list"} />
      <div className="office-operations">
      <section id="payment-code" className="order-last">
        <Card>
          <CardHeader><CardTitle>首客收款码</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-3 text-sm">
            <p>{codeReady ? "已配置收款码。" : "尚未配置收款码。"}客户接受报价后，可在项目专属链接查看。</p>
            {error ? <p className="text-destructive">{String(error)}</p> : null}
            <form action={uploadPaymentCodeAction} className="flex flex-wrap items-end gap-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="payment-code-file">收款码图片（最大 5 MB）</Label>
                <Input id="payment-code-file" name="paymentCode" type="file" accept="image/png,image/jpeg,image/webp" required />
              </div>
              <Button type="submit" variant="outline">{codeReady ? "更换收款码" : "上传收款码"}</Button>
            </form>
          </CardContent>
        </Card>
      </section>

      <Card id="standup">
        <CardHeader><CardTitle>COO 每日站会</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-sm">
          {standup ? (
            <dl className="grid gap-3 sm:grid-cols-3">
              <div><dt className="font-semibold">昨天</dt><dd>{standup.yesterday}</dd></div>
              <div><dt className="font-semibold">今天</dt><dd>{standup.today}</dd></div>
              <div><dt className="font-semibold">卡点</dt><dd>{standup.blockers}</dd></div>
            </dl>
          ) : <p>{standupRunning ? "COO 正在汇总站会。" : coo.standup?.status === "failed" ? "站会生成失败，可以重新生成。" : "还没有站会记录。"}</p>}
          {standup && coo.standup ? <p className="text-muted-foreground">{formatDateTime(coo.standup.createdAt)}{coo.standup.provider === "stub" ? " · 模拟站会" : ""}</p> : null}
          {stalled.length ? (
            <div>
              <p className="font-semibold">已运行超过 30 分钟</p>
              <AttentionList items={stalled} />
            </div>
          ) : <p className="text-muted-foreground">当前没有运行超过 30 分钟的任务。</p>}
          <div id="overdue">
            <p className="font-semibold">超过 {OWNER_REMINDER_HOURS} 小时的老板待办</p>
            {overdue.length ? <AttentionList items={overdue} /> : <p className="text-muted-foreground">当前没有超时待办。</p>}
          </div>
          <form action={createStandupReport}><Button type="submit" variant="outline" disabled={standupRunning}>生成今日站会</Button></form>
        </CardContent>
      </Card>

      <Card id="pending">
        <CardHeader>
          <CardTitle>待我决定（{todo.length}）</CardTitle>
        </CardHeader>
        <CardContent>
          {todo.length ? <AttentionList items={todo} /> : (
            <p className="text-sm text-muted-foreground">现在没有要你决定的事。</p>
          )}
        </CardContent>
      </Card>

      {waiting.length ? <Card id="waiting">
        <CardHeader><CardTitle>等客户处理（{waiting.length}）</CardTitle></CardHeader>
        <CardContent><AttentionList items={waiting} /></CardContent>
      </Card> : null}

      <div id="metrics"><OperatingNumbers metrics={metrics} /></div>

      <Card id="projects">
        <CardHeader>
          <CardTitle>全部项目</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>产品</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>订单</TableHead>
                <TableHead>Agent 任务</TableHead>
                <TableHead>打回</TableHead>
                <TableHead>模型</TableHead>
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
                      {project.isOwnProduct ? <Badge variant="outline">自有产品</Badge> : null}
                    </TableCell>
                    <TableCell>{STATUS_LABELS[project.status as ProjectStatus] ?? project.status}</TableCell>
                    <TableCell>
                      {order?.status === "paid"
                        ? "已付款"
                        : order?.status === "quoted" || order?.status === "accepted"
                          ? `${order.status === "accepted" ? "已接受" : "已报价"} ${money(order.quoteFen ?? 0)}`
                          : "未报价"}
                    </TableCell>
                    <TableCell>{own.length}</TableCell>
                    <TableCell>{own.filter((t) => t.status === "sent_back").length}</TableCell>
                    <TableCell>{providers.join("、") || "无"}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          {all.length === 0 ? (
            <p className="pt-3 text-sm text-muted-foreground">还没有项目。</p>
          ) : null}
        </CardContent>
      </Card>
      </div>
    </div></main>
  );
}
