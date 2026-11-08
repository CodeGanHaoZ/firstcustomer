import { T } from "@/components/ui-text";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CONCLUSION_LABELS, QUOTE_STATUS_LABELS, SUPPORT_LABELS, SUPPORT_RULE_DESCRIPTION } from "@/domain/provenance";
import { formatDateTime } from "@/lib/format";
import { safeHref } from "@/lib/request";
import type { ProjectProvenance } from "@/workflow/provenance";

export function ConclusionStatus({ provenance, subjectId, recordKey }: {
  provenance: ProjectProvenance; subjectId?: string | null; recordKey: string;
}) {
  const conclusion = provenance.conclusions.find((row) => row.subjectId === subjectId && row.key === recordKey);
  return <div className="flex flex-wrap items-center gap-2 text-xs">
    <span className="pill pill--line"><T>结论支持程度</T>：<T>{SUPPORT_LABELS[conclusion?.support ?? "not_assessed"]}</T></span>
    {conclusion ? <a className="underline" href={`#conclusion-${conclusion.id}`}><T>查看溯源与评价理由</T></a>
      : <span className="text-muted-foreground"><T>历史结果缺少完整溯源记录</T></span>}
  </div>;
}

export function ProvenanceSection({ provenance, reviewAction }: {
  provenance: ProjectProvenance; reviewAction?: (formData: FormData) => Promise<void>;
}) {
  return <Card id="provenance">
    <CardHeader><CardTitle><T>来源链与结论评价</T></CardTitle></CardHeader>
    <CardContent className="grid gap-5 text-sm">
      <p className="text-muted-foreground"><T>摘录已匹配只表示文字能在保存的来源中找到。结论支持程度由人工另行评价，不代表成功概率。</T></p>
      {!provenance.conclusions.length && <p><T>尚无结论溯源记录；历史结果不会自动补造成已验证。</T></p>}
      {provenance.conclusions.map((row) => <details className="fold scroll-mt-24" id={`conclusion-${row.id}`} key={row.id}>
        <summary className="p-3"><span className="font-medium"><T>{CONCLUSION_LABELS[row.subjectType]}</T> · {row.statement.slice(0, 100)}</span>
          <span className="ms-2 pill pill--line"><T>{SUPPORT_LABELS[row.support]}</T></span>
          {row.historical && <span className="ms-2 pill"><T>历史范围</T></span>}
        </summary>
        <div className="grid gap-3 border-t p-4">
          <p className="whitespace-pre-wrap">{row.statement}</p>
          <p><b><T>判断理由</T>：</b>{row.rationale}</p>
          <p><T>需求版本</T> {row.requirementVersion} · <T>范围版本</T> {row.scopeVersion} · {formatDateTime(row.createdAt)}</p>
          <p><T>来源链检查</T>：<T>{row.complete ? "链路完整（不代表内容属实）" : "溯源不完整"}</T></p>
          {row.issues.length > 0 && <ul className="list-disc ps-5">{row.issues.map((issue) => <li key={issue}><T>{issue}</T></li>)}</ul>}
          <p><T>处理记录</T>：{row.task ? `${row.task.agent} · ${row.task.provider ?? "unknown"} / ${row.task.model ?? "unknown"} · ${formatDateTime(row.task.startedAt)}` : row.actor}</p>
          {row.task && <details><summary><T>任务与提示模板版本</T></summary><p className="break-all font-mono text-xs">{row.task.id}<br />SHA-256: {row.task.promptHash ?? "—"}</p></details>}
          <ul className="grid gap-2">{row.links.map(({ item, role }) => item && <li key={item.id} className="rounded-lg border p-3">
            <span className="pill"><T>{role === "support" ? "引用依据（待评价）" : role === "against" ? "反面证据" : "推理上下文（不自动视为支持）"}</T></span>
            <p className="my-2">{item.excerpt}</p>
            <p><T>{QUOTE_STATUS_LABELS[item.status] ?? "摘录待核对"}</T> · <T>{item.expired ? "已过期" : "有效期内"}</T></p>
            <a href={`#source-evidence-${item.id}`} className="underline"><T>查看来源版本与采集记录</T></a>
          </li>)}</ul>
          {row.basis && <details><summary><T>本次计算使用的数据快照</T></summary>
            <pre className="max-h-80 overflow-auto whitespace-pre-wrap break-all rounded-lg border p-3 text-xs">{JSON.stringify(row.basis, null, 2)}</pre>
          </details>}
          <p><b><T>结论支持程度</T>：</b><T>{SUPPORT_LABELS[row.support]}</T></p>
          {row.support === "needs_review" && <p className="notice notice--wait"><T>依据已变化或失效，旧评价不能继续作为当前结论的支持程度。</T></p>}
          {!row.review && <p><T>尚未进行结论支持程度评价，摘录匹配和来源分类不会自动提升等级。</T></p>}
          {row.history.length > 0 && <details><summary><T>评价理由与历史</T> · {row.history.length}</summary>
            <ol className="grid gap-3 pt-2">{row.history.map((review) => <li key={review.id} className="rounded-lg border p-3">
              <p><T>{SUPPORT_LABELS[review.level]}</T> · {review.reviewer} · {formatDateTime(review.createdAt)}</p>
              <p className="whitespace-pre-wrap">{review.reason}</p><p className="text-xs text-muted-foreground">{review.ruleVersion}</p>
            </li>)}</ol>
          </details>}
          {reviewAction && !row.historical && <form action={reviewAction} className="grid gap-3 rounded-xl bg-muted p-4">
            <input type="hidden" name="conclusionId" value={row.id} />
            <input type="hidden" name="basisHash" value={row.basisHash} />
            <p className="text-xs text-muted-foreground"><T>{SUPPORT_RULE_DESCRIPTION}</T></p>
            <label className="grid gap-1"><T>结论支持程度（人工评价）</T>
              <select name="level" required defaultValue="" className="rounded-lg border bg-background p-2">
                <option value="" disabled><T>请选择评价</T></option>
                <option value="insufficient"><T>不足</T></option><option value="limited"><T>有限</T></option>
                <option value="supported" disabled={!row.usable}><T>较充分</T></option>
              </select>
            </label>
            <label className="grid gap-1"><T>评价理由、适用条件与主要限制</T>
              <textarea name="reason" required minLength={12} maxLength={3000} rows={4} className="rounded-lg border bg-background p-2" />
            </label>
            <Button type="submit" className="w-fit"><T>保存人工评价记录</T></Button>
          </form>}
        </div>
      </details>)}
      <h3 className="font-medium"><T>保存的来源版本</T></h3>
      {(() => {
        const SOURCE_VISIBLE = 5;
        const evidence = provenance.evidence;
        const visible = evidence.slice(0, SOURCE_VISIBLE);
        const hidden = evidence.slice(SOURCE_VISIBLE);
        const renderFold = (item: typeof evidence[number]) => <details key={item.id} id={`source-evidence-${item.id}`} className="fold scroll-mt-24">
          <summary className="p-3"><T>{QUOTE_STATUS_LABELS[item.status] ?? "摘录待核对"}</T> · {item.sourceName} · {item.excerpt.slice(0, 60)}</summary>
          <div className="grid gap-3 border-t p-4">
            <blockquote className="border-s-2 ps-3">{item.excerpt}</blockquote>
            <p><T>证据录入者</T>：{item.createdBy} · {formatDateTime(item.createdAt)}</p>
            {item.originEvidenceId && <p className="break-all text-xs"><T>预存证据来源记录</T>：{item.originEvidenceId}</p>}
            {item.task && <p><T>AI 提取或选用任务</T>：{item.task.agent} · {item.task.model ?? "—"} · {formatDateTime(item.task.startedAt)}</p>}
            {item.source ? <>
              <p>{item.source.title}</p>
              {safeHref(item.source.url) && <a className="break-all underline" target="_blank" rel="noreferrer noopener" href={safeHref(item.source.url)!}><T>打开当前原网页（可能已更新）</T></a>}
              <p><T>快照保存时间</T>：{formatDateTime(item.source.capturedAt)} · {item.source.method} · {item.source.actor}</p>
              <p className="break-all text-xs"><T>来源版本</T>：{item.source.id}<br />SHA-256（UTF-8）：{item.source.sha256}</p>
              <p className="text-xs text-muted-foreground"><T>保存的是本次取得的正文或检索片段；本地摘要不是可信时间戳，也不证明内容属实。</T></p>
              <details><summary><T>展开采集时保存的原文</T></summary>
                <pre className="max-h-96 overflow-auto whitespace-pre-wrap break-words rounded-lg border p-3 font-sans text-sm">{item.source.text}</pre>
              </details>
            </> : <p><T>历史材料没有可检查的来源版本，请重新采集；不使用当前网页冒充旧原文。</T></p>}
            {item.issues.map((issue) => <p key={issue} className="text-amber-800"><T>{issue}</T></p>)}
            <p className="text-muted-foreground"><T>人工原文复核：尚未记录；结论评价与原文复核分别处理。</T></p>
          </div>
        </details>;
        return <div className="grid gap-3">
          <div className="grid gap-3">{visible.map(renderFold)}</div>
          {hidden.length ? <details className="fold evidence-fold bg-background">
            <summary>
              <span className="evidence-fold__btn"><span className="evidence-fold__count">{hidden.length}</span><T>展开其余来源版本</T></span>
            </summary>
            <div className="grid gap-3 fold__body mt-4">{hidden.map(renderFold)}</div>
          </details> : null}
        </div>;
      })()}
    </CardContent>
  </Card>;
}
