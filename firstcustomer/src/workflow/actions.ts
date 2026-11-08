import { createHash, randomBytes } from "node:crypto";
import { and, desc, eq, inArray } from "drizzle-orm";
import type { PositioningOption } from "@/agents/schemas";
import { cacheDocument } from "@/agents/tools";
import type { Db } from "@/db";
import {
  campaigns,
  claims,
  clarifications,
  decisions,
  evidenceItems,
  events,
  landingPages,
  leads,
  orders,
  payments,
  positionings,
  projectImages,
  projects,
  stateTransitions,
} from "@/db/schema";
import { detectImageType, imageError } from "@/domain/images";
import {
  decisionError,
  gateState,
  type ActorRole,
  type Gate,
  type Verdict,
} from "@/domain/approval";
import { expiresAt, gradeFor, verifyQuote, type EvidenceKind } from "@/domain/evidence";
import { isPurchasedPro, isSelfServicePro, type ProjectStatus } from "@/domain/workflow";
import { assertAccountProjectAccess } from "./membership";
import { reportFor, type Escalation, type PendingRequest } from "./engine";
import { transition } from "./transitions";
import { evidenceTraceProblems } from "./provenance";
import { recordRequirementVersion } from "./requirements";
import { workPackageReadiness } from "./work-packages";
import { MAX_AMOUNT_FEN } from "./commerce";

export type Enqueue = (projectId: string, transaction?: Db) => Promise<void>;

export const hashToken = (token: string) =>
  createHash("sha256").update(token).digest("hex");

const newToken = () => randomBytes(32).toString("base64url");

async function getProject(db: Db, projectId: string) {
  const [project] = await db.select().from(projects).where(eq(projects.id, projectId));
  if (!project) throw new Error("项目不存在");
  return project;
}

export async function findProjectByToken(db: Db, token: string) {
  const [project] = await db
    .select()
    .from(projects)
    .where(eq(projects.tokenHash, hashToken(token)));
  return project ?? null;
}

export async function createProject(
  db: Db,
  input: {
    productName: string;
    productUrl?: string | null;
    stage: string;
    goal: string;
    targetMarket?: string | null;
    budgetNote?: string | null;
    currentWorkflow?: string;
    successCriteria?: string;
    constraints?: string;
    contact: string;
    customerId?: string | null;
    isOwnProduct?: boolean;
    productPlan?: "free";
  },
) {
  const token = newToken();
  return db.transaction(async (tx) => {
    const [project] = await tx
      .insert(projects)
      .values({ ...input, requiresPayment: true, tokenHash: hashToken(token) })
      .returning();
    if (project.productPlan !== "free") {
      await tx.insert(orders).values({ projectId: project.id, sku: "首客启动包" });
    }
    await recordRequirementVersion(tx, project, project.productPlan === "free" ? "customer" : "founder", "确认提交项目资料");
    return { project, token };
  });
}

export async function regenerateProjectLink(db: Db, projectId: string) {
  const token = newToken();
  await db
    .update(projects)
    .set({ tokenHash: hashToken(token), updatedAt: new Date() })
    .where(eq(projects.id, projectId));
  return token;
}

export async function setOwnProduct(db: Db, projectId: string, isOwnProduct: boolean) {
  const project = await getProject(db, projectId);
  if (project.productPlan !== "legacy") throw new Error("客户自助项目不能切换为首客自有产品");
  const changed = await db
    .update(projects)
    .set({ isOwnProduct, updatedAt: new Date() })
    .where(and(eq(projects.id, projectId), eq(projects.productPlan, "legacy"),
      project.requiresPayment ? eq(projects.status, "submitted") : undefined))
    .returning({ id: projects.id });
  if (!changed.length) throw new Error("请在免费分析出海机会前标记自有产品");
}

export async function startResearch(db: Db, enqueue: Enqueue, projectId: string) {
  const project = await getProject(db, projectId);
  await transition(db, project, "researching", "founder", "老板开始研究");
  await enqueue(projectId);
}

// 已填的回答先保存，全部回答完才继续研究。
export async function answerClarifications(
  db: Db,
  enqueue: Enqueue,
  input: { projectId: string; answers: Record<string, string>; by: ActorRole; version?: number },
) {
  return db.transaction(async (tx) => {
    let [project] = await tx.select().from(projects).where(eq(projects.id, input.projectId)).for("update");
    if (!project || project.status !== "needs_info" || project.paused) throw new Error("现在不需要补充信息，或项目已暂停");
    if (input.version !== undefined && input.version !== project.requirementVersion) throw new Error("需求版本已更新，请刷新后补充");
    const questions = await tx.select().from(clarifications).where(and(eq(clarifications.projectId, project.id), eq(clarifications.scopeVersion, project.scopeVersion)));
    const ids = new Set(questions.map((question) => question.id));
    if (Object.keys(input.answers).some((id) => !ids.has(id))) throw new Error("补充问题不属于当前项目范围");
    let remaining = 0;
    let changed = false;
    for (const question of questions) {
      const answer = input.answers[question.id]?.trim();
      if (answer && answer.length > 2000) throw new Error("每个回答最多 2000 字");
      if (answer && answer !== question.answer) {
        await tx.update(clarifications).set({ answer, answeredBy: input.by, answeredAt: new Date() }).where(eq(clarifications.id, question.id));
        changed = true;
      } else if (!answer && !question.answer) remaining++;
    }
    if (changed) {
      [project] = await tx.update(projects).set({ requirementVersion: project.requirementVersion + 1, updatedAt: new Date() })
        .where(eq(projects.id, project.id)).returning();
      await recordRequirementVersion(tx, project, input.by, "保存补充回答");
    }
    if (remaining > 0) return { complete: false, remaining };
    await transition(tx, project, "researching", input.by, "问题已回答");
    await enqueue(project.id, tx);
    return { complete: true, remaining: 0 };
  });
}

export async function skipClarifications(db: Db, enqueue: Enqueue, projectId: string) {
  const project = await getProject(db, projectId);
  await transition(db, project, "researching", "founder", "老板决定不再等客户回答", { clarificationsClosed: true });
  await enqueue(projectId);
}

export async function addProjectImage(
  db: Db,
  input: {
    projectId: string;
    bytes: Uint8Array;
    kind: "product" | "competitor";
    note?: string | null;
    uploadedBy: ActorRole;
  },
) {
  const project = await getProject(db, input.projectId);
  if (project.status === "delivered" || project.status === "cancelled") {
    throw new Error("项目已结束，不能再上传截图");
  }
  const existing = await db
    .select({ id: projectImages.id })
    .from(projectImages)
    .where(eq(projectImages.projectId, input.projectId));
  const problem = imageError(input.bytes, existing.length);
  if (problem) throw new Error(problem);
  await db.insert(projectImages).values({
    projectId: input.projectId,
    kind: input.kind,
    scopeVersion: project.scopeVersion,
    note: input.note || null,
    mimeType: detectImageType(input.bytes) as string,
    sizeBytes: input.bytes.length,
    data: Buffer.from(input.bytes),
    uploadedBy: input.uploadedBy,
  });
}

export async function deleteProjectImage(db: Db, projectId: string, imageId: string) {
  await db
    .delete(projectImages)
    .where(and(eq(projectImages.id, imageId), eq(projectImages.projectId, projectId)));
}

export async function retryFailedImages(db: Db, projectId: string) {
  await db
    .update(projectImages)
    .set({ analysisStatus: "pending", analysisError: null })
    .where(and(eq(projectImages.projectId, projectId), eq(projectImages.analysisStatus, "failed")));
}

const GATE_STATUS: Record<Gate, ProjectStatus> = {
  positioning: "awaiting_positioning",
  publish: "awaiting_publish",
  next_round: "reviewing",
};

async function latestPage(db: Db, projectId: string) {
  const [page] = await db
    .select()
    .from(landingPages)
    .where(eq(landingPages.projectId, projectId))
    .orderBy(desc(landingPages.version))
    .limit(1);
  return page;
}

async function latestPositioning(db: Db, projectId: string) {
  const [row] = await db
    .select()
    .from(positionings)
    .where(eq(positionings.projectId, projectId))
    .orderBy(desc(positionings.version))
    .limit(1);
  return row;
}

async function subjectVersion(db: Db, project: typeof projects.$inferSelect, gate: Gate) {
  if (gate === "positioning") return project.positioningVersion;
  if (gate === "publish") return (await latestPage(db, project.id))?.version ?? 0;
  return project.round;
}

export async function gateStatusFor(db: Db, project: typeof projects.$inferSelect, gate: Gate) {
  const version = await subjectVersion(db, project, gate);
  const rows = await db.select().from(decisions).where(eq(decisions.projectId, project.id));
  return { version, state: gateState(rows, gate, version, !isSelfServicePro(project)) };
}

export async function decide(
  db: Db,
  enqueue: Enqueue,
  input: {
    projectId: string;
    gate: Gate;
    actor: ActorRole;
    verdict: Verdict;
    reason?: string | null;
    chosenOption?: number | null;
    version?: number;
  },
) {
  await db.transaction(async (tx) => {
    const stageEnqueue: Enqueue = async (projectId) => { await enqueue(projectId, tx); };
    const { projectId, gate, actor, verdict } = input;
    const [project] = await tx.select().from(projects).where(eq(projects.id, projectId)).for("update");
    if (!project) throw new Error("项目不存在");
    if (project.status !== GATE_STATUS[gate]) {
      throw new Error("当前阶段不能做这个决定");
    }
    await assertAccountProjectAccess(tx, project);
    if (gate === "next_round" && isPurchasedPro(project)) throw new Error("本次 Pro 服务包含当前一轮验证，请完成本轮后另行确认新的服务范围");
    if (verdict === "reject" && !input.reason?.trim()) {
      throw new Error("退回时必须写明原因");
    }
    const report = gate === "next_round" ? await reportFor(tx, project) : null;
    const nextHypothesis = (report?.content as { next_hypothesis?: string | null } | undefined)
      ?.next_hypothesis;
    if (gate === "next_round" && !nextHypothesis) {
      throw new Error("没有达到判定样本或没有下一轮假设，不能开启下一轮");
    }

    const { version, state } = await gateStatusFor(tx, project, gate);
    if (input.version !== undefined && input.version !== version) throw new Error("这个版本已更新，请刷新后确认");
    const blocked = decisionError(state, actor);
    if (blocked) throw new Error(blocked);

    const positioning = gate === "positioning" ? await latestPositioning(tx, projectId) : null;
    if (positioning && (actor === "founder" || isSelfServicePro(project)) && verdict === "approve") {
      const options = positioning.options as PositioningOption[];
      const chosen = input.chosenOption ?? positioning.recommendedOption;
      if (!options[chosen]) throw new Error("选择的方案不存在");
      await tx
        .update(positionings)
        .set({ chosenOption: chosen })
        .where(eq(positionings.id, positioning.id));
    }

    await tx.insert(decisions).values({
      projectId,
      gate,
      subjectVersion: version,
      actorRole: actor,
      verdict,
      reason: input.reason ?? null,
    });

    if (verdict === "reject") {
      await applyRejection(tx, stageEnqueue, project, gate, actor, input.reason as string);
      return;
    }
    const after = await gateStatusFor(tx, project, gate);
    if (after.state.complete) {
      await applyApproval(tx, stageEnqueue, project, gate, nextHypothesis ?? null);
    }
  });
}

async function applyRejection(
  db: Db,
  enqueue: Enqueue,
  project: typeof projects.$inferSelect,
  gate: Gate,
  actor: ActorRole,
  reason: string,
) {
  if (gate === "next_round") return;
  const pending: PendingRequest = {
    route: "rejected",
    request: { missing: reason, reason: `${actor === "founder" ? "老板" : "客户"}退回`, source_types: [] },
  };
  if (gate === "positioning") {
    await db
      .update(positionings)
      .set({ chosenOption: null })
      .where(
        and(
          eq(positionings.projectId, project.id),
          eq(positionings.version, project.positioningVersion),
        ),
      );
    await transition(db, project, "strategizing", actor, reason, { pendingRequest: pending });
  } else {
    const page = await latestPage(db, project.id);
    if (page) {
      await db.update(landingPages).set({ status: "superseded" }).where(eq(landingPages.id, page.id));
    }
    await transition(db, project, "preparing_page", actor, reason, { pendingRequest: pending });
  }
  await enqueue(project.id);
}

async function applyApproval(
  db: Db,
  enqueue: Enqueue,
  project: typeof projects.$inferSelect,
  gate: Gate,
  nextHypothesis: string | null,
) {
  if (gate === "positioning") {
    await transition(db, project, "preparing_page", "customer", "定位已确认");
    await enqueue(project.id);
    return;
  }
  if (gate === "publish") {
    const page = await latestPage(db, project.id);
    if (!page || page.status !== "checked" || page.positioningVersion !== project.positioningVersion) {
      throw new Error("当前没有通过声明检查的页面版本");
    }
    const bindings = await db.select().from(claims).where(eq(claims.landingPageId, page.id));
    const referenced = bindings.flatMap((claim) => claim.evidenceId ? [claim.evidenceId] : []);
    const problems = await evidenceTraceProblems(db, project.id, referenced);
    const currentEvidence = referenced.length ? await db.select().from(evidenceItems).where(inArray(evidenceItems.id, referenced)) : [];
    if (bindings.some((claim) => !claim.evidenceId) || problems.length || currentEvidence.some((item) =>
      item.status !== "verified" || item.expiresAt <= new Date() || !["public_reference", "customer_authorized", "permitted"].includes(item.licenseStatus))) {
      throw new Error("发布前引用检查失败：来源链不完整或证据已失效");
    }
    await db.transaction(async (tx) => {
      await tx
        .update(landingPages)
        .set({ status: "superseded" })
        .where(and(eq(landingPages.projectId, project.id), eq(landingPages.status, "published")));
      await tx
        .update(landingPages)
        .set({ status: "published", publishedAt: new Date() })
        .where(eq(landingPages.id, page.id));
      await tx
        .update(campaigns)
        .set({ status: "approved" })
        .where(eq(campaigns.landingPageId, page.id));
    });
    await transition(db, project, "published", "customer", `页面第 ${page.version} 版已发布`);
    await transition(db, { id: project.id, status: "published" }, "collecting", "system", null);
    return;
  }
  const pending: PendingRequest = {
    route: "growth->strategy",
    request: {
      missing: nextHypothesis as string,
      reason: "上一轮实验未达到预设标准",
      source_types: [],
    },
  };
  await transition(db, project, "strategizing", "customer", "开启下一轮实验", {
    round: project.round + 1,
    pendingRequest: pending,
  });
  await enqueue(project.id);
}

export async function startReview(db: Db, enqueue: Enqueue, projectId: string, actor: ActorRole = "founder") {
  await db.transaction(async (tx) => {
    const [project] = await tx.select().from(projects).where(eq(projects.id, projectId)).for("update");
    if (!project || project.paused) throw new Error("项目不存在或已暂停");
    if (actor === "customer") {
      if (!isSelfServicePro(project)) throw new Error("此项目不支持客户自助启动复盘");
      await assertAccountProjectAccess(tx, project);
    }
    if (project.status === "reviewing") return;
    await transition(tx, project, "reviewing", actor, actor === "customer" ? "客户从 Pro 模块开始复盘" : "老板开始复盘");
    await enqueue(projectId, tx);
  });
}

export async function setPaused(db: Db, enqueue: Enqueue, projectId: string, paused: boolean) {
  const changed = await db.transaction(async (tx) => {
    const [project] = await tx.select().from(projects).where(eq(projects.id, projectId)).for("update");
    if (!project || ["delivered", "cancelled"].includes(project.status)) throw new Error("该项目无法暂停或恢复");
    if (project.paused === paused) return false;
    await tx.update(projects).set({ paused, updatedAt: new Date() }).where(eq(projects.id, projectId));
    await tx.insert(stateTransitions).values({
      projectId, fromStatus: project.status, toStatus: project.status, actor: "founder",
      reason: paused ? "老板暂停项目" : "老板恢复项目",
    });
    return true;
  });
  if (changed && !paused) await enqueue(projectId);
}

// 交付后由客户验收；验收不改变项目状态，只记录决定和订单的交付状态。
export async function acceptDelivery(
  db: Db,
  input: { projectId: string; verdict: Verdict; reason?: string | null; stamp?: string },
) {
  if (input.verdict === "reject" && !input.reason?.trim()) throw new Error("请写明哪里需要改");
  await db.transaction(async (tx) => {
    const [project] = await tx.select().from(projects).where(eq(projects.id, input.projectId)).for("update");
    if (project?.status !== "delivered") throw new Error("项目交付后才能验收");
    const [order] = await tx.select().from(orders).where(eq(orders.projectId, project.id));
    if (!order || order.deliveryStatus === "accepted") throw new Error("项目已完成验收或没有订单");
    const report = await reportFor(tx, project);
    const readiness = await workPackageReadiness(tx, project);
    if (input.stamp !== undefined && input.stamp !== readiness.stamp) throw new Error("交付版本已变化，请刷新后核对");
    if (input.verdict === "approve" && !readiness.ready) throw new Error("交付材料尚未通过核对，暂不能确认验收");
    await tx.insert(decisions).values({
      projectId: project.id, subjectId: report?.id, gate: "acceptance", subjectVersion: project.round, actorRole: "customer",
      verdict: input.verdict, reason: input.reason ?? null, snapshot: readiness.snapshot,
    });
    await tx.update(orders).set({ deliveryStatus: input.verdict === "approve" ? "accepted" : "changes_requested" })
      .where(eq(orders.id, order.id));
  });
}

export async function setLeadTest(db: Db, projectId: string, leadId: string, isTest: boolean) {
  const pages = db.select({ id: landingPages.id }).from(landingPages).where(eq(landingPages.projectId, projectId));
  await db
    .update(leads)
    .set({ isTest })
    .where(and(eq(leads.id, leadId), inArray(leads.landingPageId, pages)));
}

export async function deliverProject(db: Db, projectId: string, stamp?: string, actor: ActorRole = "founder") {
  await db.transaction(async (tx) => {
    const [project] = await tx.select().from(projects).where(eq(projects.id, projectId)).for("update");
    if (!project) throw new Error("项目不存在");
    if (actor === "customer") {
      if (!isSelfServicePro(project) || project.paused) throw new Error("此项目当前无法自助完成交付");
      await assertAccountProjectAccess(tx, project);
    }
    const report = await reportFor(tx, project);
    if (!report) throw new Error("复盘报告还没有生成");
    const readiness = await workPackageReadiness(tx, project);
    if (stamp !== undefined && stamp !== readiness.stamp) throw new Error("交付版本已变化，请刷新后核对");
    if (!readiness.ready) throw new Error(`交付检查未通过：${readiness.packages.flatMap((item) => item.checks.filter((check) => !check.passed).map((check) => check.label)).join("；")}`);
    await transition(tx, project, "delivered", actor, actor === "customer" ? "客户确认完成本轮交付" : "老板确认交付");
    await tx.update(orders).set({ deliveryStatus: "delivered" }).where(eq(orders.projectId, projectId));
    await tx.insert(decisions).values({
      projectId, subjectId: report.id, gate: "acceptance", subjectVersion: project.round,
      actorRole: actor, verdict: "approve", reason: actor === "customer" ? "客户确认完成本轮交付" : "老板确认交付", snapshot: readiness.snapshot,
    });
  });
}

export async function retryProject(db: Db, enqueue: Enqueue, projectId: string) {
  const project = await getProject(db, projectId);
  if (project.status !== "failed" || !project.failedFrom) throw new Error("项目不在失败状态");
  await transition(db, project, project.failedFrom as ProjectStatus, "founder", "老板重试", {
    failedFrom: null,
    failedReason: null,
  });
  await enqueue(projectId);
}

export async function cancelProject(db: Db, projectId: string) {
  const project = await getProject(db, projectId);
  await transition(db, project, "cancelled", "founder", "老板取消");
}

export async function resolveEscalation(
  db: Db,
  enqueue: Enqueue,
  input: { projectId: string; target: "researching" | "strategizing" | "preparing_page"; note: string },
) {
  const project = await getProject(db, input.projectId);
  if (project.status !== "awaiting_founder" || !project.escalation) {
    throw new Error("项目不在等待裁决状态");
  }
  if (!input.note.trim()) throw new Error("裁决时必须写明决定");
  const escalation = project.escalation as Escalation;
  if (escalation.route === "clarification-limit" && input.target !== "researching") throw new Error("补充信息超限后请先回到研究，未确认的内容列为未知");
  await db.insert(decisions).values({
    projectId: project.id,
    gate: "escalation",
    subjectVersion: project.round,
    actorRole: "founder",
    verdict: "approve",
    reason: `${escalation.route}：${input.note}`,
  });
  await transition(db, project, input.target, "founder", input.note, {
    escalation: null,
    pendingRequest: null,
    founderNote: input.note,
  });
  await enqueue(project.id);
}

export async function markCampaignExecuted(db: Db, campaignId: string, url: string) {
  const parsed = new URL(url);
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("执行凭证必须是网页链接");
  }
  const rows = await db
    .update(campaigns)
    .set({ status: "executed", executedUrl: url, executedAt: new Date() })
    .where(and(eq(campaigns.id, campaignId), eq(campaigns.status, "approved")))
    .returning({ id: campaigns.id });
  if (!rows.length) throw new Error("只有获得批准的活动才能标记已执行");
}

export async function recordFeedback(
  db: Db,
  input: { landingPageId: string; type: "reply" | "comment"; text: string; url?: string | null },
) {
  await db.insert(events).values({
    landingPageId: input.landingPageId,
    type: input.type,
    payload: { text: input.text, url: input.url ?? null },
  });
}

export async function setQuote(db: Db, projectId: string, quoteFen: number) {
  if (!Number.isSafeInteger(quoteFen) || quoteFen <= 0 || quoteFen > MAX_AMOUNT_FEN) throw new Error("请填写正确的报价金额");
  await db.transaction(async (tx) => {
    const [project] = await tx.select().from(projects).where(eq(projects.id, projectId)).for("update");
    if (!project) throw new Error("项目不存在");
    if (project.requiresPayment || project.productPlan !== "legacy") throw new Error("请通过项目报价审批确认报价");
    if (project.paused || project.status === "cancelled") throw new Error("暂停或取消的项目不能修改报价");
    const [order] = await tx.select().from(orders).where(eq(orders.projectId, projectId));
    if (!order) throw new Error("项目没有订单");
    if (["paid", "accepted", "key_activated"].includes(order.status)) throw new Error("已接受或已付款的订单不能直接改价");
    await tx.update(orders).set({ quoteFen, status: "quoted", quoteVersion: order.quoteVersion + 1 }).where(eq(orders.id, order.id));
    await tx.insert(decisions).values({ projectId, gate: "quote", subjectVersion: order.quoteVersion + 1,
      actorRole: "founder", verdict: "approve", reason: "老板更新旧版订单报价",
      snapshot: { orderId: order.id, previousQuoteFen: order.quoteFen, quoteFen } });
  });
}

export async function recordPayment(
  db: Db,
  projectId: string,
  input: { amountFen: number; method: string; reference?: string | null },
) {
  if (!Number.isSafeInteger(input.amountFen) || input.amountFen <= 0 || input.amountFen > MAX_AMOUNT_FEN) throw new Error("请填写正确的实收金额");
  if (!input.method.trim() || input.method.length > 200 || (input.reference?.length ?? 0) > 200) throw new Error("请检查收款方式与交易备注");
  await db.transaction(async (tx) => {
    const [project] = await tx.select().from(projects).where(eq(projects.id, projectId)).for("update");
    if (!project) throw new Error("项目不存在");
    if (project.requiresPayment || project.productPlan !== "legacy") throw new Error("请通过项目到账审批记录实收");
    if (project.paused || project.status === "cancelled") throw new Error("暂停或取消的项目不能记录实收");
    const [order] = await tx.select().from(orders).where(eq(orders.projectId, projectId));
    if (!order) throw new Error("项目没有订单");
    const [existing] = await tx.select({ id: payments.id }).from(payments).where(eq(payments.orderId, order.id)).limit(1);
    if (existing || order.status === "paid") throw new Error("此订单已记录实收，请勿重复记账");
    const [payment] = await tx.insert(payments).values({ ...input, orderId: order.id }).returning({ id: payments.id });
    await tx.update(orders).set({ status: "paid" }).where(eq(orders.id, order.id));
    await tx.insert(decisions).values({ projectId, gate: "payment", subjectVersion: order.quoteVersion,
      actorRole: "founder", verdict: "approve", reason: "老板确认旧版订单实收",
      snapshot: { orderId: order.id, paymentId: payment.id, quoteFen: order.quoteFen, ...input } });
  });
}

export async function setFounderMinutes(db: Db, projectId: string, minutes: number) {
  if (!Number.isSafeInteger(minutes) || minutes < 0 || minutes > MAX_AMOUNT_FEN) throw new Error("人工分钟必须是有效的非负整数");
  await db.update(orders).set({ founderMinutes: minutes }).where(eq(orders.projectId, projectId));
}

// 老板人工补充证据，同样要过第一道证据闸门。
export async function addManualEvidence(
  db: Db,
  input: {
    projectId?: string | null;
    url: string;
    quote: string;
    sourceText: string;
    kind: EvidenceKind;
    stance: "support" | "against" | "neutral";
    product?: string | null;
    category?: string | null;
    numberValue?: string | null;
    metric?: string | null;
    customerAuthorized?: boolean;
    createdBy?: string;
    collectedAt?: Date;
  },
) {
  const check = verifyQuote(input.quote, input.sourceText);
  if (check.status === "rejected") throw new Error(check.reason);
  const url = new URL(input.url).toString();
  const collectedAt = input.collectedAt ?? new Date();
  const project = input.projectId ? await getProject(db, input.projectId) : null;
  const source = await cacheDocument(db, { url, title: input.product ?? url, text: input.sourceText }, {
    projectId: input.projectId ?? null, method: "manual_submission", actor: input.createdBy ?? "founder",
  });
  const [row] = await db
    .insert(evidenceItems)
    .values({
      projectId: input.projectId ?? null,
      scopeVersion: project?.scopeVersion ?? 1,
      sourceVersionId: source.id,
      product: input.product ?? null,
      category: input.category ?? null,
      kind: input.kind,
      stance: input.stance,
      numberValue: input.numberValue ?? null,
      metric: input.metric ?? null,
      url,
      sourceName: new URL(url).hostname.replace(/^www\./, ""),
      excerpt: input.quote,
      grade: gradeFor(input.kind, url, { customerAuthorized: input.customerAuthorized }),
      status: check.status,
      matchScore: check.score,
      licenseStatus: input.customerAuthorized ? "customer_authorized" : "public_reference",
      createdBy: input.createdBy ?? "founder",
      collectedAt,
      expiresAt: expiresAt(input.kind, collectedAt),
    })
    .returning();
  return row;
}
