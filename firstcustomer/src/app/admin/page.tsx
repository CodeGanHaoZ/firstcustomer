import { desc, inArray, sum } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getDb } from "@/db";
import { agentTasks, landingPages, orders, payments, projects } from "@/db/schema";
import { STATUS_LABELS, type ProjectStatus } from "@/domain/workflow";
import { requireAdmin } from "@/lib/auth";
import { gateStatusFor } from "@/workflow/actions";
import { pageMetrics } from "@/workflow/engine";
import { logoutAction } from "./actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "OPC 经营台", robots: { index: false, follow: false } };

const money = (fen: number) => `¥${(fen / 100).toFixed(2)}`;

async function pendingForFounder(db: ReturnType<typeof getDb>, project: typeof projects.$inferSelect) {
  switch (project.status) {
    case "submitted":
      return "确认后开始研究";
    case "needs_info":
      return "等客户回答追问，可以决定不再等";
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

export default async function AdminPage() {
  await requireAdmin();
  const db = getDb();
  const all = await db.select().from(projects).orderBy(desc(projects.updatedAt));
  const allOrders = await db.select().from(orders);
  const tasks = await db
    .select({
      projectId: agentTasks.projectId,
      provider: agentTasks.provider,
      status: agentTasks.status,
      cost: agentTasks.listCostYuan,
    })
    .from(agentTasks);
  const paid = await db
    .select({ orderId: payments.orderId, amount: sum(payments.amountFen) })
    .from(payments)
    .groupBy(payments.orderId);

  const ownProjectIds = new Set(all.filter((p) => p.isOwnProduct).map((p) => p.id));
  const paidByOrder = new Map(paid.map((p) => [p.orderId, Number(p.amount)]));
  const externalOrders = allOrders.filter((o) => !ownProjectIds.has(o.projectId));
  const revenue = externalOrders.reduce((total, o) => total + (paidByOrder.get(o.id) ?? 0), 0);
  const modelCost = tasks.reduce((total, t) => total + t.cost, 0);
  const minutes = allOrders.reduce((total, o) => total + o.founderMinutes, 0);

  const pages = await db
    .select({ id: landingPages.id })
    .from(landingPages)
    .where(inArray(landingPages.status, ["published"]));
  const growth = { visits: 0, ctaClicks: 0, leads: 0, replies: 0 };
  for (const page of pages) {
    const m = await pageMetrics(db, page.id);
    growth.visits += m.visits;
    growth.ctaClicks += m.ctaClicks;
    growth.leads += m.leads;
    growth.replies += m.replies;
  }

  const todo = (
    await Promise.all(
      all.map(async (project) => ({ project, action: await pendingForFounder(db, project) })),
    )
  ).filter((item) => item.action);

  const sponsored = process.env.MODEL_COST_SPONSORED === "1";

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-6 py-10">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">OPC 经营台</h1>
        <form action={logoutAction}>
          <Button type="submit" variant="ghost">
            退出
          </Button>
        </form>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>待我决定（{todo.length}）</CardTitle>
        </CardHeader>
        <CardContent>
          {todo.length ? (
            <ul className="flex flex-col gap-2 text-sm">
              {todo.map(({ project, action }) => (
                <li key={project.id} className="flex items-center justify-between gap-4">
                  <Link className="underline" href={`/admin/projects/${project.id}`}>
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

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>首客自身经营</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-1 text-sm">
            <p>已确认收入：{money(revenue)}（只算外部客户的实际收款）</p>
            <p>服务订单：{externalOrders.length}（已付款 {externalOrders.filter((o) => o.status === "paid").length}）</p>
            <p>老板人工：{minutes} 分钟</p>
            <p>
              模型费用：¥{modelCost.toFixed(2)}（按标价折算{sponsored ? "，由赛事赞助" : ""}）
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>客户项目增长（不是首客收入）</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-1 text-sm">
            <p>独立访问：{growth.visits}</p>
            <p>CTA 点击：{growth.ctaClicks}</p>
            <p>有效留资：{growth.leads}</p>
            <p>回复和评论：{growth.replies}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
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
                        : order?.quoteFen
                          ? `已报价 ${money(order.quoteFen)}`
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
    </main>
  );
}
