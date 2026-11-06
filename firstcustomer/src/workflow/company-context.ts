import { desc, eq, sql } from "drizzle-orm";
import type { WeeklyOutput } from "@/agents/schemas";
import { hasModelListPrice } from "@/ai/call-model";
import type { Db } from "@/db";
import {
  agentTasks, campaigns, companyReports, companySettings, decisions, deliverables, evidenceItems,
  landingPages, leads, orders, payments, projects, stateTransitions, supportMessages,
} from "@/db/schema";
import { DECISION_LABELS } from "@/domain/approval";
import { STATUS_LABELS, type ProjectStatus } from "@/domain/workflow";
import { formatDateTime, formatYuan } from "@/lib/format";
import { operatingMetrics } from "./operating-metrics";
import type { ReportContent } from "./queries";

type SettingsInput = Pick<typeof companySettings.$inferInsert,
  "charter" | "brand" | "service" | "operations" | "forbiddenTerms">;

export async function getCompanySettings(db: Db) {
  const [settings] = await db.select().from(companySettings).where(eq(companySettings.id, 1));
  return settings ?? null;
}

export async function saveCompanySettings(db: Db, input: SettingsInput, confirm: boolean) {
  await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(23110802)`);
    const previous = await getCompanySettings(tx);
    const charter = input.charter?.replace(/\r\n?/g, "\n").trim() ?? "";
    const charterChanged = (previous?.charter ?? "").replace(/\r\n?/g, "\n").trim() !== charter;
    const charterVersion = (previous?.charterVersion ?? 0) + (charterChanged ? 1 : 0);
    if (confirm && !charter) throw new Error("先填写公司宪章，再确认闸门①");
    const addDecision = confirm && (charterChanged || !previous?.charterConfirmedAt);
    const charterConfirmedAt = addDecision ? new Date() : charterChanged ? null : previous?.charterConfirmedAt;
    const fields = { ...input, charter, charterVersion, charterConfirmedAt };
    await tx.insert(companySettings).values({ id: 1, ...fields }).onConflictDoUpdate({ target: companySettings.id, set: fields });
    if (addDecision) {
      await tx.insert(decisions).values({
        gate: "charter", subjectVersion: charterVersion, actorRole: "founder",
        verdict: "approve", reason: "老板确认公司宪章",
      });
    }
  });
}

const lines = (items: string[]) => items.length ? items.map((item) => `- ${item}`).join("\n") : "暂无记录。";
const title = (name: string, body: string) => `# ${name}\n\n${body}\n`;
const show = (value?: string | null) => value?.trim() || "待填写。";

export async function companyDocuments(db: Db) {
  const [settings, allProjects, evidence, inbox, orderRows, campaignRows, leadRows, cash, tasks, transitions, approvals, reviews, weekly, metrics] =
    await Promise.all([
      getCompanySettings(db),
      db.select({ id: projects.id, name: projects.productName, contact: projects.contact, own: projects.isOwnProduct, status: projects.status }).from(projects),
      db.select().from(evidenceItems).where(sql`${evidenceItems.projectId} is not null`).orderBy(desc(evidenceItems.createdAt)),
      db.select().from(supportMessages).orderBy(desc(supportMessages.createdAt)),
      db.select().from(orders),
      db.select().from(campaigns),
      db.select({ projectId: landingPages.projectId, email: leads.email, at: leads.createdAt, isTest: leads.isTest })
        .from(leads).innerJoin(landingPages, eq(landingPages.id, leads.landingPageId)),
      db.select({ projectId: orders.projectId, amount: payments.amountFen, at: payments.paidAt })
        .from(payments).innerJoin(orders, eq(orders.id, payments.orderId)),
      db.select({
        projectId: agentTasks.projectId, agent: agentTasks.agent, status: agentTasks.status, provider: agentTasks.provider,
        model: agentTasks.model, at: agentTasks.startedAt, error: agentTasks.error, sendBack: agentTasks.sendBackReason, cost: agentTasks.listCostYuan,
      }).from(agentTasks).orderBy(desc(agentTasks.startedAt)),
      db.select().from(stateTransitions).orderBy(desc(stateTransitions.createdAt)),
      db.select().from(decisions).orderBy(desc(decisions.createdAt)),
      db.select().from(deliverables).where(eq(deliverables.kind, "report")).orderBy(desc(deliverables.createdAt)),
      db.select().from(companyReports).where(eq(companyReports.kind, "weekly")).orderBy(desc(companyReports.createdAt)),
      operatingMetrics(db),
    ]);
  const projectById = new Map(allProjects.map((p) => [p.id, p]));
  const projectName = (id: string | null) => id ? (projectById.get(id)?.name ?? "已删除项目") : "首客";
  const hiddenContacts = new Set([...allProjects.map((item) => item.contact), ...leadRows.map((item) => item.email)]);
  const approvalsFor = (gates: string[]) => lines(approvals.filter((item) => gates.includes(item.gate))
    .map((item) => `${formatDateTime(item.createdAt)} · ${projectName(item.projectId)} · ${DECISION_LABELS[item.gate] ?? item.gate} · ${item.reason ?? item.verdict}`));

  const docs = [
    {
      name: "00-charter.md", body: title("公司宪章", `${show(settings?.charter)}\n\n闸门① ${settings?.charterConfirmedAt
        ? `第 ${settings.charterVersion} 版于 ${formatDateTime(settings.charterConfirmedAt)} 确认` : "待老板确认"}`),
    },
    {
      name: "01-market.md", body: title("市场与证据", lines(evidence.map((item) =>
        `${projectName(item.projectId)} · ${item.candidate ?? "通用"} · ${item.stance} · 等级 ${item.grade ?? "未知"} · ${item.status} · ${formatDateTime(item.collectedAt)}\n  - ${item.excerpt}\n  - 来源 ${item.url}`))),
    },
    {
      name: "02-brand.md", body: title("品牌语调", `${show(settings?.brand)}\n\n## 禁用词\n\n${lines(settings?.forbiddenTerms ?? [])}`),
    },
    {
      name: "03-product.md", body: title("服务定义", settings?.service || "免费初诊提供候选人群、支持和反面证据、待验证项。首客启动包提供定位、商业证据、英文验证页、单渠道行动与增长复盘。参考价 ¥299，实际以老板确认且客户接受的报价为准。"),
    },
    {
      name: "04-ops.md", body: title("运营与客服", `${show(settings?.operations)}\n\n## 闸门与权限\n\n${lines([
        "① 老板确认公司宪章", "② 声明证据由程序检查", "③ 定位和④发布先经老板把关，再由客户确认",
        "⑤ 老板确认报价、客户接受", "⑥ 老板确认实际到账", "⑦ 老板处理升级客服", "⑧ 老板记录周报决定", "⑨ 老板交付、客户验收",
        "经营台需老板登录。客户通过专属链接只访问自己的项目。海外访客仅可访问已发布页面。",
      ])}\n\n## 客服记录\n\n${lines(inbox.map((item) => `${projectName(item.projectId)} · ${item.risk ?? "未分级"} · ${item.question} → ${item.reply ?? "待处理"}`))}`),
    },
    {
      name: "05-pipeline.md", body: title("线索与订单", `## 项目\n\n${lines(allProjects.map((p) => `${p.name} · ${p.own ? "自有产品 · " : ""}${STATUS_LABELS[p.status as ProjectStatus] ?? p.status} · 联系方式 [已脱敏]`))}\n\n## 报价与订单\n\n${lines(orderRows.map((item) => `${projectName(item.projectId)} · ${item.sku} · ${item.status} · ${item.quoteFen === null ? "待报价" : formatYuan(item.quoteFen)} · ${item.deliveryStatus}`))}\n\n## 渠道执行\n\n${lines(campaignRows.map((item) => `${projectName(item.projectId)} · ${item.channel} · ${item.status}${item.executedUrl ? ` · ${item.executedUrl}` : ""}`))}\n\n## 留资\n\n${lines(leadRows.map((item) => `${projectName(item.projectId)} · ${formatDateTime(item.at)} · 邮箱 [已脱敏]${item.isTest ? " · 测试线索" : ""}`))}`),
    },
    {
      name: "06-finance.md", body: title("财务", `确认的外部客户实收 ${formatYuan(metrics.revenueFen)}。老板人工 ${metrics.founderMinutes} 分钟。已计价模型标价 ¥${metrics.modelCost.toFixed(2)}，${metrics.unpricedTasks} 个任务未计价。人工成本和其他支出未入账，毛利未知。\n\n## 到账\n\n${lines(cash.map((item) => `${projectName(item.projectId)} · ${formatYuan(item.amount)} · ${formatDateTime(item.at)}${projectById.get(item.projectId)?.own ? " · 自有产品，不计入首客实收" : ""}`))}`),
    },
    {
      name: "07-log.md", body: title("执行日志", `## 任务\n\n${lines(tasks.map((item) => `${formatDateTime(item.at)} · ${projectName(item.projectId)} · ${item.agent}/${item.status} · ${item.provider ?? "未返回"}/${item.model ?? "未知"} · ${item.provider === "stub" ? "模拟" : hasModelListPrice(item.model) ? `¥${item.cost.toFixed(4)}` : "未计价"}${item.sendBack || item.error ? ` · ${item.sendBack ?? item.error}` : ""}`))}\n\n## 状态变化\n\n${lines(transitions.map((item) => `${formatDateTime(item.createdAt)} · ${projectName(item.projectId)} · ${item.fromStatus} → ${item.toStatus} · ${item.actor}${item.reason ? ` · ${item.reason}` : ""}`))}\n\n## 闸门记录\n\n${lines(approvals.map((item) => `${formatDateTime(item.createdAt)} · ${projectName(item.projectId)} · ${DECISION_LABELS[item.gate] ?? item.gate}/第 ${item.subjectVersion} 版 · ${item.actorRole}/${item.verdict}${item.reason ? ` · ${item.reason}` : ""}`))}`),
    },
    {
      name: "08-review.md", body: title("经营复盘", `## 周报\n\n${lines(weekly.map((item) => `${formatDateTime(item.createdAt)} · ${(item.output as WeeklyOutput | null)?.summary ?? item.status}`))}\n\n## 增长复盘\n\n${lines(reviews.map((item) => `${projectName(item.projectId)} · 第 ${item.round} 轮 · ${(item.content as ReportContent).summary}`))}\n\n## 决策\n\n${approvalsFor(["weekly", "acceptance", "next_round"])}`),
    },
  ];
  return docs.map(({ name, body }) => {
    for (const contact of hiddenContacts) {
      if (contact.trim().length >= 5) body = body.replaceAll(contact.trim(), "[已脱敏]");
    }
    return {
      name,
      body: body.replace(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/giu, "[邮箱已脱敏]")
        .replace(/(?<![\d.])(?:\+\d{1,3}[ -]?)?(?:\d[ -]?){10,13}(?![\d.])/g, "[号码已脱敏]")
        .replace(/\/p\/[A-Za-z0-9_-]{43}(?=[^A-Za-z0-9_-]|$)/g, "/p/[专属链接已脱敏]"),
    };
  });
}
