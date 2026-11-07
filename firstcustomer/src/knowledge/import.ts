import { z } from "zod";
import type { Db } from "@/db";
import { knowledgeArticles, knowledgeHistory } from "@/db/schema";
import { knowledgeContentSchema } from "./validation";

const importKey = z.string().regex(/^[a-z0-9][a-z0-9-]{1,79}$/);
export const knowledgeBundleSchema = z.object({
  bundleId: importKey,
  sourceFile: z.string().min(1).max(300),
  sourceSha256: z.string().regex(/^[a-f0-9]{64}$/),
  articles: z.array(z.object({ key: importKey, content: knowledgeContentSchema })).min(1).max(100),
}).superRefine((bundle, ctx) => {
  if (new Set(bundle.articles.map((article) => article.key)).size !== bundle.articles.length) {
    ctx.addIssue({ code: "custom", path: ["articles"], message: "导入包的资料 key 不能重复" });
  }
});

// One atomic import, with stable keys. Re-runs preserve edits, withdrawals and history.
export async function importKnowledgeBundle(db: Db, input: unknown, publish: boolean) {
  const bundle = knowledgeBundleSchema.parse(input);
  return db.transaction(async (tx) => {
    const added: { id: string; title: string }[] = [];
    const skipped: string[] = [];
    for (const { key, content: draft } of bundle.articles) {
      const published = publish ? { ...draft, version: 1 } : null;
      const [article] = await tx.insert(knowledgeArticles).values({
        seedKey: `import:${bundle.bundleId}:${key}`, draft, published,
        publication: publish ? 1 : 0, publishedAt: publish ? new Date() : null,
      }).onConflictDoNothing({ target: knowledgeArticles.seedKey }).returning({ id: knowledgeArticles.id });
      if (!article) { skipped.push(draft.title); continue; }
      if (published) await tx.insert(knowledgeHistory).values({ articleId: article.id, version: 1, snapshot: published });
      added.push({ id: article.id, title: draft.title });
    }
    return { bundleId: bundle.bundleId, added, skipped };
  });
}
