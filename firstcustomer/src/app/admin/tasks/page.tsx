import type { Metadata } from "next";
import Link from "next/link";
import { hasModelListPrice } from "@/ai/call-model";
import { AutoRefresh } from "@/components/auto-refresh";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getDb } from "@/db";
import { AGENT_LABELS, TASK_STATUS_LABELS, TASK_TRIGGER_LABELS } from "@/domain/office";
import { requireAdmin } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";
import { loadTaskBoard } from "@/workflow/task-board";
import { pauseProjectAction, retryAction } from "../actions";
import "../office.css";

export const metadata: Metadata = { title: "办公室任务板", robots: { index: false, follow: false } };

export default async function TasksPage({ searchParams }: PageProps<"/admin/tasks">) {
  await requireAdmin();
  const { status: statusParam, page: pageParam } = await searchParams;
  const status = typeof statusParam === "string" && Object.hasOwn(TASK_STATUS_LABELS, statusParam) ? statusParam : "";
  const page = typeof pageParam === "string" && /^\d{1,6}$/.test(pageParam) ? Math.max(1, Number(pageParam)) : 1;
  const { rows, hasMore } = await loadTaskBoard(getDb(), status, page);
  const pageHref = (number: number) => `/admin/tasks?${new URLSearchParams({ status, page: String(number) })}`;
  const controlled = new Set<string>();

  return (
    <main className="office-shell">
      <div className="office-container space-y-4">
        <Link href="/admin" className="text-sm underline">返回办公室</Link>
        {rows.some(({ status }) => status === "running" || status === "queued") ? <AutoRefresh /> : null}
        <Card className="min-w-0">
          <CardHeader>
            <CardTitle><h1 className="text-2xl">办公室任务板</h1></CardTitle>
            <p className="text-sm text-muted-foreground">查看各项目的 Agent 执行、秘书周报和 COO 站会记录。暂停项目后，已开始的步骤可以收尾。</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <form action="/admin/tasks" method="get" className="flex flex-wrap items-center gap-2 text-sm">
              <Label htmlFor="task-status">任务状态</Label>
              <select id="task-status" name="status" defaultValue={status} className="rounded-md border bg-background px-2 py-1.5">
                <option value="">全部状态</option>
                {Object.entries(TASK_STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
              <Button type="submit" variant="outline" size="sm">筛选</Button>
            </form>
            {rows.length ? (
              <Table aria-label="跨项目 Agent 任务">
                <TableHeader><TableRow>
                  <TableHead>项目或经营记录</TableHead><TableHead>Agent</TableHead><TableHead>状态</TableHead>
                  <TableHead>触发和原因</TableHead><TableHead>模型与标价</TableHead><TableHead>记录时间</TableHead><TableHead>项目操作</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {rows.map((task) => {
                    const projectId = task.projectId;
                    const canControl = projectId && task.projectStatus && !["delivered", "cancelled"].includes(task.projectStatus) && !controlled.has(projectId);
                    if (projectId) controlled.add(projectId);
                    const href = projectId ? `/admin/projects/${projectId}#task-${task.id}`
                      : task.agent === "weekly" ? `/admin/reports?report=${task.id}` : "/admin#standup";
                    return (
                      <TableRow key={task.id}>
                        <TableCell className="min-w-44 max-w-64 whitespace-normal break-words"><Link href={href} className="underline">{task.projectName ?? "首客经营记录"}</Link></TableCell>
                        <TableCell>{AGENT_LABELS[task.agent] ?? task.agent}</TableCell>
                        <TableCell>{TASK_STATUS_LABELS[task.status] ?? task.status}{task.paused ? " · 项目已暂停" : ""}</TableCell>
                        <TableCell className="min-w-32 max-w-72 whitespace-normal break-words">
                          {TASK_TRIGGER_LABELS[task.trigger] ?? task.trigger}{task.reason ? <p className="mt-1 text-muted-foreground">{task.reason}</p> : null}
                        </TableCell>
                        <TableCell>{task.provider ?? "无"} / {task.model ?? "无"}
                          <p className="text-muted-foreground">{task.provider === "stub" ? "模拟" : hasModelListPrice(task.model) ? `¥${task.cost.toFixed(4)}` : "未计价"}</p>
                        </TableCell>
                        <TableCell>{formatDateTime(task.at)}</TableCell>
                        <TableCell>
                          {canControl ? <div className="flex flex-wrap gap-2">
                            <form action={pauseProjectAction.bind(null, projectId)}>
                              <input type="hidden" name="paused" value={task.paused ? "0" : "1"} />
                              <Button type="submit" variant="outline" size="sm">{task.paused ? "恢复项目" : "暂停项目"}</Button>
                            </form>
                            {task.projectStatus === "failed" && !task.paused ? (
                              <form action={retryAction.bind(null, projectId)}><Button type="submit" size="sm">重试项目</Button></form>
                            ) : null}
                          </div> : "·"}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            ) : <p className="text-sm text-muted-foreground">当前条件下没有任务记录。</p>}
            {page > 1 || hasMore ? (
              <nav className="flex flex-wrap items-center gap-4 text-sm" aria-label="任务分页">
                {page > 1 ? <Link href={pageHref(page - 1)} className="underline">上一页</Link> : null}
                <span>第 {page} 页</span>
                {hasMore ? <Link href={pageHref(page + 1)} className="underline">下一页</Link> : null}
              </nav>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
