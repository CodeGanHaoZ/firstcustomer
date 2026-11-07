// 预抓取品类证据库：npm run library:build [-- 品类id ...] [--force]
// 程序并行检索公开来源，MiMo 挑出原文摘录，程序逐条核对后存进证据库（project_id 为空）。
import { and, eq, gt, isNull } from "drizzle-orm";
import { gatherSources, type GatheredResult } from "../src/agents/gather";
import { LIBRARY_CATEGORIES, type LibraryCategory } from "../src/agents/library";
import { LIBRARY_EXTRACT_PROMPT } from "../src/agents/prompts";
import { libraryExtract } from "../src/agents/schemas";
import { createLiveSources } from "../src/agents/sources";
import { cacheDocument } from "../src/agents/tools";
import { createModelClient } from "../src/ai/call-model";
import { runAgent } from "../src/ai/run-agent";
import { closeDb, getDb } from "../src/db";
import { evidenceItems } from "../src/db/schema";
import { expiresAt, gradeFor, normalizeText, vendorCopyProblem, verifyQuote } from "../src/domain/evidence";

const args = process.argv.slice(2);
const force = args.includes("--force");
const wanted = args.filter((a) => !a.startsWith("--"));
const categories = wanted.length
  ? LIBRARY_CATEGORIES.filter((c) => wanted.includes(c.id))
  : LIBRARY_CATEGORIES;

const db = getDb();
const model = createModelClient();
const sources = createLiveSources(model);
const MAX_DOC_CHARS_FOR_MODEL = 1500;

async function readPricing(category: LibraryCategory): Promise<GatheredResult[]> {
  const pages = await Promise.all(
    category.pricingUrls.map(async (url) => {
      try {
        const page = await sources.readPage(url);
        if (page.text.length < 200) return null;
        const captured = await cacheDocument(db, { url, title: page.title, text: page.text }, { method: "read_page", actor: "library" });
        return { url, title: page.title, text: page.text, sourceVersionId: captured.id, source: "pricing_page", purpose: "support" as const, candidate: category.id };
      } catch {
        return null;
      }
    }),
  );
  return pages.filter((p) => p !== null);
}

async function buildCategory(category: LibraryCategory) {
  const started = Date.now();
  const fresh = await db
    .select({ id: evidenceItems.id, url: evidenceItems.url, excerpt: evidenceItems.excerpt })
    .from(evidenceItems)
    .where(and(isNull(evidenceItems.projectId), eq(evidenceItems.category, category.id), gt(evidenceItems.expiresAt, new Date())));
  if (fresh.length && !force) return `${category.id}：已有 ${fresh.length} 条未过期证据，跳过（加 --force 重抓）`;

  const gathered = await gatherSources(
    db,
    sources,
    category.queries.map((q) => ({ ...q, candidate: category.id })),
    { maxResultsPerQuery: 6 },
  );
  const docs = [...gathered.results, ...(await readPricing(category))];
  const byUrl = new Map(docs.map((d) => [d.url, d]));

  const { output, summary } = await runAgent({
    agent: "library",
    system: LIBRARY_EXTRACT_PROMPT,
    thinking: false,
    input: {
      category: category.label,
      documents: [...byUrl.values()].map((d) => ({
        url: d.url,
        title: d.title,
        source: d.source,
        purpose: d.purpose,
        text: d.text.slice(0, MAX_DOC_CHARS_FOR_MODEL),
      })),
    },
    schema: libraryExtract,
    model,
  });

  const known = new Set(fresh.map((e) => `${e.url}|${normalizeText(e.excerpt)}`));
  let saved = 0;
  let review = 0;
  let rejected = 0;
  for (const item of output.items) {
    const doc = byUrl.get(item.url);
    const check = doc ? verifyQuote(item.quote, doc.text.slice(0, MAX_DOC_CHARS_FOR_MODEL)) : null;
    const key = `${item.url}|${normalizeText(item.quote)}`;
    if (!doc || !check || check.status === "rejected" || known.has(key) || vendorCopyProblem(item.kind, item.url, item.quote)) {
      rejected++;
      continue;
    }
    known.add(key);
    const collectedAt = new Date();
    await db.insert(evidenceItems).values({
      projectId: null,
      sourceVersionId: doc.sourceVersionId,
      category: category.id,
      product: item.product,
      kind: item.kind,
      stance: item.stance,
      numberValue: item.number_value,
      metric: item.metric,
      url: item.url,
      sourceName: new URL(item.url).hostname.replace(/^www\./, ""),
      excerpt: item.quote,
      grade: gradeFor(item.kind, item.url),
      status: check.status,
      matchScore: check.score,
      licenseStatus: "public_reference",
      createdBy: "library",
      collectedAt,
      expiresAt: expiresAt(item.kind, collectedAt),
    });
    if (check.status === "verified") saved++;
    else review++;
  }
  const seconds = Math.round((Date.now() - started) / 1000);
  const bySource = [...new Set(docs.map((d) => d.source))].join("、");
  return `${category.id}：检索 ${gathered.searched} 次、资料 ${byUrl.size} 份（${bySource}），入库 ${saved} 条已核对 + ${review} 条待复核，丢弃 ${rejected} 条；${summary.usage.inputTokens}/${summary.usage.outputTokens} tokens，¥${summary.listCostYuan.toFixed(3)}，${seconds} 秒${gathered.failures.length ? `；失败 ${gathered.failures.map((f) => `${f.source}:${f.query}`).join("，")}` : ""}`;
}

// 两个品类同时跑，避免同时打太多公开接口。
const queue = [...categories];
await Promise.all(
  Array.from({ length: 2 }, async () => {
    while (queue.length) {
      const category = queue.shift() as LibraryCategory;
      try {
        console.log(await buildCategory(category));
      } catch (error) {
        console.log(`${category.id}：失败 ${error instanceof Error ? error.message : error}`);
      }
    }
  }),
);
await closeDb();
