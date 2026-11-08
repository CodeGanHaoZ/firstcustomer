import { founderReady } from "@/domain/approval";
import { LocalizedInput, LocalizedTag } from "@/components/localized-controls";
import { T } from "@/components/ui-text";
import type { PositioningOption, VisionOutput } from "@/agents/schemas";
import { ImageUploadInput } from "@/components/image-upload-input";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { GRADE_LABELS, type Grade } from "@/domain/evidence";
import { QUOTE_STATUS_LABELS } from "@/domain/provenance";
import { ConclusionStatus } from "@/components/provenance-details";
import { AgentByline } from "@/components/agent-byline";
import { STATUS_LABELS, usesQuoteFlow, type ProjectStatus } from "@/domain/workflow";
import { formatDate, formatDateTime } from "@/lib/format";
import { safeHref } from "@/lib/request";
import type { CSSProperties, ReactNode } from "react";
import { StatusPill } from "@/components/site-chrome";
import { hostedUploadLimit } from "@/lib/uploads";
import { EvidenceSummaryCard, type EvidenceDigest } from "@/components/evidence-summary-card";
import type { Project, ProjectView } from "@/workflow/queries";

const RESPONSE_LABELS: Record<string, string> = {
  accepted: "接受并调整方案",
  rebutted: "用其他证据反驳",
  to_test: "列为实验待验证",
};
const KIND_LABELS: Record<string, string> = {
  pain: "痛点",
  pricing: "定价",
  revenue: "收入",
  signal: "信号",
  channel: "渠道",
  product: "产品事实",
};
const CLAIM_LABELS: Record<string, string> = {
  metric: "数字或效果",
  comparison: "竞品对比",
  pain: "用户痛点",
  feature: "产品功能",
};

function SourceLink({ url }: { url: string | null }) {
  const href = safeHref(url);
  if (!href) return <span className="text-muted-foreground"><T>无来源</T></span>;
  return (
    <a href={href} target="_blank" rel="noreferrer noopener" className="break-all underline">
      {new URL(href).hostname.replace(/^www\./, "")}
    </a>
  );
}

export function SimulatedBanner() {
  return (
    <p className="notice notice--wait"><T>
      这个项目由模拟模型运行，所有研究和文案都是示例，不是真实结果。
    </T></p>
  );
}

/** 把细分状态归到几个大阶段，进度路径只画阶段，当前精确状态写在标签里。 */
const PHASES: { label: string; statuses: ProjectStatus[] }[] = [
  { label: "提交资料", statuses: ["submitted"] },
  { label: "分析出海机会", statuses: ["researching", "free_ready"] },
  { label: "报价与付款", statuses: ["drafting_quote", "awaiting_quote", "awaiting_quote_acceptance", "awaiting_payment", "reading_receipt"] },
  { label: "定位方案", statuses: ["strategizing", "awaiting_positioning"] },
  { label: "英文页发布", statuses: ["preparing_page", "awaiting_publish", "published"] },
  { label: "收集与复盘", statuses: ["collecting", "reviewing"] },
  { label: "交付验收", statuses: ["delivered"] },
];

export function projectPhases(status: string, quoteFlow: boolean, plan: Project["productPlan"] = "legacy", failedFrom?: string | null) {
  const phases = plan === "free"
    ? [PHASES[0], PHASES[1], { label: "机会报告", statuses: ["free_ready"] as ProjectStatus[] }]
    : PHASES.filter((phase) => quoteFlow || phase.label !== "报价与付款");
  const lookup = status === "failed" || status === "needs_info" || status === "awaiting_founder" || status === "cancelled"
    ? (status === "needs_info" ? "researching" : failedFrom ?? "")
    : status;
  let index = phases.findIndex((phase) => phase.statuses.includes(lookup as ProjectStatus));
  if (plan === "free" && lookup === "free_ready") index = 2;
  if (plan === "free" && lookup === "researching") index = 1;
  const done = status === "delivered" || (plan === "free" && status === "free_ready");
  return { phases, index, done };
}

export function StatusFlow({ status, quoteFlow, plan = "legacy", failedFrom }: { status: string; quoteFlow: boolean; plan?: Project["productPlan"]; failedFrom?: string | null }) {
  const { phases, index, done } = projectPhases(status, quoteFlow, plan, failedFrom);
  const alert = status === "failed" || status === "cancelled";
  return (
    <LocalizedTag as="ol" className="path" aria-label="项目进度">
      {phases.map((phase, i) => {
        const state = i < index || (done && i === index) ? "done" : i === index ? (alert ? "alert" : "current") : "todo";
        return (
          <li key={phase.label} className="path__step" data-state={state} style={{ "--i": i } as CSSProperties}
            aria-current={state === "current" || state === "alert" ? "step" : undefined}>
            <span className="path__dot" aria-hidden="true" />
            <span className="path__label"><T>{phase.label}</T></span>
          </li>
        );
      })}
    </LocalizedTag>
  );
}

export function DeliverablesSection({ view, deliveryStatus, closingHref, selfServicePro }: {
  view: ProjectView;
  deliveryStatus?: string;
  closingHref: string;
  selfServicePro?: boolean;
}) {
  const { positioning, gates, evidence, page, campaign, report } = view;
  const verified = evidence.filter((item) => item.status === "verified").length;
  const closing = deliveryStatus === "accepted" ? "客户已验收"
    : deliveryStatus === "changes_requested" ? "客户要求修改"
      : deliveryStatus === "delivered" ? "已交付，等待客户验收" : null;
  const items = [
    { label: "定位卡", href: positioning ? "#strategy" : null,
      state: positioning ? `第 ${positioning.version} 版 · ${gates.positioning.complete ? "已确认" : founderReady(gates.positioning) ? "待客户确认" : "待老板把关"}` : "待生成" },
    { label: "商业证据卡", href: "#research",
      state: evidence.length ? `摘录已匹配 ${verified} 条 · 未匹配或待核对 ${evidence.length - verified} 条` : "待收集" },
    { label: "英文验证页", href: page ? "#launch" : null,
      state: page ? `第 ${page.version} 版 · ${page.status === "published" ? "已发布" : founderReady(gates.publish) ? "待客户确认" : "待老板把关"}` : "待生成" },
    { label: "渠道行动卡", href: campaign ? "#campaign" : null,
      state: campaign?.status === "executed" ? "已记录执行凭证" : campaign?.status === "approved" ? "已批准，等待执行" : campaign ? "等待发布审批" : "待生成" },
    { label: "增长复盘卡", href: report ? "#growth" : null,
      state: report ? `已复盘 · ${report.verdict_label}` : "待复盘" },
    ...(!selfServicePro ? [{ label: "结案记录", href: closing ? closingHref : null, state: closing ?? "待交付" }] : []),
  ];

  return (
    <section id="deliverables" aria-labelledby="deliverables-title" className="grid gap-4">
      <div className="block-title"><h2 id="deliverables-title"><T>交付清单</T></h2></div>
      <ul className="card-grid">
        {items.map(({ label, href, state }, i) => {
          const body = (
            <>
              <p className="tile__meta">0{i + 1}</p>
              <h3 className="tile__title"><T>{label}</T></h3>
              <p className="tile__meta"><T>{state}</T></p>
              <div className="meter" aria-hidden="true"><span style={{ "--p": href ? "100%" : "12%", "--i": i } as CSSProperties} /></div>
            </>
          );
          return (
            <li key={label} className="rise" style={{ "--i": i } as CSSProperties}>
              {href ? <a href={href} className="tile h-full">{body}</a> : <div className="tile h-full">{body}</div>}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export function ClarificationSection(props: {
  questions: ProjectView["clarifications"];
  canAnswer: boolean;
  answerAction: (formData: FormData) => Promise<void>;
  requirementVersion: number;
}) {
  const { questions, canAnswer, answerAction } = props;
  if (!questions.length) return null;
  if (!canAnswer) {
    return (
      <Card>
        <CardHeader>
          <CardTitle><T>补充信息</T></CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="flex flex-col gap-2 text-sm">
            {questions.map((q) => (
              <li key={q.id}>
                <p className="font-medium">{q.question}</p>
                <p className="text-muted-foreground">{q.answer ?? <T>没有回答</T>}</p>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    );
  }
  return (
    <Card className="border-[#456447] shadow-[0_0_0_3px_rgba(69,100,71,0.08)]">
      <CardHeader>
        <CardTitle><T>需要补充这些信息</T></CardTitle>
      </CardHeader>
      <CardContent>
        <form action={answerAction} className="flex flex-col gap-4 text-sm">
          <input type="hidden" name="requirementVersion" value={props.requirementVersion} />
          {questions.map((q) => (
            <div key={q.id} className="flex flex-col gap-1">
              <Label htmlFor={`answer_${q.id}`}><T>第 </T>{q.batch}<T> 轮 · </T>{q.question}</Label>
              <p className="text-muted-foreground">{q.why}</p>
              <Textarea
                id={`answer_${q.id}`}
                name={`answer_${q.id}`}
                defaultValue={q.answer ?? ""}
                maxLength={2000}
              />
            </div>
          ))}
          <p className="text-muted-foreground"><T>已填的内容会保存；全部回答后研究才会继续。不确定可以写“不清楚”。</T></p>
          <Button type="submit" className="self-start"><T>
            提交回答
          </T></Button>
        </form>
      </CardContent>
    </Card>
  );
}

const IMAGE_STATUS: Record<string, string> = {
  pending: "等待读取，下一个 Agent 运行时处理",
  done: "已读取",
  failed: "读取失败",
};

export function ScreenshotsSection(props: {
  images: ProjectView["images"];
  hrefFor: (imageId: string) => string;
  editable: boolean;
  uploadAction: (formData: FormData) => Promise<void>;
  deleteAction: (formData: FormData) => Promise<void>;
  retryAction?: (formData: FormData) => Promise<void>;
}) {
  const { images, hrefFor, editable } = props;
  if (!images.length && !editable) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle><T>产品和竞品截图</T></CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 text-sm">
        <p className="text-muted-foreground"><T>
          截图内容由模型读取，只用来帮助理解产品，不算市场证据，也不能直接写进对外页面。
        </T></p>
        {images.map((image) => {
          const analysis = image.analysis as VisionOutput | null;
          return (
            <div key={image.id} className="flex flex-col gap-3 rounded-2xl border bg-background p-3 sm:flex-row">
              <a href={hrefFor(image.id)} target="_blank" rel="noreferrer" className="shrink-0">
                <LocalizedTag as="img" src={hrefFor(image.id)} alt="上传的截图" className="h-24 w-36 rounded-xl object-cover" />
              </a>
              <div className="flex flex-1 flex-col gap-1">
                <p className="font-medium">
                  <T>{image.kind === "competitor" ? "竞品" : "产品"}</T>
                  {image.note ? `：${image.note}` : ""}
                </p>
                <p className="text-muted-foreground"><T>{IMAGE_STATUS[image.analysisStatus] ?? image.analysisStatus}</T></p>
                {analysis ? <p>{analysis.summary}</p> : null}
                {analysis?.features.length ? <p><T>可见功能：</T>{analysis.features.join("、")}</p> : null}
                {analysis?.prices.length ? <p><T>可见价格：</T>{analysis.prices.join("、")}</p> : null}
                {image.analysisError ? <p className="text-destructive">{image.analysisError}</p> : null}
                {editable ? (
                  <form action={props.deleteAction}>
                    <input type="hidden" name="imageId" value={image.id} />
                    <Button type="submit" variant="ghost" size="sm"><T>
                      删除
                    </T></Button>
                  </form>
                ) : null}
              </div>
            </div>
          );
        })}
        {props.retryAction && images.some((image) => image.analysisStatus === "failed") ? (
          <form action={props.retryAction}>
            <Button type="submit" variant="outline"><T>
              重新读取失败的截图
            </T></Button>
          </form>
        ) : null}
        {editable ? (
          <form action={props.uploadAction} className="flex flex-col gap-3 rounded-2xl border border-dashed border-input p-4">
            <Label htmlFor="image-files"><T>上传截图（一次最多 3 张，</T><T>{hostedUploadLimit ? "合计不超过 4 MB" : "每张不超过 5 MB"}</T>）</Label>
            <ImageUploadInput id="image-files" name="images" multiple required maxTotalBytes={hostedUploadLimit} />
            <div className="flex flex-wrap gap-2">
              <LocalizedTag as="fieldset" className="choice-group" aria-label="截图类型">
                <label className="choice"><input type="radio" name="kind" value="product" defaultChecked /><span><T>我们的产品</T></span></label>
                <label className="choice"><input type="radio" name="kind" value="competitor" /><span><T>竞品</T></span></label>
              </LocalizedTag>
              <LocalizedInput name="note" placeholder="说明（选填）" maxLength={200} className="h-9 w-60" />
              <Button type="submit" variant="outline"><T>
                上传
              </T></Button>
            </div>
          </form>
        ) : null}
      </CardContent>
    </Card>
  );
}

const hostOf = (url: string | null) => {
  if (!url) return null;
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return null; }
};

/** 证据列表抽屉：默认展示前 3 条，其余收进「展开其余 N 条」。 */
const EVIDENCE_VISIBLE = 3;

function EvidenceCards({ items, empty }: { items: ProjectView["evidence"]; empty: string }) {
  if (!items.length) return <p className="text-sm text-muted-foreground"><T>{empty}</T></p>;
  const tile = (e: ProjectView["evidence"][number], i: number) => (
    <li key={e.id} className="tile rise bg-background" style={{ "--i": Math.min(i, 8) } as CSSProperties}>
      <div className="flex flex-wrap gap-1.5">
        <span className="pill"><T>{KIND_LABELS[e.kind] ?? e.kind}</T></span>
        <span className={e.status === "verified" ? "pill pill--ok" : "pill pill--wait"}><T>{QUOTE_STATUS_LABELS[e.status] ?? "摘录待核对"}</T></span>
        {e.grade ? <span className="pill pill--line"><T>{GRADE_LABELS[e.grade as Grade]}</T></span> : null}
      </div>
      <p className="m-0 leading-relaxed">{e.excerpt}</p>
      {e.numberValue ? <p className="tile__value text-[1.35rem]">{e.numberValue}{e.metric ? <span className="ms-1 font-sans text-xs text-muted-foreground">（{e.metric}）</span> : null}</p> : null}
      <p className="tile__foot tile__meta"><SourceLink url={e.url} /><span>{formatDate(e.collectedAt)}</span></p>
      <a className="text-sm underline" href={`#source-evidence-${e.id}`}><T>查看溯源</T></a>
    </li>
  );
  const visible = items.slice(0, EVIDENCE_VISIBLE);
  const hidden = items.slice(EVIDENCE_VISIBLE);
  return <div className="grid gap-3">
    <ul className="card-grid card-grid--wide">{visible.map((e, i) => tile(e, i))}</ul>
    {hidden.length ? <details className="fold bg-background">
      <summary><span className="fold__title"><T>展开其余 </T>{hidden.length}<T> 条证据</T></span><span className="fold__hint"><T>已按时间倒序收起，避免一次看太多</T></span></summary>
      <ul className="card-grid card-grid--wide fold__body mt-4">{hidden.map((e, i) => tile(e, i + EVIDENCE_VISIBLE))}</ul>
    </details> : null}
  </div>;
}

export function EvidenceSection({ view, token, cacheKey }: { view: ProjectView; token?: string; cacheKey?: string }) {
  const support = view.evidence.filter((e) => e.stance !== "against");
  const against = view.evidence.filter((e) => e.stance === "against");
  const counterSearches = view.searches.filter((s) => s.purpose === "counter");
  const digest: EvidenceDigest | null = token && cacheKey ? {
    key: cacheKey,
    items: view.evidence.slice(0, 60).map((e) => ({
      kind: KIND_LABELS[e.kind] ?? e.kind,
      stance: e.stance === "against" ? "against" : "support",
      status: QUOTE_STATUS_LABELS[e.status] ?? e.status,
      grade: e.grade ? GRADE_LABELS[e.grade as Grade] ?? e.grade : null,
      excerpt: e.excerpt.slice(0, 200),
      source: hostOf(e.url),
      date: e.collectedAt instanceof Date ? e.collectedAt.toISOString().slice(0, 10) : String(e.collectedAt ?? "").slice(0, 10),
    })),
    searches: view.searches.slice(0, 120).map((s) => ({ source: s.source, purpose: s.purpose, resultCount: s.resultCount })),
  } : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle><T>市场证据</T></CardTitle>
        <CardAction><AgentByline person="research" /></CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        {digest ? <EvidenceSummaryCard token={token!} digest={digest} /> : null}
        <h3 className="eyebrow m-0"><T>支持证据</T> · {support.length}</h3>
        <EvidenceCards items={support} empty="还没有支持证据" />
        <h3 className="eyebrow m-0"><T>反面证据</T> · {against.length}</h3>
        <EvidenceCards items={against} empty="还没有找到反面证据" />
        {counterSearches.length ? (
          <details className="fold bg-background">
            <summary><span className="fold__title"><T>反向检索记录</T></span></summary>
            <ul className="fold__body m-0 list-disc pl-10 text-sm text-muted-foreground">
              {counterSearches.map((s) => (
                <li key={s.id}>
                  {s.candidate}<T>：在 </T>{s.source}<T> 查“</T>{s.query}”，
                  <T>{s.resultCount ? `找到 ${s.resultCount} 条` : "已检索，未发现"}</T>
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </CardContent>
    </Card>
  );
}

export function PositioningSection({ view }: { view: ProjectView }) {
  const { positioning, responses } = view;
  if (!positioning) return null;
  const options = positioning.options as PositioningOption[];
  const experiment = positioning.experiment as {
    hypothesis: string;
    channel: string;
    min_visits: number;
    pass_leads: number;
  };
  return (
    <Card>
      <CardHeader>
        <CardTitle><T>定位方案（第 </T>{positioning.version}<T> 版）</T></CardTitle>
        <CardAction><AgentByline person="strategy" /></CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 text-sm">
        <p>{positioning.rationale}</p>
        <ConclusionStatus provenance={view.provenance} subjectId={positioning.id} recordKey="rationale" />
        <ul className="card-grid">
          {options.map((option, i) => (
            <li key={option.audience} className={`tile rise ${i === positioning.chosenOption || i === positioning.recommendedOption ? "border-[#456447] bg-background" : "bg-background"}`} style={{ "--i": i } as CSSProperties}>
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="tile__meta"><T>方案 </T>{i + 1}</span>
                {i === positioning.recommendedOption ? <span className="pill pill--live"><T>推荐</T></span> : null}
                {i === positioning.chosenOption ? <span className="pill pill--ok"><T>已选</T></span> : null}
              </div>
              <h3 className="tile__title">{option.audience}</h3>
              <p className="m-0"><T>问题：</T>{option.problem}</p>
              <p className="m-0"><T>价值主张：</T>{option.value_prop}</p>
              <p className="tile__meta">{option.why}</p>
              <ConclusionStatus provenance={view.provenance} subjectId={positioning.id} recordKey={`option:${i}`} />
            </li>
          ))}
        </ul>
        <div className="rounded-2xl bg-[#faebd4] p-4">
          <h3 className="eyebrow m-0 mb-2"><T>实验计划</T></h3>
          <p><T>假设：</T>{experiment.hypothesis}</p>
          <p><T>渠道：</T>{experiment.channel}</p>
          <p><T>
            判定标准：</T>{experiment.min_visits}<T> 次访问内至少 </T>{experiment.pass_leads}<T> 个有效留资；没到样本量就写“样本不足”。
          </T></p>
        </div>
        {responses.length ? (
          <div>
            <h3 className="font-medium"><T>对反面证据的回应</T></h3>
            <ul className="mt-1 list-disc pl-5">
              {responses.map((r) => (
                <li key={r.evidenceId}>
                  “{r.excerpt}” → <T>{RESPONSE_LABELS[r.response] ?? r.response}</T>：{r.note}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

export function PageSection({ view, previewHref }: { view: ProjectView; previewHref: string }) {
  const { page, publishedPage, pageClaims, campaign } = view;
  if (!page) return null;
  const published = page.status === "published";
  const assets = (campaign?.assets ?? []) as { title: string; body: string }[];
  const checklist = (campaign?.checklist ?? []) as string[];
  return (
    <Card>
      <CardHeader>
        <CardTitle><T>英文页面和渠道（第 </T>{page.version}<T> 版）</T></CardTitle>
        <CardAction><AgentByline person="launch" /></CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 text-sm">
        <p>
          {published ? (
            <a className="underline" href={`/launch/${page.slug}`} target="_blank" rel="noreferrer"><T>
              公开地址：/launch/</T>{page.slug}
            </a>
          ) : (
            <a className="underline" href={`${previewHref}?version=${page.version}`} target="_blank" rel="noreferrer"><T>
              预览第 </T>{page.version}<T> 版（未公开）
            </T></a>
          )}
        </p>
        {!published && publishedPage ? (
          <a className="w-fit underline" href={`/launch/${publishedPage.slug}`} target="_blank" rel="noreferrer"><T>
            查看当前公开的第 </T>{publishedPage.version}<T> 版
          </T></a>
        ) : null}
        <div>
          <h3 className="font-medium"><T>事实声明与证据对照</T></h3>
          {pageClaims.length ? (
            <ul className="mt-2 grid gap-2">
              {pageClaims.map((c) => (
                <li key={c.id} className="grid gap-1 rounded-xl border bg-background p-3">
                  <div className="flex flex-wrap items-center gap-2"><span className="pill"><T>{CLAIM_LABELS[c.kind] ?? c.kind}</T></span><SourceLink url={c.url} /></div>
                  <p className="m-0 font-medium">{c.text}</p>
                  <p className="m-0 text-muted-foreground"><T>{c.excerpt ?? "无"}</T></p>
                  <ConclusionStatus provenance={view.provenance} subjectId={page.id} recordKey={c.id} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground"><T>这版页面没有事实声明。</T></p>
          )}
        </div>
        {campaign ? (
          <div id="campaign" className="flex flex-col gap-2">
            <h3 className="font-medium"><T>渠道任务：</T>{campaign.channel}</h3>
            <p className="text-muted-foreground">{campaign.reason}</p>
            {assets.map((asset) => (
              <div key={asset.title} className="rounded-xl border bg-background p-3">
                <p className="font-medium">{asset.title}</p>
                <p className="whitespace-pre-wrap">{asset.body}</p>
              </div>
            ))}
            {checklist.length ? (
              <ul className="list-disc pl-5 text-muted-foreground">
                {checklist.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            ) : null}
            <p><T>
              状态：
              </T><T>{campaign.status === "executed"
                ? `已执行（${campaign.executedAt ? formatDateTime(campaign.executedAt) : "时间未知"}）`
                : campaign.status === "approved"
                  ? "已批准，等待执行"
                  : "等待确认"}</T>
              {campaign.executedUrl ? (
                <><T>
                  ，凭证：
                  </T><SourceLink url={campaign.executedUrl} />
                </>
              ) : null}
            </p>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

export function GrowthSection({ view }: { view: ProjectView }) {
  const { metrics, report } = view;
  if (!metrics && !report) return null;
  const numbers = report?.metrics ?? metrics;
  return (
    <Card>
      <CardHeader>
        <CardTitle><T>增长数据和复盘</T></CardTitle>
        <CardAction><AgentByline person="growth" /></CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 text-sm">
        {report?.feedback.length ? (
          <div>
            <h3 className="font-medium"><T>真实回复和评论</T></h3>
            <ul className="mt-1 list-disc pl-5">
              {report.feedback.map((f, i) => (
                <li key={i}>{f.payload?.text}</li>
              ))}
            </ul>
          </div>
        ) : null}
        {numbers ? (
          <dl className="figures m-0">
            {([["独立访问（按日去重）", numbers.visits], ["CTA 点击", numbers.ctaClicks], ["有效留资（不是付费）", numbers.leads], ["回复和评论", numbers.replies]] as const).map(([label, value]) => (
              <div className="figure" key={label}>
                <dd className="m-0"><b>{value}</b></dd>
                <dt className="order-first"><span><T>{label}</T></span></dt>
              </div>
            ))}
          </dl>
        ) : null}
        {report ? (
          <div className="flex flex-col gap-2">
            <p className="m-0"><span className="pill pill--live"><T>结论：</T>{report.verdict_label}</span></p>
            <p>{report.summary}</p>
            <h3 className="font-medium"><T>做过的动作</T></h3>
            <ul className="list-disc pl-5">
              {report.actions_taken.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <h3 className="font-medium"><T>仍不确定的地方</T></h3>
            <ul className="list-disc pl-5">
              {report.uncertainties.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <h3 className="font-medium"><T>下一步</T></h3>
            <ul className="list-disc pl-5">
              {report.next_steps.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            {report.next_hypothesis ? <p><T>下一轮假设：</T>{report.next_hypothesis}</p> : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

export function ProjectHeader({ project, eyebrow, actions, statusLabel }: { project: Project; eyebrow?: ReactNode; actions?: ReactNode; statusLabel?: string }) {
  return (
    <header className="grid gap-6">
      <div className="page-head rise">
        <div className="page-head__copy">
          {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
          <h1 className="page-head__title">{project.productName}</h1>
          <div className="page-head__meta">
            <StatusPill status={project.status} paused={project.paused} label={project.paused ? "已暂停" : statusLabel ?? STATUS_LABELS[project.status as ProjectStatus] ?? project.status} />
            <span className="pill pill--line"><T>{project.stage}</T></span>
            <span className="pill pill--line"><T>{project.goal}</T></span>
            {project.targetMarket ? <span className="pill pill--line">{project.targetMarket}</span> : null}
            {project.isOwnProduct ? <span className="pill pill--line"><T>自有产品</T></span> : null}
          </div>
        </div>
        {actions ? <div className="page-head__actions">{actions}</div> : null}
      </div>
      <div className="paper rise" style={{ "--i": 2 } as CSSProperties}>
        <StatusFlow status={project.status} quoteFlow={usesQuoteFlow(project)} plan={project.productPlan} failedFrom={project.failedFrom} />
      </div>
    </header>
  );
}
