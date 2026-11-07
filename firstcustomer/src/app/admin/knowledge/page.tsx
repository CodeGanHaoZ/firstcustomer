import Link from "next/link";
import { BookOpen, Download, Plus, Search } from "lucide-react";
import { getDb } from "@/db";
import { requireAdmin } from "@/lib/auth";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { knowledgeForAgent, listKnowledge } from "@/knowledge/store";
import { KNOWLEDGE_AGENTS, KNOWLEDGE_CATEGORIES, knowledgeDate, sameKnowledge, type KnowledgeAgent } from "@/knowledge/types";
import { initializeKnowledgeAction } from "./actions";

export const metadata = { title: "资料库", robots: { index: false, follow: false } };

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
        <div><h1>资料库</h1><p>维护服务说明与工作规范，按职责供 Agent 读取已发布的内容。</p></div>
        <div className="flex flex-wrap gap-2">
          <Link href="/admin/knowledge?testAgent=lumi#retrieval-preview" className={buttonVariants({ variant: "outline", className: "min-h-10" })}><Search aria-hidden="true" />试查资料</Link>
          <a href="/admin/knowledge/export" download className={buttonVariants({ variant: "outline", className: "min-h-10" })}><Download aria-hidden="true" />导出资料</a>
          <Link href="/admin/knowledge/new" className={buttonVariants({ className: "min-h-10" })}><Plus aria-hidden="true" />新建资料</Link>
        </div>
      </header>
      {params.error ? <p role="alert" className="text-sm text-destructive">{String(params.error)}</p> : null}
      {params.initialized !== undefined ? <p role="status" className="text-sm text-primary">已新增 {Number(params.initialized) || 0} 篇基础资料，已有内容保持原样。</p> : null}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-4 text-sm">
        <p>{all.length} 篇资料 · {publishedCount} 篇已发布 · {all.length - publishedCount} 篇草稿</p>
        <form action={initializeKnowledgeAction}><Button type="submit" variant="outline" className="min-h-10"><BookOpen aria-hidden="true" />{all.length ? "补齐基础资料" : "载入首客基础资料"}</Button></form>
      </div>
      <form className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_10rem_10rem_auto]" role="search">
        <div className="grid gap-1"><label className="text-sm font-medium" htmlFor="knowledge-search">搜索资料</label><Input id="knowledge-search" name="q" maxLength={200} defaultValue={query} className="min-h-10" placeholder="搜索标题、正文或来源…" /></div>
        <div className="grid gap-1"><label className="text-sm font-medium" htmlFor="knowledge-filter-category">分类</label><select id="knowledge-filter-category" name="category" defaultValue={category} className="min-h-10 rounded-lg border bg-card px-2 text-sm focus-visible:outline-2 focus-visible:outline-ring"><option value="">全部分类</option>{Object.entries(KNOWLEDGE_CATEGORIES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
        <div className="grid gap-1"><label className="text-sm font-medium" htmlFor="knowledge-filter-state">状态</label><select id="knowledge-filter-state" name="state" defaultValue={state} className="min-h-10 rounded-lg border bg-card px-2 text-sm focus-visible:outline-2 focus-visible:outline-ring"><option value="">全部状态</option><option value="published">已发布</option><option value="draft">草稿</option><option value="changed">有待发布修改</option><option value="expired">已过期</option></select></div>
        <Button className="min-h-10 self-end" type="submit" variant="outline"><Search aria-hidden="true" />搜索</Button>
      </form>
      <p className="text-sm text-muted-foreground">公开资料需同时勾选 Lumi 才用于首页答复；客户资料和市场证据仍在各自项目中管理。</p>
      {rows.length ? <ul className="divide-y rounded-xl border bg-card px-4">
        {rows.map(({ id, draft, published, updatedAt }) => {
          const current = published ?? draft;
          return (
          <li key={id}>
            <Link href={`/admin/knowledge/${id}`} className="grid gap-2 py-4 focus-visible:rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring sm:grid-cols-[minmax(0,1fr)_auto]">
              <div className="min-w-0">
                <h2 className="break-words text-base font-semibold hover:underline">{draft.title}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{KNOWLEDGE_CATEGORIES[current.category]} · {published ? "发布范围" : "草稿范围"}：{current.visibility === "public" ? "可公开" : "仅内部"} · 核对于 {current.reviewedOn}</p>
                <p className="mt-2 break-words text-xs text-muted-foreground">{current.agents.map((agent) => KNOWLEDGE_AGENTS[agent]).join("、")}</p>
              </div>
              <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm sm:flex-col sm:items-end">
                <span className={published && !expired(published.expiresOn) ? "font-medium text-primary" : "text-muted-foreground"}>{published ? expired(published.expiresOn) ? "已过期 · 暂停读取" : `已发布 · 第 ${published.version} 版` : "草稿 · 尚未发布"}</span>
                {published && !sameKnowledge(draft, published) ? <span className="text-amber-800">有修改待发布</span> : null}
                <span className="text-xs text-muted-foreground">更新于 {knowledgeDate(updatedAt)}</span>
              </div>
            </Link>
          </li>
          );
        })}
      </ul> : <div className="grid justify-items-start gap-3 border-y py-10"><h2 className="font-semibold">{all.length ? "没有找到符合条件的资料" : "把首客的服务与工作规范放在这里"}</h2><p className="text-sm text-muted-foreground">{all.length ? "试试其他关键词或清除筛选。" : "可以载入基础资料，也可以新建或导入自己的文字。保存草稿后，发布才会供 Agent 使用。"}</p>{all.length ? <Link className="text-sm font-medium underline" href="/admin/knowledge">清除筛选</Link> : null}</div>}
      <section className="scroll-mt-5 border-t pt-5" id="retrieval-preview">
        <details open={references !== null}>
          <summary className="min-h-10 cursor-pointer font-semibold">检查 Agent 可读资料</summary>
          <p className="my-3 text-sm text-muted-foreground">试查某个问题会匹配哪些已发布资料，不调用模型。</p>
          <form className="grid gap-3 sm:grid-cols-[14rem_minmax(0,1fr)_auto]" action="/admin/knowledge#retrieval-preview">
            <div className="grid gap-1"><label className="text-sm font-medium" htmlFor="knowledge-test-agent">使用者</label><select className="min-h-10 rounded-lg border bg-card px-2 text-sm focus-visible:outline-2 focus-visible:outline-ring" id="knowledge-test-agent" name="testAgent" defaultValue={testAgent || "lumi"}>{Object.entries(KNOWLEDGE_AGENTS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
            <div className="grid gap-1"><label className="text-sm font-medium" htmlFor="knowledge-test-question">问题或关键词</label><Input id="knowledge-test-question" name="testQuestion" defaultValue={testQuestion} maxLength={600} className="min-h-10" placeholder="例如：免费初诊包含什么" /></div>
            <Button className="min-h-10 self-end" type="submit" variant="outline">试查资料</Button>
          </form>
          {references !== null ? <div className="mt-5 grid gap-3" aria-live="polite">
            <p className="text-sm">{references.length ? `匹配到 ${references.length} 篇已发布资料：` : "没有可用资料，请检查发布状态、Agent 使用范围与到期日期。"}</p>
            {references.map((reference) => <details key={reference.id} className="border-b pb-3"><summary className="cursor-pointer text-sm font-semibold">{reference.title} · 第 {reference.version} 版</summary><p className="mt-2 text-xs text-muted-foreground">核对于 {reference.reviewedOn} · {reference.sourceNote}</p><pre className="my-3 font-sans text-sm leading-relaxed break-words whitespace-pre-wrap">{reference.content}</pre><Link href={`/admin/knowledge/${reference.id}`} className="text-sm font-medium underline">编辑这篇资料</Link></details>)}
          </div> : null}
        </details>
      </section>
    </main>
  );
}
