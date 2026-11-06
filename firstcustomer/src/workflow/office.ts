import { createHash } from "node:crypto";
import { and, asc, count, desc, eq, lt, max } from "drizzle-orm";
import type { Db } from "@/db";
import { agentTasks, clarifications, companyReports, decisions, landingPages, leads, payments, projects, supportMessages } from "@/db/schema";
import { gateState } from "@/domain/approval";
import { departmentViews } from "@/domain/office";
import type { ProjectStatus } from "@/domain/workflow";
import { reportFor } from "./engine";

export async function loadDepartments(db: Db, project: typeof projects.$inferSelect) {
  const [tasks, projectDecisions, pages, report, unanswered, inbox] = await Promise.all([
    db.select({ agent: agentTasks.agent, status: agentTasks.status, startedAt: agentTasks.startedAt,
      sendBackRoute: agentTasks.sendBackRoute, sendBackReason: agentTasks.sendBackReason })
      .from(agentTasks).where(eq(agentTasks.projectId, project.id)).orderBy(desc(agentTasks.startedAt)).limit(60),
    db.select().from(decisions).where(eq(decisions.projectId, project.id)),
    db.select({ version: landingPages.version, status: landingPages.status }).from(landingPages)
      .where(eq(landingPages.projectId, project.id)).orderBy(desc(landingPages.version)).limit(1),
    reportFor(db, project),
    db.select({ answer: clarifications.answer }).from(clarifications).where(eq(clarifications.projectId, project.id)),
    db.select({ status: supportMessages.status }).from(supportMessages).where(eq(supportMessages.projectId, project.id)),
  ]);
  return departmentViews({
    status: project.status as ProjectStatus,
    paused: project.paused,
    failedFrom: project.failedFrom,
    escalationFrom: (project.escalation as { from?: string } | null)?.from ?? null,
    tasks,
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

export async function officeRevision(db: Db) {
  const rows = await Promise.all([
    db.select({ updated: max(projects.updatedAt), size: count() }).from(projects),
    db.select({ started: max(agentTasks.startedAt), finished: max(agentTasks.finishedAt), size: count() }).from(agentTasks),
    db.select({ updated: max(decisions.createdAt), size: count() }).from(decisions),
    db.select({ updated: max(payments.paidAt), size: count() }).from(payments),
    db.select({ updated: max(leads.createdAt), size: count() }).from(leads).where(eq(leads.isTest, false)),
    db.select({ updated: max(supportMessages.updatedAt), size: count() }).from(supportMessages),
    db.select({ updated: max(companyReports.finishedAt), size: count() }).from(companyReports),
    db.select({ size: count() }).from(agentTasks)
      .where(and(eq(agentTasks.status, "running"), lt(agentTasks.startedAt, new Date(Date.now() - 30 * 60_000)))),
  ]);
  return createHash("sha256").update(JSON.stringify(rows)).digest("hex").slice(0, 24);
}

export async function firstProjectLead(db: Db, projectId: string) {
  const [row] = await db.select({ at: leads.createdAt }).from(leads)
    .innerJoin(landingPages, eq(landingPages.id, leads.landingPageId))
    .where(and(eq(landingPages.projectId, projectId), eq(leads.isTest, false)))
    .orderBy(leads.createdAt).limit(1);
  return row?.at ?? null;
}

export async function loadCoo(db: Db) {
  const [[standup], stalled, escalated] = await Promise.all([
    db.select().from(companyReports).where(eq(companyReports.kind, "standup"))
      .orderBy(desc(companyReports.createdAt)).limit(1),
    db.select({ projectId: projects.id, productName: projects.productName, agent: agentTasks.agent, at: agentTasks.startedAt })
      .from(agentTasks).innerJoin(projects, eq(projects.id, agentTasks.projectId))
      .where(and(eq(agentTasks.status, "running"), lt(agentTasks.startedAt, new Date(Date.now() - 30 * 60_000))))
      .orderBy(asc(agentTasks.startedAt)),
    db.select({ id: supportMessages.projectId, amount: count() }).from(supportMessages)
      .where(eq(supportMessages.status, "escalated")).groupBy(supportMessages.projectId),
  ]);
  return { standup, stalled, escalated };
}
