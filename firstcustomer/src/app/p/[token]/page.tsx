import { LocalizedTextarea } from "@/components/localized-controls";
import { getLocale } from "@/lib/locale-server";
import { translateUi } from "@/lib/ui-translation";
import { T } from "@/components/ui-text";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AutoRefresh } from "@/components/auto-refresh";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import type { CSSProperties } from "react";
import { Decide } from "@/components/decide";
import { SceneFooter, SiteHeader } from "@/components/site-chrome";
import { PaymentCodeImage, ProposalDetails, ReceiptUpload } from "@/components/commerce-details";
import { OfficeMap } from "@/components/office-map";
import { customerOfficeStations, officeGuidance, type OfficeGuideInput } from "@/domain/office-guide";
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
import { Button } from "@/components/ui/button";
import { getDb } from "@/db";
import type { Gate } from "@/domain/approval";
import { customerProgress } from "@/domain/customer-progress";
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
  const officeInput: OfficeGuideInput = { status: project.status, paused: project.paused, runningAgents, plan: project.productPlan,
    quoteRequired: usesQuoteFlow(project), quotePaid: commercialOrder?.status === "paid", openGate, reportReady: !!view.report,
    receiptUploaded: !!receipt, deliveryStatus: order?.deliveryStatus, canStartFree, failedFrom: project.failedFrom };
  const stations = customerOfficeStations(officeInput);
  const activeRoom = stations.find(({ state }) => state === "running")?.key;
  const finished = project.status === "free_ready" || project.status === "cancelled" || (project.status === "delivered" && order?.deliveryStatus === "accepted");
  const refresh = supportPending || activeRoom || project.status === "submitted" ? 3 : progress.refreshSeconds ?? (finished ? null : 12);

  const planLabel = proPaid ? "Pro" : project.productPlan === "pro" ? "Free · Pro 待开通" : "Free";
  const showPlan = project.productPlan !== "legacy" || canStartFree;

  return (
    <div className="site-shell">
      <SiteHeader current="project" />
      <main className="site-main site-main--narrow">
        {intake === "public" ? <ClearProjectDraft intake="public" /> : null}
        {view.simulated ? <SimulatedBanner /> : null}
        <ProjectHeader
          project={project}
          eyebrow={<><T>客户项目工作台</T>{showPlan ? <> · <T>{planLabel}</T></> : null}</>}
          actions={<Link href="/account" className="btn btn--ghost btn--sm"><T>{isAccountProjectToken(token) ? "我的项目" : "试用工作台"}</T></Link>}
        />
        {error ? <p className="notice notice--fail" role="alert"><T>{String(error)}</T></p> : null}
        {notice ? <p className="notice notice--ok" role="status"><T>{String(notice)}</T></p> : null}

        {refresh ? <AutoRefresh seconds={refresh} /> : null}
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
                <Link href="/#cta" className="btn btn--primary">
                  <T>{project.status === "failed" ? "重新分析出海机会" : "免费分析出海机会"}</T><ArrowRight size={14} className="arw" aria-hidden="true" />
                </Link>
              ) : null}
            </div>
          </div>
          <section aria-labelledby="customer-office-title" className="grid gap-3">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <h3 id="customer-office-title" className="eyebrow m-0"><T>项目办公室</T></h3>
              {refresh ? <p className="pill pill--live m-0"><T>自动更新当前项目进度</T></p> : null}
            </div>
            <OfficeStage transfer={transfer} customerView focusRoom={officeGuidance(officeInput).room ?? activeRoom} guidance={officeInput} stations={stations}>
              <OfficeMap stations={stations} customerView />
            </OfficeStage>
          </section>
        </section>

        {openGate ? (
          <section id="approval" className="paper paper--focus rise" aria-labelledby="approval-title">
            <p className="eyebrow m-0"><T>待你确认</T></p>
            <h2 id="approval-title" className="paper__title mt-1"><T>{GATE_TEXT[openGate]}</T></h2>
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
            {project.status === "awaiting_quote_acceptance" ? (
              <div className="mt-6 border-t pt-5">
                <Decide action={customerProposalAction.bind(null, token)} approveLabel="接受报价" rejectLabel="退回报价" reasonLabel="退回原因（退回时必填）"
                  hidden={{ version: commercialOrder.quoteVersion }} />
              </div>
            ) : null}
            {commercialOrder.status === "paid" ? (
              <div className="notice notice--ok mt-5">
                <p className="m-0"><T>首客已确认到账，正式服务已开始。</T>{confirmedPayment ? <> <T>实际到账 </T>{formatYuan(confirmedPayment.amountFen)} · {formatDateTime(confirmedPayment.paidAt)}</> : null}</p>
              </div>
            ) : null}
          </section>
        ) : null}

        {view.diagnosis ? (
          <section id="diagnosis" className="paper scroll-mt-24 rise" aria-labelledby="diagnosis-title">
            <p className="eyebrow m-0"><T>出海机会报告</T></p>
            <h2 id="diagnosis-title" className="paper__title mt-1 max-w-[30em]">{view.diagnosis.summary}</h2>
            <ul className="card-grid mt-5">
              {view.diagnosis.candidates.map((candidate, index) => (
                <li key={candidate.name} className="tile rise bg-background" style={{ "--i": index } as CSSProperties}>
                  <p className="tile__meta"><T>候选人群</T> {String(index + 1).padStart(2, "0")}</p>
                  <h3 className="tile__title">{candidate.name}</h3>
                  <p className="m-0 text-sm leading-relaxed text-muted-foreground">{candidate.why}</p>
                </li>
              ))}
            </ul>
            {view.diagnosis.unknowns.length ? (
              <div className="mt-5 flex flex-wrap items-center gap-2">
                <span className="eyebrow m-0"><T>待验证</T></span>
                {view.diagnosis.unknowns.map((item) => <span key={item} className="pill pill--wait">{item}</span>)}
              </div>
            ) : null}
          </section>
        ) : null}

        {project.productPlan === "free" && project.status === "free_ready" && !project.paused ? (
          <section className="paper paper--apricot rise" aria-labelledby="project-pro-title">
            <div className="paper__head mb-0">
              <div>
                <p className="eyebrow m-0">Pro</p>
                <h2 id="project-pro-title" className="paper__title mt-1"><T>升级到 Pro</T></h2>
                <p className="paper__lead"><T>根据出海机会报告继续做完整定位、英文验证页、渠道行动和增长复盘。</T></p>
                <p className="paper__lead"><T>申请后可查看服务提案和报价，由你决定是否付款。</T></p>
              </div>
              <form action={customerRequestProAction.bind(null, token)}>
                <Button type="submit" size="lg"><T>申请 Pro 报价</T><ArrowRight size={15} aria-hidden="true" /></Button>
              </form>
            </div>
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
        {advancedAvailable ? (
          <>
            <DeliverablesSection view={view} deliveryStatus={order?.deliveryStatus} closingHref="#delivery" />
            <div id="strategy"><PositioningSection view={view} /></div>
            <div id="launch"><PageSection view={view} previewHref={`/p/${token}/preview`} /></div>
            <div id="growth"><GrowthSection view={view} /></div>
          </>
        ) : null}
        <RequirementCard project={project} history={requirements} action={customerRequirementsAction.bind(null, token)} />
        <WorkPackageList readiness={readiness} />
        <ScreenshotsSection
          images={view.images}
          hrefFor={(imageId) => `/p/${token}/images/${imageId}`}
          editable={project.status !== "delivered" && project.status !== "cancelled"}
          uploadAction={customerUploadImages.bind(null, token)}
          deleteAction={customerDeleteImage.bind(null, token)}
        />
        <div id="research"><EvidenceSection view={view} /></div>

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

        <p className="meta">
          {isAccountProjectToken(token) ? (
            <><T>你可以随时从 </T><Link href="/account" className="link-u"><T>我的项目</T></Link><T> 回到这里。</T></>
          ) : <><T>通过专属链接查看当前项目，也可从本浏览器的 </T><Link href="/account" className="link-u"><T>试用工作台</T></Link><T> 返回。请保存此链接，方便找回项目。</T></>}
        </p>
      </main>
      <SceneFooter low />
    </div>
  );
}
