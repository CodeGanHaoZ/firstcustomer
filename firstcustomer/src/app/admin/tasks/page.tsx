import { getLocale } from "@/lib/locale-server";
import { translateUi } from "@/lib/ui-translation";
import { T, I18n } from "@/components/ui-text";
import Link from "next/link";
import { hasModelListPrice } from "@/ai/call-model";
import { AutoRefresh } from "@/components/auto-refresh";
import { Button } from "@/components/ui/button";
import type { CSSProperties } from "react";
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
      <I18n><section className="paper min-w-0 overflow-hidden p-0" aria-label="任务记录">
        <nav className="flex flex-wrap items-center gap-2 border-b px-4 py-3 text-sm" aria-label="任务状态">
          {[["", "全部状态"], ...Object.entries(TASK_STATUS_LABELS)].map(([value, label]) => (
            <Link key={value || "all"} href={value ? `/admin/tasks?status=${value}` : "/admin/tasks"}
              className={value === status ? "btn btn--primary btn--sm" : "btn btn--ghost btn--sm"} aria-current={value === status ? "true" : undefined}>
              <T>{label}</T>
            </Link>
          ))}
        </nav>
        {rows.length ? (
          <ol className="m-0 grid list-none gap-2 p-4" aria-label="跨项目 Agent 任务">
            {rows.map((task, index) => {
              const projectId = task.projectId;
              const canControl = projectId && task.projectStatus && !["delivered", "cancelled"].includes(task.projectStatus) && !controlled.has(projectId);
              if (projectId) controlled.add(projectId);
              const href = projectId ? `/admin/projects/${projectId}#task-${task.id}`
                : task.agent === "weekly" ? `/admin/reports?report=${task.id}` : "/admin#standup";
              return (
                <li key={task.id} className="rise grid gap-x-4 gap-y-2 rounded-xl border bg-background px-4 py-3 text-sm md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_auto] md:items-center" style={{ "--i": Math.min(index, 10) } as CSSProperties}>
                  <div className="grid min-w-0 gap-1">
                    <Link href={href} className="link-u w-fit break-words font-medium"><T>{task.projectName ?? "首客经营记录"}</T></Link>
                    <p className="m-0 flex flex-wrap items-center gap-2">
                      <strong className="font-medium text-[#101210]"><T>{AGENT_LABELS[task.agent] ?? task.agent}</T></strong>
                      <span className="admin-task-status pill" data-status={task.status}><T>{TASK_STATUS_LABELS[task.status] ?? task.status}</T></span>
                      {task.paused ? <span className="pill pill--wait"><T>项目已暂停</T></span> : null}
                    </p>
                  </div>
                  <div className="grid min-w-0 gap-0.5 text-muted-foreground">
                    <span><T>{TASK_TRIGGER_LABELS[task.trigger] ?? task.trigger}</T>{task.reason ? <> · {task.reason}</> : null}</span>
                    <span className="text-xs">{formatDateTime(task.at)} · <T>{task.provider ?? "无"}</T> / <T>{task.model ?? "无"}</T> · <T>{task.provider === "stub" ? "模拟" : hasModelListPrice(task.model) ? `¥${task.cost.toFixed(4)}` : "未计价"}</T></span>
                  </div>
                  {canControl ? <div className="flex flex-wrap gap-2 md:justify-end">
                    <form action={pauseProjectAction.bind(null, projectId)}>
                      <input type="hidden" name="paused" value={task.paused ? "0" : "1"} />
                      <Button type="submit" variant="outline" size="sm"><T>{task.paused ? "恢复项目" : "暂停项目"}</T></Button>
                    </form>
                    {task.projectStatus === "failed" && !task.paused ? (
                      <form action={retryAction.bind(null, projectId)}><Button type="submit" size="sm"><T>重试项目</T></Button></form>
                    ) : null}
                  </div> : <span aria-hidden="true" />}
                </li>
              );
            })}
          </ol>
        ) : <p className="px-4 py-5 text-sm text-muted-foreground"><T>当前条件下没有任务记录。</T></p>}
        {page > 1 || hasMore ? (
          <I18n><nav className="flex flex-wrap items-center gap-4 border-t px-4 py-3 text-sm" aria-label="任务分页">
            {page > 1 ? <Link href={pageHref(page - 1)} className="btn btn--ghost btn--sm"><T>上一页</T></Link> : null}
            <span><T>第 </T>{page}<T> 页</T></span>
            {hasMore ? <Link href={pageHref(page + 1)} className="btn btn--ghost btn--sm"><T>下一页</T></Link> : null}
          </nav></I18n>
        ) : null}
      </section></I18n>
    </main>
  );
}
