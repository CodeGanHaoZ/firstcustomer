import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import EmbeddedPostgres from "embedded-postgres";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { eq } from "drizzle-orm";
import { beforeAll, afterAll, beforeEach, describe, expect, it } from "vitest";
import { createDb, type Db } from "@/db";
import { knowledgeArticles } from "@/db/schema";
import { seedKnowledge } from "@/knowledge/seed";
import { findKnowledge, knowledgeForAgent, knowledgeVersions, listKnowledge, saveKnowledge, withdrawKnowledge } from "@/knowledge/store";
import { emptyKnowledge, type KnowledgeContent } from "@/knowledge/types";
import { knowledgeContentSchema } from "@/knowledge/validation";

let db: Db;
let pg: EmbeddedPostgres;
let close: () => Promise<unknown>;
let dir: string;

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), "hifirst-knowledge-"));
  pg = new EmbeddedPostgres({ databaseDir: dir, user: "test", password: "test", port: 54394,
    persistent: false, autoRehydrateSymlinks: true, onLog: () => {}, onError: () => {},
  });
  await pg.initialise();
  await pg.start();
  await pg.createDatabase("test");
  const created = createDb("postgres://test:test@127.0.0.1:54394/test");
  db = created.db;
  close = () => created.sql.end();
  await migrate(db, { migrationsFolder: "./drizzle" });
});

afterAll(async () => {
  await close?.();
  await pg?.stop();
  if (dir) rmSync(dir, { recursive: true, force: true });
});

beforeEach(async () => { await db.delete(knowledgeArticles); });

const content = (extra: Partial<KnowledgeContent> = {}): KnowledgeContent => ({
  ...emptyKnowledge(), title: "服务资料", content: "这里是经过经营者核对的首客服务说明。",
  reviewedOn: "2026-11-07", ...extra,
});
const publicContent = (extra: Partial<KnowledgeContent> = {}) => content({ visibility: "public", agents: ["lumi", "support"], ...extra });

describe("资料库发布与读取权限", () => {
  it("未发布草稿不进入任何 Agent 上下文，发布后仅供选定角色使用", async () => {
    let article = await saveKnowledge(db, { content: publicContent(), publish: false });
    expect(await knowledgeForAgent(db, "lumi")).toEqual([]);
    expect(await knowledgeForAgent(db, "support")).toEqual([]);
    article = await saveKnowledge(db, { id: article.id, revision: article.revision, content: article.draft, publish: true });
    expect((await knowledgeForAgent(db, "lumi"))[0]).toMatchObject({ id: article.id, version: 1 });
    expect(await knowledgeForAgent(db, "research")).toEqual([]);
  });

  it("保存新草稿不替换已发布内容", async () => {
    const article = await saveKnowledge(db, { content: publicContent(), publish: true });
    await saveKnowledge(db, { id: article.id, revision: article.revision,
      content: publicContent({ content: "尚未核对的新草稿内容，不应该提前进入公开答复。" }), publish: false,
    });
    const [reference] = await knowledgeForAgent(db, "lumi");
    expect(reference.content).toBe(article.draft.content);
    expect(reference.version).toBe(1);
    expect(await knowledgeVersions(db, article.id)).toHaveLength(1);
  });

  it("把内部资料改成公开草稿，也不会提前泄露内部发布版", async () => {
    const article = await saveKnowledge(db, { content: content({ content: "内部核对口径 INTERNAL_ONLY，不可进入首页上下文。" }), publish: true });
    await saveKnowledge(db, { id: article.id, revision: article.revision, content: publicContent(), publish: false });
    expect(await knowledgeForAgent(db, "lumi")).toEqual([]);
    expect((await knowledgeForAgent(db, "support"))[0].content).toContain("INTERNAL_ONLY");
  });

  it("即使数据库中内部快照带有 Lumi 标记，公开查询仍排除它", async () => {
    const draft = content();
    await db.insert(knowledgeArticles).values({ draft, published: { ...draft, agents: ["lumi"], version: 1 }, publication: 1 });
    expect(await knowledgeForAgent(db, "lumi")).toEqual([]);
  });

  it("公开发布版被改为内部草稿时，仍只公开旧版；内部新版发布后立即停止公开读取", async () => {
    let article = await saveKnowledge(db, { content: publicContent(), publish: true });
    article = await saveKnowledge(db, { id: article.id, revision: article.revision,
      content: content({ content: "内部新规则 PRIVATE_NEXT，保存草稿时不应出现在官网。" }), publish: false,
    });
    expect((await knowledgeForAgent(db, "lumi"))[0].content).not.toContain("PRIVATE_NEXT");
    await saveKnowledge(db, { id: article.id, revision: article.revision, content: article.draft, publish: true });
    expect(await knowledgeForAgent(db, "lumi")).toEqual([]);
    expect((await knowledgeForAgent(db, "support"))[0]).toMatchObject({ version: 2 });
  });

  it("撤下后停止读取，保留草稿和历史，再发布生成新版本", async () => {
    let article = await saveKnowledge(db, { content: publicContent(), publish: true });
    article = await withdrawKnowledge(db, article.id, article.revision);
    expect(await knowledgeForAgent(db, "lumi")).toEqual([]);
    expect(await knowledgeVersions(db, article.id)).toHaveLength(1);
    expect((await findKnowledge(db, article.id))?.draft.title).toBe("服务资料");
    await saveKnowledge(db, { id: article.id, revision: article.revision, content: article.draft, publish: true });
    expect((await knowledgeForAgent(db, "lumi"))[0].version).toBe(2);
  });

  it("过期判断以发布快照和北京时间为准，延长草稿期限不会恢复旧发布版", async () => {
    const article = await saveKnowledge(db, { content: publicContent({ expiresOn: "2026-11-07" }), publish: true });
    expect(await knowledgeForAgent(db, "lumi", "", new Date("2026-11-07T15:59:00Z"))).toHaveLength(1);
    await saveKnowledge(db, { id: article.id, revision: article.revision, content: publicContent({ expiresOn: "2026-12-01" }), publish: false });
    expect(await knowledgeForAgent(db, "lumi", "", new Date("2026-11-07T16:00:00Z"))).toEqual([]);
  });

  it("过期或并发页面不能覆盖新版本，也不能撤下别人刚发布的版本", async () => {
    const original = await saveKnowledge(db, { content: publicContent(), publish: true });
    const outcomes = await Promise.allSettled(["版本甲", "版本乙"].map((title) => saveKnowledge(db, {
      id: original.id, revision: original.revision, content: publicContent({ title }), publish: true,
    })));
    expect(outcomes.filter((item) => item.status === "fulfilled")).toHaveLength(1);
    expect(outcomes.filter((item) => item.status === "rejected")).toHaveLength(1);
    await expect(withdrawKnowledge(db, original.id, original.revision)).rejects.toThrow("资料已");
    expect(await knowledgeVersions(db, original.id)).toHaveLength(2);
  });

  it("基础资料载入可重复执行，且不会覆盖经营者修改", async () => {
    expect(await seedKnowledge(db)).toBe(14);
    const [article] = await listKnowledge(db);
    await saveKnowledge(db, { id: article.id, revision: article.revision, content: { ...article.draft, title: "经营者自己的标题" }, publish: false });
    expect(await seedKnowledge(db)).toBe(0);
    expect((await findKnowledge(db, article.id))?.draft.title).toBe("经营者自己的标题");
    expect(await listKnowledge(db)).toHaveLength(14);
    for (const item of await knowledgeForAgent(db, "lumi")) expect(item.content).not.toContain("INTERNAL_ONLY");
  });

  it("支持中英文关键词匹配，并限制上下文数量和长度", async () => {
    for (let i = 0; i < 7; i++) await saveKnowledge(db, { content: publicContent({ title: `通用规范 ${i}`, content: "这是一段通用的服务说明。".repeat(600) }), publish: true });
    const relevant = await saveKnowledge(db, { content: publicContent({ title: "退款 refund 处理流程", content: "退款和投诉需要经营者处理，请先从项目客服说明情况。" }), publish: true });
    const references = await knowledgeForAgent(db, "lumi", "怎么退款 refund？");
    expect(references[0].id).toBe(relevant.id);
    expect(references.length).toBeLessThanOrEqual(5);
    expect(references.reduce((sum, item) => sum + item.content.length, 0)).toBeLessThanOrEqual(8000);
    expect(references[0]).toMatchObject({ reviewedOn: "2026-11-07", category: "服务说明" });
  });

  it("校验可见范围、来源链接、正文和有效日期", () => {
    expect(knowledgeContentSchema.safeParse(content({ agents: ["lumi"] })).success).toBe(false);
    expect(knowledgeContentSchema.safeParse(content({ sourceUrl: "javascript:alert(1)" })).success).toBe(false);
    expect(knowledgeContentSchema.safeParse(content({ sourceUrl: "https://name:secret@example.com/" })).success).toBe(false);
    expect(knowledgeContentSchema.safeParse(content({ reviewedOn: "2026-02-30" })).success).toBe(false);
    expect(knowledgeContentSchema.safeParse(content({ expiresOn: "2026-11-01" })).success).toBe(false);
    expect(knowledgeContentSchema.safeParse(content({ content: "短" })).success).toBe(false);
    expect(knowledgeContentSchema.safeParse(publicContent()).success).toBe(true);
  });

  it("不存在的资料不会被隐式新建", async () => {
    await expect(saveKnowledge(db, { id: "00000000-0000-4000-8000-000000000001", revision: 1, content: content(), publish: true })).rejects.toThrow("资料已");
    expect(await findKnowledge(db, "not-a-uuid")).toBeNull();
    expect(await db.select().from(knowledgeArticles).where(eq(knowledgeArticles.publication, 1))).toEqual([]);
  });
});
