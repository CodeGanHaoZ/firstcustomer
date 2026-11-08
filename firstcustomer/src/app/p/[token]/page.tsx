import { customerMembership } from "@/workflow/membership";
import { PRO_MODULES } from "@/domain/membership";
import { ProPurchase } from "@/components/pro-purchase";
import { ProNextRound } from "@/components/pro-next-round";
import { ProTrial } from "@/components/pro-trial";
import { getCustomerSession } from "@/lib/customer-auth";
import { proRoundProgress } from "@/domain/pro-pricing";
import { canClaimProTrialOnProject, customerProTrial, guestProTrial, proPurchaseOffer, projectProTrial, projectPurchasePayment, validProTrialClaim } from "@/workflow/purchases";
import { currentProTrialVisitor } from "@/lib/pro-trial-visitor";
import { paymentsEnabled } from "@/payments/provider";
import { LocalizedTextarea } from "@/components/localized-controls";
import { getLocale } from "@/lib/locale-server";
import { translateUi } from "@/lib/ui-translation";
import { T } from "@/components/ui-text";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AutoRefresh } from "@/components/auto-refresh";
import { ConclusionStatus, ProvenanceSection } from "@/components/provenance-details";
import { ArrowLeft, ArrowRight, ArrowUpRight } from "lucide-react";
import type { CSSProperties } from "react";
import { Decide } from "@/components/decide";
import { SceneFooter, SiteHeader } from "@/components/site-chrome";
import { PaymentCodeImage, ProposalDetails, ReceiptUpload } from "@/components/commerce-details";
import { ExpandableOffice } from "@/components/expandable-office";
import { AgentByline } from "@/components/agent-byline";
import { customerOfficeStations, officeGuidance, type OfficeGuideInput } from "@/domain/office-guide";
import { ClearProjectDraft } from "@/components/project-draft";
import { ProjectConversationNotes } from "@/components/project-conversation-notes";
import { RequirementCard } from "@/components/requirement-card";
import { WorkPackageList } from "@/components/work-package-list";
import { ProKeyForm } from "@/components/pro-key-form";
import { isProAccessKeyConfigured } from "@/lib/pro-access-key";
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
import { Button } from "@/components/ui/button";
import { getDb } from "@/db";
import { founderReady, type Gate } from "@/domain/approval";
import { customerProgress } from "@/domain/customer-progress";
import { canActivateProByKey, canStartFreeDiagnosis, hasProAccess, isAccountPro, isKeyActivatedPro, isPurchasedPro, isSelfServicePro, isTrialPro, usesQuoteFlow } from "@/domain/workflow";
import { formatDateTime, formatYuan } from "@/lib/format";
import { findCustomerProject, isAccountProjectToken, requireCustomerProjectSession } from "@/lib/customer-project";
import { confirmedOrderPayment, hasPaymentCode, latestReceipt, projectOrder } from "@/workflow/commerce";
import { loadOfficeTransfer } from "@/workflow/office";
import { loadProjectView, runningProjectAgents } from "@/workflow/queries";
import { projectSupport } from "@/workflow/support";
import { customerAcceptanceAction, customerActivateProAction, customerAnswers, customerDecision, customerDeleteImage, customerReceiptAction, customerSupportAction, customerUploadImages } from "./actions";
import { customerClaimTrialAction, customerCompleteProjectAction, customerNextRoundAction, customerPayProAction, customerPurchaseProAction, customerStartFreeAction, customerStartReviewAction } from "./actions";
import "../../admin/office.css";
import "../../workspace.css";

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
  await requireCustomerProjectSession(token);
  const { error, notice, intake } = await searchParams;
  const locale = await getLocale();
  const db = getDb();
  const project = await findCustomerProject(db, token);
  if (!project) notFound();
  const [requirements, readiness] = await Promise.all([requirementHistory(db, project.id), workPackageReadiness(db, project)]);
  const [view, order, support, runningAgents, transfer] = await Promise.all([
    loadProjectView(db, project), projectOrder(db, project.id), projectSupport(db, project.id), runningProjectAgents(db, project),
    project.status === "submitted" || project.status === "cancelled" ? null : loadOfficeTransfer(db, project.id),
  ]);
  const offer = await proPurchaseOffer(db, project, order);
  const commercialOrder = usesQuoteFlow(project) && !offer ? order : null;
  const canStartFree = canStartFreeDiagnosis(project, order);
  const membership = await customerMembership(db, project.customerId);
  const accountPro = isAccountPro(project);
  const purchasedPro = isPurchasedPro(project);
  const trialPro = isTrialPro(project);
  const session = await getCustomerSession();
  const [trialStatus, trialReady, trialClaim, browserTrial] = await Promise.all([
    customerProTrial(db, session?.user.id), canClaimProTrialOnProject(db, project, order),
    trialPro ? projectProTrial(db, project.id) : null,
    guestProTrial(db, await currentProTrialVisitor()),
  ]);
  const proActive = hasProAccess(project, order) && (!accountPro || membership.plan === "pro") && (!trialPro || validProTrialClaim(project, order, trialClaim));
  const proByKey = proActive && isKeyActivatedPro(project);
  const selfServicePro = isSelfServicePro(project);
  const quote = order?.paymentMode === "simulated" ? order.pricingSnapshot : offer;
  const roundProgress = quote ? proRoundProgress(quote, project.round) : null;
  const purchasePayment = order?.paymentMode === "simulated" ? await projectPurchasePayment(db, order.id) : null;
  const checkoutPending = order?.paymentMode === "simulated" && order.status === "simulation_pending" && project.status === "awaiting_payment";
  const advancedAvailable = project.productPlan === "legacy" ? !canStartFree : proActive;
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
    accountPro && !proActive ? null : project.status === "awaiting_positioning" &&
    founderReady(view.gates.positioning) &&
    view.gates.positioning.customer === "pending"
      ? "positioning"
      : project.status === "awaiting_publish" &&
          founderReady(view.gates.publish) &&
          view.gates.publish.customer === "pending"
        ? "publish"
        : project.status === "reviewing" && !purchasedPro && !trialPro && (!accountPro || Boolean(view.report?.next_hypothesis)) &&
            founderReady(view.gates.next_round) &&
            view.gates.next_round.customer === "pending"
          ? "next_round"
          : null;
  const progress = customerProgress({
    status: project.status, paused: project.paused, runningAgents, openGate, reportReady: !!view.report,
    quoteVisible: !!visibleProposal, awaitingPayment: awaitingPayment || checkoutPending, receiptUploaded: !!receipt, deliveryStatus: order?.deliveryStatus, canStartFree, selfServicePro: selfServicePro && proActive, proInactive: accountPro && !proActive, proOffer: !!offer,
  });
  const supportPending = !project.paused && support.some((item) => item.status === "queued");
  const officeInput: OfficeGuideInput = { status: project.status, paused: project.paused, runningAgents, plan: project.productPlan,
    quoteRequired: usesQuoteFlow(project), quotePaid: commercialOrder?.status === "paid", openGate, reportReady: !!view.report,
    receiptUploaded: !!receipt, deliveryStatus: order?.deliveryStatus, canStartFree, failedFrom: project.failedFrom, selfServicePro: selfServicePro && proActive, proInactive: accountPro && !proActive, projectCheckout: checkoutPending, proOffer: !!offer };
  const stations = customerOfficeStations(officeInput);
  const activeRoom = stations.find(({ state }) => state === "running")?.key;
  const finished = project.status === "free_ready" || project.status === "cancelled" || (project.status === "delivered" && order?.deliveryStatus === "accepted");
  const refresh = supportPending || activeRoom || project.status === "submitted" ? 3 : progress.refreshSeconds ?? (finished ? null : 12);

  const planLabel = trialPro && proActive ? "Pro · 免费试用" : accountPro && proActive ? (membership.testAccount ? "Pro · 测试权益" : "Pro · 账号权益") : proByKey ? "Pro · 密钥已开通" : proActive ? "Pro" : project.productPlan === "pro" ? "Free · Pro 待开通" : "Free";
  const showPlan = project.productPlan !== "legacy" || canStartFree;

  return (
    <div className="site-shell">
      <SiteHeader current="project" />
      <main className="site-main customer-workspace-main">
        {intake === "public" ? <ClearProjectDraft intake="public" projectId={project.id} /> : null}
        {view.simulated ? <SimulatedBanner /> : null}
        <ProjectHeader
          project={project}
          statusLabel={offer && project.status !== "free_ready" ? "待确认 Pro 服务" : undefined}
          eyebrow={<><T>客户项目工作台</T>{showPlan ? <> · <T>{planLabel}</T></> : null}</>}
          actions={<Link href="/account" className="btn btn--back"><ArrowLeft size={15} className="arw" aria-hidden="true" /><T>{isAccountProjectToken(token) ? "我的项目" : "试用工作台"}</T></Link>}
        />
        {error ? <p className="notice notice--fail" role="alert"><T>{String(error)}</T></p> : null}
        {notice ? <p className="notice notice--ok" role="status"><T>{String(notice)}</T></p> : null}
        {accountPro && proActive ? <section className="paper"><p className="notice notice--ok"><T>{membership.testAccount ? "当前使用 Pro 测试权益，不代表付款或收入。" : "当前项目使用已开通的 Pro 账号权益，无需初步报价与老板开通审核。"}</T></p><nav className="flex flex-wrap gap-2" aria-label="Pro 工作模块">{PRO_MODULES.map((module) => <a key={module.key} href={`#${module.anchor}`} className="btn btn--ghost btn--sm"><T>{module.zh}</T></a>)}</nav></section> : null}
        {proByKey ? <p className="notice notice--ok"><T>当前项目已通过密钥开通 Pro。后续定位和发布仍需双方确认。</T></p> : null}
        {(purchasedPro || trialPro) && proActive ? <nav className="mb-5 flex flex-wrap gap-2" aria-label="Pro 工作模块">{PRO_MODULES.map((module) => <a key={module.key} href={`#${module.anchor}`} className="btn btn--ghost btn--sm"><T>{module.zh}</T></a>)}</nav> : null}

        {refresh ? <AutoRefresh seconds={refresh} /> : null}
        <div className="customer-project-layout">
        <div className="customer-project-activity">
        <section className="paper paper--tan rise" style={{ "--i": 3 } as CSSProperties} aria-labelledby="customer-progress-title">
          <div className="paper__head">
            <div role="status">
              <p className="eyebrow m-0" id="customer-progress-title"><T>当前进度</T></p>
              <h2 className="paper__title mt-1"><T>{progress.title}</T></h2>
              <p className="paper__lead"><T>{progress.detail}</T></p>
            </div>
            <div className="flex flex-wrap gap-2">
              {progress.action ? <a className="btn btn--ghost" href={progress.action.href}><T>{progress.action.label}</T><ArrowRight size={14} className="arw" aria-hidden="true" /></a> : null}
              {canStartFree ? (
                <form action={customerStartFreeAction.bind(null, token)}><Button type="submit"><T>{project.status === "failed" ? "重新分析出海机会" : "免费分析出海机会"}</T><ArrowRight size={14} className="arw" aria-hidden="true" /></Button></form>
              ) : null}
            </div>
          </div>
          <ExpandableOffice stations={stations} transfer={transfer} focusRoom={officeGuidance(officeInput, locale).room ?? activeRoom}
            title={translateUi(locale, progress.title)} detail={officeGuidance(officeInput, locale).output} />
        </section>

        {openGate ? (
          <section id="approval" className="paper paper--focus rise" aria-labelledby="approval-title">
            <p className="eyebrow m-0"><T>待你确认</T></p>
            <h2 id="approval-title" className="paper__title mt-1"><T>{selfServicePro ? "请核对当前方案并确认" : GATE_TEXT[openGate]}</T></h2>
            {openGate === "publish" ? <p className="paper__lead"><T>实验使用一个免费渠道。额外付费推广需要单独确认。</T><T>{project.budgetNote ? `你提交的预算和时间要求为「${project.budgetNote}」。` : ""}</T></p> : null}
            {openGate === "publish" && view.page ? (
              <a href={`/p/${token}/preview?version=${view.page.version}`} target="_blank" rel="noreferrer" className="btn btn--ghost btn--sm mt-4"><T>
                预览待确认的第 </T>{view.page.version}<T> 版
              </T><ArrowUpRight size={14} aria-hidden="true" /></a>
            ) : null}
            <div className="mt-5">
              <Decide action={customerDecision.bind(null, token)} approveLabel="确认采用" rejectLabel="退回修改" reasonLabel="退回原因（退回时必填）"
                hidden={{ gate: openGate, version: openGate === "publish" ? view.page?.version : openGate === "positioning" ? project.positioningVersion : project.round }} />
            </div>
          </section>
        ) : null}

        {commercialOrder && visibleProposal ? (
          <section id="proposal" className="paper rise" aria-labelledby="proposal-title">
            <h2 id="proposal-title" className="paper__title mb-5"><T>首客服务提案</T></h2>
            <ProposalDetails proposal={visibleProposal} version={commercialOrder.quoteVersion} quoteFen={commercialOrder.quoteFen} />
            {commercialOrder.status === "paid" ? (
              <div className="notice notice--ok mt-5">
                <p className="m-0"><T>首客已确认到账，正式服务已开始。</T>{confirmedPayment ? <> <T>实际到账 </T>{formatYuan(confirmedPayment.amountFen)} · {formatDateTime(confirmedPayment.paidAt)}</> : null}</p>
              </div>
            ) : null}
          </section>
        ) : null}

        {(trialPro && trialClaim && proActive) || (trialReady && !browserTrial && (!session || trialStatus.eligible)) ? <ProTrial
          state={trialPro ? "active" : "offer"} guest={!session} action={customerClaimTrialAction.bind(null, token)}
          loginHref={`/register?next=${encodeURIComponent(`/p/${token}`)}`} disabled={project.paused} /> : null}

        {quote && ((purchasedPro && proActive) || checkoutPending || !!offer) ? <ProPurchase state={checkoutPending ? "checkout" : purchasedPro && proActive ? "active" : "offer"}
          productName={project.productName} targetMarket={project.targetMarket} round={purchasedPro && proActive ? project.round : quote.round} amountFen={quote.quoteFen}
          includedRounds={roundProgress?.included ?? 1} startedRounds={roundProgress?.started} remainingRounds={roundProgress?.remaining}
          fingerprint={quote.fingerprint} paymentId={purchasePayment?.id} paidAt={purchasePayment?.completedAt}
          disabled={project.paused || !paymentsEnabled()}
          action={(checkoutPending ? customerPayProAction : customerPurchaseProAction).bind(null, token)} /> : null}

        {canActivateProByKey(project) && isProAccessKeyConfigured() ? (
          <section id="pro-key" className="paper rise" aria-labelledby="project-pro-title">
            <div className="paper__head mb-0">
              <div>
                <p className="eyebrow m-0">Pro</p>
                <h2 id="project-pro-title" className="paper__title mt-1"><T>密钥开通 Pro</T></h2>
                <p className="paper__lead"><T>根据出海机会报告继续做完整定位、英文验证页、渠道行动和增长复盘。</T></p>
              </div>
            </div>
            {isProAccessKeyConfigured() ? <ProKeyForm action={customerActivateProAction.bind(null, token)} /> :
              <p className="mt-5 text-sm text-muted-foreground"><T>密钥开通暂未启用，请联系首客获取开通方式。</T></p>}
          </section>
        ) : null}

        {awaitingPayment ? (
          <section id="payment" className="paper rise" aria-labelledby="payment-title">
            <h2 id="payment-title" className="paper__title"><T>首客服务付款与到账确认</T></h2>
            <div className="mt-5 grid items-start gap-5 sm:grid-cols-[auto_1fr]">
              {receipt ? <p className="notice notice--ok m-0 sm:col-span-2"><T>付款截图已收到，等待首客核对实际到账。 </T><a className="underline underline-offset-4" href={`/p/${token}/receipts/${receipt.id}`}><T>查看截图</T></a></p> : (
                codeReady ? <><PaymentCodeImage token={token} /><p className="paper__lead m-0 self-center"><T>扫码后请上传付款截图。</T></p></>
                  : <p className="notice notice--wait m-0 sm:col-span-2"><T>首客正在准备收款码，收款码配置后会在这里显示。</T></p>
              )}
              {project.status === "awaiting_payment" ? <div className="sm:col-span-2"><ReceiptUpload action={customerReceiptAction.bind(null, token)} /></div> : null}
            </div>
          </section>
        ) : null}

        <div id="clarifications" hidden={!view.clarifications.length}><ClarificationSection
          questions={view.clarifications}
          requirementVersion={project.requirementVersion}
          canAnswer={project.status === "needs_info"}
          answerAction={customerAnswers.bind(null, token)}
        /></div>
        {project.status === "delivered" ? (
          <section id="delivery" className={order?.deliveryStatus === "accepted" ? "paper rise" : "paper paper--focus rise"} aria-labelledby="delivery-title">
            <p className="eyebrow m-0"><T>交付验收</T></p>
            {order?.deliveryStatus === "accepted" ? <h2 id="delivery-title" className="paper__title mt-1"><T>你已确认验收。</T></h2> : (
              <>
                <h2 id="delivery-title" className="paper__title mt-1"><T>{order?.deliveryStatus === "changes_requested" ? "修改意见已提交，可补充意见或确认验收。" : "请确认交付成果"}</T></h2>
                <div className="mt-5">
                  <Decide action={customerAcceptanceAction.bind(null, token)} approveLabel="确认验收" rejectLabel="提出修改" reasonLabel="需要修改的地方（退回时必填）"
                    hidden={{ deliveryStamp: readiness.stamp }} approveDisabled={!readiness.ready} multiline />
                </div>
              </>
            )}
          </section>
        ) : null}
        {selfServicePro && proActive && ["published", "collecting"].includes(project.status) ? <section className="paper"><h2 className="paper__title"><T>开始本轮增长复盘</T></h2><p className="paper__lead"><T>核对当前访问和反馈后开始复盘，样本不足会在报告中说明。</T></p><form action={customerStartReviewAction.bind(null, token)}><Button type="submit" disabled={project.paused}><T>开始增长复盘</T></Button></form></section> : null}
        {selfServicePro && proActive && project.status === "reviewing" && view.report ? <section className="paper"><h2 className="paper__title"><T>完成本轮交付</T></h2><p className="paper__lead"><T>定位、页面、渠道方案和复盘通过核对后，即可进入交付验收。</T></p><form action={customerCompleteProjectAction.bind(null, token)}><input type="hidden" name="deliveryStamp" value={readiness.stamp} /><Button type="submit" disabled={!readiness.ready || project.paused}><T>完成交付，前往验收</T></Button></form></section> : null}
        {purchasedPro && proActive && roundProgress && ["reviewing", "delivered"].includes(project.status) && view.report ? <ProNextRound
          round={project.round} remaining={roundProgress.remaining} disabled={project.paused || (!readiness.ready && !(project.status === "delivered" && order?.deliveryStatus === "accepted"))}
          action={customerNextRoundAction.bind(null, token)} /> : null}
        <details id="support" className="fold rise" open={support.length > 0 || undefined}>
          <summary>
            <span>
              <span className="fold__title block"><T>问首客客服</T></span>
              <span className="fold__hint block"><T>{support.length ? `已提问 ${support.length} 次` : "有疑问随时问，客服会在这里回复"}</T></span>
            </span>
          </summary>
          <div className="fold__body grid gap-4 text-sm">
            {support.map((item) => (
              <article key={item.id} className="grid gap-2">
                <p className="m-0 max-w-[85%] justify-self-end rounded-2xl rounded-br-md bg-[#101210] px-4 py-2.5 whitespace-pre-wrap text-[#fbfaf8]">{item.question}</p>
                <p className="m-0 max-w-[85%] rounded-2xl rounded-bl-md border bg-background px-4 py-2.5 whitespace-pre-wrap">{item.reply ?? <T>{item.status === "escalated" ? "已转给首客老板处理。" : "客服已收到问题，等待处理。"}</T>}</p>
              </article>
            ))}
            <form action={customerSupportAction.bind(null, token)} className="flex items-end gap-2 rounded-2xl border bg-background p-2">
              <label htmlFor="support-question" className="sr-only"><T>你的问题</T></label>
              <LocalizedTextarea id="support-question" name="question" required maxLength={1000} rows={1} placeholder="你的问题" className="min-h-11 border-0 bg-transparent focus-visible:ring-0" />
              <Button type="submit" className="shrink-0"><T>提交问题</T></Button>
            </form>
          </div>
        </details>

        </div>
        <aside className="customer-project-content" aria-label={locale === "en" ? "Project content and reports" : "项目内容与报告"}>
          <header className="workspace-content-head"><h2>{locale === "en" ? "Project content" : "项目内容"}</h2><span>{locale === "en" ? "Saved project records" : "需求与成果，持续更新"}</span></header>
          <nav className="workspace-report-links" aria-label={locale === "en" ? "Project documents" : "项目资料"}>
            <a href="#requirements">{locale === "en" ? "Brief" : "需求"}</a><a href="#diagnosis">{locale === "en" ? "Opportunity report" : "出海报告"}</a>
            {advancedAvailable && view.positioning ? <a href="#strategy">{locale === "en" ? "Positioning" : "定位方案"}</a> : null}
            {advancedAvailable && view.page ? <a href="#launch">{locale === "en" ? "Page" : "英文页面"}</a> : null}
            {advancedAvailable && (view.metrics || view.report) ? <a href="#growth">{locale === "en" ? "Review" : "复盘"}</a> : null}
          </nav>
        {view.diagnosis ? (
          <section id="diagnosis" className="paper report-diagnosis scroll-mt-24 rise" aria-labelledby="diagnosis-title">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <p className="eyebrow m-0"><T>出海机会报告</T></p>
              <AgentByline person="research" />
            </div>
            <h2 id="diagnosis-title" className="paper__title mt-1 max-w-[30em]">{view.diagnosis.summary}</h2>
            <ConclusionStatus provenance={view.provenance} subjectId={view.diagnosisTaskId} recordKey="summary" />
            <ul className="card-grid mt-5">
              {view.diagnosis.candidates.map((candidate, index) => (
                <li key={candidate.name} className="tile rise bg-background" style={{ "--i": index } as CSSProperties}>
                  <p className="tile__meta"><T>候选人群</T> {String(index + 1).padStart(2, "0")}</p>
                  <h3 className="tile__title">{candidate.name}</h3>
                  <p className="m-0 text-sm leading-relaxed text-muted-foreground">{candidate.why}</p>
                  <ConclusionStatus provenance={view.provenance} subjectId={view.diagnosisTaskId} recordKey={`candidate:${index}`} />
                </li>
              ))}
            </ul>
            {view.diagnosis.unknowns.length ? (
              <section className="validation-waterfall" aria-labelledby="validation-waterfall-title">
                <div className="validation-waterfall__head">
                  <span id="validation-waterfall-title" className="eyebrow m-0"><T>待验证</T></span>
                  <span className="validation-waterfall__count">{locale === "en" ? `${view.diagnosis.unknowns.length} open questions` : `${view.diagnosis.unknowns.length} 个问题`}</span>
                </div>
                <ol className="validation-waterfall__list">
                  {view.diagnosis.unknowns.map((item, index) => (
                    <li key={item}>
                      <span className="validation-waterfall__index" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
                      <p>{item}</p>
                    </li>
                  ))}
                </ol>
              </section>
            ) : null}
          </section>
        ) : null}

          {!view.diagnosis ? <section id="diagnosis" className="paper"><h3 className="paper__title">{locale === "en" ? "Market opportunity report" : "出海机会报告"}</h3><p className="paper__lead">{locale === "en" ? "Your report will appear here after the research is complete." : "研究完成后，候选人群、来源证据和待验证问题会在这里展示。"}</p></section> : null}
        {advancedAvailable ? (
          <>
            <DeliverablesSection view={view} deliveryStatus={order?.deliveryStatus} closingHref="#delivery" selfServicePro={selfServicePro} />
            {/* 注意：aside 是 grid + 44px gap，空 wrapper div 也会占一格间距；内容未生成时不要渲染壳 */}
            {view.positioning ? <div id="strategy"><PositioningSection view={view} /></div> : null}
            {view.page ? <div id="launch"><PageSection view={view} previewHref={`/p/${token}/preview`} /></div> : null}
            {view.metrics || view.report ? <div id="growth"><GrowthSection view={view} /></div> : null}
          </>
        ) : null}
        <ProjectConversationNotes projectId={project.id} />
        <RequirementCard project={project} history={requirements} action={customerRequirementsAction.bind(null, token)} />
        <WorkPackageList readiness={readiness} />
        {/* TODO: 产品和竞品截图上传区暂时下线，需要时恢复这段
        <ScreenshotsSection
          images={view.images}
          hrefFor={(imageId) => `/p/${token}/images/${imageId}`}
          editable={project.status !== "delivered" && project.status !== "cancelled"}
          uploadAction={customerUploadImages.bind(null, token)}
          deleteAction={customerDeleteImage.bind(null, token)}
        />
        */}
        <div id="research"><EvidenceSection view={view} token={token} cacheKey={`${project.id}:${project.scopeVersion}:${view.evidence.length}:${view.evidence[0]?.collectedAt instanceof Date ? view.evidence[0].collectedAt.toISOString() : ""}`} /></div>
        <ProvenanceSection provenance={view.provenance} />

        </aside>
        </div>

        {/* TODO: 「你可以随时从我的项目回到这里」提示暂时下线，需要时恢复这段
        <p className="meta">
          {isAccountProjectToken(token) ? (
            <><T>你可以随时从 </T><Link href="/account" className="link-u"><T>我的项目</T></Link><T> 回到这里。</T></>
          ) : <><T>通过专属链接查看当前项目，也可从本浏览器的 </T><Link href="/account" className="link-u"><T>试用工作台</T></Link><T> 返回。请保存此链接，方便找回项目。</T></>}
        </p>
        */}
      </main>
      <SceneFooter low />
    </div>
  );
}
