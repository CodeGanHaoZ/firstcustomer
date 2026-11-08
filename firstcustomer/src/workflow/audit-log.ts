import { and, desc, eq, sql } from "drizzle-orm";
import type { Db } from "@/db";
import { decisions, projects, stateTransitions } from "@/db/schema";

export const AUDIT_GATES = {
  all: "全部记录", quote: "服务价格确认", payment: "到账", positioning: "定位", publish: "发布",
  next_round: "下一轮", pro_round: "套餐验证轮次", acceptance: "交付验收", support: "客服处置", escalation: "异常裁决",
  weekly: "周报决定", charter: "公司宪章", pro_access: "Pro 开通", transition: "项目流转",
} as const;
export const AUDIT_PAGE_SIZE = 25;

export async function loadAuditLog(db: Db, input: { projectId?: string; gate?: string; actor?: string; page?: number } = {}) {
  const page = Math.max(1, Math.min(10000, Math.floor(input.page || 1)));
  const decisionRows = db.select({
    id: decisions.id, projectId: decisions.projectId, productName: projects.productName,
    event: decisions.gate, actor: decisions.actorRole, outcome: decisions.verdict,
    version: decisions.subjectVersion, reason: decisions.reason, snapshot: decisions.snapshot,
    at: decisions.createdAt,
  }).from(decisions).leftJoin(projects, eq(projects.id, decisions.projectId)).where(and(
    input.projectId ? eq(decisions.projectId, input.projectId) : undefined,
    input.gate && input.gate !== "all" ? eq(decisions.gate, input.gate) : undefined,
    input.actor ? eq(decisions.actorRole, input.actor) : undefined,
  ));
  const transitions = db.select({
    id: stateTransitions.id, projectId: stateTransitions.projectId, productName: projects.productName,
    event: sql<string>`'transition'`.as("gate"), actor: stateTransitions.actor, outcome: stateTransitions.toStatus,
    version: sql<number>`0`.as("subject_version"), reason: stateTransitions.reason,
    snapshot: sql<unknown>`jsonb_build_object('fromStatus', ${stateTransitions.fromStatus}, 'toStatus', ${stateTransitions.toStatus})`.as("snapshot"),
    at: stateTransitions.createdAt,
  }).from(stateTransitions).leftJoin(projects, eq(projects.id, stateTransitions.projectId)).where(and(
    input.projectId ? eq(stateTransitions.projectId, input.projectId) : undefined,
    input.gate && !["all", "transition"].includes(input.gate) ? sql`false` : undefined,
    input.actor ? eq(stateTransitions.actor, input.actor) : undefined,
  ));
  const feed = decisionRows.unionAll(transitions).as("audit");
  const rows = await db.select().from(feed).orderBy(desc(feed.at), desc(feed.id))
    .limit(AUDIT_PAGE_SIZE + 1).offset((page - 1) * AUDIT_PAGE_SIZE);
  return { items: rows.slice(0, AUDIT_PAGE_SIZE), page, hasNext: rows.length > AUDIT_PAGE_SIZE };
}
