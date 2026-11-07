import { and, eq } from "drizzle-orm";
import type { Db } from "@/db";
import { customerMemberships, decisions, orders, projects } from "@/db/schema";
import { effectiveCustomerPlan } from "@/domain/membership";
import { hasProAccess, isAccountPro, type ProjectStatus } from "@/domain/workflow";
import { enqueueAdvance } from "@/jobs/queue";
import { projectOrder } from "./commerce";
import { transition } from "./transitions";

export async function customerMembership(db: Db, customerId: string | null | undefined) {
  const [record] = customerId ? await db.select().from(customerMemberships).where(eq(customerMemberships.customerId, customerId)).limit(1) : [];
  return { plan: effectiveCustomerPlan(record), testAccount: record?.testAccount ?? false, source: record?.source ?? null, expiresAt: record?.expiresAt ?? null };
}

export async function assertAccountProjectAccess(db: Db, project: typeof projects.$inferSelect) {
  if (isAccountPro(project) && (await customerMembership(db, project.customerId)).plan !== "pro") throw new Error("Pro 账号权益已失效，请在账号工作台查看版本。");
}

// The authenticated customer ID and membership are verified here. Neither a
// form plan selector nor an existing project link can grant account-level Pro.
export async function activateAccountPro(
  db: Db, projectId: string, customerId: string,
  enqueue: (projectId: string, transaction: Db) => Promise<void> = enqueueAdvance,
) {
  return db.transaction(async (tx) => {
    const [membership] = await tx.select().from(customerMemberships).where(eq(customerMemberships.customerId, customerId)).for("update");
    if (effectiveCustomerPlan(membership) !== "pro") throw new Error("当前账号未开通 Pro。");
    const [project] = await tx.select().from(projects).where(and(eq(projects.id, projectId), eq(projects.customerId, customerId))).for("update");
    if (!project || project.isOwnProduct) throw new Error("项目不属于当前客户账号。");
    const order = await projectOrder(tx, projectId);
    if (hasProAccess(project, order)) {
      const retry = project.status === "failed" && ["researching", "strategizing", "preparing_page", "reviewing"].includes(project.failedFrom ?? "");
      if (isAccountPro(project) && (project.status === "submitted" || retry) && !project.paused) {
        await transition(tx, project, retry ? project.failedFrom as ProjectStatus : "researching", "customer", "启动 Pro 账号项目", { failedFrom: null, failedReason: null });
        await enqueue(projectId, tx);
        return true;
      }
      return false;
    }
    if (project.paused || ["cancelled", "delivered", "drafting_quote", "reading_receipt"].includes(project.status)) return false;
    const resumable = ["submitted", "researching", "needs_info", "free_ready", "awaiting_quote", "awaiting_quote_acceptance", "awaiting_payment"];
    if (!resumable.includes(project.status) && !(project.status === "failed" && ["researching", "drafting_quote", "reading_receipt"].includes(project.failedFrom ?? ""))) return false;
    if (order) await tx.update(orders).set({ status: "account_active", sku: "首客 Pro 账号权益" }).where(eq(orders.id, order.id));
    else await tx.insert(orders).values({ projectId, status: "account_active", sku: "首客 Pro 账号权益" });
    await tx.insert(decisions).values({ projectId, gate: "pro_access", subjectVersion: project.scopeVersion,
      actorRole: "customer", verdict: "approve", reason: "使用已开通的 Pro 账号权益，无需初步报价",
      snapshot: { method: "account", customerId, source: membership.source, testAccount: membership.testAccount, scopeVersion: project.scopeVersion },
    });
    const patch = { productPlan: "pro" as const, requiresPayment: false, proAccessSource: "account" as const, failedFrom: null, failedReason: null };
    const next: ProjectStatus = project.status === "submitted" || (project.status === "failed" && project.failedFrom === "researching") ? "researching"
      : ["free_ready", "awaiting_quote", "awaiting_quote_acceptance", "awaiting_payment", "failed"].includes(project.status) ? "strategizing"
      : project.status as ProjectStatus;
    if (next !== project.status) await transition(tx, project, next, "customer", "Pro 账号直接进入工作模块", patch);
    else await tx.update(projects).set({ ...patch, updatedAt: new Date() }).where(eq(projects.id, projectId));
    if (next !== "needs_info") await enqueue(projectId, tx);
    return true;
  });
}
