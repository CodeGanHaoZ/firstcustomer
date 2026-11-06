import type { PositioningOption, VisionOutput } from "@/agents/schemas";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { GRADE_LABELS, type Grade } from "@/domain/evidence";
import { MAIN_FLOW, STATUS_LABELS, usesQuoteFlow, type ProjectStatus } from "@/domain/workflow";
import { formatDate, formatDateTime } from "@/lib/format";
import { safeHref } from "@/lib/request";
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
  if (!href) return <span className="text-muted-foreground">无来源</span>;
  return (
    <a href={href} target="_blank" rel="noreferrer noopener" className="break-all underline">
      {new URL(href).hostname.replace(/^www\./, "")}
    </a>
  );
}

export function SimulatedBanner() {
  return (
    <p className="rounded-md border border-amber-500 bg-amber-50 px-3 py-2 text-sm text-amber-900">
      这个项目由模拟模型运行，所有研究和文案都是示例，不是真实结果。
    </p>
  );
}

export function StatusFlow({ status, quoteFlow }: { status: string; quoteFlow: boolean }) {
  const flow: ProjectStatus[] = quoteFlow
    ? [...MAIN_FLOW.slice(0, 2), "drafting_quote", "awaiting_quote", "awaiting_quote_acceptance", "awaiting_payment", ...MAIN_FLOW.slice(2)]
    : MAIN_FLOW;
  const current = status === "reading_receipt" ? "awaiting_payment" : status;
  const index = flow.indexOf(current as ProjectStatus);
  return (
    <ol className="flex flex-wrap gap-2 text-sm">
      {flow.map((step, i) => (
        <li key={step} aria-current={step === current ? "step" : undefined}>
          <Badge variant={step === current ? "default" : i < index ? "secondary" : "outline"}>
            {STATUS_LABELS[step]}
          </Badge>
        </li>
      ))}
      {index < 0 ? (
        <li aria-current="step">
          <Badge variant={status === "failed" || status === "cancelled" ? "destructive" : "secondary"}>
            {STATUS_LABELS[status as ProjectStatus] ?? status}
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
      <CardHeader><CardTitle>交付清单</CardTitle></CardHeader>
      <CardContent>
        <dl className="divide-y text-sm">
          {items.map(({ label, href, state }) => (
            <div className="flex flex-wrap justify-between gap-x-4 gap-y-1 py-2 first:pt-0 last:pb-0" key={label}>
              <dt className="font-medium">{href ? <a href={href} className="underline underline-offset-4">{label}</a> : label}</dt>
              <dd className="text-muted-foreground">{state}</dd>
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
}) {
  const { questions, canAnswer, answerAction } = props;
  if (!questions.length) return null;
  if (!canAnswer) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>补充信息</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="flex flex-col gap-2 text-sm">
            {questions.map((q) => (
              <li key={q.id}>
                <p className="font-medium">{q.question}</p>
                <p className="text-muted-foreground">{q.answer ?? "没有回答"}</p>
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
        <CardTitle>需要补充这些信息</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={answerAction} className="flex flex-col gap-4 text-sm">
          {questions.map((q) => (
            <div key={q.id} className="flex flex-col gap-1">
              <Label htmlFor={`answer_${q.id}`}>{q.question}</Label>
              <p className="text-muted-foreground">{q.why}</p>
              <Textarea
                id={`answer_${q.id}`}
                name={`answer_${q.id}`}
                defaultValue={q.answer ?? ""}
                maxLength={2000}
              />
            </div>
          ))}
          <p className="text-muted-foreground">已填的内容会保存；全部回答后研究才会继续。不确定可以写“不清楚”。</p>
          <Button type="submit" className="self-start">
            提交回答
          </Button>
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
        <CardTitle>产品和竞品截图</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 text-sm">
        <p className="text-muted-foreground">
          截图内容由模型读取，只用来帮助理解产品，不算市场证据，也不能直接写进对外页面。
        </p>
        {images.map((image) => {
          const analysis = image.analysis as VisionOutput | null;
          return (
            <div key={image.id} className="flex flex-col gap-3 rounded-md border p-3 sm:flex-row">
              <a href={hrefFor(image.id)} target="_blank" rel="noreferrer" className="shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={hrefFor(image.id)} alt="上传的截图" className="h-24 w-36 rounded object-cover" />
              </a>
              <div className="flex flex-1 flex-col gap-1">
                <p className="font-medium">
                  {image.kind === "competitor" ? "竞品" : "产品"}
                  {image.note ? `：${image.note}` : ""}
                </p>
                <p className="text-muted-foreground">{IMAGE_STATUS[image.analysisStatus] ?? image.analysisStatus}</p>
                {analysis ? <p>{analysis.summary}</p> : null}
                {analysis?.features.length ? <p>可见功能：{analysis.features.join("、")}</p> : null}
                {analysis?.prices.length ? <p>可见价格：{analysis.prices.join("、")}</p> : null}
                {image.analysisError ? <p className="text-destructive">{image.analysisError}</p> : null}
                {editable ? (
                  <form action={props.deleteAction}>
                    <input type="hidden" name="imageId" value={image.id} />
                    <Button type="submit" variant="ghost" size="sm">
                      删除
                    </Button>
                  </form>
                ) : null}
              </div>
            </div>
          );
        })}
        {props.retryAction && images.some((image) => image.analysisStatus === "failed") ? (
          <form action={props.retryAction}>
            <Button type="submit" variant="outline">
              重新读取失败的截图
            </Button>
          </form>
        ) : null}
        {editable ? (
          <form action={props.uploadAction} className="flex flex-col gap-2">
            <Label htmlFor="image-files">上传截图（一次最多 3 张，每张不超过 5 MB）</Label>
            <Input id="image-files" name="images" type="file" multiple required accept="image/png,image/jpeg,image/webp" />
            <div className="flex flex-wrap gap-2">
              <select name="kind" className="h-9 rounded-md border bg-background px-3" defaultValue="product">
                <option value="product">我们的产品</option>
                <option value="competitor">竞品</option>
              </select>
              <Input name="note" placeholder="说明（选填）" maxLength={200} className="w-60" />
              <Button type="submit" variant="outline">
                上传
              </Button>
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
        <TableCell>{KIND_LABELS[e.kind] ?? e.kind}</TableCell>
        <TableCell>{e.grade ? GRADE_LABELS[e.grade as Grade] : "不适用"}</TableCell>
        <TableCell>{e.status === "verified" ? "已验证" : "待验证"}</TableCell>
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
            <TableHead>内容</TableHead>
            <TableHead>类型</TableHead>
            <TableHead>付费证据等级</TableHead>
            <TableHead>状态</TableHead>
            <TableHead>来源和日期</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>{rows(items)}</TableBody>
      </Table>
    ) : (
      <p className="text-sm text-muted-foreground">{empty}</p>
    );

  return (
    <Card>
      <CardHeader>
        <CardTitle>市场证据</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <h3 className="font-medium">支持证据</h3>
        {table(support, "还没有支持证据")}
        <h3 className="font-medium">反面证据</h3>
        {table(against, "还没有找到反面证据")}
        {counterSearches.length ? (
          <div className="text-sm">
            <h3 className="font-medium">反向检索记录</h3>
            <ul className="mt-1 list-disc pl-5 text-muted-foreground">
              {counterSearches.map((s) => (
                <li key={s.id}>
                  {s.candidate}：在 {s.source} 查“{s.query}”，
                  {s.resultCount ? `找到 ${s.resultCount} 条` : "已检索，未发现"}
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
        <CardTitle>定位方案（第 {positioning.version} 版）</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 text-sm">
        <p>{positioning.rationale}</p>
        <ul className="flex flex-col gap-3">
          {options.map((option, i) => (
            <li key={option.audience} className="rounded-md border p-3">
              <p className="font-medium">
                方案 {i + 1}：{option.audience}
                {i === positioning.recommendedOption ? "（推荐）" : ""}
                {i === positioning.chosenOption ? "（已选）" : ""}
              </p>
              <p>问题：{option.problem}</p>
              <p>价值主张：{option.value_prop}</p>
              <p className="text-muted-foreground">{option.why}</p>
            </li>
          ))}
        </ul>
        <div>
          <h3 className="font-medium">实验计划</h3>
          <p>假设：{experiment.hypothesis}</p>
          <p>渠道：{experiment.channel}</p>
          <p>
            判定标准：{experiment.min_visits} 次访问内至少 {experiment.pass_leads} 个有效留资；没到样本量就写“样本不足”。
          </p>
        </div>
        {responses.length ? (
          <div>
            <h3 className="font-medium">对反面证据的回应</h3>
            <ul className="mt-1 list-disc pl-5">
              {responses.map((r) => (
                <li key={r.evidenceId}>
                  “{r.excerpt}” → {RESPONSE_LABELS[r.response] ?? r.response}：{r.note}
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
        <CardTitle>英文页面和渠道（第 {page.version} 版）</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 text-sm">
        <p>
          {published ? (
            <a className="underline" href={`/launch/${page.slug}`} target="_blank" rel="noreferrer">
              公开地址：/launch/{page.slug}
            </a>
          ) : (
            <a className="underline" href={`${previewHref}?version=${page.version}`} target="_blank" rel="noreferrer">
              预览第 {page.version} 版（未公开）
            </a>
          )}
        </p>
        {!published && publishedPage ? (
          <a className="w-fit underline" href={`/launch/${publishedPage.slug}`} target="_blank" rel="noreferrer">
            查看当前公开的第 {publishedPage.version} 版
          </a>
        ) : null}
        <div>
          <h3 className="font-medium">事实声明与证据对照</h3>
          {pageClaims.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>声明</TableHead>
                  <TableHead>类型</TableHead>
                  <TableHead>证据摘录</TableHead>
                  <TableHead>来源</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageClaims.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="whitespace-normal">{c.text}</TableCell>
                    <TableCell>{CLAIM_LABELS[c.kind] ?? c.kind}</TableCell>
                    <TableCell className="whitespace-normal">{c.excerpt ?? "无"}</TableCell>
                    <TableCell>
                      <SourceLink url={c.url} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-muted-foreground">这版页面没有事实声明。</p>
          )}
        </div>
        {campaign ? (
          <div id="campaign" className="flex flex-col gap-2">
            <h3 className="font-medium">渠道任务：{campaign.channel}</h3>
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
            <p>
              状态：
              {campaign.status === "executed"
                ? `已执行（${campaign.executedAt ? formatDateTime(campaign.executedAt) : "时间未知"}）`
                : campaign.status === "approved"
                  ? "已批准，等待执行"
                  : "等待确认"}
              {campaign.executedUrl ? (
                <>
                  ，凭证：
                  <SourceLink url={campaign.executedUrl} />
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
        <CardTitle>增长数据和复盘</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 text-sm">
        {report?.feedback.length ? (
          <div>
            <h3 className="font-medium">真实回复和评论</h3>
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
              <dt className="text-muted-foreground">独立访问（按日去重）</dt>
              <dd className="text-lg font-medium">{numbers.visits}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">CTA 点击</dt>
              <dd className="text-lg font-medium">{numbers.ctaClicks}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">有效留资（不是付费）</dt>
              <dd className="text-lg font-medium">{numbers.leads}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">回复和评论</dt>
              <dd className="text-lg font-medium">{numbers.replies}</dd>
            </div>
          </dl>
        ) : null}
        {report ? (
          <div className="flex flex-col gap-2">
            <p className="font-medium">结论：{report.verdict_label}</p>
            <p>{report.summary}</p>
            <h3 className="font-medium">做过的动作</h3>
            <ul className="list-disc pl-5">
              {report.actions_taken.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <h3 className="font-medium">仍不确定的地方</h3>
            <ul className="list-disc pl-5">
              {report.uncertainties.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <h3 className="font-medium">下一步</h3>
            <ul className="list-disc pl-5">
              {report.next_steps.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            {report.next_hypothesis ? <p>下一轮假设：{report.next_hypothesis}</p> : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

export function ProjectHeader({ project }: { project: Project }) {
  return (
    <header className="flex flex-col gap-3">
      <h1 className="text-2xl font-semibold">{project.productName}</h1>
      <p className="text-sm text-muted-foreground">
        {project.stage} · {project.goal}
        {project.targetMarket ? ` · ${project.targetMarket}` : ""}
        {project.isOwnProduct ? " · 自有产品" : ""}
      </p>
      <StatusFlow status={project.status} quoteFlow={usesQuoteFlow(project)} />
    </header>
  );
}
