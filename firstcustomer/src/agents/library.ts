import { and, eq, gt, inArray, isNull } from "drizzle-orm";
import type { Db } from "@/db";
import { evidenceItems, projects } from "@/db/schema";
import { normalizeText } from "@/domain/evidence";

type LibraryQuery = { source: string; query: string; purpose: "support" | "counter" };

export type LibraryCategory = {
  id: string;
  label: string;
  queries: LibraryQuery[];
  pricingUrls: string[];
};

const q = (source: string, query: string, purpose: "support" | "counter" = "support"): LibraryQuery => ({
  source,
  query,
  purpose,
});

// 中国开发者常见的出海品类。预抓的证据 project_id 为空、category 为品类 id，
// Research 选中后才复制进项目，Strategy 和 Launch 只看项目里的证据。
export const LIBRARY_CATEGORIES: LibraryCategory[] = [
  {
    id: "ai_meeting_notes",
    label: "AI 会议记录 / 转写",
    queries: [
      q("hn", "AI meeting notes"),
      q("hn", "meeting bot privacy", "counter"),
      q("hn", "otter fireflies alternative"),
      q("appstore_reviews", "Otter transcribe", "counter"),
      q("appstore_reviews", "Fireflies meeting notes", "counter"),
      q("github_issues", "meeting transcription local whisper"),
      q("devto", "productivity"),
    ],
    pricingUrls: ["https://otter.ai/pricing", "https://fireflies.ai/pricing", "https://www.granola.ai/pricing"],
  },
  {
    id: "note_taking",
    label: "笔记 / 知识管理",
    queries: [
      q("hn", "note taking app"),
      q("hn", "notion slow alternative", "counter"),
      q("hn", "obsidian sync pricing"),
      q("appstore_reviews", "Notion", "counter"),
      q("appstore_reviews", "Evernote", "counter"),
      q("stackexchange", "markdown notes sync"),
    ],
    pricingUrls: ["https://obsidian.md/pricing", "https://evernote.com/compare-plans"],
  },
  {
    id: "task_productivity",
    label: "任务管理 / 效率工具",
    queries: [
      q("hn", "todo app"),
      q("hn", "task manager subscription", "counter"),
      q("appstore_reviews", "Todoist", "counter"),
      q("appstore_reviews", "Things 3", "counter"),
      q("devto", "productivity"),
    ],
    pricingUrls: ["https://todoist.com/pricing", "https://www.any.do/pricing"],
  },
  {
    id: "ai_writing",
    label: "AI 写作 / 改写",
    queries: [
      q("hn", "AI writing assistant"),
      q("hn", "grammarly alternative", "counter"),
      q("appstore_reviews", "Grammarly keyboard", "counter"),
      q("appstore_reviews", "AI writer", "counter"),
      q("devto", "ai"),
    ],
    pricingUrls: ["https://www.grammarly.com/plans", "https://quillbot.com/upgrade"],
  },
  {
    id: "screen_recording",
    label: "录屏 / 截图",
    queries: [
      q("hn", "screen recording app mac"),
      q("hn", "loom pricing", "counter"),
      q("appstore_reviews", "screen recorder", "counter"),
      q("github_issues", "screen recorder feature request"),
    ],
    pricingUrls: ["https://www.loom.com/pricing", "https://cleanshot.com/pricing"],
  },
  {
    id: "ai_image_video",
    label: "AI 图片 / 视频生成与编辑",
    queries: [
      q("hn", "AI image generator"),
      q("hn", "AI video editor"),
      q("hn", "AI headshot", "counter"),
      q("appstore_reviews", "AI photo editor", "counter"),
      q("appstore_reviews", "CapCut", "counter"),
    ],
    pricingUrls: ["https://www.canva.com/pricing/", "https://www.descript.com/pricing"],
  },
  {
    id: "developer_tools",
    label: "开发者工具 / API",
    queries: [
      q("hn", "developer tool pricing"),
      q("hn", "Show HN developer tool"),
      q("hn", "SaaS pricing too expensive", "counter"),
      q("github_issues", "pricing self-hosted alternative"),
      q("stackexchange", "api rate limit pricing"),
      q("devto", "webdev"),
    ],
    pricingUrls: ["https://www.raycast.com/pricing", "https://vercel.com/pricing"],
  },
  {
    id: "language_learning",
    label: "语言学习",
    queries: [
      q("hn", "language learning app"),
      q("hn", "duolingo", "counter"),
      q("appstore_reviews", "Duolingo", "counter"),
      q("appstore_reviews", "language learning AI tutor", "counter"),
    ],
    pricingUrls: ["https://www.duolingo.com/super"],
  },
];

export const LIBRARY_CATEGORY_IDS = LIBRARY_CATEGORIES.map((c) => c.id);

export async function libraryEvidence(db: Db, categoryIds: string[]) {
  if (!categoryIds.length) return [];
  return db
    .select()
    .from(evidenceItems)
    .where(
      and(
        isNull(evidenceItems.projectId),
        inArray(evidenceItems.category, categoryIds),
        gt(evidenceItems.expiresAt, new Date()),
      ),
    );
}

// 把选中的预存证据复制进项目；项目里已有同一网址、同一摘录的就直接复用。
export async function copyLibraryEvidence(db: Db, projectId: string, ids: string[], candidate: string) {
  if (!ids.length) return [];
  const [project] = await db.select().from(projects).where(eq(projects.id, projectId));
  if (!project) throw new Error("项目不存在");
  const rows = await db
    .select()
    .from(evidenceItems)
    .where(and(isNull(evidenceItems.projectId), inArray(evidenceItems.id, ids)));
  const existing = await db
    .select({ id: evidenceItems.id, url: evidenceItems.url, excerpt: evidenceItems.excerpt })
    .from(evidenceItems)
    .where(and(eq(evidenceItems.projectId, projectId), eq(evidenceItems.scopeVersion, project.scopeVersion)));
  const key = (url: string, excerpt: string) => `${url}|${normalizeText(excerpt)}`;
  const known = new Map(existing.map((e) => [key(e.url, e.excerpt), e.id]));
  const out: { library_id: string; evidence_id: string }[] = [];
  for (const row of rows) {
    const k = key(row.url, row.excerpt);
    let evidenceId = known.get(k);
    if (!evidenceId) {
      const [copy] = await db
        .insert(evidenceItems)
        .values({
          projectId,
          scopeVersion: project.scopeVersion,
          candidate,
          product: row.product,
          category: row.category,
          kind: row.kind,
          stance: row.stance,
          numberValue: row.numberValue,
          metric: row.metric,
          url: row.url,
          sourceName: row.sourceName,
          excerpt: row.excerpt,
          grade: row.grade,
          status: row.status,
          matchScore: row.matchScore,
          licenseStatus: row.licenseStatus,
          createdBy: `library:${row.createdBy}`,
          collectedAt: row.collectedAt,
          expiresAt: row.expiresAt,
        })
        .returning({ id: evidenceItems.id });
      evidenceId = copy.id;
      known.set(k, evidenceId);
    }
    out.push({ library_id: row.id, evidence_id: evidenceId });
  }
  return out;
}
