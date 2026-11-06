import { and, eq, gt, ilike, isNull, or } from "drizzle-orm";
import { z } from "zod";
import type { AgentTool } from "@/ai/run-agent";
import type { Db } from "@/db";
import { evidenceItems, evidenceSearches, sourceDocuments } from "@/db/schema";
import { expiresAt, gradeFor, normalizeText, verifyQuote, type EvidenceKind } from "@/domain/evidence";
import { copyLibraryEvidence } from "./library";
import type { SourceClient, SourceResult } from "./sources";

const MAX_TEXT_FOR_MODEL = 6000;

export async function cacheDocument(db: Db, doc: { url: string; title: string; text: string }) {
  await db
    .insert(sourceDocuments)
    .values({ url: doc.url, title: doc.title, text: doc.text })
    .onConflictDoUpdate({
      target: sourceDocuments.url,
      set: { title: doc.title, text: doc.text, fetchedAt: new Date() },
    });
}

function sourceName(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

// 模型只能经由这些工具接触证据库：保存时由程序核对摘录，等级也由程序决定。
export function createResearchTools(context: {
  db: Db;
  projectId: string;
  sources: SourceClient;
  onSearchCalls: (count: number) => void;
  /** 现场检索的次数上限，资料已由程序预先检索好。 */
  searchLimit?: number;
}): Record<string, AgentTool> {
  const { db, projectId, sources, searchLimit = 6 } = context;
  let searchesUsed = 0;
  const searchedKeys = new Set<string>();
  return {
    use_library_evidence: {
      description: "把输入 library 里的预存证据（已核对原文）加入本项目，返回本项目里的 evidence_id。可一次传多条。",
      parameters: z.object({ library_ids: z.array(z.string()).min(1), candidate: z.string() }),
      execute: async ({ library_ids, candidate }: { library_ids: string[]; candidate: string }) =>
        copyLibraryEvidence(db, projectId, library_ids, candidate),
    },
    lookup_evidence: {
      description: "查本地证据库里未过期的证据。",
      parameters: z.object({ query: z.string() }),
      execute: async ({ query }: { query: string }) => {
        const like = `%${query}%`;
        return db
          .select({
            id: evidenceItems.id,
            product: evidenceItems.product,
            category: evidenceItems.category,
            kind: evidenceItems.kind,
            stance: evidenceItems.stance,
            excerpt: evidenceItems.excerpt,
            grade: evidenceItems.grade,
            status: evidenceItems.status,
            url: evidenceItems.url,
          })
          .from(evidenceItems)
          .where(
            and(
              gt(evidenceItems.expiresAt, new Date()),
              or(isNull(evidenceItems.projectId), eq(evidenceItems.projectId, projectId)),
              or(
                ilike(evidenceItems.product, like),
                ilike(evidenceItems.category, like),
                ilike(evidenceItems.excerpt, like),
              ),
            ),
          )
          .limit(20);
      },
    },
    search_evidence: {
      description: `检索公开来源，只返回资料，不写入证据库。可用来源：${sources.help ?? sources.names.join("、")}。`,
      parameters: z.object({
        query: z.string(),
        source: z.string(),
        purpose: z.enum(["support", "counter"]),
        candidate: z.string(),
      }),
      execute: async (args: {
        query: string;
        source: string;
        purpose: "support" | "counter";
        candidate: string;
      }) => {
        const key = `${args.source}|${normalizeText(args.query)}`;
        if (searchedKeys.has(key)) {
          return { error: "这个检索词刚刚搜过，结果不会变。换一个检索词或来源，或直接用已有资料。" };
        }
        if (searchesUsed >= searchLimit) {
          return { error: `现场检索已用完 ${searchLimit} 次，请用已有资料完成，查不到的写进 unknowns。` };
        }
        searchesUsed++;
        searchedKeys.add(key);
        const { results, searchCalls } = await sources.search(args.source, args.query);
        context.onSearchCalls(searchCalls);
        await Promise.all(results.map((r: SourceResult) => cacheDocument(db, r)));
        await db.insert(evidenceSearches).values({
          projectId,
          candidate: args.candidate,
          purpose: args.purpose,
          source: args.source,
          query: args.query,
          resultCount: results.length,
        });
        return results.map((r: SourceResult) => ({
          url: r.url,
          title: r.title,
          published_at: r.publishedAt,
          text: r.text.slice(0, 1500),
        }));
      },
    },
    read_page: {
      description: "读取一个公开网页的正文，读取后才能从中保存证据。",
      parameters: z.object({ url: z.string() }),
      execute: async ({ url }: { url: string }) => {
        const page = await sources.readPage(url);
        await cacheDocument(db, { url, title: page.title, text: page.text });
        return { url, title: page.title, text: page.text.slice(0, MAX_TEXT_FOR_MODEL) };
      },
    },
    save_evidence: {
      description: "保存一条证据。quote 必须从已检索或已读取的来源原样复制，程序会核对。",
      parameters: z.object({
        url: z.string(),
        quote: z.string(),
        kind: z.enum(["pain", "pricing", "revenue", "signal", "channel", "product"]),
        stance: z.enum(["support", "against", "neutral"]),
        candidate: z.string(),
        product: z.string().nullable(),
        category: z.string().nullable(),
        number_value: z.string().nullable(),
        metric: z.string().nullable(),
      }),
      execute: async (args: {
        url: string;
        quote: string;
        kind: EvidenceKind;
        stance: "support" | "against" | "neutral";
        candidate: string;
        product: string | null;
        category: string | null;
        number_value: string | null;
        metric: string | null;
      }) => {
        const [doc] = await db
          .select()
          .from(sourceDocuments)
          .where(eq(sourceDocuments.url, args.url));
        if (!doc) throw new Error("这个网址还没有读取过，不能保存为证据");
        const check = verifyQuote(args.quote, doc.text);
        if (check.status === "rejected") throw new Error(check.reason);
        // 同一项目里同一网址、同一摘录只存一次。
        const sameUrl = await db
          .select({ id: evidenceItems.id, excerpt: evidenceItems.excerpt, grade: evidenceItems.grade, status: evidenceItems.status })
          .from(evidenceItems)
          .where(and(eq(evidenceItems.projectId, projectId), eq(evidenceItems.url, args.url)));
        const duplicate = sameUrl.find((e) => normalizeText(e.excerpt) === normalizeText(args.quote));
        if (duplicate) {
          return { evidence_id: duplicate.id, status: duplicate.status, grade: duplicate.grade, note: "已经保存过，直接复用" };
        }
        const collectedAt = new Date();
        const [row] = await db
          .insert(evidenceItems)
          .values({
            projectId,
            candidate: args.candidate,
            product: args.product,
            category: args.category,
            kind: args.kind,
            stance: args.stance,
            numberValue: args.number_value,
            metric: args.metric,
            url: args.url,
            sourceName: sourceName(args.url),
            excerpt: args.quote,
            grade: gradeFor(args.kind, args.url),
            status: check.status,
            matchScore: check.score,
            licenseStatus: "public_reference",
            createdBy: "agent",
            collectedAt,
            expiresAt: expiresAt(args.kind, collectedAt),
          })
          .returning({ id: evidenceItems.id, grade: evidenceItems.grade, status: evidenceItems.status });
        return { evidence_id: row.id, status: row.status, grade: row.grade, note: check.reason };
      },
    },
  };
}
