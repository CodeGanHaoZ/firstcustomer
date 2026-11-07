import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AutoRefresh } from "@/components/auto-refresh";
import { BrandMark } from "@/components/brand-mark";
import { PaymentCodeImage, ProposalDetails, ReceiptUpload } from "@/components/commerce-details";
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
import { Textarea } from "@/components/ui/textarea";
import { getDb } from "@/db";
import type { Gate } from "@/domain/approval";
import { customerProgress } from "@/domain/customer-progress";
import { usesQuoteFlow } from "@/domain/workflow";
import { isAdmin } from "@/lib/auth";
import { formatDateTime, formatYuan } from "@/lib/format";
import { findProjectByToken } from "@/workflow/actions";
import { confirmedOrderPayment, hasPaymentCode, latestReceipt, projectOrder } from "@/workflow/commerce";
import { loadProjectView, runningProjectAgents } from "@/workflow/queries";
import { projectSupport } from "@/workflow/support";
import { customerAcceptanceAction, customerAnswers, customerDecision, customerDeleteImage, customerProposalAction, customerReceiptAction, customerSupportAction, customerUploadImages } from "./actions";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "我的出海项目",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

const GATE_TEXT: Record<Gate, string> = {
  positioning: "请确认老板推荐的定位方案",
  publish: "请确认页面和渠道素材，确认后页面会公开",
  next_round: "请确认是否开启下一轮实验",
};

export default async function CustomerProjectPage({ params, searchParams }: PageProps<"/p/[token]">) {
  const { token } = await params;
  const { error, notice, intake } = await searchParams;
  const db = getDb();
  const project = await findProjectByToken(db, token);
  if (!project) notFound();
  const [view, order, support, runningAgents] = await Promise.all([
    loadProjectView(db, project), projectOrder(db, project.id), projectSupport(db, project.id), runningProjectAgents(db, project),
  ]);
  const commercialOrder = usesQuoteFlow(project) ? order : null;
  const visibleProposal = commercialOrder && ["quoted", "accepted", "paid"].includes(commercialOrder.status)
    ? commercialOrder.proposal : null;
  const founderIntake = intake === "admin" && await isAdmin();
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
    quoteVisible: !!visibleProposal, awaitingPayment, receiptUploaded: !!receipt, deliveryStatus: order?.deliveryStatus,
  });
  const supportPending = !project.paused && support.some((item) => item.status === "queued");
  const refresh = supportPending ? 3 : progress.refreshSeconds;

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-6 py-10">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-3">
        <BrandMark />
        <span className="text-sm text-muted-foreground">客户专属链接</span>
      </div>
      {intake === "public" || founderIntake ? <ClearProjectDraft intake={founderIntake ? "admin" : "public"} /> : null}
      {founderIntake ? <Link className="self-start underline" href={`/admin/projects/${project.id}`}>项目已创建 · 返回经营台详情</Link> : null}
      {view.simulated ? <SimulatedBanner /> : null}
      <ProjectHeader project={project} />
      {error ? <p className="text-sm text-destructive">{String(error)}</p> : null}
      {notice ? <p className="rounded-md border p-3 text-sm">{String(notice)}</p> : null}
      <p className="text-sm text-muted-foreground">
        这是你的项目专属链接，请不要转发给无关的人。如需作废，请联系首客。
      </p>

      {refresh ? <AutoRefresh seconds={refresh} /> : null}
      <Card className="bg-secondary" aria-labelledby="customer-progress-title">
        <CardHeader><CardTitle><h2 id="customer-progress-title">当前进度</h2></CardTitle></CardHeader>
        <CardContent className="flex flex-col gap-2 text-sm">
          <div role="status">
            <p className="font-semibold">{progress.title}</p>
            <p className="text-muted-foreground">{progress.detail}</p>
          </div>
          {progress.action ? <a className="self-start font-medium underline underline-offset-4" href={progress.action.href}>{progress.action.label}</a> : null}
        </CardContent>
      </Card>

      {commercialOrder && visibleProposal ? (
        <Card id="proposal">
          <CardHeader><CardTitle>首客服务提案</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-4">
            <ProposalDetails proposal={visibleProposal} version={commercialOrder.quoteVersion} quoteFen={commercialOrder.quoteFen} />
            {project.status === "awaiting_quote_acceptance" ? (
              <form action={customerProposalAction.bind(null, token)} className="flex flex-col gap-3">
                <input type="hidden" name="version" value={commercialOrder.quoteVersion} />
                <Label htmlFor="proposal-feedback">退回原因（退回时必填）</Label>
                <Input id="proposal-feedback" name="reason" maxLength={500} />
                <div className="flex flex-wrap gap-2">
                  <Button name="verdict" value="approve" type="submit">接受报价</Button>
                  <Button name="verdict" value="reject" type="submit" variant="outline">退回报价</Button>
                </div>
              </form>
            ) : null}
            {commercialOrder.status === "paid" ? (
              <div className="space-y-1 rounded-md border p-3 text-sm">
                <p className="font-medium">首客已确认到账，正式服务已开始。</p>
                {confirmedPayment ? <p>实际到账 {formatYuan(confirmedPayment.amountFen)} · {formatDateTime(confirmedPayment.paidAt)}</p> : null}
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {view.diagnosis ? (
        <Card>
          <CardHeader><CardTitle>免费初诊摘要</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p>{view.diagnosis.summary}</p>
            <ul className="list-disc space-y-1 pl-5">
              {view.diagnosis.candidates.map((candidate) => <li key={candidate.name}><strong>{candidate.name}</strong>　{candidate.why}</li>)}
            </ul>
            {view.diagnosis.unknowns.length ? <p>待验证　{view.diagnosis.unknowns.join("、")}</p> : null}
          </CardContent>
        </Card>
      ) : null}

      {awaitingPayment ? (
        <Card id="payment">
          <CardHeader><CardTitle>付款与到账确认</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-4 text-sm">
            {receipt ? <p>付款截图已收到，等待首客核对实际到账。 <a className="underline" href={`/p/${token}/receipts/${receipt.id}`}>查看截图</a></p> : (
              codeReady ? <><PaymentCodeImage token={token} /><p>扫码后请上传付款截图。</p></>
                : <p>首客正在准备收款码，收款码配置后会在这里显示。</p>
            )}
            {project.status === "awaiting_payment" ? <ReceiptUpload action={customerReceiptAction.bind(null, token)} /> : null}
          </CardContent>
        </Card>
      ) : null}

      {openGate ? (
        <Card id="approval" className="border-primary">
          <CardHeader>
            <CardTitle>待你确认</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={customerDecision.bind(null, token)} className="flex flex-col gap-3">
              <p className="text-sm">{GATE_TEXT[openGate]}</p>
              {openGate === "publish" && view.page ? (
                <a href={`/p/${token}/preview?version=${view.page.version}`} target="_blank" rel="noreferrer" className="self-start text-sm underline">
                  预览待确认的第 {view.page.version} 版
                </a>
              ) : null}
              {openGate === "publish" ? <p className="text-sm">实验使用一个免费渠道。额外付费推广需要单独确认。{project.budgetNote ? `你提交的预算和时间要求为「${project.budgetNote}」。` : ""}</p> : null}
              <input type="hidden" name="gate" value={openGate} />
              <input type="hidden" name="version" value={openGate === "publish" ? view.page?.version : openGate === "positioning" ? project.positioningVersion : project.round} />
              <div className="flex flex-col gap-2">
                <Label htmlFor="reason">退回原因（退回时必填）</Label>
                <Input id="reason" name="reason" maxLength={500} />
              </div>
              <div className="flex gap-2">
                <Button type="submit" name="verdict" value="approve">
                  确认采用
                </Button>
                <Button type="submit" name="verdict" value="reject" variant="outline">
                  退回修改
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : null}

      <div id="clarifications" hidden={!view.clarifications.length}><ClarificationSection
        questions={view.clarifications}
        canAnswer={project.status === "needs_info"}
        answerAction={customerAnswers.bind(null, token)}
      /></div>
      <DeliverablesSection view={view} deliveryStatus={order?.deliveryStatus} closingHref="#delivery" />
      <div id="strategy"><PositioningSection view={view} /></div>
      <div id="launch"><PageSection view={view} previewHref={`/p/${token}/preview`} /></div>
      <div id="growth"><GrowthSection view={view} /></div>
      {project.status === "delivered" ? (
        <Card id="delivery">
          <CardHeader><CardTitle>交付验收</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-3 text-sm">
            {order?.deliveryStatus === "accepted" ? <p>你已确认验收。</p> : (
              <form action={customerAcceptanceAction.bind(null, token)} className="flex flex-col gap-3">
                {order?.deliveryStatus === "changes_requested" ? <p>修改意见已提交，可补充意见或确认验收。</p> : null}
                <Label htmlFor="acceptance-note">需要修改的地方（退回时必填）</Label>
                <Textarea id="acceptance-note" name="reason" maxLength={500} />
                <div className="flex gap-2">
                  <Button name="verdict" value="approve" type="submit">确认验收</Button>
                  <Button name="verdict" value="reject" type="submit" variant="outline">提出修改</Button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      ) : null}
      <Card id="support">
        <CardHeader><CardTitle>问首客客服</CardTitle></CardHeader>
        <CardContent className="flex flex-col gap-4 text-sm">
          <form action={customerSupportAction.bind(null, token)} className="flex flex-col gap-2">
            <Label htmlFor="support-question">你的问题</Label>
            <Textarea id="support-question" name="question" required maxLength={1000} />
            <Button type="submit" className="self-start">提交问题</Button>
          </form>
          {support.map((item) => (
            <article key={item.id} className="space-y-2 border-t pt-3">
              <p className="font-medium whitespace-pre-wrap">{item.question}</p>
              <p className="whitespace-pre-wrap">{item.reply ?? (item.status === "escalated" ? "已转给首客老板处理。" : "客服已收到问题，等待处理。")}</p>
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
