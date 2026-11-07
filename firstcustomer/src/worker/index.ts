import { eq, inArray } from "drizzle-orm";
import { getDb } from "@/db";
import { agentTasks, companyReports, projects, supportMessages } from "@/db/schema";
import { AGENT_STATUSES } from "@/domain/workflow";
import { createJobProcessor } from "@/jobs/process-job";
import { ADVANCE_QUEUE, getBoss, type AdvanceJob, type CompanyJob, type WorkJob } from "@/jobs/queue";

const db = getDb();
const boss = await getBoss("worker");

const enqueue = async (projectId: string) => {
  await boss.send(ADVANCE_QUEUE, { projectId } satisfies AdvanceJob, {
    retryLimit: 0,
    expireInSeconds: 3600,
  });
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
const unanswered = await db.selectDistinct({ id: supportMessages.projectId }).from(supportMessages)
  .where(eq(supportMessages.status, "queued"));
await Promise.all([...new Set([...interrupted, ...unanswered].map((p) => p.id))].map(enqueue));

const enqueueReport = async (reportId: string) => {
  await boss.send(ADVANCE_QUEUE, { reportId } satisfies CompanyJob, { retryLimit: 0, expireInSeconds: 3600 });
};
const pendingReports = await db.update(companyReports).set({ status: "queued" })
  .where(inArray(companyReports.status, ["queued", "running"])).returning({ id: companyReports.id });
await Promise.all(pendingReports.map(({ id }) => enqueueReport(id)));
await boss.schedule(ADVANCE_QUEUE, "0 9 * * *", { dailyStandup: true } satisfies CompanyJob, { tz: "Asia/Shanghai" });

const processJob = createJobProcessor(db, enqueue, enqueueReport);
await boss.work<WorkJob>(ADVANCE_QUEUE, { localConcurrency: 1 }, async ([job]) => processJob(job.data));

console.log(`worker 已启动，模型：${process.env.LLM_PROVIDER ?? "mimo"}`);

const shutdown = async () => {
  await boss.stop({ graceful: true });
  process.exit(0);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
