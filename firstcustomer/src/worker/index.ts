import { eq, inArray } from "drizzle-orm";
import { createLiveSources } from "@/agents/sources";
import { createModelClient } from "@/ai/call-model";
import { createStubSources } from "@/ai/stub-model";
import { getDb } from "@/db";
import { agentTasks, companyReports, projects, supportMessages } from "@/db/schema";
import { AGENT_STATUSES } from "@/domain/workflow";
import { ADVANCE_QUEUE, getBoss, type AdvanceJob, type CompanyJob } from "@/jobs/queue";
import { requestCompanyReport, runCompanyReport } from "@/workflow/company-reports";
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

await boss.work<AdvanceJob | CompanyJob>(ADVANCE_QUEUE, { localConcurrency: 1 }, async ([job]) => {
  if ("projectId" in job.data) await advanceProject(deps, job.data.projectId);
  else if ("reportId" in job.data) await runCompanyReport(db, model, job.data.reportId);
  else await requestCompanyReport(db, enqueueReport, "standup");
});

console.log(`worker 已启动，模型：${process.env.LLM_PROVIDER ?? "mimo"}`);

const shutdown = async () => {
  await boss.stop({ graceful: true });
  process.exit(0);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
