import { and, count, eq, isNotNull, min, sql, sum } from "drizzle-orm";
import type { Db } from "@/db";
import { hasModelListPrice } from "@/ai/call-model";
import { agentTasks, companyReports, customerMemberships, events, landingPages, leads, orders, payments, projects } from "@/db/schema";

const externalCustomerProject = () => and(eq(projects.isOwnProduct, false), sql`${projects.proAccessSource} is distinct from 'simulation'`, sql`not exists (
  select 1 from ${customerMemberships}
  where ${customerMemberships.customerId} = ${projects.customerId} and ${customerMemberships.testAccount} = true
)`);

export async function operatingMetrics(db: Db) {
  const [orderRows, [cash], [effort], [growthEvents], [leadMetrics], tasks, company] = await Promise.all([
    db.select({ status: orders.status, delivery: orders.deliveryStatus }).from(orders)
      .innerJoin(projects, eq(projects.id, orders.projectId)).where(externalCustomerProject()),
    db.select({ amount: sum(payments.amountFen), first: min(payments.paidAt) }).from(payments)
      .innerJoin(orders, eq(orders.id, payments.orderId))
      .innerJoin(projects, eq(projects.id, orders.projectId)).where(externalCustomerProject()),
    db.select({ minutes: sum(orders.founderMinutes) }).from(orders),
    db.select({
      visits: sql<number>`count(distinct (${events.landingPageId}, ${events.visitorHash})) filter (where ${events.type} = 'visit' and ${events.visitorHash} is not null)`.mapWith(Number),
      ctaClicks: sql<number>`count(*) filter (where ${events.type} = 'cta_click')`.mapWith(Number),
      replies: sql<number>`count(*) filter (where ${events.type} in ('reply', 'comment'))`.mapWith(Number),
    }).from(events).innerJoin(landingPages, eq(landingPages.id, events.landingPageId))
      .innerJoin(projects, eq(projects.id, landingPages.projectId))
      .where(and(isNotNull(landingPages.publishedAt), externalCustomerProject())),
    db.select({ total: count(), first: min(leads.createdAt) }).from(leads)
      .innerJoin(landingPages, eq(landingPages.id, leads.landingPageId))
      .innerJoin(projects, eq(projects.id, landingPages.projectId))
      .where(and(eq(leads.isTest, false), externalCustomerProject(), isNotNull(landingPages.publishedAt))),
    db.select({ provider: agentTasks.provider, model: agentTasks.model, cost: agentTasks.listCostYuan }).from(agentTasks),
    db.select({ provider: companyReports.provider, model: companyReports.model, cost: companyReports.listCostYuan }).from(companyReports),
  ]);
  const providerRows = [...tasks, ...company];
  const growth = { ...growthEvents, leads: leadMetrics.total };
  return {
    orders: orderRows.length,
    quoted: orderRows.filter((o) => ["quoted", "accepted", "paid"].includes(o.status)).length,
    accepted: orderRows.filter((o) => ["accepted", "paid"].includes(o.status)).length,
    paid: orderRows.filter((o) => o.status === "paid").length,
    delivered: orderRows.filter((o) => o.delivery === "accepted").length,
    revenueFen: Number(cash.amount ?? 0),
    firstPaymentAt: cash.first?.toISOString() ?? null,
    firstLeadAt: leadMetrics.first?.toISOString() ?? null,
    founderMinutes: Number(effort.minutes ?? 0),
    modelCost: providerRows.reduce((total, item) => total + item.cost, 0),
    unpricedTasks: providerRows.filter(({ provider, model }) => provider && provider !== "stub" && !hasModelListPrice(model)).length,
    totalTasks: providerRows.length,
    growth,
  };
}

export type OperatingMetrics = Awaited<ReturnType<typeof operatingMetrics>>;
