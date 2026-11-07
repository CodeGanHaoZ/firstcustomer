import { getLocale } from "@/lib/locale-server";
import { translateUi } from "@/lib/ui-translation";
import { T, I18n } from "@/components/ui-text";
import Link from "next/link";
import { hasModelListPrice } from "@/ai/call-model";
import { AutoRefresh } from "@/components/auto-refresh";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getDb } from "@/db";
import { AGENT_LABELS, TASK_STATUS_LABELS, TASK_TRIGGER_LABELS } from "@/domain/office";
import { requireAdmin } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";
import { loadTaskBoard } from "@/workflow/task-board";
import { pauseProjectAction, retryAction } from "../actions";

export async function generateMetadata() {
  const locale = await getLocale();
  return { title: translateUi(locale, "办公室任务板"), robots: { index: false, follow: false } };
}

export default async function TasksPage({ searchParams }: PageProps<"/admin/tasks">) {
  await requireAdmin();
  const { status: statusParam, page: pageParam } = await searchParams;
  const status = typeof statusParam === "string" && Object.hasOwn(TASK_STATUS_LABELS, statusParam) ? statusParam : "";
  const page = typeof pageParam === "string" && /^\d{1,6}$/.test(pageParam) ? Math.max(1, Number(pageParam)) : 1;
  const { rows, hasMore } = await loadTaskBoard(getDb(), status, page);
  const pageHref = (number: number) => `/admin/tasks?${new URLSearchParams({ status, page: String(number) })}`;
  const controlled = new Set<string>();

  return (
    <main className="admin-section">
      <header className="admin-section-heading">
        <div>
          <h1><T>办公室任务板</T></h1>
          <p><T>查看各项目的 Agent 执行、秘书周报和 COO 站会记录。暂停项目后，已开始的步骤可以收尾。</T></p>
        </div>
      </header>
      {rows.some(({ status }) => status === "running" || status === "queued") ? <AutoRefresh /> : null}
      <I18n><section className="min-w-0 overflow-hidden rounded-xl border bg-card" aria-label="任务记录">
        <form action="/admin/tasks" method="get" className="flex flex-wrap items-center gap-2 border-b px-4 py-3 text-sm">
          <Label htmlFor="task-status"><T>任务状态</T></Label>
          <select id="task-status" name="status" defaultValue={status} className="rounded-md border bg-background px-2 py-1.5">
            <option value=""><T>全部状态</T></option>
            {Object.entries(TASK_STATUS_LABELS).map(([value, label]) => <option key={value} value={value}><T>{label}</T></option>)}
          </select>
          <Button type="submit" variant="outline" size="sm"><T>筛选</T></Button>
        </form>
        {rows.length ? (
          <Table aria-label="跨项目 Agent 任务">
            <TableHeader className="bg-secondary/65"><TableRow>
              <TableHead><T>项目或经营记录</T></TableHead><TableHead>Agent</TableHead><TableHead><T>状态</T></TableHead>
              <TableHead><T>触发和原因</T></TableHead><TableHead><T>模型与标价</T></TableHead><TableHead><T>记录时间</T></TableHead><TableHead><T>项目操作</T></TableHead>
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
                    <TableCell className="min-w-44 max-w-64 whitespace-normal break-words"><Link href={href} className="underline"><T>{task.projectName ?? "首客经营记录"}</T></Link></TableCell>
                    <TableCell><T>{AGENT_LABELS[task.agent] ?? task.agent}</T></TableCell>
                    <TableCell>
                      <Badge variant="outline" className="admin-task-status" data-status={task.status}>
                        <T>{TASK_STATUS_LABELS[task.status] ?? task.status}</T>
                      </Badge>
                      {task.paused ? <p className="mt-1 text-xs text-muted-foreground"><T>项目已暂停</T></p> : null}
                    </TableCell>
                    <TableCell className="min-w-32 max-w-72 whitespace-normal break-words">
                      <T>{TASK_TRIGGER_LABELS[task.trigger] ?? task.trigger}</T>{task.reason ? <p className="mt-1 text-muted-foreground">{task.reason}</p> : null}
                    </TableCell>
                    <TableCell><T>{task.provider ?? "无"}</T> / <T>{task.model ?? "无"}</T>
                      <p className="text-muted-foreground"><T>{task.provider === "stub" ? "模拟" : hasModelListPrice(task.model) ? `¥${task.cost.toFixed(4)}` : "未计价"}</T></p>
                    </TableCell>
                    <TableCell>{formatDateTime(task.at)}</TableCell>
                    <TableCell>
                      {canControl ? <div className="flex flex-wrap gap-2">
                        <form action={pauseProjectAction.bind(null, projectId)}>
                          <input type="hidden" name="paused" value={task.paused ? "0" : "1"} />
                          <Button type="submit" variant="outline" size="sm"><T>{task.paused ? "恢复项目" : "暂停项目"}</T></Button>
                        </form>
                        {task.projectStatus === "failed" && !task.paused ? (
                          <form action={retryAction.bind(null, projectId)}><Button type="submit" size="sm"><T>重试项目</T></Button></form>
                        ) : null}
                      </div> : "·"}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        ) : <p className="px-4 py-5 text-sm text-muted-foreground"><T>当前条件下没有任务记录。</T></p>}
        {page > 1 || hasMore ? (
          <I18n><nav className="flex flex-wrap items-center gap-4 border-t px-4 py-3 text-sm" aria-label="任务分页">
            {page > 1 ? <Link href={pageHref(page - 1)} className="underline"><T>上一页</T></Link> : null}
            <span><T>第 </T>{page}<T> 页</T></span>
            {hasMore ? <Link href={pageHref(page + 1)} className="underline"><T>下一页</T></Link> : null}
          </nav></I18n>
        ) : null}
      </section></I18n>
    </main>
  );
}
