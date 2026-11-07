import type { Db } from "@/db";
import { knowledgeArticles, knowledgeHistory } from "@/db/schema";
import { INITIAL_KNOWLEDGE } from "./defaults";
import { knowledgeDate } from "./types";
import { knowledgeContentSchema } from "./validation";

export async function seedKnowledge(db: Db) {
  return db.transaction(async (tx) => {
    let added = 0;
    for (const { key, ...initial } of INITIAL_KNOWLEDGE) {
      const draft = knowledgeContentSchema.parse({
        ...initial, sourceUrl: "https://github.com/kongleiwork-art/firstcustomer",
        sourceNote: "根据当前首客服务流程、项目规则与代码整理的基础资料。", reviewedOn: knowledgeDate(), expiresOn: "",
      });
      const published = { ...draft, version: 1 };
      const [article] = await tx.insert(knowledgeArticles).values({
        seedKey: key, draft, published, publication: 1, publishedAt: new Date(),
      }).onConflictDoNothing({ target: knowledgeArticles.seedKey }).returning({ id: knowledgeArticles.id });
      if (article) {
        await tx.insert(knowledgeHistory).values({ articleId: article.id, version: 1, snapshot: published });
        added++;
      }
    }
    return added;
  });
}
