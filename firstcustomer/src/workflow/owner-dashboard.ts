import { count, desc, eq, sum } from "drizzle-orm";
import type { Db } from "@/db";
import { agentTasks, companySettings, customerMemberships, orders, payments, projects } from "@/db/schema";
import { hasPaymentCode } from "./commerce";
import { loadCoo, projectAttention } from "./office";
import { operatingMetrics } from "./operating-metrics";

export const OWNER_CATEGORIES = {
  all: "全部待办", quote: "批价", payment: "核款", approval: "方案与交付",
  risk: "异常与客服", operations: "项目推进", company: "公司决策",
} as const;
export type OwnerCategory = Exclude<keyof typeof OWNER_CATEGORIES, "all">;
export type OwnerItem = {
  id: string; projectId: string | null; title: string; action: string; href: string;
  category: OwnerCategory; since: Date | null; overdue: boolean; isOwnProduct: boolean;
};

function categoryFor(status: string, paused: boolean): OwnerCategory {
  if (paused) return "operations";
  if (status === "awaiting_quote") return "quote";
  if (status === "awaiting_payment") return "payment";
  if (["failed", "awaiting_founder"].includes(status)) return "risk";
  if (["awaiting_positioning", "awaiting_publish", "reviewing", "delivered"].includes(status)) return "approval";
  return "operations";
}

export async function loadOwnerDashboard(db: Db) {
  const [all, orderRows, coo, metrics, taskCounts, [settings], paymentCodeReady, received, testMembers] = await Promise.all([
    db.select().from(projects).orderBy(desc(projects.updatedAt)),
    db.select().from(orders), loadCoo(db), operatingMetrics(db),
    db.select({ status: agentTasks.status, total: count() }).from(agentTasks).groupBy(agentTasks.status),
    db.select({ confirmedAt: companySettings.charterConfirmedAt }).from(companySettings).where(eq(companySettings.id, 1)),
    hasPaymentCode(db),
    db.select({ orderId: payments.orderId, amountFen: sum(payments.amountFen) }).from(payments).groupBy(payments.orderId),
    db.select({ customerId: customerMemberships.customerId }).from(customerMemberships).where(eq(customerMemberships.testAccount, true)),
  ]);
  const testCustomers = new Set(testMembers.map((member) => member.customerId));
  const names = new Map(all.map((project) => [project.id, project]));
  const queue: OwnerItem[] = [];
  const waiting: OwnerItem[] = [];
  const add = (item: Omit<OwnerItem, "overdue">, owner = true) => {
    (owner ? queue : waiting).push({ ...item, overdue: owner && !!item.since && item.since < coo.reminderCutoff });
  };
  const attention = await Promise.all(all.map((project) => projectAttention(db, project)));
  all.forEach((project, index) => {
    const item = attention[index];
    if (!item) return;
    add({ id: project.id, projectId: project.id, title: project.productName, action: item.action,
      href: `/admin/projects/${project.id}#${item.anchor}`, category: categoryFor(project.status, project.paused),
      since: item.since, isOwnProduct: project.isOwnProduct }, item.owner);
  });
  for (const message of coo.escalated) {
    add({ id: `support-${message.id}`, projectId: message.id, title: names.get(message.id)?.productName ?? "客户项目",
      action: `${message.amount} 条客服待处理`, category: "risk", since: message.since,
      href: `/admin/projects/${message.id}#frontdesk`, isOwnProduct: names.get(message.id)?.isOwnProduct ?? false });
  }
  for (const report of coo.pendingReports) {
    add({ id: report.id, projectId: null, title: "经营周报", action: "查看建议并记录经营决定", category: "company",
      since: report.since, href: `/admin/reports?report=${report.id}`, isOwnProduct: false });
  }
  if (!settings?.confirmedAt) {
    add({ id: "charter", projectId: null, title: "公司宪章", action: "确认业务范围与服务红线", category: "company",
      since: null, href: "/admin/context#company-settings", isOwnProduct: false });
  }
  const priorities: Record<OwnerCategory, number> = { risk: 0, payment: 1, quote: 2, approval: 3, company: 4, operations: 5 };
  queue.sort((a, b) => Number(b.overdue) - Number(a.overdue) || priorities[a.category] - priorities[b.category]
    || (a.since?.getTime() ?? Infinity) - (b.since?.getTime() ?? Infinity) || a.id.localeCompare(b.id));
  const counts = Object.fromEntries(Object.keys(OWNER_CATEGORIES).map((key) =>
    [key, key === "all" ? queue.length : queue.filter((item) => item.category === key).length])) as Record<keyof typeof OWNER_CATEGORIES, number>;
  const ordersByProject = new Map(orderRows.map((order) => [order.projectId, order]));
  const cashByOrder = new Map(received.map((row) => [row.orderId, Number(row.amountFen ?? 0)]));
  return {
    queue, waiting, counts, metrics, coo, taskCounts, paymentCodeReady,
    overdue: queue.filter((item) => item.overdue).length,
    pendingPaymentFen: orderRows.filter((order) => order.status === "accepted" && names.get(order.projectId)?.status !== "cancelled"
      && names.get(order.projectId)?.isOwnProduct === false && !testCustomers.has(names.get(order.projectId)?.customerId ?? "")).reduce((total, order) => total + (order.quoteFen ?? 0), 0),
    projects: all.map((project) => {
      const order = ordersByProject.get(project.id);
      // Only the fields used by the operator UI leave this query layer.
      return { id: project.id, productName: project.productName, productPlan: project.productPlan, status: project.status,
        paused: project.paused, isOwnProduct: project.isOwnProduct, testAccount: testCustomers.has(project.customerId ?? ""), updatedAt: project.updatedAt,
        orderStatus: order?.status ?? null, quoteFen: order?.quoteFen ?? null,
        receivedFen: order ? cashByOrder.get(order.id) ?? 0 : 0 };
    }),
  };
}
