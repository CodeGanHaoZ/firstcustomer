import { send } from "@vercel/queue";
import { sql } from "drizzle-orm";
import { after } from "next/server";
import { fromDrizzle, PgBoss } from "pg-boss";
import type { Db } from "@/db";

export const ADVANCE_QUEUE = "advance-project";
export const JOB_WAKE_TOPIC = "hifirst-work";

export type AdvanceJob = { projectId: string };
export type CompanyJob = { reportId: string } | { dailyStandup: true };
export type WorkJob = AdvanceJob | CompanyJob;

const processCache = globalThis as typeof globalThis & { hifirstBoss?: Promise<PgBoss> };
const hosted = process.env.VERCEL === "1" && process.env.VERCEL_ENV !== "development";

// Web 进程只负责发任务，worker 进程才负责维护和执行。
export function getBoss(role: "web" | "worker" = "web") {
  processCache.hifirstBoss ??= (async () => {
    const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
    if (!url) throw new Error("缺少 DATABASE_URL");
    const boss = new PgBoss(
      role === "web"
        ? { connectionString: url, schedule: false, supervise: false, max: 2 }
        : { connectionString: url },
    );
    boss.on("error", (error) => console.error("pg-boss 错误", error));
    await boss.start();
    await boss.createQueue(ADVANCE_QUEUE);
    return boss;
  })().catch((error) => {
    processCache.hifirstBoss = undefined;
    throw error;
  });
  return processCache.hifirstBoss;
}

export async function publishJobWake(id: string, recoveryDate?: string) {
  await send(JOB_WAKE_TOPIC, { id }, { idempotencyKey: recoveryDate ? `${id}:${recoveryDate}` : id });
}

async function enqueue(data: WorkJob, transaction?: Db) {
  const boss = await getBoss();
  const id = await boss.send(ADVANCE_QUEUE, data, {
    retryLimit: hosted ? 1 : 0,
    expireInSeconds: hosted ? 310 : 3600,
    ...(hosted ? { group: { id: "hifirst" } } : {}),
    ...(transaction ? { db: fromDrizzle(transaction, sql) } : {}),
  });
  if (!id) throw new Error("任务未能进入队列，请重试");
  // The PostgreSQL job is authoritative. Wake the function after any enclosing transaction commits.
  if (hosted) after(() => publishJobWake(id));
}

export async function enqueueAdvance(projectId: string, transaction?: Db) {
  await enqueue({ projectId }, transaction);
}

export async function enqueueCompanyReport(reportId: string) {
  await enqueue({ reportId });
}
