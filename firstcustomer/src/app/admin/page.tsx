import { desc } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { OfficeBoard } from "@/components/office-board";
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
import { STATUS_LABELS, type ProjectStatus } from "@/domain/workflow";
import { requireAdmin } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";
import { gateStatusFor } from "@/workflow/actions";
import { hasPaymentCode, latestReceipt, projectOrder } from "@/workflow/commerce";
import { operatingMetrics } from "@/workflow/operating-metrics";
import { firstProjectLead, loadCoo, loadDepartments, officeRevision } from "@/workflow/office";
import { logoutAction, uploadPaymentCodeAction } from "./actions";
import { createStandupReport } from "./reports/actions";
import "./office.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "OPC 经营台", robots: { index: false, follow: false } };

const money = (fen: number) => `¥${(fen / 100).toFixed(2)}`;

async function pendingForFounder(db: ReturnType<typeof getDb>, project: typeof projects.$inferSelect) {
  switch (project.status) {
    case "submitted":
      return "确认后开始研究";
    case "needs_info":
      return "等客户回答追问，可以决定不再等";
    case "awaiting_quote":
      return "确认报价和服务条款";
    case "awaiting_payment": {
      const order = await projectOrder(db, project.id);
      return order && await latestReceipt(db, order.id) ? "核对付款截图并确认到账" : null;
    }
    case "awaiting_positioning":
      return (await gateStatusFor(db, project, "positioning")).state.founder === "pending"
        ? "把关定位方案"
        : "等客户确认定位";
    case "awaiting_publish":
      return (await gateStatusFor(db, project, "publish")).state.founder === "pending"
        ? "把关页面和素材"
        : "等客户确认发布";
    case "awaiting_founder":
      return "打回超限，等你裁决";
    case "failed":
      return "执行失败，决定是否重试";
    case "collecting":
      return "数据够了就开始复盘";
    case "reviewing":
      return "看复盘，决定交付或下一轮";
    default:
      return null;
  }
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
  const escalated = new Map(coo.escalated.map(({ id, amount }) => [id, amount]));
  const [firstLeadAt, departments, pending] = await Promise.all([
    selected ? firstProjectLead(db, selected.id) : null,
    selected ? loadDepartments(db, selected) : [],
    Promise.all(all.map(async (project) => {
      const action = await pendingForFounder(db, project);
      const riskCount = escalated.get(project.id);
      return {
        project,
        action: [action, riskCount ? `${riskCount} 条客服待处理` : null].filter(Boolean).join(" · "),
        anchor: riskCount ? "frontdesk" : "decisions",
      };
    })),
  ]);
  const todo = pending.filter(({ action }) => action);
  const standup = coo.standup?.output as StandupOutput | null;
  const standupRunning = coo.standup?.status === "queued" || coo.standup?.status === "running";

  return (
    <main className="office-shell"><div className="office-container">
      <header className="office-nav">
        <p className="office-brand">FIRSTCUSTOMER <small>首客经营台</small></p>
        <nav className="office-nav-links" aria-label="经营台导航">
          <Link href="/admin/projects/new">新建项目</Link>
          <Link href="#projects">全部项目</Link>
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
        firstPaymentAt={metrics.firstPaymentAt ? new Date(metrics.firstPaymentAt) : null} firstLeadAt={firstLeadAt}
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
          {coo.stalled.length ? (
            <div>
              <p className="font-semibold">已运行超过 30 分钟</p>
              <ul className="space-y-1">
                {coo.stalled.map((item) => <li key={`${item.projectId}-${item.agent}${item.at.getTime()}`}><Link className="underline" href={`/admin/projects/${item.projectId}#tasks`}>{item.productName} · {item.agent} · {formatDateTime(item.at)}</Link></li>)}
              </ul>
            </div>
          ) : <p className="text-muted-foreground">当前没有运行超过 30 分钟的任务。</p>}
          <form action={createStandupReport}><Button type="submit" variant="outline" disabled={standupRunning}>生成今日站会</Button></form>
        </CardContent>
      </Card>

      <Card id="pending">
        <CardHeader>
          <CardTitle>待我决定（{todo.length}）</CardTitle>
        </CardHeader>
        <CardContent>
          {todo.length ? (
            <ul className="flex flex-col gap-2 text-sm">
              {todo.map(({ project, action, anchor }) => (
                <li key={project.id} className="flex items-center justify-between gap-4">
                  <Link className="underline" href={`/admin/projects/${project.id}#${anchor}`}>
                    {project.productName}
                  </Link>
                  <span className="text-muted-foreground">{action}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">现在没有要你决定的事。</p>
          )}
        </CardContent>
      </Card>

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
