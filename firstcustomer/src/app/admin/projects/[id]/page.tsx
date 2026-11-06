import { eq } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { PositioningOption } from "@/agents/schemas";
import { AutoRefresh } from "@/components/auto-refresh";
import {
  ClarificationSection,
  EvidenceSection,
  GrowthSection,
  PageSection,
  PositioningSection,
  ProjectHeader,
  ScreenshotsSection,
  SimulatedBanner,
} from "@/components/project-details";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { getDb } from "@/db";
import { orders, payments, projects } from "@/db/schema";
import type { Gate, GateState } from "@/domain/approval";
import { STATUS_LABELS, type ProjectStatus } from "@/domain/workflow";
import { requireAdmin } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";
import type { Escalation } from "@/workflow/engine";
import { loadLeads, loadProjectAudit, loadProjectView } from "@/workflow/queries";
import {
  adminDeleteImageAction,
  adminUploadImagesAction,
  campaignExecutedAction,
  cancelAction,
  deleteLeadAction,
  deliverAction,
  escalationAction,
  feedbackAction,
  founderAnswersAction,
  founderDecision,
  manualEvidenceAction,
  minutesAction,
  ownProductAction,
  ownProductConfirm,
  paymentAction,
  quoteAction,
  regenerateLinkAction,
  retryAction,
  retryImagesAction,
  skipClarificationsAction,
  startResearchAction,
  startReviewAction,
} from "../../actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "项目详情", robots: { index: false, follow: false } };

const AGENT_LABELS: Record<string, string> = {
  vision: "截图读取",
  research: "Research",
  strategy: "Strategy",
  launch: "Launch",
  growth: "Growth",
};
const TASK_STATUS: Record<string, string> = {
  running: "运行中",
  succeeded: "完成",
  failed: "失败",
  sent_back: "已打回",
  rejected: "声明检查未通过",
  escalated: "打回超限",
};
const TRIGGER_LABELS: Record<string, string> = {
  normal: "正常",
  send_back: "打回后执行",
  rewrite: "改写",
};

function GateForm(props: {
  projectId: string;
  gate: Gate;
  state: GateState;
  title: string;
  isOwnProduct: boolean;
  options?: PositioningOption[];
  recommended?: number;
}) {
  const { projectId, gate, state } = props;
  if (state.founder === "approved") {
    return (
      <div className="flex flex-col gap-2 text-sm">
        <p>你已把关，等待客户确认。</p>
        {props.isOwnProduct ? (
          <form action={ownProductConfirm.bind(null, projectId)}>
            <input type="hidden" name="gate" value={gate} />
            <Button type="submit" variant="outline">
              代为确认（自有产品）
            </Button>
          </form>
        ) : null}
      </div>
    );
  }
  return (
    <form action={founderDecision.bind(null, projectId)} className="flex flex-col gap-3 text-sm">
      <p>{props.title}</p>
      <input type="hidden" name="gate" value={gate} />
      {props.options ? (
        <fieldset className="flex flex-col gap-1">
          <legend className="mb-1 font-medium">向客户推荐</legend>
          {props.options.map((option, i) => (
            <label key={option.audience} className="flex gap-2">
              <input type="radio" name="chosenOption" value={i} defaultChecked={i === props.recommended} />
              {option.audience}
            </label>
          ))}
        </fieldset>
      ) : null}
      <div className="flex flex-col gap-1">
        <Label htmlFor={`${gate}-reason`}>退回原因（退回时必填）</Label>
        <Input id={`${gate}-reason`} name="reason" maxLength={500} />
      </div>
      <div className="flex gap-2">
        <Button type="submit" name="verdict" value="approve">
          把关通过
        </Button>
        <Button type="submit" name="verdict" value="reject" variant="outline">
          退回修改
        </Button>
      </div>
    </form>
  );
}

export default async function AdminProjectPage({ params, searchParams }: PageProps<"/admin/projects/[id]">) {
  await requireAdmin();
  const { id } = await params;
  const { error, notice } = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const db = getDb();
  const [project] = await db.select().from(projects).where(eq(projects.id, id));
  if (!project) notFound();
  const view = await loadProjectView(db, project);
  const audit = await loadProjectAudit(db, id);
  const projectLeads = await loadLeads(db, id);
  const [order] = await db.select().from(orders).where(eq(orders.projectId, id));
  const orderPayments = order
    ? await db.select().from(payments).where(eq(payments.orderId, order.id))
    : [];
  const escalation = project.escalation as Escalation | null;
  const bind = <T,>(action: (projectId: string, formData: FormData) => Promise<T>) => action.bind(null, id);
  const canStartNextRound = project.status === "reviewing" && !!view.report?.next_hypothesis;

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-6 py-10">
      <Link className="text-sm underline" href="/admin">
        返回经营台
      </Link>
      {view.simulated ? <SimulatedBanner /> : null}
      <ProjectHeader project={project} />
      {error ? <p className="text-sm text-destructive">{String(error)}</p> : null}
      {notice ? <p className="break-all rounded-md border p-3 text-sm">{String(notice)}</p> : null}

      <Card className="border-primary">
        <CardHeader>
          <CardTitle>待我决定</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {project.status === "submitted" ? (
            <form action={bind(startResearchAction)}>
              <Button type="submit">开始研究</Button>
            </form>
          ) : null}
          {project.status === "needs_info" ? (
            <form action={bind(skipClarificationsAction)} className="flex flex-col gap-2 text-sm">
              <p>正在等客户回答追问。也可以不再等，让 Research 把未回答的内容写进待确认事项。</p>
              <Button type="submit" variant="outline" className="self-start">
                不再等待，继续研究
              </Button>
            </form>
          ) : null}
          {project.status === "awaiting_positioning" && view.positioning ? (
            <GateForm
              projectId={id}
              gate="positioning"
              state={view.gates.positioning}
              title="把关定位方案，通过后交给客户确认。"
              isOwnProduct={project.isOwnProduct}
              options={view.positioning.options as PositioningOption[]}
              recommended={view.positioning.recommendedOption}
            />
          ) : null}
          {project.status === "awaiting_publish" ? (
            <GateForm
              projectId={id}
              gate="publish"
              state={view.gates.publish}
              title="逐条对照声明和证据摘录，通过后交给客户确认。"
              isOwnProduct={project.isOwnProduct}
            />
          ) : null}
          {project.status === "awaiting_founder" && escalation ? (
            <form action={bind(escalationAction)} className="flex flex-col gap-3 text-sm">
              <p>
                打回超限（{escalation.route}）：{escalation.request.missing}。{escalation.request.reason}
              </p>
              <div className="flex flex-col gap-1">
                <Label htmlFor="note">你的决定</Label>
                <Input id="note" name="note" required placeholder="例如：按“尚未验证”继续" maxLength={500} />
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor="target">接下来交给</Label>
                <select id="target" name="target" className="h-9 rounded-md border bg-background px-3" defaultValue={escalation.from}>
                  <option value="researching">Research 继续补查</option>
                  <option value="strategizing">Strategy 继续制定</option>
                  <option value="preparing_page">Launch 继续准备页面</option>
                </select>
              </div>
              <Button type="submit" className="self-start">
                提交裁决
              </Button>
            </form>
          ) : null}
          {project.status === "failed" ? (
            <form action={bind(retryAction)} className="flex flex-col gap-2 text-sm">
              <p className="text-destructive">失败原因：{project.failedReason}</p>
              <Button type="submit" className="self-start">
                重试（已完成的部分会保留）
              </Button>
            </form>
          ) : null}
          {project.status === "collecting" ? (
            <form action={bind(startReviewAction)}>
              <Button type="submit">开始复盘</Button>
            </form>
          ) : null}
          {project.status === "reviewing" && view.report ? (
            <div className="flex flex-col gap-3">
              <form action={bind(deliverAction)}>
                <Button type="submit">确认交付</Button>
              </form>
              {canStartNextRound ? (
                <GateForm
                  projectId={id}
                  gate="next_round"
                  state={view.gates.next_round}
                  title={`开启下一轮实验：${view.report.next_hypothesis}`}
                  isOwnProduct={project.isOwnProduct}
                />
              ) : null}
            </div>
          ) : null}
          {["researching", "strategizing", "preparing_page"].includes(project.status) ||
          (project.status === "reviewing" && !view.report) ? (
            <>
              <AutoRefresh />
              <p className="text-sm text-muted-foreground">Agent 正在工作，完成后这里会出现下一步。</p>
            </>
          ) : null}
        </CardContent>
      </Card>

      <ClarificationSection
        questions={view.clarifications}
        canAnswer={project.status === "needs_info"}
        answerAction={bind(founderAnswersAction)}
      />
      <PositioningSection view={view} />
      <PageSection view={view} previewHref={`/admin/projects/${id}/preview`} />

      {view.campaign?.status === "approved" ? (
        <Card>
          <CardHeader>
            <CardTitle>记录渠道执行</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={bind(campaignExecutedAction)} className="flex items-end gap-2 text-sm">
              <input type="hidden" name="campaignId" value={view.campaign.id} />
              <div className="flex flex-1 flex-col gap-1">
                <Label htmlFor="url">真实链接或执行凭证</Label>
                <Input id="url" name="url" type="url" required placeholder="https://" />
              </div>
              <Button type="submit">标记已执行</Button>
            </form>
          </CardContent>
        </Card>
      ) : null}

      {view.page?.status === "published" ? (
        <Card>
          <CardHeader>
            <CardTitle>记录真实回复</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={bind(feedbackAction)} className="flex flex-col gap-3 text-sm">
              <input type="hidden" name="landingPageId" value={view.page.id} />
              <select name="type" className="h-9 w-32 rounded-md border bg-background px-3" defaultValue="reply">
                <option value="reply">回复</option>
                <option value="comment">评论</option>
              </select>
              <Textarea name="text" required maxLength={2000} placeholder="粘贴原话" />
              <Input name="url" type="url" placeholder="来源链接（选填）" />
              <Button type="submit" className="self-start">
                保存
              </Button>
            </form>
            {projectLeads.length ? (
              <Table className="mt-4">
                <TableHeader>
                  <TableRow>
                    <TableHead>邮箱</TableHead>
                    <TableHead>留言</TableHead>
                    <TableHead>时间</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {projectLeads.map((lead) => (
                    <TableRow key={lead.id}>
                      <TableCell>{lead.email}</TableCell>
                      <TableCell className="whitespace-normal">{lead.message}</TableCell>
                      <TableCell>{formatDateTime(lead.createdAt)}</TableCell>
                      <TableCell>
                        <form action={bind(deleteLeadAction)}>
                          <input type="hidden" name="leadId" value={lead.id} />
                          <Button type="submit" variant="ghost" size="sm">
                            删除
                          </Button>
                        </form>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      <GrowthSection view={view} />
      <ScreenshotsSection
        images={view.images}
        hrefFor={(imageId) => `/admin/projects/${id}/images/${imageId}`}
        editable={project.status !== "delivered" && project.status !== "cancelled"}
        uploadAction={bind(adminUploadImagesAction)}
        deleteAction={bind(adminDeleteImageAction)}
        retryAction={bind(retryImagesAction)}
      />
      <EvidenceSection view={view} />

      <Card>
        <CardHeader>
          <CardTitle>人工补充证据</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={bind(manualEvidenceAction)} className="flex flex-col gap-3 text-sm">
            <Input name="url" type="url" required placeholder="来源链接" />
            <Textarea name="sourceText" required placeholder="粘贴来源原文（程序会核对摘录是否在原文里）" />
            <Input name="quote" required placeholder="要保存的摘录，从原文复制" />
            <div className="flex flex-wrap gap-2">
              <select name="kind" className="h-9 rounded-md border bg-background px-3" defaultValue="revenue">
                <option value="revenue">收入</option>
                <option value="pricing">定价</option>
                <option value="signal">信号</option>
                <option value="pain">痛点</option>
                <option value="channel">渠道</option>
                <option value="product">产品事实（客户提供）</option>
              </select>
              <select name="stance" className="h-9 rounded-md border bg-background px-3" defaultValue="support">
                <option value="support">支持</option>
                <option value="against">反面</option>
                <option value="neutral">中性</option>
              </select>
              <Input name="product" placeholder="产品" className="w-40" />
              <Input name="numberValue" placeholder="数字，如 $170" className="w-32" />
              <Input name="metric" placeholder="口径，如 TTM" className="w-32" />
            </div>
            <label className="flex items-center gap-2">
              <input type="checkbox" name="customerAuthorized" />
              这是客户授权的支付数据（A 级）
            </label>
            <Button type="submit" className="self-start">
              保存证据
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Agent 执行记录</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Agent</TableHead>
                <TableHead>触发</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>打回或拦截原因</TableHead>
                <TableHead>模型</TableHead>
                <TableHead>标价成本</TableHead>
                <TableHead>开始时间</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {audit.tasks.map((task) => (
                <TableRow key={task.id}>
                  <TableCell>{AGENT_LABELS[task.agent] ?? task.agent}</TableCell>
                  <TableCell>{TRIGGER_LABELS[task.trigger] ?? task.trigger}</TableCell>
                  <TableCell>{TASK_STATUS[task.status] ?? task.status}</TableCell>
                  <TableCell className="whitespace-normal">{task.sendBackReason ?? task.error ?? ""}</TableCell>
                  <TableCell>
                    {task.provider ?? "无"} / {task.model ?? "无"}
                  </TableCell>
                  <TableCell>¥{task.listCostYuan.toFixed(4)}</TableCell>
                  <TableCell>{formatDateTime(task.startedAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <h3 className="mt-6 mb-2 text-sm font-medium">状态变化</h3>
          <ul className="flex flex-col gap-1 text-sm text-muted-foreground">
            {audit.transitions.map((t) => (
              <li key={t.id}>
                {formatDateTime(t.createdAt)} {STATUS_LABELS[t.fromStatus as ProjectStatus] ?? t.fromStatus} →{" "}
                {STATUS_LABELS[t.toStatus as ProjectStatus] ?? t.toStatus}（{t.actor}）{t.reason ? `：${t.reason}` : ""}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>订单和项目设置</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 text-sm">
          {order ? (
            <>
              <p>
                {order.sku}：
                {order.quoteFen ? `报价 ¥${(order.quoteFen / 100).toFixed(2)}` : "未报价"}，付款状态 {order.status}，交付状态 {order.deliveryStatus}
              </p>
              {orderPayments.map((p) => (
                <p key={p.id} className="text-muted-foreground">
                  已收 ¥{(p.amountFen / 100).toFixed(2)}（{p.method}
                  {p.reference ? `，${p.reference}` : ""}）
                </p>
              ))}
              <form action={bind(quoteAction)} className="flex items-end gap-2">
                <input type="hidden" name="orderId" value={order.id} />
                <Input name="yuan" type="number" step="0.01" min="0" required placeholder="报价（元）" className="w-40" />
                <Button type="submit" variant="outline">
                  保存报价
                </Button>
              </form>
              <form action={bind(paymentAction)} className="flex flex-wrap items-end gap-2">
                <input type="hidden" name="orderId" value={order.id} />
                <Input name="yuan" type="number" step="0.01" min="0.01" required placeholder="实收（元）" className="w-40" />
                <Input name="method" placeholder="收款方式" className="w-32" />
                <Input name="reference" placeholder="凭证号" className="w-40" />
                <Button type="submit" variant="outline">
                  记录真实收款
                </Button>
              </form>
              <form action={bind(minutesAction)} className="flex items-end gap-2">
                <input type="hidden" name="orderId" value={order.id} />
                <Input name="minutes" type="number" min="0" defaultValue={order.founderMinutes} className="w-40" />
                <Button type="submit" variant="outline">
                  更新老板人工分钟
                </Button>
              </form>
            </>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <form action={bind(ownProductAction)}>
              <input type="hidden" name="value" value={project.isOwnProduct ? "0" : "1"} />
              <Button type="submit" variant="outline">
                {project.isOwnProduct ? "取消自有产品标记" : "标记为自有产品"}
              </Button>
            </form>
            <form action={bind(regenerateLinkAction)}>
              <Button type="submit" variant="outline">
                作废并重新生成项目链接
              </Button>
            </form>
            {project.status !== "delivered" && project.status !== "cancelled" ? (
              <form action={bind(cancelAction)}>
                <Button type="submit" variant="ghost">
                  取消项目
                </Button>
              </form>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
