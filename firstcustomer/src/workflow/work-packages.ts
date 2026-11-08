import { createHash } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "@/db";
import { agentTasks, campaigns, decisions, deliverables, evidenceItems, landingPages, positionings, projects, orders, payments } from "@/db/schema";
import { experimentPlan } from "@/agents/schemas";
import { gateState } from "@/domain/approval";
import { evaluateExperiment } from "@/domain/experiment";
import { isAccountPro, isKeyActivatedPro, isPurchasedPro, isSelfServicePro } from "@/domain/workflow";
import { projectPurchasePayment } from "./purchases";
import { loadProjectProvenance } from "./provenance";

type Project = typeof projects.$inferSelect;
type Check = { label: string; passed: boolean };
export type WorkPackage = {
  key: string; label: string; version: string; attempts: number; costYuan: number;
  artifact: string | null; status: "verified" | "waiting" | "failed"; checks: Check[];
};
const reportSchema = z.object({ summary: z.string().trim().min(1), verdict: z.enum(["insufficient", "passed", "failed"]),
  experiment: experimentPlan, metrics: z.object({ visits: z.number().int().nonnegative(), leads: z.number().int().nonnegative(),
    ctaClicks: z.number().int().nonnegative(), replies: z.number().int().nonnegative() }) });

// Verification reads persisted artifacts and approvals, not the generator's self-rating.
export async function workPackageReadiness(db: Db, project: Project) {
  const [tasks, [positioning], [page], [report], approvals, evidence] = await Promise.all([
    db.select().from(agentTasks).where(and(eq(agentTasks.projectId, project.id), eq(agentTasks.scopeVersion, project.scopeVersion))),
    db.select().from(positionings).where(eq(positionings.projectId, project.id)).orderBy(desc(positionings.version)).limit(1),
    db.select().from(landingPages).where(eq(landingPages.projectId, project.id)).orderBy(desc(landingPages.version)).limit(1),
    db.select().from(deliverables).where(and(eq(deliverables.projectId, project.id), eq(deliverables.kind, "report"), eq(deliverables.round, project.round))).orderBy(desc(deliverables.createdAt)).limit(1),
    db.select().from(decisions).where(eq(decisions.projectId, project.id)),
    db.select().from(evidenceItems).where(and(eq(evidenceItems.projectId, project.id), eq(evidenceItems.scopeVersion, project.scopeVersion))),
  ]);
  const [campaign] = page ? await db.select().from(campaigns).where(eq(campaigns.landingPageId, page.id)).limit(1) : [];
  const research = tasks.filter((task) => task.agent === "research" && task.status === "succeeded")
    .sort((a,b) => b.startedAt.getTime() - a.startedAt.getTime())
    .find((task) => (task.output as { status?: string } | null)?.status === "done");
  const researchOutput = research?.output as { candidates?: { evidence_ids: string[] }[]; summary?: string } | undefined;
  const ids = researchOutput?.candidates?.flatMap((candidate) => candidate.evidence_ids) ?? [];
  const provenance = await loadProjectProvenance(db, project.id);
  const traceIds = new Set(provenance.evidence.filter((item) => item.complete && item.scopeVersion === project.scopeVersion).map((item) => item.id));
  const parsedReport = reportSchema.safeParse(report?.content);
  const currentExperiment = experimentPlan.safeParse(positioning?.experiment);
  const packages: WorkPackage[] = [];
  const add = (key: string, label: string, artifact: string | null, checks: Check[]) => {
    const attempts = tasks.filter((task) => task.agent === key && (key === "research" || task.round === project.round)).sort((a,b) => a.startedAt.getTime() - b.startedAt.getTime());
    packages.push({ key, label, artifact, version: `范围 ${project.scopeVersion} · 第 ${project.round} 轮`,
      attempts: attempts.length, costYuan: attempts.reduce((sum, task) => sum + task.listCostYuan, 0), checks,
      status: attempts.at(-1)?.status === "failed" ? "failed" : checks.every((check) => check.passed) ? "verified" : "waiting" });
  };
  add("research", "出海机会分析", research?.id ?? null, [
    { label: "机会分析摘要与候选人群已保存", passed: Boolean(researchOutput?.summary?.trim() && researchOutput.candidates?.length) },
    { label: "引用证据属于当前范围且已核对、未过期", passed: ids.length > 0 && ids.every((id) => evidence.some((item) => item.id === id && item.status === "verified" && item.expiresAt >= new Date())) },
    { label: "引用材料有不可变来源版本和溯源记录", passed: ids.length > 0 && ids.every((id) => traceIds.has(id)) && provenance.conclusions.some((row) => row.subjectId === research?.id && row.complete) },
  ]);
  if (project.productPlan !== "free") {
    if (isPurchasedPro(project)) {
      const [order] = await db.select().from(orders).where(eq(orders.projectId, project.id)).limit(1);
      const payment = order ? await projectPurchasePayment(db, order.id) : null;
      const quote = order?.pricingSnapshot;
      const grant = approvals.find((item) => item.gate === "pro_access" && item.subjectVersion === project.scopeVersion &&
        item.verdict === "approve" && (item.snapshot as { paymentId?: string } | null)?.paymentId === payment?.id);
      add("commerce", "项目服务付款核验", payment?.id ?? null, [
        { label: "支付订单金额与当前报价一致", passed: Boolean(quote && payment?.amountFen === quote.quoteFen && order?.quoteFen === quote.quoteFen) },
        { label: "付款校验及项目开通记录已保存", passed: order?.status === "simulation_active" && payment?.status === "succeeded" && Boolean(grant) },
        { label: "购买权益对应当前项目范围", passed: quote?.projectId === project.id && quote.scopeVersion === project.scopeVersion && quote.round === project.round },
      ]);
    } else if (isAccountPro(project)) {
      const [order] = await db.select().from(orders).where(eq(orders.projectId, project.id)).limit(1);
      const grant = approvals.find((item) => item.gate === "pro_access" && item.verdict === "approve" && (item.snapshot as { method?: string } | null)?.method === "account");
      add("commerce", "Pro 账号权益", grant?.id ?? null, [
        { label: "当前项目使用 Pro 账号权益", passed: order?.status === "account_active" },
        { label: "账号权益开通记录已保存", passed: Boolean(grant) },
      ]);
    } else if (isKeyActivatedPro(project)) {
      const [order] = await db.select().from(orders).where(eq(orders.projectId, project.id)).limit(1);
      const grant = approvals.find((item) => item.gate === "pro_access" && item.verdict === "approve" && item.subjectVersion === project.scopeVersion);
      add("commerce", "Pro 密钥授权", grant?.id ?? null, [
        { label: "当前项目已通过密钥开通 Pro", passed: order?.status === "key_activated" },
        { label: "当前范围的密钥开通记录已保存", passed: Boolean(grant) },
      ]);
    } else if (project.requiresPayment && !project.isOwnProduct) {
      const [order] = await db.select().from(orders).where(eq(orders.projectId, project.id)).limit(1);
      const [payment] = order ? await db.select().from(payments).where(eq(payments.orderId, order.id)).limit(1) : [];
      add("commerce", "服务费用核对", payment?.id ?? null, [
        { label: "提案已接受且订单记录为已付款", passed: order?.status === "paid" && Boolean(order.proposal) },
        { label: "实际到账记录已保存", passed: Boolean(payment && payment.amountFen > 0) },
      ]);
    }
    add("strategy", "定位与验证计划", positioning?.id ?? null, [
      { label: "定位方案与实验计划已保存", passed: Boolean(positioning && experimentPlan.safeParse(positioning.experiment).success && positioning.chosenOption !== null) },
      { label: isSelfServicePro(project) ? "客户已确认当前定位版本" : "老板和客户已确认当前定位版本", passed: Boolean(positioning && gateState(approvals, "positioning", positioning.version, !isSelfServicePro(project)).complete) },
    ]);
    add("launch", "英文页面与渠道行动", page?.id ?? null, [
      { label: "当前定位对应的页面已发布", passed: Boolean(page?.status === "published" && page.publishedAt && page.positioningVersion === positioning?.version) },
      { label: isSelfServicePro(project) ? "客户已确认当前页面版本" : "当前页面版本已通过双方审批", passed: Boolean(page && gateState(approvals, "publish", page.version, !isSelfServicePro(project)).complete) },
      { label: "渠道行动卡已批准，实际执行状态单独记录", passed: Boolean(campaign && ["approved", "executed"].includes(campaign.status)) },
    ]);
    add("growth", "增长复盘", report?.id ?? null, [
      { label: "本轮复盘产物与指标已保存", passed: parsedReport.success },
      { label: "复盘使用当前定位的预设标准", passed: parsedReport.success && currentExperiment.success && JSON.stringify(parsedReport.data.experiment) === JSON.stringify(currentExperiment.data) },
      { label: "结论与预先标准、记录指标一致", passed: parsedReport.success && evaluateExperiment(parsedReport.data.experiment, parsedReport.data.metrics) === parsedReport.data.verdict },
    ]);
  }
  const stamp = createHash("sha256").update(JSON.stringify({ requirement: project.requirementVersion, scope: project.scopeVersion,
    round: project.round, research: research?.id, positioning: positioning?.id, page: page?.id, report: report?.id, campaign: campaign?.id,
    checks: packages.map((item) => item.checks.map((check) => check.passed)),
    reportContent: report?.content, pageContent: page?.content, positioningContent: positioning?.options, campaignContent: campaign,
  })).digest("hex");
  return { stamp, ready: packages.every((item) => item.status === "verified"), packages,
    channelExecuted: campaign?.status === "executed" && Boolean(campaign.executedUrl && campaign.executedAt),
    snapshot: { requirementVersion: project.requirementVersion, scopeVersion: project.scopeVersion, round: project.round,
      packages: packages.map(({ key, artifact, checks }) => ({ key, artifact, checks })), stamp } };
}
