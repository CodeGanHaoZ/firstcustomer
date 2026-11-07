import { createHash } from "node:crypto";
import { and, desc, eq, isNull, or } from "drizzle-orm";
import type { Db } from "@/db";
import { agentTasks, projects, sourceVersions } from "@/db/schema";

export const textHash = (text: string) => createHash("sha256").update(text, "utf8").digest("hex");
export type CaptureContext = { projectId?: string | null; taskId?: string; method?: string; actor?: string };

// The hash covers the exact UTF-8 extracted text, not the remote HTML or a TSA token.
export async function captureSource(db: Db, doc: { url: string; title: string; text: string }, context: CaptureContext = {}) {
  const projectId = context.projectId ?? null;
  const [project] = projectId ? await db.select().from(projects).where(eq(projects.id, projectId)) : [];
  if (projectId && !project) throw new Error("项目不存在");
  if (context.taskId) {
    const [task] = await db.select().from(agentTasks).where(eq(agentTasks.id, context.taskId));
    if (!task || task.projectId !== projectId || task.scopeVersion !== project?.scopeVersion) throw new Error("采集任务不属于当前范围");
  }
  const [version] = await db.insert(sourceVersions).values({
    projectId, scopeVersion: project?.scopeVersion ?? 1,
    url: doc.url, title: doc.title, text: doc.text, sha256: textHash(doc.text),
    method: context.method ?? "search_result", actor: context.actor ?? "system",
    taskId: context.taskId ?? null,
  }).returning();
  return version;
}

export async function readCapturedSource(db: Db, input: {
  projectId: string; scopeVersion: number; url: string; sourceVersionId?: string;
}) {
  const [source] = await db.select().from(sourceVersions).where(and(
    eq(sourceVersions.url, input.url),
    input.sourceVersionId ? eq(sourceVersions.id, input.sourceVersionId) : undefined,
    or(isNull(sourceVersions.projectId), and(eq(sourceVersions.projectId, input.projectId), eq(sourceVersions.scopeVersion, input.scopeVersion))),
  )).orderBy(desc(sourceVersions.capturedAt), desc(sourceVersions.id)).limit(1);
  return source ?? null;
}
