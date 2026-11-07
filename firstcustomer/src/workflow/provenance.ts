import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "@/db";
import { agentTasks, conclusionEvidence, conclusionReviews, evidenceConclusions, evidenceItems, projects, sourceVersions } from "@/db/schema";
import { SUPPORT_RULE_VERSION } from "@/domain/provenance";
import { textHash } from "./source-versions";

type Project = typeof projects.$inferSelect;
type Ref = { id: string; role: "support" | "against" | "context" };

// Called in the same transaction as the artifact. The links describe provenance,
// not an automatic semantic endorsement; every conclusion starts unassessed.
export async function recordConclusion(db: Db, input: {
  project: Pick<Project, "id" | "scopeVersion" | "requirementVersion">;
  subjectType: "research" | "positioning" | "claim" | "growth";
  subjectId: string; key: string; statement: string; rationale: string;
  taskId?: string; actor?: string; evidence: Ref[]; basis?: Record<string, unknown>;
}) {
  return db.transaction(async (tx) => {
    const refs = [...new Map(input.evidence.map((ref) => [ref.id, ref])).values()];
    if (refs.length) {
      const rows = await tx.select().from(evidenceItems).where(inArray(evidenceItems.id, refs.map((ref) => ref.id)));
      if (rows.length !== refs.length || rows.some((row) => row.projectId !== input.project.id || row.scopeVersion !== input.project.scopeVersion)) {
        throw new Error("结论引用缺失、跨项目或旧范围的证据");
      }
    }
    if (input.taskId) {
      const [task] = await tx.select().from(agentTasks).where(eq(agentTasks.id, input.taskId));
      if (!task || task.projectId !== input.project.id || task.scopeVersion !== input.project.scopeVersion) throw new Error("结论处理任务不属于当前范围");
    }
    const [row] = await tx.insert(evidenceConclusions).values({
      projectId: input.project.id, scopeVersion: input.project.scopeVersion, requirementVersion: input.project.requirementVersion,
      subjectType: input.subjectType, subjectId: input.subjectId, key: input.key,
      statement: input.statement, rationale: input.rationale,
      taskId: input.taskId ?? null, actor: input.actor ?? "agent", basis: input.basis ?? null,
    }).returning();
    if (refs.length) await tx.insert(conclusionEvidence).values(refs.map((ref) => ({ conclusionId: row.id, evidenceId: ref.id, role: ref.role })));
    return row;
  });
}

// Internal DAL: projectId must come from an authenticated owner or findCustomerProject.
// Every linked row is checked again; a malformed foreign link never exposes its text.
export async function loadProjectProvenance(db: Db, projectId: string, now = new Date()) {
  const [project] = await db.select().from(projects).where(eq(projects.id, projectId));
  if (!project) return { evidence: [], conclusions: [] };
  const [items, conclusions, tasks] = await Promise.all([
    db.select({ evidence: evidenceItems, source: sourceVersions }).from(evidenceItems)
      .leftJoin(sourceVersions, eq(evidenceItems.sourceVersionId, sourceVersions.id)).where(eq(evidenceItems.projectId, projectId)),
    db.select().from(evidenceConclusions).where(eq(evidenceConclusions.projectId, projectId)).orderBy(desc(evidenceConclusions.createdAt)),
    db.select({ id: agentTasks.id, agent: agentTasks.agent, provider: agentTasks.provider, model: agentTasks.model,
      promptHash: agentTasks.promptHash, scopeVersion: agentTasks.scopeVersion, status: agentTasks.status,
      startedAt: agentTasks.startedAt, finishedAt: agentTasks.finishedAt }).from(agentTasks).where(eq(agentTasks.projectId, projectId)),
  ]);
  const taskMap = new Map(tasks.map((task) => [task.id, task]));
  const evidence = items.map(({ evidence: item, source: raw }) => {
    const source = raw && (raw.projectId === null || (raw.projectId === projectId && raw.scopeVersion === item.scopeVersion)) ? raw : null;
    const task = item.createdTaskId ? taskMap.get(item.createdTaskId) ?? null : null;
    const issues: string[] = [];
    if (!source) issues.push("缺少可访问的来源版本");
    else if (source.url !== item.url || source.sha256 !== textHash(source.text)) issues.push("来源版本或摘要不一致");
    if (item.createdTaskId && (!task || task.scopeVersion !== item.scopeVersion)) issues.push("缺少本范围的处理任务");
    if (item.createdBy === "agent" && !task) issues.push("缺少 AI 提取任务记录");
    return { ...item, source, task, issues, complete: issues.length === 0,
      expired: item.expiresAt <= now };
  });
  const byId = new Map(evidence.map((item) => [item.id, item]));
  const ids = conclusions.map((row) => row.id);
  const [links, reviews] = ids.length ? await Promise.all([
    db.select().from(conclusionEvidence).where(inArray(conclusionEvidence.conclusionId, ids)),
    db.select().from(conclusionReviews).where(inArray(conclusionReviews.conclusionId, ids)).orderBy(desc(conclusionReviews.createdAt), desc(conclusionReviews.id)),
  ]) : [[], []];
  const traced = conclusions.map((row) => {
    const refs = links.filter((link) => link.conclusionId === row.id).sort((a, b) => a.evidenceId.localeCompare(b.evidenceId));
    const linked = refs.map((ref) => ({ role: ref.role, item: byId.get(ref.evidenceId) })).filter(
      (ref) => ref.item?.scopeVersion === row.scopeVersion,
    );
    const task = row.taskId ? taskMap.get(row.taskId) ?? null : null;
    const issues = linked.flatMap(({ item }) => item?.issues ?? []);
    if (linked.length !== refs.length) issues.push("引用链存在缺失或越权证据");
    if (!refs.length && !(row.subjectType === "growth" && row.basis?.metrics && row.basis?.experiment)) issues.push("结论缺少依据记录");
    if (row.actor === "agent" && (!task || task.scopeVersion !== row.scopeVersion || !task.promptHash)) issues.push("缺少完整 AI 处理记录");
    const unusable = linked.some(({ item }) => !item || item.expired || item.status !== "verified");
    const historical = row.scopeVersion !== project.scopeVersion;
    const basisHash = textHash(JSON.stringify({ row, refs: linked.map(({ item, role }) => ({
      id: item?.id, role, source: item?.sourceVersionId, hash: item?.source?.sha256,
      status: item?.status, expiresAt: item?.expiresAt, expired: item?.expired, license: item?.licenseStatus,
    })), issues, historical, task: task ? { id: task.id, status: task.status, promptHash: task.promptHash } : null }));
    const history = reviews.filter((review) => review.conclusionId === row.id);
    const review = history[0] ?? null;
    const support = !review ? "not_assessed" : review.basisHash !== basisHash || issues.length || unusable || historical ? "needs_review" : review.level;
    return { ...row, task, links: linked, issues: [...new Set(issues)], complete: issues.length === 0,
      historical, basisHash, support, review, history, usable: !issues.length && !unusable && !historical };
  });
  return { evidence, conclusions: traced };
}

const reviewInput = z.object({
  projectId: z.uuid(), conclusionId: z.uuid(), basisHash: z.string().regex(/^[a-f0-9]{64}$/),
  level: z.enum(["supported", "limited", "insufficient"]), reason: z.string().trim().min(12).max(3000),
  reviewer: z.string().trim().min(1).max(120),
});

export async function reviewConclusion(db: Db, raw: z.input<typeof reviewInput>) {
  const input = reviewInput.parse(raw);
  return db.transaction(async (tx) => {
    await tx.select().from(projects).where(eq(projects.id, input.projectId)).for("update");
    const [conclusion] = await tx.select().from(evidenceConclusions).where(and(eq(evidenceConclusions.id, input.conclusionId), eq(evidenceConclusions.projectId, input.projectId))).for("update");
    if (!conclusion) throw new Error("结论不存在或无权评价");
    const refs = await tx.select().from(conclusionEvidence).where(eq(conclusionEvidence.conclusionId, conclusion.id));
    if (refs.length) await tx.select().from(evidenceItems).where(inArray(evidenceItems.id, refs.map((ref) => ref.evidenceId))).orderBy(asc(evidenceItems.id)).for("share");
    const view = await loadProjectProvenance(tx, input.projectId);
    const current = view.conclusions.find((row) => row.id === input.conclusionId)!;
    if (current.historical || current.basisHash !== input.basisHash) throw new Error("依据或范围已变化，请刷新后重新评价");
    if (input.level === "supported" && !current.usable) throw new Error("来源链不完整、摘录未匹配或证据过期，不能评价为较充分");
    const [review] = await tx.insert(conclusionReviews).values({
      conclusionId: current.id, level: input.level, reason: input.reason, reviewer: input.reviewer,
      basisHash: current.basisHash, ruleVersion: SUPPORT_RULE_VERSION,
    }).returning();
    return review;
  });
}

export async function evidenceTraceProblems(db: Db, projectId: string, ids: string[]) {
  const [project] = await db.select().from(projects).where(eq(projects.id, projectId));
  const view = await loadProjectProvenance(db, projectId);
  return [...new Set(ids)].flatMap((id) => {
    const item = view.evidence.find((row) => row.id === id && row.scopeVersion === project?.scopeVersion);
    return !item ? ["引用缺失、跨项目或旧范围证据"] : !item.complete ? item.issues : [];
  });
}

export type ProjectProvenance = Awaited<ReturnType<typeof loadProjectProvenance>>;
