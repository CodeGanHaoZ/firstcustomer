import { and, asc, eq, isNotNull, min, sum } from "drizzle-orm";
import type { Db } from "@/db";
import { hasModelListPrice } from "@/ai/call-model";
import { agentTasks, companyReports, landingPages, leads, orders, payments, projects } from "@/db/schema";
import { pageMetrics } from "./engine";

export async function operatingMetrics(db: Db) {
  const [orderRows, [cash], [effort], pageRows, [firstLead], tasks, company] = await Promise.all([
    db.select({ status: orders.status, delivery: orders.deliveryStatus }).from(orders)
      .innerJoin(projects, eq(projects.id, orders.projectId)).where(eq(projects.isOwnProduct, false)),
    db.select({ amount: sum(payments.amountFen), first: min(payments.paidAt) }).from(payments)
      .innerJoin(orders, eq(orders.id, payments.orderId))
      .innerJoin(projects, eq(projects.id, orders.projectId)).where(eq(projects.isOwnProduct, false)),
    db.select({ minutes: sum(orders.founderMinutes) }).from(orders),
    db.select({ id: landingPages.id }).from(landingPages).where(isNotNull(landingPages.publishedAt)),
    db.select({ at: leads.createdAt }).from(leads)
      .innerJoin(landingPages, eq(landingPages.id, leads.landingPageId))
      .innerJoin(projects, eq(projects.id, landingPages.projectId))
      .where(and(eq(leads.isTest, false), eq(projects.isOwnProduct, false)))
      .orderBy(asc(leads.createdAt)).limit(1),
    db.select({ provider: agentTasks.provider, model: agentTasks.model, cost: agentTasks.listCostYuan }).from(agentTasks),
    db.select({ provider: companyReports.provider, model: companyReports.model, cost: companyReports.listCostYuan }).from(companyReports),
  ]);
  const perPage = await Promise.all(pageRows.map((page) => pageMetrics(db, page.id)));
  const providerRows = [...tasks, ...company];
  const growth = perPage.reduce((total, row) => ({
    visits: total.visits + row.visits, ctaClicks: total.ctaClicks + row.ctaClicks,
    leads: total.leads + row.leads, replies: total.replies + row.replies,
  }), { visits: 0, ctaClicks: 0, leads: 0, replies: 0 });
  return {
    orders: orderRows.length,
    quoted: orderRows.filter((o) => ["quoted", "accepted", "paid"].includes(o.status)).length,
    accepted: orderRows.filter((o) => ["accepted", "paid"].includes(o.status)).length,
    paid: orderRows.filter((o) => o.status === "paid").length,
    delivered: orderRows.filter((o) => o.delivery === "accepted").length,
    revenueFen: Number(cash.amount ?? 0),
    firstPaymentAt: cash.first?.toISOString() ?? null,
    firstLeadAt: firstLead?.at.toISOString() ?? null,
    founderMinutes: Number(effort.minutes ?? 0),
    modelCost: providerRows.reduce((total, item) => total + item.cost, 0),
    unpricedTasks: providerRows.filter(({ provider, model }) => provider && provider !== "stub" && !hasModelListPrice(model)).length,
    totalTasks: providerRows.length,
    growth,
  };
}

export type OperatingMetrics = Awaited<ReturnType<typeof operatingMetrics>>;
