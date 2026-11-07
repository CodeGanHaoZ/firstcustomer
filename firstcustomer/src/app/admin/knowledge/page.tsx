import { getLocale } from "@/lib/locale-server";
import { translateUi } from "@/lib/ui-translation";
import { LocalizedInput, LocalizedTag } from "@/components/localized-controls";
import { T } from "@/components/ui-text";
import Link from "next/link";
import { ArrowRight, BookOpen, Download, Plus, Search } from "lucide-react";
import type { CSSProperties } from "react";
import { getDb } from "@/db";
import { requireAdmin } from "@/lib/auth";
import { Button, buttonVariants } from "@/components/ui/button";
import { knowledgeForAgent, listKnowledge } from "@/knowledge/store";
import { KNOWLEDGE_AGENTS, KNOWLEDGE_CATEGORIES, knowledgeDate, sameKnowledge, type KnowledgeAgent } from "@/knowledge/types";
import { initializeKnowledgeAction } from "./actions";

export async function generateMetadata() {
  const locale = await getLocale();
  return { title: translateUi(locale, "资料库"), robots: { index: false, follow: false } };
}

export default async function KnowledgePage({ searchParams }: PageProps<"/admin/knowledge">) {
  await requireAdmin();
  const params = await searchParams;
  const query = String(params.q ?? "").trim().slice(0, 200);
  const category = String(params.category ?? "");
  const state = String(params.state ?? "");
  const all = await listKnowledge(getDb());
  const today = knowledgeDate();
  const expired = (date: string) => Boolean(date && date < today);
  const rows = all.filter(({ draft, published }) => {
    if (category && draft.category !== category) return false;
    if (state === "draft" && published) return false;
    if (state === "published" && !published) return false;
    if (state === "changed" && (!published || sameKnowledge(draft, published))) return false;
    if (state === "expired" && (!published || !expired(published.expiresOn))) return false;
    return !query || `${draft.title}\n${draft.content}\n${draft.sourceNote}`.toLocaleLowerCase().includes(query.toLocaleLowerCase());
  });
  const publishedCount = all.filter((row) => row.published).length;
  const testAgent = String(params.testAgent ?? "");
  const testQuestion = String(params.testQuestion ?? "").slice(0, 600);
  const references = Object.hasOwn(KNOWLEDGE_AGENTS, testAgent)
    ? await knowledgeForAgent(getDb(), testAgent as KnowledgeAgent, testQuestion) : null;
  const filterHref = (next: { category?: string; state?: string }) => {
    const search = new URLSearchParams();
    if (query) search.set("q", query);
    const nextCategory = next.category ?? category;
    const nextState = next.state ?? state;
    if (nextCategory) search.set("category", nextCategory);
    if (nextState) search.set("state", nextState);
    const text = search.toString();
    return text ? `/admin/knowledge?${text}` : "/admin/knowledge";
  };
  const STATES = [["", "全部状态"], ["published", "已发布"], ["draft", "草稿"], ["changed", "有待发布修改"], ["expired", "已过期"]] as const;
  return (
    <main className="admin-section">
      <header className="admin-section-heading">
        <div><h1><T>资料库</T></h1><p><T>维护服务说明与工作规范，按职责供 Agent 读取已发布的内容。</T></p></div>
        <div className="flex flex-wrap gap-2">
          <Link href="/admin/knowledge?testAgent=lumi#retrieval-preview" className={buttonVariants({ variant: "outline", className: "min-h-10" })}><Search aria-hidden="true" /><T>试查资料</T></Link>
          <a href="/admin/knowledge/export" download className={buttonVariants({ variant: "outline", className: "min-h-10" })}><Download aria-hidden="true" /><T>导出资料</T></a>
          <Link href="/admin/knowledge/new" className={buttonVariants({ className: "min-h-10" })}><Plus aria-hidden="true" /><T>新建资料</T></Link>
        </div>
      </header>
      {params.error ? <p role="alert" className="notice notice--fail"><T>{String(params.error)}</T></p> : null}
      {params.initialized !== undefined ? <p role="status" className="notice notice--ok"><T>已新增 </T>{Number(params.initialized) || 0}<T> 篇基础资料，已有内容保持原样。</T></p> : null}
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
        <dl className="figures m-0 min-w-[min(100%,26rem)] flex-1">
          <div className="figure"><dd className="m-0"><b>{all.length}</b></dd><dt className="order-last"><span><T>篇资料</T></span></dt></div>
          <div className="figure"><dd className="m-0"><b>{publishedCount}</b></dd><dt className="order-last"><span><T>篇已发布</T></span></dt></div>
          <div className="figure"><dd className="m-0"><b>{all.length - publishedCount}</b></dd><dt className="order-last"><span><T>篇草稿</T></span></dt></div>
        </dl>
        <form action={initializeKnowledgeAction}><Button type="submit" variant="outline" className="min-h-10"><BookOpen aria-hidden="true" /><T>{all.length ? "补齐基础资料" : "载入首客基础资料"}</T></Button></form>
      </div>
      <form className="flex flex-wrap items-center gap-2 rounded-full border bg-background p-1.5 ps-4" role="search">
        <Search size={16} aria-hidden="true" className="text-muted-foreground" />
        <label className="sr-only" htmlFor="knowledge-search"><T>搜索资料</T></label>
        <LocalizedInput id="knowledge-search" name="q" maxLength={200} defaultValue={query} className="h-10 min-w-0 flex-1 border-0 bg-transparent px-1 focus-visible:ring-0" placeholder="搜索标题、正文或来源…" />
        {category ? <input type="hidden" name="category" value={category} /> : null}
        {state ? <input type="hidden" name="state" value={state} /> : null}
        <Button type="submit"><T>搜索</T></Button>
      </form>
      <LocalizedTag as="nav" className="grid gap-2" aria-label="筛选资料">
        <div className="flex flex-wrap gap-2">
          {[["", "全部分类"], ...Object.entries(KNOWLEDGE_CATEGORIES)].map(([value, label]) => (
            <Link key={value || "all"} href={filterHref({ category: value })} className={value === category ? "btn btn--primary btn--sm" : "btn btn--ghost btn--sm"} aria-current={value === category ? "true" : undefined}><T>{label}</T></Link>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {STATES.map(([value, label]) => (
            <Link key={value || "all"} href={filterHref({ state: value })} className={value === state ? "btn btn--primary btn--sm" : "btn btn--ghost btn--sm"} aria-current={value === state ? "true" : undefined}><T>{label}</T></Link>
          ))}
        </div>
      </LocalizedTag>
      <p className="text-sm text-muted-foreground"><T>公开资料需同时勾选 Lumi 才用于首页答复；客户资料和市场证据仍在各自项目中管理。</T></p>
      {rows.length ? <ul className="card-grid">
        {rows.map(({ id, draft, published, updatedAt }, index) => {
          const current = published ?? draft;
          const live = published && !expired(published.expiresOn);
          return (
          <li key={id} className="rise" style={{ "--i": Math.min(index, 10) } as CSSProperties}>
            <Link href={`/admin/knowledge/${id}`} className="tile h-full">
              <div className="flex flex-wrap gap-1.5">
                <span className={live ? "pill pill--ok" : published ? "pill pill--fail" : "pill"}><T>{published ? expired(published.expiresOn) ? "已过期 · 暂停读取" : `已发布 · 第 ${published.version} 版` : "草稿 · 尚未发布"}</T></span>
                {published && !sameKnowledge(draft, published) ? <span className="pill pill--wait"><T>有修改待发布</T></span> : null}
              </div>
              <h2 className="tile__title">{draft.title}</h2>
              <p className="tile__meta"><T>{KNOWLEDGE_CATEGORIES[current.category]}</T> · <T>{current.visibility === "public" ? "可公开" : "仅内部"}</T><T> · 核对于 </T>{current.reviewedOn}</p>
              <p className="tile__meta break-words"><T>{current.agents.map((agent) => KNOWLEDGE_AGENTS[agent]).join("、")}</T></p>
              <div className="tile__foot tile__meta"><span><T>更新于 </T>{knowledgeDate(updatedAt)}</span><ArrowRight size={15} className="tile__arrow" aria-hidden="true" /></div>
            </Link>
          </li>
          );
        })}
      </ul> : <div className="empty"><h2 className="paper__title"><T>{all.length ? "没有找到符合条件的资料" : "把首客的服务与工作规范放在这里"}</T></h2><p className="text-sm text-muted-foreground"><T>{all.length ? "试试其他关键词或清除筛选。" : "可以载入基础资料，也可以新建或导入自己的文字。保存草稿后，发布才会供 Agent 使用。"}</T></p>{all.length ? <Link className="btn btn--ghost btn--sm" href="/admin/knowledge"><T>清除筛选</T></Link> : null}</div>}
      <section className="scroll-mt-24" id="retrieval-preview">
        <details className="fold" open={references !== null}>
          <summary>
            <span>
              <span className="fold__title block"><T>检查 Agent 可读资料</T></span>
              <span className="fold__hint block"><T>试查某个问题会匹配哪些已发布资料，不调用模型。</T></span>
            </span>
          </summary>
          <div className="fold__body">
          <form className="grid gap-3" action="/admin/knowledge#retrieval-preview">
            <fieldset className="m-0 border-0 p-0"><legend className="mb-2 text-sm font-medium"><T>使用者</T></legend><div className="choice-group">{Object.entries(KNOWLEDGE_AGENTS).map(([value, label]) => <label key={value} className="choice"><input type="radio" name="testAgent" value={value} defaultChecked={value === (testAgent || "lumi")} /><span><T>{label}</T></span></label>)}</div></fieldset>
            <div className="grid gap-1 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end sm:gap-3"><div className="grid gap-1"><label className="text-sm font-medium" htmlFor="knowledge-test-question"><T>问题或关键词</T></label><LocalizedInput id="knowledge-test-question" name="testQuestion" defaultValue={testQuestion} maxLength={600} className="min-h-10" placeholder="例如：免费出海机会分析包含什么" /></div>
            <Button className="self-end" type="submit" variant="outline"><T>试查资料</T></Button></div>
          </form>
          {references !== null ? <div className="mt-5 grid gap-3" aria-live="polite">
            <p className="text-sm"><T>{references.length ? `匹配到 ${references.length} 篇已发布资料：` : "没有可用资料，请检查发布状态、Agent 使用范围与到期日期。"}</T></p>
            {references.map((reference) => <details key={reference.id} className="rounded-xl border bg-background px-4 py-3"><summary className="cursor-pointer text-sm font-semibold">{reference.title}<T> · 第 </T>{reference.version}<T> 版</T></summary><p className="mt-2 text-xs text-muted-foreground"><T>核对于 </T>{reference.reviewedOn} · {reference.sourceNote}</p><pre className="my-3 font-sans text-sm leading-relaxed break-words whitespace-pre-wrap">{reference.content}</pre><Link href={`/admin/knowledge/${reference.id}`} className="text-sm font-medium underline"><T>编辑这篇资料</T></Link></details>)}
          </div> : null}
          </div>
        </details>
      </section>
    </main>
  );
}
