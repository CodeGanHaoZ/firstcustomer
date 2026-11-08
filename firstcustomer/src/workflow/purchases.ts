import { and, eq } from "drizzle-orm";
import type { Db } from "@/db";
import { decisions, orders, projects, purchasePayments } from "@/db/schema";
import { proQuote } from "@/domain/pro-pricing";
import { hasProAccess, isPurchasedPro } from "@/domain/workflow";
import { enqueueAdvance } from "@/jobs/queue";
import { paymentProvider, paymentsEnabled, type PaymentProvider } from "@/payments/provider";
import { projectOrder } from "./commerce";
import { transition } from "./transitions";

export function canPurchasePro(project: typeof projects.$inferSelect) {
  return project.productPlan === "free" && project.status === "free_ready" && !project.paused && !project.isOwnProduct;
}

export async function projectPurchasePayment(db: Db, orderId: string) {
  const [payment] = await db.select().from(purchasePayments).where(eq(purchasePayments.orderId, orderId)).limit(1);
  return payment ?? null;
}

export async function customerPurchasedProjects(db: Db, customerId: string) {
  const rows = await db.select({ project: projects }).from(projects)
    .innerJoin(orders, eq(orders.projectId, projects.id))
    .innerJoin(purchasePayments, eq(purchasePayments.orderId, orders.id))
    .where(and(eq(projects.customerId, customerId), eq(projects.proAccessSource, "simulation"),
      eq(orders.status, "simulation_active"), eq(purchasePayments.status, "succeeded")));
  return rows.map(({ project }) => project);
}

export async function createProPurchase(db: Db, projectId: string, fingerprint: string) {
  if (!paymentsEnabled()) throw new Error("支付暂不可用，请稍后重试");
  return db.transaction(async (tx) => {
    const [project] = await tx.select().from(projects).where(eq(projects.id, projectId)).for("update");
    if (!project) throw new Error("项目不存在");
    const existing = await projectOrder(tx, projectId);
    if (existing?.paymentMode === "simulated" && existing.pricingSnapshot?.fingerprint === fingerprint &&
        isPurchasedPro(project) && ["simulation_pending", "simulation_active"].includes(existing.status)) return existing;
    if (!canPurchasePro(project)) throw new Error("请在出海机会报告生成后购买 Pro，并确认项目未暂停");
    if (existing && (existing.status !== "inquiry" || existing.quoteVersion !== 0)) throw new Error("当前项目已有服务订单，请刷新后查看");
    const quote = proQuote(project);
    if (quote.fingerprint !== fingerprint) throw new Error("报价或需求版本已更新，请刷新后重新确认");
    const values = { sku: "首客 Pro · 项目服务", quoteFen: quote.quoteFen, quoteVersion: 1,
      pricingSnapshot: quote, paymentMode: "simulated" as const, status: "simulation_pending" };
    const [order] = existing
      ? await tx.update(orders).set(values).where(eq(orders.id, existing.id)).returning()
      : await tx.insert(orders).values({ ...values, projectId }).returning();
    await tx.insert(purchasePayments).values({ orderId: order.id, provider: "simulated", amountFen: quote.quoteFen });
    await tx.insert(decisions).values({ projectId, gate: "quote", subjectId: order.id, subjectVersion: order.quoteVersion,
      actorRole: "customer", verdict: "approve", reason: "客户确认自动计价的项目服务范围与报价",
      snapshot: { quoteFingerprint: quote.fingerprint, amountFen: quote.quoteFen, scopeVersion: project.scopeVersion, paymentMode: "simulated" } });
    await transition(tx, project, "awaiting_payment", "customer", "客户接受项目报价，进入支付", {
      productPlan: "pro", requiresPayment: false, proAccessSource: "simulation",
    });
    return order;
  });
}

export async function completeProPurchase(
  db: Db, projectId: string, paymentId: string, fingerprint: string,
  enqueue: (projectId: string, transaction: Db) => Promise<void> = enqueueAdvance,
  provider: PaymentProvider = paymentProvider(),
) {
  if (!paymentsEnabled() || provider.name !== "simulated") throw new Error("支付暂不可用，请稍后重试");
  return db.transaction(async (tx) => {
    const [project] = await tx.select().from(projects).where(eq(projects.id, projectId)).for("update");
    if (!project) throw new Error("项目不存在");
    const order = await projectOrder(tx, projectId);
    const quote = order?.pricingSnapshot;
    if (!order || !quote || order.paymentMode !== "simulated" || quote.fingerprint !== fingerprint) throw new Error("支付订单已更新，请刷新后重试");
    const [payment] = await tx.select().from(purchasePayments).where(and(eq(purchasePayments.id, paymentId), eq(purchasePayments.orderId, order.id))).for("update");
    if (!payment || payment.provider !== provider.name || payment.amountFen !== quote.quoteFen || order.quoteFen !== quote.quoteFen) throw new Error("支付订单校验失败，请刷新后重试");
    if (payment.status === "succeeded" && hasProAccess(project, order)) return false;
    if (project.paused || project.status !== "awaiting_payment" || order.status !== "simulation_pending" || !isPurchasedPro(project)) throw new Error("当前项目暂不能完成付款，请刷新后查看进度");
    if (quote.projectId !== projectId || quote.requirementVersion !== project.requirementVersion || quote.scopeVersion !== project.scopeVersion || quote.round !== project.round) throw new Error("需求版本已更新，请重新确认报价");
    // Verification uses the persisted amount and identity, never a client paid flag.
    const result = await provider.verify({ paymentId: payment.id, orderId: order.id, amountFen: quote.quoteFen, currency: "CNY" });
    if (result.status !== "succeeded" || result.provider !== payment.provider || result.paymentId !== payment.id ||
        result.orderId !== order.id || result.amountFen !== quote.quoteFen || result.currency !== "CNY" || !result.reference) {
      throw new Error("付款尚未通过校验，请重试");
    }
    await tx.update(purchasePayments).set({ status: "succeeded", reference: result.reference, completedAt: new Date() }).where(eq(purchasePayments.id, payment.id));
    await tx.update(orders).set({ status: "simulation_active" }).where(eq(orders.id, order.id));
    const snapshot = { method: "simulated", paymentId: payment.id, orderId: order.id, reference: result.reference,
      amountFen: quote.quoteFen, currency: quote.currency, pricingVersion: quote.version, quoteFingerprint: quote.fingerprint,
      requirementVersion: project.requirementVersion, scopeVersion: project.scopeVersion, round: project.round };
    await tx.insert(decisions).values([
      { projectId, gate: "payment", subjectId: payment.id, subjectVersion: order.quoteVersion, actorRole: "system", verdict: "approve", reason: "模拟支付校验成功，不计入实际收款", snapshot },
      { projectId, gate: "pro_access", subjectId: order.id, subjectVersion: project.scopeVersion, actorRole: "system", verdict: "approve", reason: "付款校验后自动开通本项目 Pro", snapshot },
    ]);
    await transition(tx, project, "strategizing", "payment", "付款校验完成，自动开通项目并启动策略", { failedFrom: null, failedReason: null });
    // Queue failure rolls everything back, so the same checkout remains retryable.
    await enqueue(projectId, tx);
    return true;
  });
}

export async function assertPurchasedProjectAccess(db: Db, project: typeof projects.$inferSelect) {
  if (!isPurchasedPro(project)) return;
  const order = await projectOrder(db, project.id);
  const payment = order ? await projectPurchasePayment(db, order.id) : null;
  const quote = order?.pricingSnapshot;
  if (!hasProAccess(project, order) || payment?.status !== "succeeded" || !quote ||
      payment.amountFen !== quote.quoteFen || order?.quoteFen !== quote.quoteFen || quote.projectId !== project.id ||
      quote.scopeVersion !== project.scopeVersion || quote.requirementVersion !== project.requirementVersion ||
      quote.round !== project.round) throw new Error("请先完成当前项目付款");
}
