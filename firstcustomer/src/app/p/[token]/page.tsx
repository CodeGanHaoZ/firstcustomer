import { LocalizedLink } from "@/components/localized-controls";
import { getLocale } from "@/lib/locale-server";
import { translateUi } from "@/lib/ui-translation";
import { T } from "@/components/ui-text";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AutoRefresh } from "@/components/auto-refresh";
import { LanguageSwitch } from "@/components/language-switch";
import { BrandMark } from "@/components/brand-mark";
import { PaymentCodeImage, ProposalDetails, ReceiptUpload } from "@/components/commerce-details";
import { OfficeMap, type OfficeStation } from "@/components/office-map";
import { OfficeStage } from "@/components/office-stage";
import { ClearProjectDraft } from "@/components/project-draft";
import { RequirementCard } from "@/components/requirement-card";
import { WorkPackageList } from "@/components/work-package-list";
import { requirementHistory } from "@/workflow/requirements";
import { workPackageReadiness } from "@/workflow/work-packages";
import { customerRequirementsAction } from "./actions";
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
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { getDb } from "@/db";
import type { Gate } from "@/domain/approval";
import { customerProgress } from "@/domain/customer-progress";
import { DEPARTMENTS, officeRoomForAgent } from "@/domain/office";
import { canStartFreeDiagnosis, usesQuoteFlow } from "@/domain/workflow";
import { formatDateTime, formatYuan } from "@/lib/format";
import { findCustomerProject, isAccountProjectToken } from "@/lib/customer-project";
import { confirmedOrderPayment, hasPaymentCode, latestReceipt, projectOrder } from "@/workflow/commerce";
import { loadOfficeTransfer } from "@/workflow/office";
import { loadProjectView, runningProjectAgents } from "@/workflow/queries";
import { projectSupport } from "@/workflow/support";
import { customerAcceptanceAction, customerAnswers, customerDecision, customerDeleteImage, customerProposalAction, customerReceiptAction, customerRequestProAction, customerSupportAction, customerUploadImages } from "./actions";
import "../../admin/office.css";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return {
  title: translateUi(locale, "我的出海项目"),
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};
}

const GATE_TEXT: Record<Gate, string> = {
  positioning: "请确认老板推荐的定位方案",
  publish: "请确认页面和渠道素材，确认后页面会公开",
  next_round: "请确认是否开启下一轮实验",
};

export default async function CustomerProjectPage({ params, searchParams }: PageProps<"/p/[token]">) {
  const { token } = await params;
  const { error, notice, intake } = await searchParams;
  const db = getDb();
  const project = await findCustomerProject(db, token);
  if (!project) notFound();
  const [requirements, readiness] = await Promise.all([requirementHistory(db, project.id), workPackageReadiness(db, project)]);
  const [view, order, support, runningAgents, transfer] = await Promise.all([
    loadProjectView(db, project), projectOrder(db, project.id), projectSupport(db, project.id), runningProjectAgents(db, project),
    project.status === "submitted" || project.status === "cancelled" ? null : loadOfficeTransfer(db, project.id),
  ]);
  const commercialOrder = usesQuoteFlow(project) ? order : null;
  const canStartFree = canStartFreeDiagnosis(project, order);
  const proPaid = project.productPlan === "pro" && commercialOrder?.status === "paid";
  const advancedAvailable = project.productPlan === "legacy" ? !canStartFree : proPaid;
  const visibleProposal = commercialOrder && ["quoted", "accepted", "paid"].includes(commercialOrder.status)
    ? commercialOrder.proposal : null;
  const awaitingPayment = !!commercialOrder && commercialOrder.status === "accepted" &&
    ["awaiting_payment", "reading_receipt"].includes(project.status);
  const [codeReady, receipt, confirmedPayment] = await Promise.all([
    awaitingPayment ? hasPaymentCode(db) : false,
    commercialOrder && awaitingPayment ? latestReceipt(db, commercialOrder.id) : null,
    commercialOrder?.status === "paid" ? confirmedOrderPayment(db, commercialOrder.id) : null,
  ]);

  const openGate: Gate | null =
    project.status === "awaiting_positioning" &&
    view.gates.positioning.founder === "approved" &&
    view.gates.positioning.customer === "pending"
      ? "positioning"
      : project.status === "awaiting_publish" &&
          view.gates.publish.founder === "approved" &&
          view.gates.publish.customer === "pending"
        ? "publish"
        : project.status === "reviewing" &&
            view.gates.next_round.founder === "approved" &&
            view.gates.next_round.customer === "pending"
          ? "next_round"
          : null;
  const progress = customerProgress({
    status: project.status, paused: project.paused, runningAgents, openGate, reportReady: !!view.report,
    quoteVisible: !!visibleProposal, awaitingPayment, receiptUploaded: !!receipt, deliveryStatus: order?.deliveryStatus, canStartFree,
  });
  const supportPending = !project.paused && support.some((item) => item.status === "queued");
  const workingRooms = new Set(project.status === "cancelled" ? [] : runningAgents.map(officeRoomForAgent));
  const stations: OfficeStation[] = DEPARTMENTS.map(({ key }) => ({
    key,
    state: workingRooms.has(key) ? "running" : "idle",
    detail: workingRooms.has(key) ? "正在处理你的项目" : "当前项目在该工位暂无运行中的任务",
  }));
  const activeRoom = stations.find(({ state }) => state === "running")?.key;
  const finished = project.status === "free_ready" || project.status === "cancelled" || (project.status === "delivered" && order?.deliveryStatus === "accepted");
  const refresh = supportPending || activeRoom || project.status === "submitted" ? 3 : progress.refreshSeconds ?? (finished ? null : 12);

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-6 py-10">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-3">
        <LocalizedLink href="/#cta" aria-label="返回首页" className="inline-flex"><BrandMark /></LocalizedLink>
        <div className="flex flex-wrap items-center gap-2 text-sm font-semibold">
          {project.productPlan !== "legacy" || canStartFree ? (
            <span className="rounded-md bg-secondary px-2 py-1 text-secondary-foreground">
              <T>{proPaid ? "Pro" : project.productPlan === "pro" ? "Free · Pro 待开通" : "Free"}</T>
            </span>
          ) : null}
          <span className="text-muted-foreground"><T>客户项目工作台</T></span><LanguageSwitch />
        </div>
      </div>
      {intake === "public" ? <ClearProjectDraft intake="public" /> : null}
      {view.simulated ? <SimulatedBanner /> : null}
      <ProjectHeader project={project} />
      {error ? <p className="text-sm text-destructive"><T>{String(error)}</T></p> : null}
      {notice ? <p className="rounded-md border p-3 text-sm"><T>{String(notice)}</T></p> : null}
      <p className="text-sm text-muted-foreground">
        {isAccountProjectToken(token) ? (
          <><T>你可以随时从 </T><Link href="/account" className="font-semibold underline underline-offset-4"><T>我的项目</T></Link><T> 回到这里。</T></>
        ) : <T>通过这个专属链接可查看当前项目的进度、报价和交付。请妥善保管，如需作废请联系首客。</T>}
      </p>

      {refresh ? <AutoRefresh seconds={refresh} /> : null}
      <Card className="bg-secondary" aria-labelledby="customer-progress-title">
        <CardHeader><CardTitle><h2 id="customer-progress-title"><T>当前进度</T></h2></CardTitle></CardHeader>
        <CardContent className="flex flex-col gap-2 text-sm">
          <div role="status">
            <p className="font-semibold"><T>{progress.title}</T></p>
            <p className="text-muted-foreground"><T>{progress.detail}</T></p>
          </div>
          {progress.action ? <a className="self-start font-medium underline underline-offset-4" href={progress.action.href}><T>{progress.action.label}</T></a> : null}
          {canStartFree ? (
            <Link href="/#cta" className={buttonVariants()}>
              <T>{project.status === "failed" ? "重新分析出海机会" : "免费分析出海机会"}</T>
            </Link>
          ) : null}
          <section aria-labelledby="customer-office-title" className="mt-2 grid gap-3 border-t pt-4">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <h3 id="customer-office-title" className="text-base font-semibold"><T>项目办公室</T></h3>
              {refresh ? <p className="text-xs text-muted-foreground"><T>自动更新当前项目进度</T></p> : null}
            </div>
            <OfficeStage transfer={transfer} customerView focusRoom={activeRoom}>
              <OfficeMap stations={stations} customerView />
            </OfficeStage>
          </section>
        </CardContent>
      </Card>

      {commercialOrder && visibleProposal ? (
        <Card id="proposal">
          <CardHeader><CardTitle><T>首客服务提案</T></CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-4">
            <ProposalDetails proposal={visibleProposal} version={commercialOrder.quoteVersion} quoteFen={commercialOrder.quoteFen} />
            {project.status === "awaiting_quote_acceptance" ? (
              <form action={customerProposalAction.bind(null, token)} className="flex flex-col gap-3">
                <input type="hidden" name="version" value={commercialOrder.quoteVersion} />
                <Label htmlFor="proposal-feedback"><T>退回原因（退回时必填）</T></Label>
                <Input id="proposal-feedback" name="reason" maxLength={500} />
                <div className="flex flex-wrap gap-2">
                  <Button name="verdict" value="approve" type="submit"><T>接受报价</T></Button>
                  <Button name="verdict" value="reject" type="submit" variant="outline"><T>退回报价</T></Button>
                </div>
              </form>
            ) : null}
            {commercialOrder.status === "paid" ? (
              <div className="space-y-1 rounded-md border p-3 text-sm">
                <p className="font-medium"><T>首客已确认到账，正式服务已开始。</T></p>
                {confirmedPayment ? <p><T>实际到账 </T>{formatYuan(confirmedPayment.amountFen)} · {formatDateTime(confirmedPayment.paidAt)}</p> : null}
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {view.diagnosis ? (
        <Card id="diagnosis" className="scroll-mt-4">
          <CardHeader><CardTitle><T>出海机会报告</T></CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p>{view.diagnosis.summary}</p>
            <ul className="list-disc space-y-1 pl-5">
              {view.diagnosis.candidates.map((candidate) => <li key={candidate.name}><strong>{candidate.name}</strong>　{candidate.why}</li>)}
            </ul>
            {view.diagnosis.unknowns.length ? <p><T>待验证　</T>{view.diagnosis.unknowns.join("、")}</p> : null}
          </CardContent>
        </Card>
      ) : null}

      {project.productPlan === "free" && project.status === "free_ready" && !project.paused ? (
        <Card aria-labelledby="project-pro-title">
          <CardHeader><CardTitle><h2 id="project-pro-title"><T>升级到 Pro</T></h2></CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-3 text-sm">
            <p><T>根据出海机会报告继续做完整定位、英文验证页、渠道行动和增长复盘。</T></p>
            <p className="text-muted-foreground"><T>申请后可查看服务提案和报价，由你决定是否付款。</T></p>
            <form action={customerRequestProAction.bind(null, token)}>
              <Button type="submit"><T>申请 Pro 报价</T></Button>
            </form>
          </CardContent>
        </Card>
      ) : null}

      {awaitingPayment ? (
        <Card id="payment">
          <CardHeader><CardTitle><T>首客服务付款与到账确认</T></CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-4 text-sm">
            {receipt ? <p><T>付款截图已收到，等待首客核对实际到账。 </T><a className="underline" href={`/p/${token}/receipts/${receipt.id}`}><T>查看截图</T></a></p> : (
              codeReady ? <><PaymentCodeImage token={token} /><p><T>扫码后请上传付款截图。</T></p></>
                : <p><T>首客正在准备收款码，收款码配置后会在这里显示。</T></p>
            )}
            {project.status === "awaiting_payment" ? <ReceiptUpload action={customerReceiptAction.bind(null, token)} /> : null}
          </CardContent>
        </Card>
      ) : null}

      {openGate ? (
        <Card id="approval" className="border-primary">
          <CardHeader>
            <CardTitle><T>待你确认</T></CardTitle>
          </CardHeader>
          <CardContent>
            <form action={customerDecision.bind(null, token)} className="flex flex-col gap-3">
              <p className="text-sm"><T>{GATE_TEXT[openGate]}</T></p>
              {openGate === "publish" && view.page ? (
                <a href={`/p/${token}/preview?version=${view.page.version}`} target="_blank" rel="noreferrer" className="self-start text-sm underline"><T>
                  预览待确认的第 </T>{view.page.version}<T> 版
                </T></a>
              ) : null}
              {openGate === "publish" ? <p className="text-sm"><T>实验使用一个免费渠道。额外付费推广需要单独确认。</T><T>{project.budgetNote ? `你提交的预算和时间要求为「${project.budgetNote}」。` : ""}</T></p> : null}
              <input type="hidden" name="gate" value={openGate} />
              <input type="hidden" name="version" value={openGate === "publish" ? view.page?.version : openGate === "positioning" ? project.positioningVersion : project.round} />
              <div className="flex flex-col gap-2">
                <Label htmlFor="reason"><T>退回原因（退回时必填）</T></Label>
                <Input id="reason" name="reason" maxLength={500} />
              </div>
              <div className="flex gap-2">
                <Button type="submit" name="verdict" value="approve"><T>
                  确认采用
                </T></Button>
                <Button type="submit" name="verdict" value="reject" variant="outline"><T>
                  退回修改
                </T></Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : null}

      <RequirementCard project={project} history={requirements} action={customerRequirementsAction.bind(null, token)} />
      <WorkPackageList readiness={readiness} />
      <div id="clarifications" hidden={!view.clarifications.length}><ClarificationSection
        questions={view.clarifications}
        requirementVersion={project.requirementVersion}
        canAnswer={project.status === "needs_info"}
        answerAction={customerAnswers.bind(null, token)}
      /></div>
      {advancedAvailable ? (
        <>
          <DeliverablesSection view={view} deliveryStatus={order?.deliveryStatus} closingHref="#delivery" />
          <div id="strategy"><PositioningSection view={view} /></div>
          <div id="launch"><PageSection view={view} previewHref={`/p/${token}/preview`} /></div>
          <div id="growth"><GrowthSection view={view} /></div>
        </>
      ) : null}
      {project.status === "delivered" ? (
        <Card id="delivery">
          <CardHeader><CardTitle><T>交付验收</T></CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-3 text-sm">
            {order?.deliveryStatus === "accepted" ? <p><T>你已确认验收。</T></p> : (
              <form action={customerAcceptanceAction.bind(null, token)} className="flex flex-col gap-3">
                <input type="hidden" name="deliveryStamp" value={readiness.stamp} />
                {order?.deliveryStatus === "changes_requested" ? <p><T>修改意见已提交，可补充意见或确认验收。</T></p> : null}
                <Label htmlFor="acceptance-note"><T>需要修改的地方（退回时必填）</T></Label>
                <Textarea id="acceptance-note" name="reason" maxLength={500} />
                <div className="flex gap-2">
                  <Button name="verdict" value="approve" type="submit" disabled={!readiness.ready}><T>确认验收</T></Button>
                  <Button name="verdict" value="reject" type="submit" variant="outline"><T>提出修改</T></Button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      ) : null}
      <Card id="support">
        <CardHeader><CardTitle><T>问首客客服</T></CardTitle></CardHeader>
        <CardContent className="flex flex-col gap-4 text-sm">
          <form action={customerSupportAction.bind(null, token)} className="flex flex-col gap-2">
            <Label htmlFor="support-question"><T>你的问题</T></Label>
            <Textarea id="support-question" name="question" required maxLength={1000} />
            <Button type="submit" className="self-start"><T>提交问题</T></Button>
          </form>
          {support.map((item) => (
            <article key={item.id} className="space-y-2 border-t pt-3">
              <p className="font-medium whitespace-pre-wrap">{item.question}</p>
              <p className="whitespace-pre-wrap">{item.reply ?? <T>{item.status === "escalated" ? "已转给首客老板处理。" : "客服已收到问题，等待处理。"}</T>}</p>
            </article>
          ))}
        </CardContent>
      </Card>
      <ScreenshotsSection
        images={view.images}
        hrefFor={(imageId) => `/p/${token}/images/${imageId}`}
        editable={project.status !== "delivered" && project.status !== "cancelled"}
        uploadAction={customerUploadImages.bind(null, token)}
        deleteAction={customerDeleteImage.bind(null, token)}
      />
      <div id="research"><EvidenceSection view={view} /></div>
    </main>
  );
}
