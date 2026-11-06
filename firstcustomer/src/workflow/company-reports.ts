import { and, desc, eq, gt, inArray, isNull, sql } from "drizzle-orm";
import { STANDUP_PROMPT, WEEKLY_PROMPT } from "@/agents/prompts";
import { standupOutput, weeklyOutput } from "@/agents/schemas";
import { AgentRunError, runAgent } from "@/ai/run-agent";
import type { ModelClient } from "@/ai/types";
import type { Db } from "@/db";
import { agentTasks, companyReports, decisions, projects } from "@/db/schema";
import { STATUS_LABELS, type ProjectStatus } from "@/domain/workflow";
import { operatingMetrics } from "./operating-metrics";

export type ReportKind = "weekly" | "standup";
const chinaDate = (date: Date) => new Date(date.getTime() + 8 * 3_600_000).toISOString().slice(0, 10);

export async function requestCompanyReport(
  db: Db, enqueue: (id: string) => Promise<void>, kind: ReportKind,
) {
  const report = await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(23110801)`);
    const dedupeKey = kind === "standup" ? `standup:${chinaDate(new Date())}` : null;
    const [current] = await tx.select().from(companyReports)
      .where(dedupeKey
        ? eq(companyReports.dedupeKey, dedupeKey)
        : and(eq(companyReports.kind, kind), inArray(companyReports.status, ["queued", "running"])))
      .limit(1);
    if (current) {
      if (current.status === "failed") {
        const [updated] = await tx.update(companyReports)
          .set({ status: "queued", error: null, finishedAt: null })
          .where(eq(companyReports.id, current.id)).returning();
        return updated;
      }
      return current;
    }
    const [created] = await tx.insert(companyReports).values({ kind, dedupeKey }).returning();
    return created;
  });
  if (report.status === "queued") await enqueue(report.id);
  return report.id;
}

export async function runCompanyReport(db: Db, model: ModelClient, id: string) {
  const [report] = await db.update(companyReports).set({ status: "running" })
    .where(and(eq(companyReports.id, id), eq(companyReports.status, "queued"))).returning();
  if (!report) return;
  try {
    const isStandup = report.kind === "standup";
    const input = isStandup ? await standupInput(db) : await operatingMetrics(db);
    const modelInput = isStandup ? input : { ...input, data_scope: "截至生成时的累计经营数据" };
    const options = { tier: "flash" as const, thinking: false, input: modelInput, model };
    const result = isStandup
      ? await runAgent({ ...options, agent: "standup", system: STANDUP_PROMPT, schema: standupOutput })
      : await runAgent({ ...options, agent: "weekly", system: WEEKLY_PROMPT, schema: weeklyOutput });
    await db.update(companyReports).set({
      status: "succeeded", input, output: result.output, provider: result.summary.provider,
      model: result.summary.model, listCostYuan: result.summary.listCostYuan, finishedAt: new Date(),
    }).where(eq(companyReports.id, id));
  } catch (error) {
    const summary = error instanceof AgentRunError ? error.summary : null;
    await db.update(companyReports).set({
      status: "failed", error: error instanceof Error ? error.message : "生成失败",
      provider: summary?.provider ?? null, model: summary?.model ?? null,
      listCostYuan: summary?.listCostYuan ?? 0, finishedAt: new Date(),
    }).where(eq(companyReports.id, id));
  }
}

async function standupInput(db: Db) {
  const today = new Date(`${chinaDate(new Date())}T00:00:00+08:00`);
  const yesterday = new Date(today.getTime() - 86_400_000);
  const [recent, current] = await Promise.all([
    db.select({
      agent: agentTasks.agent, status: agentTasks.status, started: agentTasks.startedAt,
      finished: agentTasks.finishedAt, product: projects.productName, reason: agentTasks.sendBackReason,
    }).from(agentTasks).innerJoin(projects, eq(projects.id, agentTasks.projectId))
      .where(gt(agentTasks.startedAt, yesterday)).orderBy(desc(agentTasks.startedAt)).limit(40),
    db.select({ product: projects.productName, status: projects.status, paused: projects.paused })
      .from(projects).orderBy(desc(projects.updatedAt)).limit(30),
  ]);
  return {
    yesterday: chinaDate(yesterday),
    today: chinaDate(today),
    tasks: recent,
    projects: current.map((item) => ({ ...item, status: STATUS_LABELS[item.status as ProjectStatus] })),
  };
}

const WEEKLY_DECISIONS = { continue: "继续", pricing: "调价", trim: "砍掉某项服务" } as const;
export type WeeklyDecision = keyof typeof WEEKLY_DECISIONS;

export async function decideWeekly(db: Db, id: string, choice: WeeklyDecision, note: string) {
  if (!note.trim()) throw new Error("请写明周报决定的执行内容");
  await db.transaction(async (tx) => {
    const [report] = await tx.select().from(companyReports).where(eq(companyReports.id, id)).for("update");
    if (report?.kind !== "weekly" || report.status !== "succeeded") throw new Error("周报尚未生成");
    const [existing] = await tx.select({ id: decisions.id }).from(decisions)
      .where(and(eq(decisions.subjectId, id), eq(decisions.gate, "weekly"), isNull(decisions.projectId)));
    if (existing) throw new Error("这份周报已有决定");
    await tx.insert(decisions).values({
      subjectId: id, gate: "weekly", subjectVersion: 1, actorRole: "founder", verdict: "approve",
      reason: `${WEEKLY_DECISIONS[choice]} · ${note.trim()}`,
    });
  });
}
