import { sql } from "drizzle-orm";
import { fromDrizzle, PgBoss } from "pg-boss";
import type { Db } from "@/db";

export const ADVANCE_QUEUE = "advance-project";

export type AdvanceJob = { projectId: string };
export type CompanyJob = { reportId: string } | { dailyStandup: true };

let starting: Promise<PgBoss> | undefined;

// Web 进程只负责发任务，worker 进程才负责维护和执行。
export function getBoss(role: "web" | "worker" = "web") {
  starting ??= (async () => {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("缺少 DATABASE_URL");
    const boss = new PgBoss(
      role === "web"
        ? { connectionString: url, schedule: false, supervise: false }
        : { connectionString: url },
    );
    boss.on("error", (error) => console.error("pg-boss 错误", error));
    await boss.start();
    await boss.createQueue(ADVANCE_QUEUE);
    return boss;
  })();
  return starting;
}

export async function enqueueAdvance(projectId: string, transaction?: Db) {
  const boss = await getBoss();
  const job = await boss.send(ADVANCE_QUEUE, { projectId } satisfies AdvanceJob, {
    retryLimit: 0,
    expireInSeconds: 3600,
    ...(transaction ? { db: fromDrizzle(transaction, sql) } : {}),
  });
  if (transaction && !job) throw new Error("任务未能进入队列，请重试");
}

export async function enqueueCompanyReport(reportId: string) {
  const boss = await getBoss();
  await boss.send(ADVANCE_QUEUE, { reportId } satisfies CompanyJob, { retryLimit: 0, expireInSeconds: 3600 });
}
