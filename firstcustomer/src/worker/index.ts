import { eq, inArray } from "drizzle-orm";
import { createLiveSources } from "@/agents/sources";
import { createModelClient } from "@/ai/call-model";
import { createStubSources } from "@/ai/stub-model";
import { getDb } from "@/db";
import { agentTasks, projects } from "@/db/schema";
import { AGENT_STATUSES } from "@/domain/workflow";
import { ADVANCE_QUEUE, getBoss, type AdvanceJob } from "@/jobs/queue";
import { advanceProject, type EngineDeps } from "@/workflow/engine";

const db = getDb();
const model = createModelClient();
const boss = await getBoss("worker");

const enqueue = async (projectId: string) => {
  await boss.send(ADVANCE_QUEUE, { projectId } satisfies AdvanceJob, {
    retryLimit: 0,
    expireInSeconds: 3600,
  });
};

const deps: EngineDeps = {
  db,
  model,
  sources: process.env.LLM_PROVIDER === "stub" ? createStubSources() : createLiveSources(model),
  enqueue,
};

// 只有一个 worker，所以启动时还在运行的任务都是上次中断留下的，要接着跑。
await db
  .update(agentTasks)
  .set({ status: "failed", error: "worker 重启，任务中断", finishedAt: new Date() })
  .where(eq(agentTasks.status, "running"));
const interrupted = await db
  .select({ id: projects.id })
  .from(projects)
  .where(inArray(projects.status, AGENT_STATUSES));
await Promise.all(interrupted.map((p) => enqueue(p.id)));

await boss.work<AdvanceJob>(ADVANCE_QUEUE, { localConcurrency: 1 }, async ([job]) => {
  await advanceProject(deps, job.data.projectId);
});

console.log(`worker 已启动，模型：${process.env.LLM_PROVIDER ?? "mimo"}`);

const shutdown = async () => {
  await boss.stop({ graceful: true });
  process.exit(0);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
