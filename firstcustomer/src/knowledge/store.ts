import { and, desc, eq, isNotNull, sql } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "@/db";
import { knowledgeArticles, knowledgeHistory } from "@/db/schema";
import { KNOWLEDGE_AGENTS, KNOWLEDGE_CATEGORIES, knowledgeDate, type KnowledgeAgent, type KnowledgeContent, type KnowledgeReference } from "./types";
import { knowledgeContentSchema } from "./validation";

export type KnowledgeArticle = typeof knowledgeArticles.$inferSelect;

export async function listKnowledge(db: Db) {
  return db.select().from(knowledgeArticles).orderBy(desc(knowledgeArticles.updatedAt));
}

export async function findKnowledge(db: Db, id: string) {
  if (!z.uuid().safeParse(id).success) return null;
  const [article] = await db.select().from(knowledgeArticles).where(eq(knowledgeArticles.id, id));
  return article ?? null;
}

export async function knowledgeVersions(db: Db, id: string) {
  return db.select().from(knowledgeHistory).where(eq(knowledgeHistory.articleId, id)).orderBy(desc(knowledgeHistory.version));
}

export async function saveKnowledge(db: Db, input: {
  id?: string; revision?: number; content: KnowledgeContent; publish: boolean;
}) {
  const draft = knowledgeContentSchema.parse(input.content);
  if (input.id) z.uuid().parse(input.id);
  return db.transaction(async (tx) => {
    const [previous] = input.id ? await tx.select().from(knowledgeArticles)
      .where(eq(knowledgeArticles.id, input.id)).for("update") : [];
    if (input.id && (!previous || previous.revision !== input.revision)) {
      throw new Error("资料已被其他页面修改，请重新打开最新版本后再保存");
    }
    const version = (previous?.publication ?? 0) + 1;
    const published = input.publish ? { ...draft, version } : previous?.published ?? null;
    const now = new Date();
    const values = {
      draft, published, revision: (previous?.revision ?? 0) + 1,
      publication: input.publish ? version : previous?.publication ?? 0,
      publishedAt: input.publish ? now : previous?.publishedAt ?? null,
      updatedAt: now,
    };
    const [saved] = previous
      ? await tx.update(knowledgeArticles).set(values).where(eq(knowledgeArticles.id, previous.id)).returning()
      : await tx.insert(knowledgeArticles).values(values).returning();
    if (input.publish && published) {
      await tx.insert(knowledgeHistory).values({ articleId: saved.id, version, snapshot: published });
    }
    return saved;
  });
}

export async function withdrawKnowledge(db: Db, id: string, revision: number) {
  z.uuid().parse(id);
  const [saved] = await db.update(knowledgeArticles).set({
    published: null, publishedAt: null, revision: sql`${knowledgeArticles.revision} + 1`, updatedAt: new Date(),
  }).where(and(eq(knowledgeArticles.id, id), eq(knowledgeArticles.revision, revision))).returning();
  if (!saved) throw new Error("资料已被修改，请重新打开最新版本后再撤下");
  return saved;
}

function termsFor(query: string) {
  const text = query.toLocaleLowerCase().slice(0, 1000);
  const words: string[] = text.match(/[a-z0-9][a-z0-9_-]+/g) ?? [];
  for (const part of text.match(/\p{Script=Han}+/gu) ?? []) {
    for (let i = 0; i < part.length - 1; i++) words.push(part.slice(i, i + 2));
  }
  return [...new Set(words)].slice(0, 100);
}

export async function knowledgeForAgent(db: Db, agent: KnowledgeAgent, query = "", now = new Date()): Promise<KnowledgeReference[]> {
  if (!Object.hasOwn(KNOWLEDGE_AGENTS, agent)) throw new Error("未知的资料使用角色");
  // Filter the published snapshot, never the editable draft, for access control.
  const rows = await db.select({ id: knowledgeArticles.id, published: knowledgeArticles.published })
    .from(knowledgeArticles).where(and(
      isNotNull(knowledgeArticles.published),
      sql`${knowledgeArticles.published}->'agents' @> ${JSON.stringify([agent])}::jsonb`,
      agent === "lumi" ? sql`${knowledgeArticles.published}->>'visibility' = 'public'` : undefined,
    ));
  const today = knowledgeDate(now);
  const terms = termsFor(query);
  const preferred = {
    lumi: ["faq", "service"], quote: ["service", "operations", "faq"], support: ["faq", "service", "operations"],
    research: ["research", "strategy", "service"], strategy: ["strategy", "research", "growth", "brand"],
    launch: ["launch", "brand", "research"], growth: ["growth", "strategy", "launch"],
    standup: ["operations", "growth"], weekly: ["growth", "operations"],
  } satisfies Record<KnowledgeAgent, string[]>;
  const candidates = rows.flatMap(({ id, published }) => {
    if (!published || (published.expiresOn && published.expiresOn < today)) return [];
    const title = published.title.toLocaleLowerCase();
    const text = published.content.toLocaleLowerCase();
    const categoryIndex = preferred[agent].indexOf(published.category);
    const score = terms.reduce((sum, word) => sum + (title.includes(word) ? 5 : 0) + (text.includes(word) ? 1 : 0), 0)
      + (categoryIndex < 0 ? 0 : (preferred[agent].length - categoryIndex) / 10);
    return [{ id, published, score }];
  }).sort((a, b) => b.score - a.score || b.published.reviewedOn.localeCompare(a.published.reviewedOn) || a.id.localeCompare(b.id));

  let remaining = 8000;
  return candidates.slice(0, 5).map(({ id, published }) => {
    const paragraphs = published.content.split(/\n\s*\n/);
    const ranked = paragraphs.map((text, index) => ({ text, index,
      score: terms.reduce((sum, term) => sum + (text.toLocaleLowerCase().includes(term) ? 1 : 0), 0),
    })).sort((a, b) => b.score - a.score || a.index - b.index);
    const content = ranked.slice(0, 5).sort((a, b) => a.index - b.index).map(({ text }) => text).join("\n\n")
      .slice(0, Math.min(2400, remaining));
    remaining -= content.length;
    return {
      id, version: published.version, title: published.title, category: KNOWLEDGE_CATEGORIES[published.category], content,
      sourceUrl: published.sourceUrl, sourceNote: published.sourceNote, reviewedOn: published.reviewedOn,
    };
  }).filter((item) => item.content);
}
