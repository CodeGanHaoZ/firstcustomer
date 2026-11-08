import { and, eq, inArray, sql } from "drizzle-orm";
import type { Db } from "@/db";
import { authUsers, customerMemberships, decisions, deliverables, orders, paymentReceipts, payments, projects, proTrialClaims, purchasePayments } from "@/db/schema";
import { proQuote, proRoundProgress, proTrialQuote } from "@/domain/pro-pricing";
import { hasProAccess, isLegacyProOffer, isProjectServicePro, isPurchasedPro, isTrialPro } from "@/domain/workflow";
import { enqueueAdvance } from "@/jobs/queue";
import { paymentProvider, paymentsEnabled, type PaymentProvider } from "@/payments/provider";
import { projectOrder } from "./commerce";
import { transition } from "./transitions";

export function canPurchasePro(project: typeof projects.$inferSelect) {
  return !project.paused && !project.isOwnProduct && (
    (project.productPlan === "free" && project.status === "free_ready") || isLegacyProOffer(project) ||
    (isTrialPro(project) && ["reviewing", "delivered"].includes(project.status))
  );
}

async function hasHistoricalPayment(db: Db, orderId: string) {
  const [cash, receipt] = await Promise.all([
    db.select({ id: payments.id }).from(payments).where(eq(payments.orderId, orderId)).limit(1),
    db.select({ id: paymentReceipts.id }).from(paymentReceipts).where(eq(paymentReceipts.orderId, orderId)).limit(1),
  ]);
  return cash.length > 0 || receipt.length > 0;
}

export async function canClaimProTrialOnProject(db: Db, project: typeof projects.$inferSelect, order: typeof orders.$inferSelect | null) {
  return canPurchasePro(project) && !isTrialPro(project) && (!order || (!order.paymentMode &&
    ["inquiry", "quoted", "accepted"].includes(order.status) && !await hasHistoricalPayment(db, order.id)));
}

export async function proPurchaseOffer(db: Db, project: typeof projects.$inferSelect, order: typeof orders.$inferSelect | null) {
  if (!paymentsEnabled() || !canPurchasePro(project)) return null;
  if (order && (order.paymentMode || !["inquiry", "quoted", "accepted", ...(isTrialPro(project) ? ["trial_active"] : [])].includes(order.status) || await hasHistoricalPayment(db, order.id))) return null;
  if (isTrialPro(project) && !await completedProTrial(db, project)) return null;
  return proQuote(isTrialPro(project) ? { ...project, round: project.round + 1 } : project);
}

export async function projectProTrial(db: Db, projectId: string) {
  const [claim] = await db.select().from(proTrialClaims).where(eq(proTrialClaims.projectId, projectId)).limit(1);
  return claim ?? null;
}

export async function guestProTrial(db: Db, guestHash: string | null) {
  if (!guestHash) return null;
  const [claim] = await db.select().from(proTrialClaims).where(eq(proTrialClaims.guestHash, guestHash)).limit(1);
  return claim ?? null;
}

export async function customerProTrial(db: Db, customerId: string | null | undefined) {
  if (!customerId) return { eligible: false, claim: null };
  const [[claim], [membership], previousPro] = await Promise.all([
    db.select().from(proTrialClaims).where(eq(proTrialClaims.customerId, customerId)).limit(1),
    db.select().from(customerMemberships).where(eq(customerMemberships.customerId, customerId)).limit(1),
    db.select({ id: orders.id }).from(orders).innerJoin(projects, eq(projects.id, orders.projectId))
      .where(and(eq(projects.customerId, customerId), inArray(orders.status, ["paid", "account_active", "key_activated", "simulation_active"]))).limit(1),
  ]);
  return { eligible: !claim && membership?.plan !== "pro" && previousPro.length === 0, claim: claim ?? null };
}

export function validProTrialClaim(project: typeof projects.$inferSelect, order: typeof orders.$inferSelect | null, claim: typeof proTrialClaims.$inferSelect | null) {
  return Boolean(isTrialPro(project) && claim && claim.projectId === project.id &&
    (claim.customerId ? claim.customerId === project.customerId : claim.guestHash) && claim.orderId === order?.id &&
    hasProAccess(project, order) && claim.snapshot.quoteFen === 0 && claim.snapshot.includedRounds === 1 &&
    claim.snapshot.projectId === project.id && claim.snapshot.scopeVersion === project.scopeVersion &&
    claim.snapshot.requirementVersion === project.requirementVersion && proRoundProgress(claim.snapshot, project.round).covered);
}

export async function assertTrialProjectAccess(db: Db, project: typeof projects.$inferSelect) {
  if (!isTrialPro(project)) return;
  const claim = await projectProTrial(db, project.id);
  const order = await projectOrder(db, project.id);
  if (!validProTrialClaim(project, order, claim)) {
    throw new Error("免费试用授权与当前账号或项目范围不一致");
  }
}

async function completedProTrial(db: Db, project: typeof projects.$inferSelect) {
  await assertTrialProjectAccess(db, project);
  const [report] = await db.select({ id: deliverables.id }).from(deliverables).where(and(eq(deliverables.projectId, project.id),
    eq(deliverables.kind, "report"), eq(deliverables.round, project.round))).limit(1);
  return Boolean(report);
}

export async function claimProTrial(db: Db, customerId: string, projectId: string,
  enqueue: (projectId: string, transaction: Db) => Promise<void> = enqueueAdvance, guestHash: string | null = null) {
  return claimTrial(db, { customerId, guestHash }, projectId, enqueue);
}

export async function claimGuestProTrial(db: Db, guestHash: string, projectId: string,
  enqueue: (projectId: string, transaction: Db) => Promise<void> = enqueueAdvance) {
  if (!/^[a-f0-9]{64}$/.test(guestHash)) throw new Error("试用凭据无效，请刷新后重试");
  return claimTrial(db, { customerId: null, guestHash }, projectId, enqueue);
}

async function claimTrial(db: Db, identity: { customerId: string | null; guestHash: string | null }, projectId: string,
  enqueue: (projectId: string, transaction: Db) => Promise<void>) {
  const { customerId, guestHash } = identity;
  return db.transaction(async (tx) => {
    // Serialize both account and browser claims across different projects.
    if (customerId) {
      const [customer] = await tx.select({ id: authUsers.id }).from(authUsers).where(eq(authUsers.id, customerId)).for("update");
      if (!customer) throw new Error("账号不存在，请重新登录");
    }
    if (guestHash) await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`pro-trial:${guestHash}`}, 0))`);
    const [project] = await tx.select().from(projects).where(eq(projects.id, projectId)).for("update");
    if (!project || project.customerId !== customerId || project.isOwnProduct) throw new Error("项目不属于当前账号");
    const [accountStatus, browserClaim] = await Promise.all([customerProTrial(tx, customerId), guestProTrial(tx, guestHash)]);
    const claim = accountStatus.claim ?? browserClaim;
    if (claim?.projectId === project.id && isTrialPro(project)) { await assertTrialProjectAccess(tx, project); return false; }
    if (browserClaim) throw new Error("当前浏览器已领取过一次完整试用，可在试用工作台继续原项目");
    if (customerId && !accountStatus.eligible) throw new Error("每个首次使用 Pro 的账号仅可领取一次完整试用");
    if (!canPurchasePro(project) || isTrialPro(project)) throw new Error("请先完成免费出海机会报告，并确认项目未暂停");
    const existing = await projectOrder(tx, projectId);
    if (existing && (existing.paymentMode || !["inquiry", "quoted", "accepted"].includes(existing.status) || await hasHistoricalPayment(tx, existing.id))) {
      throw new Error("当前项目已有购买或付款记录，请先核对原订单");
    }
    const snapshot = proTrialQuote(project);
    const values = { sku: "新用户 Pro · 免费试用一轮", quoteFen: 0, quoteVersion: (existing?.quoteVersion ?? 0) + 1,
      pricingSnapshot: snapshot, status: "trial_active", paymentMode: null, deliveryStatus: "not_started" } as const;
    const [order] = existing ? await tx.update(orders).set(values).where(eq(orders.id, existing.id)).returning()
      : await tx.insert(orders).values({ ...values, projectId }).returning();
    const [createdClaim] = await tx.insert(proTrialClaims).values({ customerId, guestHash, projectId, orderId: order.id, snapshot }).returning();
    await tx.insert(decisions).values({ projectId, gate: "pro_access", subjectId: createdClaim.id, subjectVersion: project.scopeVersion,
      actorRole: "system", verdict: "approve", reason: "新用户领取一轮完整试用，无需付款",
      snapshot: { method: "trial", trialClaimId: createdClaim.id, orderId: order.id, includedRounds: 1, amountFen: 0,
        previousOrder: existing ? { status: existing.status, quoteFen: existing.quoteFen, quoteVersion: existing.quoteVersion, proposal: existing.proposal } : null } });
    await transition(tx, project, "strategizing", "customer", "领取免费完整验证试用并启动执行", {
      productPlan: "pro", requiresPayment: false, proAccessSource: "trial", failedFrom: null, failedReason: null,
    });
    await enqueue(projectId, tx);
    return true;
  });
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

export async function customerProProjects(db: Db, customerId: string) {
  const [purchased, trial] = await Promise.all([
    customerPurchasedProjects(db, customerId),
    db.select({ project: projects, claim: proTrialClaims }).from(proTrialClaims)
      .innerJoin(projects, eq(projects.id, proTrialClaims.projectId))
      .innerJoin(orders, eq(orders.id, proTrialClaims.orderId))
      .where(and(eq(projects.customerId, customerId), eq(projects.proAccessSource, "trial"),
        inArray(orders.status, ["trial_active", "simulation_pending"]))),
  ]);
  return [...purchased, ...trial.filter(({ project, claim }) => claim.snapshot.scopeVersion === project.scopeVersion &&
    claim.snapshot.requirementVersion === project.requirementVersion && proRoundProgress(claim.snapshot, project.round).covered).map(({ project }) => project)];
}

export async function createProPurchase(db: Db, projectId: string, fingerprint: string) {
  if (!paymentsEnabled()) throw new Error("支付暂不可用，请稍后重试");
  return db.transaction(async (tx) => {
    const [project] = await tx.select().from(projects).where(eq(projects.id, projectId)).for("update");
    if (!project) throw new Error("项目不存在");
    const existing = await projectOrder(tx, projectId);
    if (existing?.paymentMode === "simulated" && existing.pricingSnapshot?.fingerprint === fingerprint &&
        isProjectServicePro(project) && ["simulation_pending", "simulation_active"].includes(existing.status)) return existing;
    if (!canPurchasePro(project)) throw new Error("请在出海机会报告生成后购买 Pro，并确认项目未暂停");
    if (existing && (existing.paymentMode || !["inquiry", "quoted", "accepted", ...(isTrialPro(project) ? ["trial_active"] : [])].includes(existing.status))) throw new Error("当前项目已有服务订单，请刷新后查看");
    if (existing && await hasHistoricalPayment(tx, existing.id)) throw new Error("此订单已有付款或凭证记录，请先核对原订单，不要重复购买");
    if (isTrialPro(project) && !await completedProTrial(tx, project)) throw new Error("请先完成当前试用轮的复盘，再购买后续三轮");
    const quote = proQuote(isTrialPro(project) ? { ...project, round: project.round + 1 } : project);
    if (quote.fingerprint !== fingerprint) throw new Error("报价或需求版本已更新，请刷新后重新确认");
    const values = { sku: "首客 Pro · 项目服务", quoteFen: quote.quoteFen, quoteVersion: (existing?.quoteVersion ?? 0) + 1,
      pricingSnapshot: quote, paymentMode: "simulated" as const, status: "simulation_pending" };
    const [order] = existing
      ? await tx.update(orders).set(values).where(eq(orders.id, existing.id)).returning()
      : await tx.insert(orders).values({ ...values, projectId }).returning();
    await tx.insert(purchasePayments).values({ orderId: order.id, provider: "simulated", amountFen: quote.quoteFen });
    await tx.insert(decisions).values({ projectId, gate: "quote", subjectId: order.id, subjectVersion: order.quoteVersion,
      actorRole: "customer", verdict: "approve", reason: "客户确认自动计价的项目服务范围与报价",
      snapshot: { quoteFingerprint: quote.fingerprint, amountFen: quote.quoteFen, scopeVersion: project.scopeVersion, paymentMode: "simulated",
        previousOrder: existing ? { quoteFen: existing.quoteFen, quoteVersion: existing.quoteVersion, status: existing.status, proposal: existing.proposal } : null } });
    await transition(tx, project, "awaiting_payment", "customer", "客户接受项目报价，进入支付", {
      productPlan: "pro", requiresPayment: false, proAccessSource: isTrialPro(project) ? "trial" : "simulation",
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
    if (project.paused || project.status !== "awaiting_payment" || order.status !== "simulation_pending" || !isProjectServicePro(project)) throw new Error("当前项目暂不能完成付款，请刷新后查看进度");
    if (isTrialPro(project)) await assertTrialProjectAccess(tx, project);
    const firstPaidRound = isTrialPro(project) ? project.round + 1 : project.round;
    if (quote.projectId !== projectId || quote.requirementVersion !== project.requirementVersion || quote.scopeVersion !== project.scopeVersion || quote.round !== firstPaidRound) throw new Error("需求版本已更新，请重新确认报价");
    // Verification uses the persisted amount and identity, never a client paid flag.
    const result = await provider.verify({ paymentId: payment.id, orderId: order.id, amountFen: quote.quoteFen, currency: "CNY" });
    if (result.status !== "succeeded" || result.provider !== payment.provider || result.paymentId !== payment.id ||
        result.orderId !== order.id || result.amountFen !== quote.quoteFen || result.currency !== "CNY" || !result.reference) {
      throw new Error("付款尚未通过校验，请重试");
    }
    await tx.update(purchasePayments).set({ status: "succeeded", reference: result.reference, completedAt: new Date() }).where(eq(purchasePayments.id, payment.id));
    await tx.update(orders).set({ status: "simulation_active", deliveryStatus: "not_started" }).where(eq(orders.id, order.id));
    const snapshot = { method: "simulated", paymentId: payment.id, orderId: order.id, reference: result.reference,
      amountFen: quote.quoteFen, currency: quote.currency, pricingVersion: quote.version, quoteFingerprint: quote.fingerprint,
      requirementVersion: project.requirementVersion, scopeVersion: project.scopeVersion, round: quote.round };
    await tx.insert(decisions).values([
      { projectId, gate: "payment", subjectId: payment.id, subjectVersion: order.quoteVersion, actorRole: "system", verdict: "approve", reason: "模拟支付校验成功，不计入实际收款", snapshot },
      { projectId, gate: "pro_access", subjectId: order.id, subjectVersion: project.scopeVersion, actorRole: "system", verdict: "approve", reason: "付款校验后自动开通本项目 Pro", snapshot },
    ]);
    await transition(tx, project, "strategizing", "payment", "付款校验完成，自动开通项目并启动策略", {
      proAccessSource: "simulation", round: quote.round, failedFrom: null, failedReason: null,
    });
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
      !proRoundProgress(quote, project.round).covered) throw new Error("请先完成当前项目付款，或核对套餐剩余轮数");
}
