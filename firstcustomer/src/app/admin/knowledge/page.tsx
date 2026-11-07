import { getLocale } from "@/lib/locale-server";
import { translateUi } from "@/lib/ui-translation";
import { LocalizedInput } from "@/components/localized-controls";
import { T } from "@/components/ui-text";
import Link from "next/link";
import { BookOpen, Download, Plus, Search } from "lucide-react";
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
  return (
    <main className="admin-section max-w-5xl">
      <header className="admin-section-heading">
        <div><h1><T>资料库</T></h1><p><T>维护服务说明与工作规范，按职责供 Agent 读取已发布的内容。</T></p></div>
        <div className="flex flex-wrap gap-2">
          <Link href="/admin/knowledge?testAgent=lumi#retrieval-preview" className={buttonVariants({ variant: "outline", className: "min-h-10" })}><Search aria-hidden="true" /><T>试查资料</T></Link>
          <a href="/admin/knowledge/export" download className={buttonVariants({ variant: "outline", className: "min-h-10" })}><Download aria-hidden="true" /><T>导出资料</T></a>
          <Link href="/admin/knowledge/new" className={buttonVariants({ className: "min-h-10" })}><Plus aria-hidden="true" /><T>新建资料</T></Link>
        </div>
      </header>
      {params.error ? <p role="alert" className="text-sm text-destructive"><T>{String(params.error)}</T></p> : null}
      {params.initialized !== undefined ? <p role="status" className="text-sm text-primary"><T>已新增 </T>{Number(params.initialized) || 0}<T> 篇基础资料，已有内容保持原样。</T></p> : null}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-4 text-sm">
        <p>{all.length}<T> 篇资料 · </T>{publishedCount}<T> 篇已发布 · </T>{all.length - publishedCount}<T> 篇草稿</T></p>
        <form action={initializeKnowledgeAction}><Button type="submit" variant="outline" className="min-h-10"><BookOpen aria-hidden="true" /><T>{all.length ? "补齐基础资料" : "载入首客基础资料"}</T></Button></form>
      </div>
      <form className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_10rem_10rem_auto]" role="search">
        <div className="grid gap-1"><label className="text-sm font-medium" htmlFor="knowledge-search"><T>搜索资料</T></label><LocalizedInput id="knowledge-search" name="q" maxLength={200} defaultValue={query} className="min-h-10" placeholder="搜索标题、正文或来源…" /></div>
        <div className="grid gap-1"><label className="text-sm font-medium" htmlFor="knowledge-filter-category"><T>分类</T></label><select id="knowledge-filter-category" name="category" defaultValue={category} className="min-h-10 rounded-lg border bg-card px-2 text-sm focus-visible:outline-2 focus-visible:outline-ring"><option value=""><T>全部分类</T></option>{Object.entries(KNOWLEDGE_CATEGORIES).map(([value, label]) => <option key={value} value={value}><T>{label}</T></option>)}</select></div>
        <div className="grid gap-1"><label className="text-sm font-medium" htmlFor="knowledge-filter-state"><T>状态</T></label><select id="knowledge-filter-state" name="state" defaultValue={state} className="min-h-10 rounded-lg border bg-card px-2 text-sm focus-visible:outline-2 focus-visible:outline-ring"><option value=""><T>全部状态</T></option><option value="published"><T>已发布</T></option><option value="draft"><T>草稿</T></option><option value="changed"><T>有待发布修改</T></option><option value="expired"><T>已过期</T></option></select></div>
        <Button className="min-h-10 self-end" type="submit" variant="outline"><Search aria-hidden="true" /><T>搜索</T></Button>
      </form>
      <p className="text-sm text-muted-foreground"><T>公开资料需同时勾选 Lumi 才用于首页答复；客户资料和市场证据仍在各自项目中管理。</T></p>
      {rows.length ? <ul className="divide-y rounded-xl border bg-card px-4">
        {rows.map(({ id, draft, published, updatedAt }) => {
          const current = published ?? draft;
          return (
          <li key={id}>
            <Link href={`/admin/knowledge/${id}`} className="grid gap-2 py-4 focus-visible:rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring sm:grid-cols-[minmax(0,1fr)_auto]">
              <div className="min-w-0">
                <h2 className="break-words text-base font-semibold hover:underline">{draft.title}</h2>
                <p className="mt-1 text-sm text-muted-foreground"><T>{KNOWLEDGE_CATEGORIES[current.category]}</T> · <T>{published ? "发布范围" : "草稿范围"}</T>：<T>{current.visibility === "public" ? "可公开" : "仅内部"}</T><T> · 核对于 </T>{current.reviewedOn}</p>
                <p className="mt-2 break-words text-xs text-muted-foreground"><T>{current.agents.map((agent) => KNOWLEDGE_AGENTS[agent]).join("、")}</T></p>
              </div>
              <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm sm:flex-col sm:items-end">
                <span className={published && !expired(published.expiresOn) ? "font-medium text-primary" : "text-muted-foreground"}><T>{published ? expired(published.expiresOn) ? "已过期 · 暂停读取" : `已发布 · 第 ${published.version} 版` : "草稿 · 尚未发布"}</T></span>
                {published && !sameKnowledge(draft, published) ? <span className="text-amber-800"><T>有修改待发布</T></span> : null}
                <span className="text-xs text-muted-foreground"><T>更新于 </T>{knowledgeDate(updatedAt)}</span>
              </div>
            </Link>
          </li>
          );
        })}
      </ul> : <div className="grid justify-items-start gap-3 border-y py-10"><h2 className="font-semibold"><T>{all.length ? "没有找到符合条件的资料" : "把首客的服务与工作规范放在这里"}</T></h2><p className="text-sm text-muted-foreground"><T>{all.length ? "试试其他关键词或清除筛选。" : "可以载入基础资料，也可以新建或导入自己的文字。保存草稿后，发布才会供 Agent 使用。"}</T></p>{all.length ? <Link className="text-sm font-medium underline" href="/admin/knowledge"><T>清除筛选</T></Link> : null}</div>}
      <section className="scroll-mt-5 border-t pt-5" id="retrieval-preview">
        <details open={references !== null}>
          <summary className="min-h-10 cursor-pointer font-semibold"><T>检查 Agent 可读资料</T></summary>
          <p className="my-3 text-sm text-muted-foreground"><T>试查某个问题会匹配哪些已发布资料，不调用模型。</T></p>
          <form className="grid gap-3 sm:grid-cols-[14rem_minmax(0,1fr)_auto]" action="/admin/knowledge#retrieval-preview">
            <div className="grid gap-1"><label className="text-sm font-medium" htmlFor="knowledge-test-agent"><T>使用者</T></label><select className="min-h-10 rounded-lg border bg-card px-2 text-sm focus-visible:outline-2 focus-visible:outline-ring" id="knowledge-test-agent" name="testAgent" defaultValue={testAgent || "lumi"}>{Object.entries(KNOWLEDGE_AGENTS).map(([value, label]) => <option key={value} value={value}><T>{label}</T></option>)}</select></div>
            <div className="grid gap-1"><label className="text-sm font-medium" htmlFor="knowledge-test-question"><T>问题或关键词</T></label><LocalizedInput id="knowledge-test-question" name="testQuestion" defaultValue={testQuestion} maxLength={600} className="min-h-10" placeholder="例如：免费出海机会分析包含什么" /></div>
            <Button className="min-h-10 self-end" type="submit" variant="outline"><T>试查资料</T></Button>
          </form>
          {references !== null ? <div className="mt-5 grid gap-3" aria-live="polite">
            <p className="text-sm"><T>{references.length ? `匹配到 ${references.length} 篇已发布资料：` : "没有可用资料，请检查发布状态、Agent 使用范围与到期日期。"}</T></p>
            {references.map((reference) => <details key={reference.id} className="border-b pb-3"><summary className="cursor-pointer text-sm font-semibold">{reference.title}<T> · 第 </T>{reference.version}<T> 版</T></summary><p className="mt-2 text-xs text-muted-foreground"><T>核对于 </T>{reference.reviewedOn} · {reference.sourceNote}</p><pre className="my-3 font-sans text-sm leading-relaxed break-words whitespace-pre-wrap">{reference.content}</pre><Link href={`/admin/knowledge/${reference.id}`} className="text-sm font-medium underline"><T>编辑这篇资料</T></Link></details>)}
          </div> : null}
        </details>
      </section>
    </main>
  );
}
