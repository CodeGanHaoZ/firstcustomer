import { getLocale } from "@/lib/locale-server";
import { translateUi } from "@/lib/ui-translation";
import { LocalizedInput, LocalizedTag, LocalizedTextarea } from "@/components/localized-controls";
import { T } from "@/components/ui-text";
import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { PositioningOption } from "@/agents/schemas";
import { hasModelListPrice } from "@/ai/call-model";
import { AutoRefresh } from "@/components/auto-refresh";
import { ProvenanceSection } from "@/components/provenance-details";
import { conclusionReviewAction } from "@/app/admin/actions";
import { ReceiptUpload } from "@/components/commerce-details";
import { LandingEditor } from "@/components/landing-editor";
import { ClearProjectDraft } from "@/components/project-draft";
import {
  ClarificationSection,
  DeliverablesSection,
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
import { Decide } from "@/components/decide";
import { Textarea } from "@/components/ui/textarea";
import { getDb } from "@/db";
import { orders, payments, projects } from "@/db/schema";
import { DECISION_LABELS, type Gate, type GateState } from "@/domain/approval";
import { AGENT_LABELS, TASK_STATUS_LABELS, TASK_TRIGGER_LABELS } from "@/domain/office";
import { STATUS_LABELS, usesQuoteFlow, type ProjectStatus } from "@/domain/workflow";
import { NEW_CUSTOMER_LINK_COOKIE, requireAdmin } from "@/lib/auth";
import { formatDateTime, formatYuan } from "@/lib/format";
import { hashToken } from "@/workflow/actions";
import { latestReceipt } from "@/workflow/commerce";
import type { Escalation } from "@/workflow/engine";
import { loadLeads, loadProjectAudit, loadProjectView } from "@/workflow/queries";
import { projectSupport } from "@/workflow/support";
import { RequirementCard } from "@/components/requirement-card";
import { WorkPackageList } from "@/components/work-package-list";
import { requirementHistory } from "@/workflow/requirements";
import { workPackageReadiness } from "@/workflow/work-packages";
import {
  adminDeleteImageAction,
  adminUploadImagesAction,
  campaignExecutedAction,
  cancelAction,
  confirmReceiptAction,
  deleteLeadAction,
  deliverAction,
  editLandingAction,
  escalationAction,
  feedbackAction,
  founderAnswersAction,
  founderDecision,
  founderReceiptUploadAction,
  manualEvidenceAction,
  markTestLeadAction,
  minutesAction,
  ownProductAction,
  ownProductConfirm,
  paymentAction,
  pauseProjectAction,
  regenerateLinkAction,
  replyToSupportAction,
  retryAction,
  retryImagesAction,
  skipClarificationsAction,
  startResearchAction,
  startReviewAction,
} from "../../actions";

export const dynamic = "force-dynamic";
export async function generateMetadata() {
  const locale = await getLocale();
  return { title: translateUi(locale, "项目详情"), robots: { index: false, follow: false } };
}

function GateForm(props: {
  projectId: string;
  gate: Gate;
  version: number;
  state: GateState;
  title: string;
  isOwnProduct: boolean;
  options?: PositioningOption[];
  recommended?: number;
  previewHref?: string;
}) {
  const { projectId, gate, state } = props;
  if (state.founderRequired === false) return <p className="notice"><T>Pro 项目由客户直接确认，无需老板审核。</T></p>;
  if (state.founder === "approved") {
    return (
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <span className="pill pill--wait"><T>你已把关，等待客户确认。</T></span>
        {props.previewHref ? <a href={props.previewHref} className="btn btn--ghost btn--sm" target="_blank" rel="noreferrer"><T>预览第 </T>{props.version}<T> 版</T></a> : null}
        {props.isOwnProduct ? (
          <form action={ownProductConfirm.bind(null, projectId)}>
            <input type="hidden" name="gate" value={gate} />
            <input type="hidden" name="version" value={props.version} />
            <Button type="submit" variant="outline"><T>
              代为确认（自有产品）
            </T></Button>
          </form>
        ) : null}
      </div>
    );
  }
  return (
    <div className="grid gap-4 text-sm">
      <p className="paper__title text-[1.15rem]"><T>{props.title}</T></p>
      {props.previewHref ? <a href={props.previewHref} className="btn btn--ghost btn--sm w-fit" target="_blank" rel="noreferrer"><T>预览待审批的第 </T>{props.version}<T> 版</T></a> : null}
      <Decide action={founderDecision.bind(null, projectId)} approveLabel="把关通过" rejectLabel="退回修改" reasonLabel="退回原因（退回时必填）"
        hidden={{ gate, version: props.version }}>
        {props.options ? (
          <fieldset className="m-0 grid gap-2 border-0 p-0">
            <legend className="eyebrow mb-2"><T>向客户推荐</T></legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {props.options.map((option, i) => (
                <label key={option.audience} className="pick">
                  <input type="radio" name="chosenOption" value={i} defaultChecked={i === props.recommended} />
                  <span><b>{option.audience}</b>{i === props.recommended ? <small><T>推荐</T></small> : null}</span>
                </label>
              ))}
            </div>
          </fieldset>
        ) : null}
      </Decide>
    </div>
  );
}

export default async function AdminProjectPage({ params, searchParams }: PageProps<"/admin/projects/[id]">) {
  const { id } = await params;
  await requireAdmin("workspace.read", `/admin/projects/${id}`);
  const { error, notice, task, created } = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const db = getDb();
  const [project] = await db.select().from(projects).where(eq(projects.id, id));
  if (!project) notFound();
  const [requirements, readiness] = await Promise.all([requirementHistory(db, project.id), workPackageReadiness(db, project)]);
  const issuedToken = created === "1" ? (await cookies()).get(NEW_CUSTOMER_LINK_COOKIE)?.value : undefined;
  const customerHref = issuedToken && hashToken(issuedToken) === project.tokenHash ? `/p/${issuedToken}` : null;
  const [view, audit, projectLeads, [order], support] = await Promise.all([
    loadProjectView(db, project), loadProjectAudit(db, id), loadLeads(db, id),
    db.select().from(orders).where(eq(orders.projectId, id)), projectSupport(db, id),
  ]);
  const orderPayments = order
    ? await db.select().from(payments).where(eq(payments.orderId, order.id))
    : [];
  const receipt = order && usesQuoteFlow(project) ? await latestReceipt(db, order.id) : null;
  const escalation = project.escalation as Escalation | null;
  const bind = <T,>(action: (projectId: string, formData: FormData) => Promise<T>) => action.bind(null, id);
  const canStartNextRound = project.status === "reviewing" && !!view.report?.next_hypothesis;
  const taskStatuses = [...new Set(audit.tasks.map(({ status }) => status))];
  const taskFilter = typeof task === "string" && taskStatuses.includes(task) ? task : "";
  const visibleTasks = taskFilter ? audit.tasks.filter(({ status }) => status === taskFilter) : audit.tasks;
  const acceptanceNote = order?.deliveryStatus === "changes_requested" ? view.decisions
    .filter(({ gate, verdict, subjectVersion }) => gate === "acceptance" && verdict === "reject" && subjectVersion === project.round)
    .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())[0] : null;
  const decisionHistory = [...view.decisions].sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime());

  return (
    <main className="admin-section">
      {view.simulated ? <SimulatedBanner /> : null}
      {order?.paymentMode === "simulated" ? <p className="notice">模拟支付订单 · {order.status === "simulation_active" ? "已校验并开通" : "待客户付款"} · 不计入实际收款与真实客户经营指标。计价版本：{order.pricingSnapshot?.version}，报价 {formatYuan(order.quoteFen ?? 0)}。</p> : null}
      <ProjectHeader project={project}
        eyebrow={<Link className="link-u" href="/admin"><T>返回经营台</T></Link>}
        actions={<a className="btn btn--ghost btn--sm" href="#deliverables"><T>查看交付清单</T></a>} />
      {customerHref ? (
        <div className="notice notice--ok notice--row">
          <ClearProjectDraft intake="admin" />
          <p className="m-0"><T>项目已创建。请将专属链接发给客户，链接将在此处显示 10 分钟。</T></p>
          <Link prefetch={false} href={customerHref} className="btn btn--primary btn--sm"><T>打开客户专属链接</T></Link>
        </div>
      ) : null}
      {project.paused ? <p className="notice notice--wait"><T>项目已暂停。正在执行的步骤完成后停下。</T></p> : null}
      {error ? <p className="notice notice--fail" role="alert"><T>{String(error)}</T></p> : null}
      {notice ? <p className="notice notice--ok break-all" role="status"><T>{String(notice)}</T></p> : null}

      <Card id="decisions" className="scroll-mt-4 border-[#456447] bg-[#f2eee2] shadow-[0_0_0_3px_rgba(69,100,71,0.08)]">
        <CardHeader>
          <p className="eyebrow m-0"><T>当前一步</T></p>
          <CardTitle><T>待我决定</T></CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {project.status === "submitted" && project.productPlan === "legacy" ? (
            <form action={bind(startResearchAction)}>
              <Button type="submit" size="lg"><T>开始研究</T></Button>
            </form>
          ) : null}
          {project.productPlan === "free" && ["submitted", "free_ready"].includes(project.status) ? (
            <p className="text-sm text-muted-foreground">
              <T>{project.status === "submitted" ? "客户可以从专属链接自助启动出海机会分析。" : "出海机会报告已生成，客户可以从专属链接查看结果并购买 Pro。"}</T>
            </p>
          ) : null}
          {project.status === "needs_info" ? (
            <form action={bind(skipClarificationsAction)} className="flex flex-col gap-2 text-sm">
              <p><T>正在等客户回答追问。也可以不再等，让 Research 把未回答的内容写进待确认事项。</T></p>
              <Button type="submit" variant="outline" className="self-start"><T>
                不再等待，继续研究
              </T></Button>
            </form>
          ) : null}
          {(["awaiting_quote", "awaiting_quote_acceptance", "drafting_quote"].includes(project.status) || (project.status === "awaiting_payment" && order?.paymentMode !== "simulated" && !receipt)) ? <p className="notice"><T>客户可在项目页确认 Pro 服务范围与价格并购买，无需老板批价。</T></p> : null}
          {project.status === "awaiting_payment" && order?.paymentMode === "simulated" ? <p className="notice"><T>等待客户完成付款，系统自动校验并开通，无需人工核款。</T></p> : null}
          {project.status === "awaiting_payment" && order && order.paymentMode !== "simulated" && receipt ? (
            <>
              <ReceiptUpload action={bind(founderReceiptUploadAction)} />
              {receipt && receipt.analysisStatus !== "pending" ? (
                <form action={bind(confirmReceiptAction)} className="grid gap-3 rounded-2xl border bg-background p-4 text-sm">
                  <input type="hidden" name="receiptId" value={receipt.id} />
                  <Link href={`/admin/projects/${id}/receipts/${receipt.id}`} target="_blank" rel="noreferrer" className="btn btn--ghost btn--sm w-fit"><T>打开付款截图核对</T></Link>
                  <p><T>已接受的报价 </T>{formatYuan(order.quoteFen ?? 0)}。</p>
                  {receipt.analysis ? (
                    <p><T>截图读取金额 </T><T>{receipt.analysis.amountFen === null ? "未知" : formatYuan(receipt.analysis.amountFen)}</T><T> · 时间 </T>{receipt.analysis.paidAtText ?? <T>未知</T>}<T> · 付款方 </T>{receipt.analysis.payer ?? <T>未知</T>}。{receipt.analysis.unreadable}</p>
                  ) : <p><T>截图自动读取未成功，请人工核对。</T></p>}
                  {receipt.analysis?.amountFen != null && receipt.analysis.amountFen !== order.quoteFen ? (
                    <p className="text-destructive"><T>截图金额与报价不一致，请核对后填写实际到账金额及原因。</T></p>
                  ) : null}
                  <Label htmlFor="confirmed-amount"><T>核对后的实际到账金额（元）</T></Label>
                  <Input id="confirmed-amount" name="yuan" type="number" min="0.01" step="0.01" required />
                  <Label htmlFor="payment-reference"><T>凭证号（选填）</T></Label>
                  <Input id="payment-reference" name="reference" maxLength={200} />
                  <Label htmlFor="payment-reason"><T>金额差异原因（实收与报价不同时必填）</T></Label>
                  <Input id="payment-reason" name="reason" maxLength={500} />
                  <Button type="submit" className="justify-self-start" size="lg"><T>确认实际到账并开始正式服务</T></Button>
                </form>
              ) : <p className="text-sm"><T>{receipt ? "票据员正在读取付款截图。" : "客户已接受报价，等待付款截图。"}</T></p>}
              {receipt?.analysisStatus === "pending" ? <AutoRefresh /> : null}
            </>
          ) : null}
          {project.status === "awaiting_positioning" && view.positioning ? (
            <GateForm
              projectId={id}
              gate="positioning"
              version={project.positioningVersion}
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
              version={view.page?.version ?? 0}
              state={view.gates.publish}
              previewHref={view.page ? `/admin/projects/${id}/preview?version=${view.page.version}` : undefined}
              title={`逐条对照声明和证据摘录。验证仅使用一个免费渠道，额外支出需客户单独确认。${project.budgetNote ? ` 客户预算和时间要求为「${project.budgetNote}」。` : ""}`}
              isOwnProduct={project.isOwnProduct}
            />
          ) : null}
          {project.status === "awaiting_founder" && escalation ? (
            <form action={bind(escalationAction)} className="flex flex-col gap-3 text-sm">
              <p>
                <T>{escalation.route === "clarification-limit" ? "补充信息转人工" : "打回超限"}</T>：{escalation.request.missing}。{escalation.request.reason}
              </p>
              <div className="flex flex-col gap-1">
                <Label htmlFor="note"><T>你的决定</T></Label>
                <LocalizedInput id="note" name="note" required placeholder="例如：按“尚未验证”继续" maxLength={500} />
              </div>
              <fieldset className="m-0 border-0 p-0">
                <legend className="mb-2 font-medium"><T>接下来交给</T></legend>
                <div className="choice-group">
                  {([["researching", "Research 继续补查"], ...(escalation.route !== "clarification-limit" ? [["strategizing", "Strategy 继续制定"], ["preparing_page", "Launch 继续准备页面"]] : [])] as [string, string][]).map(([value, label]) => (
                    <label key={value} className="choice"><input type="radio" name="target" value={value} defaultChecked={value === escalation.from || (value === "researching" && !["strategizing", "preparing_page"].includes(escalation.from))} /><span><T>{label}</T></span></label>
                  ))}
                </div>
              </fieldset>
              <Button type="submit" className="self-start"><T>
                提交裁决
              </T></Button>
            </form>
          ) : null}
          {project.status === "failed" ? (
            <form action={bind(retryAction)} className="flex flex-col gap-2 text-sm">
              <p className="notice notice--fail m-0"><T>失败原因：</T>{project.failedReason}</p>
              <Button type="submit" className="self-start"><T>
                重试（已完成的部分会保留）
              </T></Button>
            </form>
          ) : null}
          {project.status === "collecting" ? (
            <form action={bind(startReviewAction)}>
              <Button type="submit" size="lg"><T>开始复盘</T></Button>
            </form>
          ) : null}
          {project.status === "reviewing" && view.report ? (
            <div className="flex flex-col gap-3">
              <form action={bind(deliverAction)}>
                <input type="hidden" name="deliveryStamp" value={readiness.stamp} />
                <Button type="submit" size="lg" disabled={!readiness.ready}><T>检查通过，确认交付</T></Button>
              </form>
              {canStartNextRound ? (
                <GateForm
                  projectId={id}
                  gate="next_round"
                  version={project.round}
                  state={view.gates.next_round}
                  title={`开启下一轮实验：${view.report.next_hypothesis}`}
                  isOwnProduct={project.isOwnProduct}
                />
              ) : null}
            </div>
          ) : null}
          {["researching", "drafting_quote", "reading_receipt", "strategizing", "preparing_page"].includes(project.status) ||
          (project.status === "reviewing" && !view.report) ? (
            <>
              <AutoRefresh />
              <p className="pill pill--live m-0 w-fit"><T>Agent 正在工作，完成后这里会出现下一步。</T></p>
            </>
          ) : null}
        </CardContent>
      </Card>

      <RequirementCard project={project} history={requirements} />
      <WorkPackageList readiness={readiness} />
      <DeliverablesSection view={view} deliveryStatus={order?.deliveryStatus} closingHref="#finance" />

      <Card id="frontdesk">
        <CardHeader><CardTitle><T>前台 · 客服收件箱</T></CardTitle></CardHeader>
        <CardContent className="space-y-4 text-sm">
          {support.some((item) => item.status === "queued") && !project.paused ? <AutoRefresh /> : null}
          {support.length ? support.map((item) => (
            <article key={item.id} className="grid gap-2 border-b pb-4 last:border-b-0">
              <p className="m-0 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">{formatDateTime(item.createdAt)}
                <span className={item.status === "escalated" ? "pill pill--wait" : item.risk === "complex" ? "pill pill--fail" : item.status === "queued" ? "pill pill--live" : "pill pill--ok"}><T>{item.status === "escalated" ? "待老板处理" : item.risk === "complex" ? "疑难" : item.status === "queued" ? "等待客服" : "已回复"}</T></span></p>
              <p className="m-0 max-w-[85%] rounded-2xl rounded-bl-md border bg-background px-4 py-2.5 font-medium whitespace-pre-wrap">{item.question}</p>
              {item.reply ? <p className="m-0 max-w-[85%] justify-self-end rounded-2xl rounded-br-md bg-[#101210] px-4 py-2.5 whitespace-pre-wrap text-[#fbfaf8]">{item.reply}</p> : null}
              {item.draft && item.status === "escalated" ? <p className="notice m-0"><T>处理建议　</T>{item.draft}</p> : null}
              {item.status === "escalated" || (item.status === "replied" && item.risk === "complex") ? (
                <form action={bind(replyToSupportAction)} className="flex items-end gap-2 rounded-2xl border bg-background p-2">
                  <input type="hidden" name="messageId" value={item.id} />
                  <label htmlFor={`support-${item.id}`} className="sr-only"><T>给客户的回复</T></label>
                  <Textarea id={`support-${item.id}`} name="reply" maxLength={1200} required rows={1} className="min-h-11 border-0 bg-transparent focus-visible:ring-0" />
                  <Button type="submit" className="shrink-0"><T>确认并回复</T></Button>
                </form>
              ) : null}
            </article>
          )) : <p className="text-muted-foreground"><T>客户还没有提问。</T></p>}
        </CardContent>
      </Card>

      <ClarificationSection
        questions={view.clarifications}
        requirementVersion={project.requirementVersion}
        canAnswer={project.status === "needs_info"}
        answerAction={bind(founderAnswersAction)}
      />
      <div id="strategy"><PositioningSection view={view} /></div>
      <div id="launch" className="flex flex-col gap-3">
        <PageSection view={view} previewHref={`/admin/projects/${id}/preview`} />
        {["awaiting_publish", "collecting"].includes(project.status) ? <LandingEditor view={view} action={bind(editLandingAction)} /> : null}
      </div>

      {view.campaign?.status === "approved" ? (
        <Card>
          <CardHeader>
            <CardTitle><T>记录渠道执行</T></CardTitle>
          </CardHeader>
          <CardContent>
            <form action={bind(campaignExecutedAction)} className="flex items-end gap-2 text-sm">
              <input type="hidden" name="campaignId" value={view.campaign.id} />
              <div className="flex flex-1 flex-col gap-1">
                <Label htmlFor="url"><T>真实链接或执行凭证</T></Label>
                <Input id="url" name="url" type="url" required placeholder="https://" />
              </div>
              <Button type="submit"><T>标记已执行</T></Button>
            </form>
          </CardContent>
        </Card>
      ) : null}

      {view.page?.status === "published" ? (
        <Card>
          <CardHeader>
            <CardTitle><T>记录真实回复</T></CardTitle>
          </CardHeader>
          <CardContent>
            <form action={bind(feedbackAction)} className="flex flex-col gap-3 text-sm">
              <input type="hidden" name="landingPageId" value={view.page.id} />
              <div className="choice-group">
                <label className="choice"><input type="radio" name="type" value="reply" defaultChecked /><span><T>回复</T></span></label>
                <label className="choice"><input type="radio" name="type" value="comment" /><span><T>评论</T></span></label>
              </div>
              <LocalizedTextarea name="text" required maxLength={2000} placeholder="粘贴原话" />
              <LocalizedInput name="url" type="url" placeholder="来源链接（选填）" />
              <Button type="submit" className="self-start"><T>
                保存
              </T></Button>
            </form>
            {projectLeads.length ? (
              <ul className="mt-5 grid gap-2">
                {projectLeads.map((lead) => (
                  <li key={lead.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-background px-4 py-3 text-sm">
                    <span className="grid min-w-0 gap-0.5">
                      <strong className="font-medium">{lead.email}{lead.isTest ? <span className="pill ms-2"><T>测试</T></span> : null}</strong>
                      {lead.message ? <span className="text-muted-foreground">{lead.message}</span> : null}
                      <span className="text-xs text-muted-foreground">{formatDateTime(lead.createdAt)}</span>
                    </span>
                    <span className="flex gap-1">
                      <form action={bind(markTestLeadAction)}>
                        <input type="hidden" name="leadId" value={lead.id} />
                        <input type="hidden" name="test" value={lead.isTest ? "0" : "1"} />
                        <Button type="submit" variant="outline" size="sm"><T>{lead.isTest ? "恢复计入" : "标记测试"}</T></Button>
                      </form>
                      <form action={bind(deleteLeadAction)}>
                        <input type="hidden" name="leadId" value={lead.id} />
                        <Button type="submit" variant="ghost" size="sm"><T>
                          删除
                        </T></Button>
                      </form>
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      <div id="growth"><GrowthSection view={view} /></div>
      <ScreenshotsSection
        images={view.images}
        hrefFor={(imageId) => `/admin/projects/${id}/images/${imageId}`}
        editable={project.status !== "delivered" && project.status !== "cancelled"}
        uploadAction={bind(adminUploadImagesAction)}
        deleteAction={bind(adminDeleteImageAction)}
        retryAction={bind(retryImagesAction)}
      />
      <div id="research"><EvidenceSection view={view} /></div>
      <ProvenanceSection provenance={view.provenance} reviewAction={conclusionReviewAction.bind(null, project.id)} />

      <details className="fold">
        <summary>
          <span>
            <span className="fold__title block"><T>人工补充证据</T></span>
            <span className="fold__hint block"><T>Agent 找不到的来源，可以在这里手动补一条</T></span>
          </span>
        </summary>
        <form action={bind(manualEvidenceAction)} className="fold__body grid gap-3 text-sm">
          <LocalizedInput name="url" type="url" required placeholder="来源链接" />
          <LocalizedTextarea name="sourceText" required placeholder="粘贴来源原文（程序会核对摘录是否在原文里）" />
          <LocalizedInput name="quote" required placeholder="要保存的摘录，从原文复制" />
          <LocalizedTag as="div" className="choice-group" role="radiogroup" aria-label="类型">
            {([["revenue", "收入"], ["pricing", "定价"], ["signal", "信号"], ["pain", "痛点"], ["channel", "渠道"], ["product", "产品事实（客户提供）"]] as const).map(([value, label]) => (
              <label key={value} className="choice"><input type="radio" name="kind" value={value} defaultChecked={value === "revenue"} /><span><T>{label}</T></span></label>
            ))}
          </LocalizedTag>
          <LocalizedTag as="div" className="choice-group" role="radiogroup" aria-label="立场">
            {([["support", "支持"], ["against", "反面"], ["neutral", "中性"]] as const).map(([value, label]) => (
              <label key={value} className="choice"><input type="radio" name="stance" value={value} defaultChecked={value === "support"} /><span><T>{label}</T></span></label>
            ))}
          </LocalizedTag>
          <div className="flex flex-wrap gap-2">
            <LocalizedInput name="product" placeholder="产品" className="w-40" />
            <LocalizedInput name="numberValue" placeholder="数字，如 $170" className="w-36" />
            <LocalizedInput name="metric" placeholder="口径，如 TTM" className="w-36" />
          </div>
          <label className="flex items-center gap-2">
            <input type="checkbox" name="customerAuthorized" /><T>
            这是客户授权的支付数据（A 级）
          </T></label>
          <Button type="submit" className="justify-self-start"><T>
            保存证据
          </T></Button>
        </form>
      </details>

      <Card id="tasks">
        <CardHeader>
          <CardTitle><T>Agent 执行记录</T></CardTitle>
          <Link href="/admin/tasks" className="w-fit text-sm underline"><T>查看全部项目任务</T></Link>
        </CardHeader>
        <CardContent>
          {taskStatuses.length > 1 ? (
            <LocalizedTag as="nav" className="mb-4 flex flex-wrap items-center gap-2 text-sm" aria-label="任务状态">
              {["", ...taskStatuses].map((status) => (
                <Link key={status || "all"} href={`/admin/projects/${id}${status ? `?task=${status}` : ""}#tasks`} scroll={false}
                  className={status === taskFilter ? "btn btn--primary btn--sm" : "btn btn--ghost btn--sm"} aria-current={status === taskFilter ? "true" : undefined}>
                  <T>{status ? TASK_STATUS_LABELS[status] ?? status : "全部"}</T>
                </Link>
              ))}
            </LocalizedTag>
          ) : null}
          {project.status !== "delivered" && project.status !== "cancelled" ? (
            <form action={bind(pauseProjectAction)} className="mb-4 flex flex-wrap items-center gap-2 text-sm">
              <input type="hidden" name="paused" value={project.paused ? "0" : "1"} />
              <Button type="submit" variant="outline"><T>{project.paused ? "恢复项目" : "暂停项目"}</T></Button>
              <span className="text-muted-foreground"><T>暂停会在当前步骤结束后生效。</T></span>
            </form>
          ) : null}
          <ol className="m-0 grid list-none gap-2 ps-0">
            {visibleTasks.map((task) => (
              <li key={task.id} id={`task-${task.id}`} className="scroll-mt-24 grid gap-x-4 gap-y-1 rounded-xl border bg-background px-4 py-3 text-sm target:border-[#456447] sm:grid-cols-[minmax(0,1fr)_auto]">
                <p className="m-0 flex flex-wrap items-center gap-2">
                  <strong className="font-medium text-[#101210]"><T>{AGENT_LABELS[task.agent] ?? task.agent}</T></strong>
                  <span className="admin-task-status pill" data-status={task.status}><T>{TASK_STATUS_LABELS[task.status] ?? task.status}</T></span>
                  <span className="text-xs text-muted-foreground"><T>{TASK_TRIGGER_LABELS[task.trigger] ?? task.trigger}</T></span>
                </p>
                <p className="m-0 text-xs text-muted-foreground sm:text-end">{formatDateTime(task.startedAt)} · <T>{task.provider === "stub" ? "模拟" : hasModelListPrice(task.model) ? `¥${task.listCostYuan.toFixed(4)}` : "未计价"}</T></p>
                {task.sendBackReason ?? task.error ? <p className="m-0 text-muted-foreground sm:col-span-2">{task.sendBackReason ?? task.error}</p> : null}
                <p className="m-0 text-xs text-muted-foreground sm:col-span-2"><T>{task.provider ?? "无"}</T> / <T>{task.model ?? "无"}</T></p>
              </li>
            ))}
          </ol>
          <h3 className="eyebrow mt-7"><T>状态变化</T></h3>
          <ul className="timeline">
            {audit.transitions.map((t) => (
              <li key={t.id}>
                {formatDateTime(t.createdAt)} <T>{STATUS_LABELS[t.fromStatus as ProjectStatus] ?? t.fromStatus}</T> →{" "}
                <T>{STATUS_LABELS[t.toStatus as ProjectStatus] ?? t.toStatus}</T>（{t.actor}）{t.reason ? `：${t.reason}` : ""}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card id="approval-history">
        <CardHeader><CardTitle><T>闸门记录</T></CardTitle></CardHeader>
        <CardContent>
          {decisionHistory.length ? <LocalizedTag as="ul" className="timeline" aria-label="项目闸门记录">
            {decisionHistory.map((decision) => <li key={decision.id} data-tone={decision.verdict === "approve" ? "ok" : "fail"}>
              <span className="flex flex-wrap items-center gap-2">
                <strong className="font-medium text-[#101210]"><T>{DECISION_LABELS[decision.gate] ?? decision.gate}</T></strong>
                <span className="text-xs">#{decision.subjectVersion}</span>
                <span className={decision.verdict === "approve" ? "pill pill--ok" : "pill pill--fail"}><T>{decision.verdict === "approve" ? "通过" : "退回"}</T></span>
                <span className="text-xs"><T>{decision.actorRole === "founder" ? "老板" : decision.actorRole === "customer" ? "客户" : "程序"}</T> · {formatDateTime(decision.createdAt)}</span>
              </span>
              {decision.reason ? <span className="block break-words">{decision.reason}</span> : null}
            </li>)}
          </LocalizedTag> : <p className="text-sm text-muted-foreground"><T>还没有闸门记录。</T></p>}
        </CardContent>
      </Card>

      <Card id="finance">
        <CardHeader>
          <CardTitle><T>订单和项目设置</T></CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 text-sm">
          {order ? (
            <>
              <dl className="figures m-0">
                <div className="figure"><dt className="order-last"><span>{order.sku}</span></dt><dd className="m-0"><b><T>{order.quoteFen !== null ? `¥${(order.quoteFen / 100).toFixed(2)}` : "未报价"}</T></b></dd></div>
                <div className="figure"><dt className="order-last"><span><T>付款状态</T></span></dt><dd className="m-0"><b className="text-[1.25rem]"><T>{order.status === "key_activated" ? "密钥已开通 Pro（无实收）" : order.status}</T></b></dd></div>
                <div className="figure"><dt className="order-last"><span><T>交付状态</T></span></dt><dd className="m-0"><b className="text-[1.25rem]">{order.deliveryStatus}</b></dd></div>
              </dl>
              {orderPayments.map((p) => (
                <p key={p.id} className="text-muted-foreground"><T>
                  已收 ¥</T>{(p.amountFen / 100).toFixed(2)}（{p.method}
                  {p.reference ? `，${p.reference}` : ""}）
                </p>
              ))}
              {acceptanceNote ? (
                <div className="notice notice--wait grid">
                  <p className="m-0 font-medium"><T>客户修改意见 · </T>{formatDateTime(acceptanceNote.createdAt)}</p>
                  <p className="whitespace-pre-wrap break-words">{acceptanceNote.reason}</p>
                </div>
              ) : null}
              <details className="fold bg-background">
                <summary><span className="fold__title"><T>调整订单与人工记录</T></span></summary>
                <div className="fold__body grid gap-3">
              {!project.requiresPayment && project.productPlan === "legacy" ? <>
              <form action={bind(paymentAction)} className="flex flex-wrap items-end gap-2">
                <input type="hidden" name="orderId" value={order.id} />
                <LocalizedInput name="yuan" type="number" step="0.01" min="0.01" required placeholder="实收（元）" className="w-40" />
                <LocalizedInput name="method" placeholder="收款方式" className="w-32" />
                <LocalizedInput name="reference" placeholder="凭证号" className="w-40" />
                <Button type="submit" variant="outline"><T>
                  记录真实收款
                </T></Button>
              </form></> : null}
              <form action={bind(minutesAction)} className="flex items-end gap-2">
                <input type="hidden" name="orderId" value={order.id} />
                <Input name="minutes" type="number" min="0" defaultValue={order.founderMinutes} className="w-40" />
                <Button type="submit" variant="outline"><T>
                  更新老板人工分钟
                </T></Button>
              </form>
                </div>
              </details>
            </>
          ) : null}
          <div className="flex flex-wrap gap-2">
            {project.productPlan === "legacy" && (!project.requiresPayment || project.status === "submitted") ? <form action={bind(ownProductAction)}>
              <input type="hidden" name="value" value={project.isOwnProduct ? "0" : "1"} />
              <Button type="submit" variant="outline">
                <T>{project.isOwnProduct ? "取消自有产品标记" : "标记为自有产品"}</T>
              </Button>
            </form> : null}
            <form action={bind(regenerateLinkAction)}>
              <Button type="submit" variant="outline"><T>
                作废并重新生成项目链接
              </T></Button>
            </form>
            {project.status !== "delivered" && project.status !== "cancelled" ? (
              <form action={bind(cancelAction)}>
                <Button type="submit" variant="ghost"><T>
                  取消项目
                </T></Button>
              </form>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
