import { and, eq } from "drizzle-orm";
import type { Db } from "@/db";
import { evidenceSearches, projects } from "@/db/schema";
import { normalizeText } from "@/domain/evidence";
import type { SourceClient, SourceResult } from "./sources";
import { cacheDocument } from "./tools";

export type PlannedQuery = {
  source: string;
  query: string;
  purpose: "support" | "counter";
  candidate: string;
};

export type GatheredResult = SourceResult & {
  source: string;
  purpose: "support" | "counter";
  candidate: string;
};

export type GatherReport = {
  results: GatheredResult[];
  searched: number;
  skippedDuplicates: number;
  failures: { source: string; query: string; error: string }[];
  searchCalls: number;
};

export const queryKey = (source: string, query: string) => `${source}|${normalizeText(query)}`;

async function mapLimit<T, R>(items: T[], limit: number, run: (item: T) => Promise<R>) {
  const out: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next++;
      out[index] = await run(items[index]);
    }
  });
  await Promise.all(workers);
  return out;
}

// 由程序并行检索，不让模型一轮一轮地搜：同一项目里重复的检索词直接跳过，重复的网址只保留一份。
export async function gatherSources(
  db: Db,
  sources: SourceClient,
  queries: PlannedQuery[],
  options: { projectId?: string | null; concurrency?: number; maxResultsPerQuery?: number } = {},
): Promise<GatherReport> {
  const { projectId = null, concurrency = 6, maxResultsPerQuery = 6 } = options;
  const seen = new Set<string>();
  let scopeVersion = 1;
  if (projectId) {
    const [project] = await db.select({ scopeVersion: projects.scopeVersion }).from(projects).where(eq(projects.id, projectId));
    if (!project) throw new Error("项目不存在");
    scopeVersion = project.scopeVersion;
    const past = await db
      .select({ source: evidenceSearches.source, query: evidenceSearches.query })
      .from(evidenceSearches)
      .where(and(eq(evidenceSearches.projectId, projectId), eq(evidenceSearches.scopeVersion, scopeVersion)));
    for (const p of past) seen.add(queryKey(p.source, p.query));
  }
  let skippedDuplicates = 0;
  const todo = queries.filter((q) => {
    if (!sources.names.includes(q.source)) return false;
    const key = queryKey(q.source, q.query);
    if (seen.has(key)) {
      skippedDuplicates++;
      return false;
    }
    seen.add(key);
    return true;
  });

  const failures: GatherReport["failures"] = [];
  let searchCalls = 0;
  const batches = await mapLimit(todo, concurrency, async (q) => {
    try {
      const outcome = await sources.search(q.source, q.query);
      searchCalls += outcome.searchCalls;
      const results = outcome.results.slice(0, maxResultsPerQuery);
      await Promise.all(results.map((r) => cacheDocument(db, r)));
      if (projectId) {
        await db.insert(evidenceSearches).values({
          projectId,
          scopeVersion,
          candidate: q.candidate,
          purpose: q.purpose,
          source: q.source,
          query: q.query,
          resultCount: results.length,
        });
      }
      return results.map((r) => ({ ...r, source: q.source, purpose: q.purpose, candidate: q.candidate }));
    } catch (error) {
      failures.push({ source: q.source, query: q.query, error: error instanceof Error ? error.message : String(error) });
      return [];
    }
  });

  const byUrl = new Map<string, GatheredResult>();
  for (const result of batches.flat()) {
    if (!result.text.trim() || byUrl.has(result.url)) continue;
    byUrl.set(result.url, result);
  }
  return { results: [...byUrl.values()], searched: todo.length, skippedDuplicates, failures, searchCalls };
}
