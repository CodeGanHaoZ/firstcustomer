import { and, eq } from "drizzle-orm";
import type { Db } from "@/db";
import { projects, stateTransitions } from "@/db/schema";
import { canTransition, type ProjectStatus } from "@/domain/workflow";

export class ConflictError extends Error {}

export async function transition(
  db: Db,
  project: { id: string; status: string },
  to: ProjectStatus,
  actor: string,
  reason: string | null,
  patch: Partial<typeof projects.$inferInsert> = {},
) {
  const from = project.status as ProjectStatus;
  if (!canTransition(from, to)) throw new Error(`不允许从 ${from} 流转到 ${to}`);
  await db.transaction(async (tx) => {
    const rows = await tx
      .update(projects)
      .set({ ...patch, status: to, updatedAt: new Date() })
      .where(and(eq(projects.id, project.id), eq(projects.status, from)))
      .returning({ id: projects.id });
    if (!rows.length) throw new ConflictError(`项目状态已不是 ${from}`);
    await tx.insert(stateTransitions).values({
      projectId: project.id,
      fromStatus: from,
      toStatus: to,
      actor,
      reason,
    });
  });
}
