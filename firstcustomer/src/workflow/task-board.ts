import { desc, eq, sql } from "drizzle-orm";
import { unionAll } from "drizzle-orm/pg-core";
import type { Db } from "@/db";
import { agentTasks, companyReports, projects } from "@/db/schema";

const PAGE_SIZE = 25;

export async function loadTaskBoard(db: Db, status: string, page: number) {
  const projectTasks = db.select({
    id: agentTasks.id,
    projectId: sql<string | null>`${agentTasks.projectId}`.as("project_id"),
    projectName: sql<string | null>`${projects.productName}`.as("product_name"),
    projectStatus: sql<string | null>`${projects.status}`.as("project_status"),
    paused: projects.paused,
    agent: agentTasks.agent,
    status: agentTasks.status,
    trigger: agentTasks.trigger,
    reason: sql<string | null>`coalesce(${agentTasks.sendBackReason}, ${agentTasks.error})`.as("reason"),
    provider: agentTasks.provider,
    model: agentTasks.model,
    cost: agentTasks.listCostYuan,
    at: agentTasks.startedAt,
  }).from(agentTasks).innerJoin(projects, eq(agentTasks.projectId, projects.id))
    .where(status ? eq(agentTasks.status, status) : undefined);

  const reports = db.select({
    id: companyReports.id,
    projectId: sql<string | null>`null::uuid`.as("project_id"),
    projectName: sql<string | null>`null::text`.as("product_name"),
    projectStatus: sql<string | null>`null::text`.as("project_status"),
    paused: sql<boolean>`false`.as("paused"),
    agent: companyReports.kind,
    status: companyReports.status,
    trigger: sql<string>`'normal'`.as("trigger"),
    reason: companyReports.error,
    provider: companyReports.provider,
    model: companyReports.model,
    cost: companyReports.listCostYuan,
    at: companyReports.createdAt,
  }).from(companyReports).where(status ? eq(companyReports.status, status) : undefined);

  const history = unionAll(projectTasks, reports).as("office_task_history");
  const rows = await db.select().from(history).orderBy(desc(history.at), desc(history.id))
    .limit(PAGE_SIZE + 1).offset((page - 1) * PAGE_SIZE);
  return { rows: rows.slice(0, PAGE_SIZE), hasMore: rows.length > PAGE_SIZE };
}
