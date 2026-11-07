import { and, asc, eq } from "drizzle-orm";
import type { Db } from "@/db";
import { agentTasks, clarifications, projectRequirements, projects, stateTransitions } from "@/db/schema";
import { MAX_FREE_SCOPE_VERSIONS, requirementFields, requirementSnapshot, type RequirementFields } from "@/domain/requirements";

type Project = typeof projects.$inferSelect;
export const canReviseRequirements = (project: Pick<Project, "productPlan" | "status" | "paused" | "scopeVersion">) =>
  project.productPlan === "free" && !project.paused && project.scopeVersion < MAX_FREE_SCOPE_VERSIONS
    && ["submitted", "needs_info", "free_ready", "failed"].includes(project.status);

export async function recordRequirementVersion(db: Db, project: Project, actor: string, reason: string) {
  const answers = await db.select({ question: clarifications.question, answer: clarifications.answer, batch: clarifications.batch })
    .from(clarifications).where(and(eq(clarifications.projectId, project.id), eq(clarifications.scopeVersion, project.scopeVersion)))
    .orderBy(asc(clarifications.createdAt));
  await db.insert(projectRequirements).values({ projectId: project.id, version: project.requirementVersion,
    scopeVersion: project.scopeVersion, snapshot: requirementSnapshot(project, answers), actor, reason, confirmedAt: new Date() });
}

export async function requirementHistory(db: Db, projectId: string) {
  return db.select().from(projectRequirements).where(eq(projectRequirements.projectId, projectId)).orderBy(asc(projectRequirements.version));
}

export async function reviseRequirements(db: Db, enqueue: (id: string, tx?: Db) => Promise<void>, input: {
  projectId: string; version: number; fields: RequirementFields;
}) {
  const fields = requirementFields.parse(input.fields);
  return db.transaction(async (tx) => {
    const [previous] = await tx.select().from(projects).where(eq(projects.id, input.projectId)).for("update");
    if (!previous || previous.requirementVersion !== input.version) throw new Error("需求版本已更新，请刷新后再修改");
    if (!canReviseRequirements(previous)) throw new Error("当前范围已进入执行、已暂停或已达到初诊修订上限，请联系经营者处理范围变更");
    const running = await tx.select({ id: agentTasks.id }).from(agentTasks)
      .where(and(eq(agentTasks.projectId, previous.id), eq(agentTasks.status, "running"))).limit(1);
    if (running.length) throw new Error("项目仍有任务运行，请等待结束后修改需求");
    if (JSON.stringify(requirementSnapshot(previous)) === JSON.stringify(requirementSnapshot({ ...previous, ...fields }))) return previous;
    const [saved] = await tx.update(projects).set({ ...fields, productUrl: fields.productUrl || null,
      requirementVersion: previous.requirementVersion + 1, scopeVersion: previous.scopeVersion + 1,
      clarificationRounds: 0, clarificationsClosed: false, status: "researching", failedFrom: null, failedReason: null,
      pendingRequest: null, escalation: null, updatedAt: new Date(),
    }).where(eq(projects.id, previous.id)).returning();
    await recordRequirementVersion(tx, saved, "customer", "客户确认修订需求，重新初诊");
    await tx.insert(stateTransitions).values({ projectId: saved.id, fromStatus: previous.status, toStatus: "researching",
      actor: "customer", reason: `客户确认需求第 ${saved.requirementVersion} 版，范围第 ${saved.scopeVersion} 版；旧范围资料保留为历史` });
    await enqueue(saved.id, tx);
    return saved;
  });
}
