import { LocalizedInput } from "@/components/localized-controls";
import { T, I18n } from "@/components/ui-text";
import type { PositioningOption, VisionOutput } from "@/agents/schemas";
import { ImageUploadInput } from "@/components/image-upload-input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { GRADE_LABELS, type Grade } from "@/domain/evidence";
import { MAIN_FLOW, STATUS_LABELS, usesQuoteFlow, type ProjectStatus } from "@/domain/workflow";
import { formatDate, formatDateTime } from "@/lib/format";
import { safeHref } from "@/lib/request";
import { hostedUploadLimit } from "@/lib/uploads";
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
    <p className="rounded-md border border-amber-500 bg-amber-50 px-3 py-2 text-sm text-amber-900"><T>
      这个项目由模拟模型运行，所有研究和文案都是示例，不是真实结果。
    </T></p>
  );
}

export function StatusFlow({ status, quoteFlow, plan = "legacy" }: { status: string; quoteFlow: boolean; plan?: Project["productPlan"] }) {
  const flow: ProjectStatus[] = plan === "free"
    ? ["submitted", "researching", "free_ready"]
    : quoteFlow
      ? [...MAIN_FLOW.slice(0, 2), ...(plan === "pro" ? ["free_ready"] as const : []), "drafting_quote", "awaiting_quote", "awaiting_quote_acceptance", "awaiting_payment", ...MAIN_FLOW.slice(2)]
      : MAIN_FLOW;
  const current = status === "reading_receipt" ? "awaiting_payment" : status;
  const index = flow.indexOf(current as ProjectStatus);
  return (
    <ol className="flex flex-wrap gap-2 text-sm">
      {flow.map((step, i) => (
        <li key={step} aria-current={step === current ? "step" : undefined}>
          <Badge className="transition-none" variant={step === current ? "default" : i < index ? "secondary" : "outline"}>
            <T>{STATUS_LABELS[step]}</T>
          </Badge>
        </li>
      ))}
      {index < 0 ? (
        <li aria-current="step">
          <Badge variant={status === "failed" || status === "cancelled" ? "destructive" : "secondary"}>
            <T>{STATUS_LABELS[status as ProjectStatus] ?? status}</T>
          </Badge>
        </li>
      ) : null}
    </ol>
  );
}

export function DeliverablesSection({ view, deliveryStatus, closingHref }: {
  view: ProjectView;
  deliveryStatus?: string;
  closingHref: string;
}) {
  const { positioning, gates, evidence, page, campaign, report } = view;
  const verified = evidence.filter((item) => item.status === "verified").length;
  const closing = deliveryStatus === "accepted" ? "客户已验收"
    : deliveryStatus === "changes_requested" ? "客户要求修改"
      : deliveryStatus === "delivered" ? "已交付，等待客户验收" : null;
  const items = [
    { label: "定位卡", href: positioning ? "#strategy" : null,
      state: positioning ? `第 ${positioning.version} 版 · ${gates.positioning.complete ? "已确认" : gates.positioning.founder === "approved" ? "待客户确认" : "待老板把关"}` : "待生成" },
    { label: "商业证据卡", href: "#research",
      state: evidence.length ? `已验证 ${verified} 条 · 待验证 ${evidence.length - verified} 条` : "待收集" },
    { label: "英文验证页", href: page ? "#launch" : null,
      state: page ? `第 ${page.version} 版 · ${page.status === "published" ? "已发布" : gates.publish.founder === "approved" ? "待客户确认" : "待老板把关"}` : "待生成" },
    { label: "渠道行动卡", href: campaign ? "#campaign" : null,
      state: campaign?.status === "executed" ? "已记录执行凭证" : campaign?.status === "approved" ? "已批准，等待执行" : campaign ? "等待发布审批" : "待生成" },
    { label: "增长复盘卡", href: report ? "#growth" : null,
      state: report ? `已复盘 · ${report.verdict_label}` : "待复盘" },
    { label: "结案记录", href: closing ? closingHref : null, state: closing ?? "待交付" },
  ];

  return (
    <Card id="deliverables">
      <CardHeader><CardTitle><T>交付清单</T></CardTitle></CardHeader>
      <CardContent>
        <dl className="divide-y text-sm">
          {items.map(({ label, href, state }) => (
            <div className="flex flex-wrap justify-between gap-x-4 gap-y-1 py-2 first:pt-0 last:pb-0" key={label}>
              <dt className="font-medium">{href ? <a href={href} className="underline underline-offset-4"><T>{label}</T></a> : <T>{label}</T>}</dt>
              <dd className="text-muted-foreground"><T>{state}</T></dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
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
    <Card className="border-primary">
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
            <div key={image.id} className="flex flex-col gap-3 rounded-md border p-3 sm:flex-row">
              <a href={hrefFor(image.id)} target="_blank" rel="noreferrer" className="shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <I18n><img src={hrefFor(image.id)} alt="上传的截图" className="h-24 w-36 rounded object-cover" /></I18n>
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
          <form action={props.uploadAction} className="flex flex-col gap-2">
            <Label htmlFor="image-files"><T>上传截图（一次最多 3 张，</T><T>{hostedUploadLimit ? "合计不超过 4 MB" : "每张不超过 5 MB"}</T>）</Label>
            <ImageUploadInput id="image-files" name="images" multiple required maxTotalBytes={hostedUploadLimit} />
            <div className="flex flex-wrap gap-2">
              <select name="kind" className="h-9 rounded-md border bg-background px-3" defaultValue="product">
                <option value="product"><T>我们的产品</T></option>
                <option value="competitor"><T>竞品</T></option>
              </select>
              <LocalizedInput name="note" placeholder="说明（选填）" maxLength={200} className="w-60" />
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

export function EvidenceSection({ view }: { view: ProjectView }) {
  const support = view.evidence.filter((e) => e.stance !== "against");
  const against = view.evidence.filter((e) => e.stance === "against");
  const counterSearches = view.searches.filter((s) => s.purpose === "counter");
  const rows = (items: ProjectView["evidence"]) =>
    items.map((e) => (
      <TableRow key={e.id}>
        <TableCell className="whitespace-normal">
          <p>{e.excerpt}</p>
          {e.numberValue ? (
            <p className="text-xs text-muted-foreground">
              {e.numberValue}
              {e.metric ? `（${e.metric}）` : ""}
            </p>
          ) : null}
        </TableCell>
        <TableCell><T>{KIND_LABELS[e.kind] ?? e.kind}</T></TableCell>
        <TableCell><T>{e.grade ? GRADE_LABELS[e.grade as Grade] : "不适用"}</T></TableCell>
        <TableCell><T>{e.status === "verified" ? "已验证" : "待验证"}</T></TableCell>
        <TableCell>
          <SourceLink url={e.url} />
          <p className="text-xs text-muted-foreground">{formatDate(e.collectedAt)}</p>
        </TableCell>
      </TableRow>
    ));
  const table = (items: ProjectView["evidence"], empty: string) =>
    items.length ? (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead><T>内容</T></TableHead>
            <TableHead><T>类型</T></TableHead>
            <TableHead><T>付费证据等级</T></TableHead>
            <TableHead><T>状态</T></TableHead>
            <TableHead><T>来源和日期</T></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>{rows(items)}</TableBody>
      </Table>
    ) : (
      <p className="text-sm text-muted-foreground"><T>{empty}</T></p>
    );

  return (
    <Card>
      <CardHeader>
        <CardTitle><T>市场证据</T></CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <h3 className="font-medium"><T>支持证据</T></h3>
        {table(support, "还没有支持证据")}
        <h3 className="font-medium"><T>反面证据</T></h3>
        {table(against, "还没有找到反面证据")}
        {counterSearches.length ? (
          <div className="text-sm">
            <h3 className="font-medium"><T>反向检索记录</T></h3>
            <ul className="mt-1 list-disc pl-5 text-muted-foreground">
              {counterSearches.map((s) => (
                <li key={s.id}>
                  {s.candidate}<T>：在 </T>{s.source}<T> 查“</T>{s.query}”，
                  <T>{s.resultCount ? `找到 ${s.resultCount} 条` : "已检索，未发现"}</T>
                </li>
              ))}
            </ul>
          </div>
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
      </CardHeader>
      <CardContent className="flex flex-col gap-4 text-sm">
        <p>{positioning.rationale}</p>
        <ul className="flex flex-col gap-3">
          {options.map((option, i) => (
            <li key={option.audience} className="rounded-md border p-3">
              <p className="font-medium"><T>
                方案 </T>{i + 1}：{option.audience}
                <T>{i === positioning.recommendedOption ? "（推荐）" : ""}</T>
                <T>{i === positioning.chosenOption ? "（已选）" : ""}</T>
              </p>
              <p><T>问题：</T>{option.problem}</p>
              <p><T>价值主张：</T>{option.value_prop}</p>
              <p className="text-muted-foreground">{option.why}</p>
            </li>
          ))}
        </ul>
        <div>
          <h3 className="font-medium"><T>实验计划</T></h3>
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
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead><T>声明</T></TableHead>
                  <TableHead><T>类型</T></TableHead>
                  <TableHead><T>证据摘录</T></TableHead>
                  <TableHead><T>来源</T></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageClaims.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="whitespace-normal">{c.text}</TableCell>
                    <TableCell><T>{CLAIM_LABELS[c.kind] ?? c.kind}</T></TableCell>
                    <TableCell className="whitespace-normal"><T>{c.excerpt ?? "无"}</T></TableCell>
                    <TableCell>
                      <SourceLink url={c.url} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-muted-foreground"><T>这版页面没有事实声明。</T></p>
          )}
        </div>
        {campaign ? (
          <div id="campaign" className="flex flex-col gap-2">
            <h3 className="font-medium"><T>渠道任务：</T>{campaign.channel}</h3>
            <p className="text-muted-foreground">{campaign.reason}</p>
            {assets.map((asset) => (
              <div key={asset.title} className="rounded-md border p-3">
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
          <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div>
              <dt className="text-muted-foreground"><T>独立访问（按日去重）</T></dt>
              <dd className="text-lg font-medium">{numbers.visits}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground"><T>CTA 点击</T></dt>
              <dd className="text-lg font-medium">{numbers.ctaClicks}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground"><T>有效留资（不是付费）</T></dt>
              <dd className="text-lg font-medium">{numbers.leads}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground"><T>回复和评论</T></dt>
              <dd className="text-lg font-medium">{numbers.replies}</dd>
            </div>
          </dl>
        ) : null}
        {report ? (
          <div className="flex flex-col gap-2">
            <p className="font-medium"><T>结论：</T>{report.verdict_label}</p>
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

export function ProjectHeader({ project }: { project: Project }) {
  return (
    <header className="flex flex-col gap-3">
      <h1 className="text-3xl font-bold tracking-tight break-words">{project.productName}</h1>
      <p className="text-sm text-muted-foreground">
        <T>{project.stage}</T> · <T>{project.goal}</T>
        {project.targetMarket ? ` · ${project.targetMarket}` : ""}
        <T>{project.isOwnProduct ? " · 自有产品" : ""}</T>
      </p>
      <StatusFlow status={project.status} quoteFlow={usesQuoteFlow(project)} plan={project.productPlan} />
    </header>
  );
}
