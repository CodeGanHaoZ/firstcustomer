import { createHash } from "node:crypto";
import { and, asc, count, desc, eq, inArray, isNull, lt, max, min, or, sql } from "drizzle-orm";
import type { Db } from "@/db";
import { agentTasks, clarifications, companyReports, decisions, landingPages, leads, payments, projects, stateTransitions, supportMessages } from "@/db/schema";
import { gateState } from "@/domain/approval";
import { departmentViews, OFFICE_TRANSFER_STEPS, type OfficeTransfer } from "@/domain/office";
import type { ProjectStatus } from "@/domain/workflow";
import { gateStatusFor } from "./actions";
import { latestReceipt, projectOrder } from "./commerce";
import { reportFor } from "./engine";

const WAITING_OWNER_STATUSES = ["submitted", "awaiting_quote", "awaiting_payment", "awaiting_positioning", "awaiting_publish", "awaiting_founder", "reviewing", "failed"];
export const OWNER_REMINDER_HOURS = 24;
const reminderCutoff = (now: Date) => new Date(now.getTime() - OWNER_REMINDER_HOURS * 3_600_000);

export async function loadOfficeTransfer(db: Db, projectId: string): Promise<OfficeTransfer | null> {
  const [event] = await db.select({
    id: stateTransitions.id, from: stateTransitions.fromStatus, to: stateTransitions.toStatus, at: stateTransitions.createdAt,
  }).from(stateTransitions).where(and(eq(stateTransitions.projectId, projectId), or(...OFFICE_TRANSFER_STEPS.map((step) =>
    and(eq(stateTransitions.fromStatus, step.phaseFrom), eq(stateTransitions.toStatus, step.phaseTo)),
  )))).orderBy(desc(stateTransitions.createdAt), desc(stateTransitions.id)).limit(1);
  if (!event) return null;
  const step = OFFICE_TRANSFER_STEPS.find(({ phaseFrom, phaseTo }) => phaseFrom === event.from && phaseTo === event.to);
  return step ? { id: event.id, from: step.from, to: step.to, at: event.at.toISOString() } : null;
}

export type OfficeAttention = { action: string; owner: boolean; anchor: string; since: Date | null };

export async function projectAttention(db: Db, project: typeof projects.$inferSelect): Promise<OfficeAttention | null> {
  const owner = (action: string, since: Date | null = project.updatedAt): OfficeAttention =>
    ({ action, owner: true, anchor: "decisions", since });
  const waiting = (action: string): OfficeAttention => ({ action, owner: false, anchor: "decisions", since: null });
  if (project.paused && project.status !== "cancelled" && project.status !== "delivered") {
    return { ...owner("项目已暂停，恢复后继续", null), anchor: "tasks" };
  }

  switch (project.status) {
    case "submitted": return project.productPlan === "free" ? null : owner("确认后开始研究");
    case "needs_info": return waiting("等客户回答追问，也可选择继续研究");
    case "awaiting_quote": return owner("确认报价和服务条款");
    case "awaiting_quote_acceptance": return waiting("等客户接受报价");
    case "awaiting_payment": {
      const order = await projectOrder(db, project.id);
      const receipt = order && await latestReceipt(db, order.id);
      if (!receipt) return waiting("等客户上传付款截图");
      return receipt.analysisStatus === "pending" ? null : owner("核对付款截图并确认到账");
    }
    case "awaiting_positioning":
    case "awaiting_publish": {
      const positioning = project.status === "awaiting_positioning";
      const gate = await gateStatusFor(db, project, positioning ? "positioning" : "publish");
      if (gate.state.founder !== "approved") return owner(positioning ? "把关定位方案" : "把关页面和素材");
      return project.isOwnProduct
        ? owner(positioning ? "代为确认自有产品定位" : "代为确认自有产品发布")
        : waiting(positioning ? "等客户确认定位" : "等客户确认发布");
    }
    case "awaiting_founder": return owner("打回超限，等你裁决");
    case "failed": return owner("执行失败，决定是否重试");
    case "collecting": return owner("数据够了就开始复盘", null);
    case "reviewing": {
      if (!(await reportFor(db, project))) return null;
      const { state } = await gateStatusFor(db, project, "next_round");
      if (state.founder !== "approved") return owner("看复盘，决定交付或下一轮");
      return project.isOwnProduct ? owner("代为确认自有产品下一轮") : waiting("等客户确认下一轮");
    }
    case "delivered": {
      const order = await projectOrder(db, project.id);
      if (order?.deliveryStatus === "delivered") return { ...waiting("等客户确认验收"), anchor: "finance" };
      if (order?.deliveryStatus !== "changes_requested") return null;
      const [latest] = await db.select({ at: max(decisions.createdAt) }).from(decisions)
        .where(and(eq(decisions.projectId, project.id), eq(decisions.gate, "acceptance"), eq(decisions.verdict, "reject")));
      return { ...owner("查看客户提交的修改意见", latest.at), anchor: "finance" };
    }
    default: return null;
  }
}

export async function loadDepartments(db: Db, project: typeof projects.$inferSelect) {
  const taskFields = {
    id: agentTasks.id, agent: agentTasks.agent, status: agentTasks.status, startedAt: agentTasks.startedAt, round: agentTasks.round,
    sendBackRoute: agentTasks.sendBackRoute, sendBackReason: agentTasks.sendBackReason,
  };
  const [tasks, [lastHandoff], projectDecisions, pages, report, unanswered, inbox] = await Promise.all([
    db.select(taskFields)
      .from(agentTasks).where(eq(agentTasks.projectId, project.id)).orderBy(desc(agentTasks.startedAt)).limit(60),
    db.select(taskFields).from(agentTasks)
      .where(and(eq(agentTasks.projectId, project.id), eq(agentTasks.round, project.round), eq(agentTasks.status, "sent_back")))
      .orderBy(desc(agentTasks.startedAt)).limit(1),
    db.select().from(decisions).where(eq(decisions.projectId, project.id)),
    db.select({ version: landingPages.version, status: landingPages.status }).from(landingPages)
      .where(eq(landingPages.projectId, project.id)).orderBy(desc(landingPages.version)).limit(1),
    reportFor(db, project),
    db.select({ answer: clarifications.answer }).from(clarifications).where(eq(clarifications.projectId, project.id)),
    db.select({ status: supportMessages.status }).from(supportMessages).where(eq(supportMessages.projectId, project.id)),
  ]);
  return departmentViews({
    status: project.status as ProjectStatus,
    round: project.round,
    paused: project.paused,
    failedFrom: project.failedFrom,
    escalationFrom: (project.escalation as { from?: string } | null)?.from ?? null,
    tasks: lastHandoff ? [...tasks, lastHandoff] : tasks,
    gates: {
      positioning: gateState(projectDecisions, "positioning", project.positioningVersion),
      publish: gateState(projectDecisions, "publish", pages[0]?.version ?? 0),
      next_round: gateState(projectDecisions, "next_round", project.round),
    },
    hasReport: !!report,
    pagePublished: pages[0]?.status === "published",
    unansweredQuestions: unanswered.filter(({ answer }) => !answer).length,
    supportPending: inbox.filter(({ status }) => status === "queued").length,
    supportEscalated: inbox.filter(({ status }) => status === "escalated").length,
  });
}

export async function officeRevision(db: Db, now = new Date()) {
  const cutoff = reminderCutoff(now);
  const rows = await Promise.all([
    db.select({ updated: max(projects.updatedAt), size: count(),
      overdue: sql<number>`count(*) filter (where ${and(eq(projects.paused, false), inArray(projects.status, WAITING_OWNER_STATUSES), lt(projects.updatedAt, cutoff))})`,
    }).from(projects),
    db.select({ started: max(agentTasks.startedAt), finished: max(agentTasks.finishedAt), size: count() }).from(agentTasks),
    db.select({ updated: max(decisions.createdAt), size: count(),
      overdue: sql<number>`count(*) filter (where ${and(eq(decisions.gate, "acceptance"), eq(decisions.verdict, "reject"), lt(decisions.createdAt, cutoff))})`,
    }).from(decisions),
    db.select({ updated: max(payments.paidAt), size: count() }).from(payments),
    db.select({ updated: max(leads.createdAt), size: count() }).from(leads).where(eq(leads.isTest, false)),
    db.select({ updated: max(supportMessages.updatedAt), size: count(),
      overdue: sql<number>`count(*) filter (where ${and(eq(supportMessages.status, "escalated"), lt(supportMessages.updatedAt, cutoff))})`,
    }).from(supportMessages),
    db.select({ updated: max(companyReports.finishedAt), size: count(),
      overdue: sql<number>`count(*) filter (where ${and(eq(companyReports.kind, "weekly"), eq(companyReports.status, "succeeded"), lt(companyReports.finishedAt, cutoff))})`,
    }).from(companyReports),
    db.select({ size: count() }).from(agentTasks)
      .where(and(eq(agentTasks.status, "running"), lt(agentTasks.startedAt, new Date(now.getTime() - 30 * 60_000)))),
  ]);
  return createHash("sha256").update(JSON.stringify(rows)).digest("hex").slice(0, 24);
}

export async function loadCoo(db: Db) {
  const now = new Date();
  const [[standup], stalled, escalated, pendingReports] = await Promise.all([
    db.select().from(companyReports).where(eq(companyReports.kind, "standup"))
      .orderBy(desc(companyReports.createdAt)).limit(1),
    db.select({ id: agentTasks.id, projectId: projects.id, productName: projects.productName, agent: agentTasks.agent, at: agentTasks.startedAt })
      .from(agentTasks).innerJoin(projects, eq(projects.id, agentTasks.projectId))
      .where(and(eq(agentTasks.status, "running"), lt(agentTasks.startedAt, new Date(now.getTime() - 30 * 60_000))))
      .orderBy(asc(agentTasks.startedAt)),
    db.select({ id: supportMessages.projectId, amount: count(), since: min(supportMessages.updatedAt) }).from(supportMessages)
      .where(eq(supportMessages.status, "escalated")).groupBy(supportMessages.projectId),
    db.select({ id: companyReports.id, since: companyReports.finishedAt }).from(companyReports)
      .leftJoin(decisions, and(eq(decisions.subjectId, companyReports.id), eq(decisions.gate, "weekly")))
      .where(and(eq(companyReports.kind, "weekly"), eq(companyReports.status, "succeeded"), isNull(decisions.id)))
      .orderBy(desc(companyReports.createdAt)),
  ]);
  return { standup, stalled, escalated, pendingReports, reminderCutoff: reminderCutoff(now) };
}
