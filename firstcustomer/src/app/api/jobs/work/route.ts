import { handleCallback } from "@vercel/queue";
import { and, eq, lte } from "drizzle-orm";
import type { JobWithMetadata } from "pg-boss";
import { z } from "zod";
import { getDb } from "@/db";
import { agentTasks, companyReports, projects } from "@/db/schema";
import { AGENT_STATUSES, type ProjectStatus } from "@/domain/workflow";
import { createJobProcessor } from "@/jobs/process-job";
import { ADVANCE_QUEUE, enqueueAdvance, enqueueCompanyReport, getBoss, type WorkJob } from "@/jobs/queue";
import { ConflictError, transition } from "@/workflow/transitions";

export const maxDuration = 300;
const wake = z.object({ id: z.uuid() });
const interrupted = "后台任务中断，请重试";

async function recoverInterrupted(job: JobWithMetadata<WorkJob>, exhausted = false) {
  const db = getDb();
  if ("projectId" in job.data) {
    const projectId = job.data.projectId;
    const cutoff = exhausted ? job.completedOn ?? job.startedOn : job.startedOn;
    await db.update(agentTasks).set({ status: "failed", error: interrupted, finishedAt: new Date() })
      .where(and(eq(agentTasks.projectId, projectId), eq(agentTasks.status, "running"), lte(agentTasks.startedAt, cutoff)));
    if (!exhausted) return;

    const [project] = await db.select().from(projects)
      .where(and(eq(projects.id, projectId), lte(projects.updatedAt, job.startedOn)));
    if (project && AGENT_STATUSES.includes(project.status as ProjectStatus)) {
      await transition(db, project, "failed", "system", interrupted, {
        failedFrom: project.status, failedReason: interrupted,
      }).catch((error: unknown) => { if (!(error instanceof ConflictError)) throw error; });
    }
  } else if ("reportId" in job.data) {
    await db.update(companyReports).set(exhausted
      ? { status: "failed", error: interrupted, finishedAt: new Date() }
      : { status: "queued", error: null, finishedAt: null })
      .where(and(eq(companyReports.id, job.data.reportId), eq(companyReports.status, "running")));
  }
}

export const POST = handleCallback(async (message) => {
  const parsed = wake.safeParse(message);
  if (!parsed.success) return;

  const boss = await getBoss();
  await boss.supervise(ADVANCE_QUEUE, { reindex: false });
  const [requested] = await boss.findJobs<WorkJob>(ADVANCE_QUEUE, { id: parsed.data.id });
  if (!requested || requested.state === "completed" || requested.state === "cancelled") return;
  if (requested.state === "failed") {
    await recoverInterrupted(requested, true);
    return;
  }

  const [job] = await boss.fetch<WorkJob>(ADVANCE_QUEUE, { includeMetadata: true, groupConcurrency: 1 });
  if (!job) throw new Error("后台任务仍在等待执行");

  try {
    if (job.retryCount > 0) await recoverInterrupted(job);
    const processJob = createJobProcessor(getDb(), enqueueAdvance, enqueueCompanyReport);
    await processJob(job.data);
    await boss.complete(ADVANCE_QUEUE, job);
  } catch (error) {
    await boss.fail(ADVANCE_QUEUE, job, { message: error instanceof Error ? error.message : "后台任务失败" });
    throw error;
  }

  if (job.id !== requested.id) throw new Error("已完成前一项任务，当前任务等待执行");
}, { visibilityTimeoutSeconds: 320, retry: () => ({ afterSeconds: 20 }) });
