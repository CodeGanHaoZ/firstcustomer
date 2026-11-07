import { getDb } from "@/db";
import { requireAdmin } from "@/lib/auth";
import { markdownArchive } from "@/lib/markdown-archive";
import { listKnowledge } from "@/knowledge/store";
import { KNOWLEDGE_AGENTS, KNOWLEDGE_CATEGORIES, type KnowledgeContent } from "@/knowledge/types";

function markdown(content: KnowledgeContent) {
  return [
    `# ${content.title}`, "",
    `分类：${KNOWLEDGE_CATEGORIES[content.category]}`,
    `范围：${content.visibility === "public" ? "可公开" : "仅内部"}`,
    `使用者：${content.agents.map((agent) => KNOWLEDGE_AGENTS[agent]).join("、")}`,
    `核对日期：${content.reviewedOn}`,
    `到期日期：${content.expiresOn || "未设置"}`,
    `来源：${content.sourceUrl || "未设置"}`,
    `说明：${content.sourceNote || "未设置"}`, "", content.content, "",
  ].join("\n");
}

export async function GET() {
  await requireAdmin("knowledge.manage", "/admin/knowledge");
  const articles = await listKnowledge(getDb());
  const files = articles.flatMap((article) => [
    { name: `drafts/${article.id}.md`, body: markdown(article.draft) },
    ...(article.published ? [{ name: `published/${article.id}-v${article.published.version}.md`, body: markdown(article.published) }] : []),
  ]);
  return new Response(markdownArchive(files), { headers: {
    "content-type": "application/zip", "content-disposition": 'attachment; filename="hifirst-knowledge.zip"',
    "cache-control": "private, no-store", "x-content-type-options": "nosniff",
  } });
}
