import { getLocale } from "@/lib/locale-server";
import { translateUi } from "@/lib/ui-translation";
import { T, I18n } from "@/components/ui-text";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";
import { getDb } from "@/db";
import { requireAdmin } from "@/lib/auth";
import { buttonVariants, Button } from "@/components/ui/button";
import { KnowledgeEditor } from "@/components/knowledge-editor";
import { emptyKnowledge, KNOWLEDGE_AGENTS, knowledgeDate, sameKnowledge } from "@/knowledge/types";
import { findKnowledge, knowledgeVersions } from "@/knowledge/store";
import { withdrawKnowledgeAction } from "../actions";

export async function generateMetadata() {
  const locale = await getLocale();
  return { title: translateUi(locale, "编辑资料"), robots: { index: false, follow: false } };
}

export default async function KnowledgeDetailPage({ params, searchParams }: PageProps<"/admin/knowledge/[id]">) {
  await requireAdmin();
  const { id } = await params;
  const query = await searchParams;
  const isNew = id === "new";
  const article = isNew ? null : await findKnowledge(getDb(), id);
  if (!isNew && !article) notFound();
  const versions = article ? await knowledgeVersions(getDb(), article.id) : [];
  const notice = query.saved === "published" ? "已发布，相关 Agent 会读取新版本。"
    : query.saved === "draft" ? article?.published ? "草稿已保存，当前发布版保持原样。" : "草稿已保存，发布后才能供 Agent 读取。"
    : query.saved === "withdrawn" ? "已撤下，Agent 停止读取；草稿和发布历史已保留。" : "";
  return (
    <main className="admin-section max-w-4xl">
      <header className="admin-section-heading"><div><h1><T>{isNew ? "新建资料" : "编辑资料"}</T></h1><p><T>{article?.published ? `当前发布第 ${article.published.version} 版 · ${article.published.visibility === "public" ? "可公开" : "仅内部"}${sameKnowledge(article.draft, article.published) ? "" : "，有修改待发布"}` : "保存为草稿后，可在核对完成时发布。"}</T></p></div><Link href="/admin/knowledge" className={buttonVariants({ variant: "outline", className: "min-h-10" })}><ArrowLeft aria-hidden="true" /><T>返回资料库</T></Link></header>
      {notice ? <p role="status" className="rounded-lg bg-secondary p-3 text-sm text-primary"><T>{notice}</T></p> : null}
      {query.error ? <p role="alert" className="text-sm text-destructive"><T>{String(query.error)}</T></p> : null}
      <KnowledgeEditor key={`${article?.id ?? "new"}:${article?.revision ?? 1}`} id={article?.id} revision={article?.revision ?? 1} initial={article?.draft ?? emptyKnowledge()} />
      {article?.published ? <I18n><section className="grid gap-3 border-t pt-5" aria-label="当前发布版">
        <details><summary className="min-h-10 cursor-pointer text-sm font-semibold"><T>查看当前发布版</T></summary><p className="my-3 text-sm text-muted-foreground"><T>当前可读：</T><T>{article.published.agents.map((agent) => KNOWLEDGE_AGENTS[agent]).join("、")}</T><T> · 核对于 </T>{article.published.reviewedOn}</p><pre className="rounded-lg bg-card p-4 font-sans text-sm leading-relaxed break-words whitespace-pre-wrap">{article.published.content}</pre></details>
        <form action={withdrawKnowledgeAction} className="flex flex-wrap items-center gap-3">
          <input type="hidden" name="id" value={article.id} /><input type="hidden" name="revision" value={article.revision} />
          <Button className="min-h-10" type="submit" variant="outline"><T>撤下当前发布版</T></Button><p className="text-xs text-muted-foreground"><T>撤下后不再供 Agent 使用，草稿和历史仍保留。</T></p>
        </form>
      </section></I18n> : null}
      {versions.length ? <section className="grid gap-3 border-t pt-5" aria-labelledby="knowledge-history-title"><h2 id="knowledge-history-title" className="font-semibold"><T>发布历史</T></h2><div className="divide-y rounded-xl border bg-card">{versions.map((item) => <details key={item.id} className="px-4 py-3"><summary className="cursor-pointer text-sm font-medium"><T>第 </T>{item.version}<T> 版 · </T>{item.snapshot.title} · {knowledgeDate(item.createdAt)}</summary><p className="mt-3 text-xs text-muted-foreground"><T>{item.snapshot.visibility === "public" ? "可公开" : "仅内部"}</T><T> · 核对于 </T>{item.snapshot.reviewedOn}{item.snapshot.sourceNote ? ` · ${item.snapshot.sourceNote}` : ""}</p><pre className="mt-3 font-sans text-sm leading-relaxed break-words whitespace-pre-wrap">{item.snapshot.content}</pre></details>)}</div></section> : null}
    </main>
  );
}
