import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { eq } from "drizzle-orm";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import EmbeddedPostgres from "embedded-postgres";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createDb, type Db } from "@/db";
import { companyReports, companySettings, decisions, events, landingPages, leads, orders, paymentReceipts, payments, projects, stateTransitions, supportMessages } from "@/db/schema";
import { recordPayment, setFounderMinutes, setQuote } from "@/workflow/actions";
import { confirmReceipt, decideQuote, uploadReceipt } from "@/workflow/commerce";
import { loadOwnerDashboard } from "@/workflow/owner-dashboard";
import { loadAuditLog } from "@/workflow/audit-log";
import { operatingMetrics } from "@/workflow/operating-metrics";

let db: Db;
let pg: EmbeddedPostgres;
let close: () => Promise<unknown>;
let dir: string;
const enqueue = vi.fn(async () => {});
const proposal = { scope: "海外首轮验证", deliverables: ["定位卡", "英文验证页"], timing: "双方确认后 7 天", terms: "不承诺成交" };
const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), "fc-owner-pg-"));
  pg = new EmbeddedPostgres({ databaseDir: dir, user: "test", password: "test", port: 54392,
    persistent: false, autoRehydrateSymlinks: true, onLog: () => {}, onError: () => {} });
  await pg.initialise(); await pg.start(); await pg.createDatabase("test");
  const created = createDb("postgres://test:test@127.0.0.1:54392/test");
  db = created.db; close = () => created.sql.end();
  await migrate(db, { migrationsFolder: "./drizzle" });
});
afterAll(async () => { await close?.(); await pg?.stop(); if (dir) rmSync(dir, { recursive: true, force: true }); });
beforeEach(async () => {
  await db.delete(projects); await db.delete(decisions); await db.delete(companyReports); await db.delete(companySettings);
  enqueue.mockClear();
});

async function fixture(patch: Partial<typeof projects.$inferInsert> = {}) {
  const [project] = await db.insert(projects).values({ tokenHash: crypto.randomUUID(), productName: "测试项目",
    contact: "test@example.com", stage: "MVP", goal: "验证需求", requiresPayment: true, status: "awaiting_quote", ...patch }).returning();
  const [order] = await db.insert(orders).values({ projectId: project.id, sku: "启动包", proposal, quoteFen: 29900, quoteVersion: 1 }).returning();
  return { project, order };
}

describe("老板经营台与真实数据口径", () => {
  it("汇总批价、客服、公司决策；客户等待与暂停不误算成批价", async () => {
    const { project: quote } = await fixture({ updatedAt: new Date(Date.now() - 25 * 3600000) });
    const { project: waiting } = await fixture({ status: "awaiting_payment" });
    const { project: paused } = await fixture({ paused: true });
    await db.insert(supportMessages).values({ projectId: waiting.id, question: "退款", status: "escalated" });
    const dashboard = await loadOwnerDashboard(db);
    expect(dashboard.counts).toMatchObject({ all: 4, quote: 1, risk: 1, operations: 1, company: 1, payment: 0 });
    expect(dashboard.queue[0]).toMatchObject({ projectId: quote.id, category: "quote", overdue: true });
    expect(dashboard.queue.find((item) => item.projectId === paused.id)).toMatchObject({ category: "operations" });
    expect(dashboard.waiting).toEqual([expect.objectContaining({ projectId: waiting.id, action: "等客户上传付款截图" })]);
    expect(dashboard.projects[0]).not.toHaveProperty("tokenHash");
    expect(dashboard.projects[0]).not.toHaveProperty("contact");
  });

  it("待收款排除自有产品、取消单、密钥开通；核款待办只接受已识别凭证", async () => {
    const external = await fixture({ status: "awaiting_payment" });
    const own = await fixture({ status: "awaiting_payment", isOwnProduct: true });
    const cancelled = await fixture({ status: "cancelled" });
    const key = await fixture({ status: "strategizing", productPlan: "pro" });
    for (const item of [external, own, cancelled]) await db.update(orders).set({ status: "accepted" }).where(eq(orders.id, item.order.id));
    await db.update(orders).set({ status: "key_activated" }).where(eq(orders.id, key.order.id));
    await db.insert(paymentReceipts).values({ orderId: external.order.id, data: Buffer.from(png), mimeType: "image/png", uploadedBy: "customer", analysisStatus: "succeeded" });
    const dashboard = await loadOwnerDashboard(db);
    expect(dashboard.pendingPaymentFen).toBe(29900);
    expect(dashboard.counts.payment).toBe(1);
    expect(dashboard.metrics).toMatchObject({ revenueFen: 0, paid: 0 });
  });

  it("客户成效排除自有产品、未发布页与测试线索，访问在单页去重", async () => {
    const external = await fixture(); const own = await fixture({ isOwnProduct: true });
    const [published, self, draft] = await db.insert(landingPages).values([
      { projectId: external.project.id, slug: "external", publishedAt: new Date() },
      { projectId: own.project.id, slug: "self", publishedAt: new Date() },
      { projectId: external.project.id, slug: "draft", publishedAt: null },
    ].map((item, index) => ({ ...item, version: index + 1, positioningVersion: 1, content: {}, status: item.publishedAt ? "published" : "draft" }))).returning();
    for (const page of [published, self, draft]) {
      await db.insert(leads).values([{ landingPageId: page.id, email: "real@example.com" }, { landingPageId: page.id, email: "test@example.com", isTest: true }]);
      await db.insert(events).values([{ landingPageId: page.id, type: "visit", visitorHash: "a" }, { landingPageId: page.id, type: "visit", visitorHash: "a" },
        { landingPageId: page.id, type: "visit", visitorHash: null }, { landingPageId: page.id, type: "cta_click" }, { landingPageId: page.id, type: "reply" }]);
    }
    expect((await operatingMetrics(db)).growth).toEqual({ visits: 1, ctaClicks: 1, leads: 1, replies: 1 });
    const [externalLead] = await db.select().from(leads).where(eq(leads.landingPageId, published.id));
    expect((await operatingMetrics(db)).firstLeadAt).toBe(externalLead.createdAt.toISOString());
  });
});

describe("批价与核款保护", () => {
  it("暂停时拒绝批价，旧版本无效，并发批价只记录一次且保存条款快照", async () => {
    const { project, order } = await fixture({ paused: true });
    const approve = (version = 1) => decideQuote(db, enqueue, { projectId: project.id, actor: "founder", verdict: "approve", version, quoteFen: 39900 });
    await expect(approve()).rejects.toThrow("暂停");
    await db.update(projects).set({ paused: false }).where(eq(projects.id, project.id));
    await expect(approve(2)).rejects.toThrow("已更新");
    const results = await Promise.allSettled([approve(), approve()]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    const rows = await db.select().from(decisions);
    expect(rows).toHaveLength(1);
    expect(rows[0].snapshot).toEqual({ orderId: order.id, quoteVersion: 1, quoteFen: 39900, proposal });
    expect((await operatingMetrics(db)).revenueFen).toBe(0);
  });

  it("退回必填原因，客户仍需单独接受老板批准的价格", async () => {
    const { project } = await fixture();
    await expect(decideQuote(db, enqueue, { projectId: project.id, actor: "founder", verdict: "reject", version: 1 })).rejects.toThrow("原因");
    await expect(decideQuote(db, enqueue, { projectId: project.id, actor: "customer", verdict: "approve", version: 1 })).rejects.toThrow("已更新");
    await decideQuote(db, enqueue, { projectId: project.id, actor: "founder", verdict: "approve", version: 1, quoteFen: 19900 });
    expect((await loadOwnerDashboard(db)).waiting).toEqual([expect.objectContaining({ projectId: project.id, action: "等客户接受报价" })]);
    await decideQuote(db, enqueue, { projectId: project.id, actor: "customer", verdict: "approve", version: 1 });
    expect((await loadAuditLog(db, { actor: "customer", gate: "quote" })).items[0].snapshot).toMatchObject({ quoteFen: 19900 });
  });

  it("核款绑定最新凭证和实收快照，暂停时不能付款推进", async () => {
    const { project, order } = await fixture({ status: "awaiting_payment", paused: true });
    await db.update(orders).set({ status: "accepted" }).where(eq(orders.id, order.id));
    const [receipt] = await db.insert(paymentReceipts).values({ orderId: order.id, data: Buffer.from(png), mimeType: "image/png", uploadedBy: "customer", analysisStatus: "succeeded" }).returning();
    const confirm = () => confirmReceipt(db, enqueue, { projectId: project.id, receiptId: receipt.id, amountFen: 29900, reference: "verified-bank-record" });
    await expect(confirm()).rejects.toThrow("暂停");
    await expect(uploadReceipt(db, enqueue, { projectId: project.id, bytes: png, actor: "customer" })).rejects.toThrow("暂停");
    await db.update(projects).set({ paused: false }).where(eq(projects.id, project.id));
    await confirm();
    const [decision] = await db.select().from(decisions);
    expect(decision.snapshot).toMatchObject({ receiptId: receipt.id, orderId: order.id, quoteFen: 29900, amountFen: 29900, reference: "verified-bank-record" });
    expect((await operatingMetrics(db)).revenueFen).toBe(29900);
  });

  it("旧版人工收款拒绝非法金额和并发重复记账，已付款不能直接改价", async () => {
    const { project } = await fixture({ requiresPayment: false });
    for (const amountFen of [0, -1, 1.5, Infinity, 2147483648]) {
      await expect(recordPayment(db, project.id, { amountFen, method: "人工核对" })).rejects.toThrow("金额");
      await expect(setQuote(db, project.id, amountFen)).rejects.toThrow("金额");
    }
    await setQuote(db, project.id, 39900);
    const results = await Promise.allSettled([1, 2].map(() => recordPayment(db, project.id, { amountFen: 39900, method: "人工核对" })));
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(await db.select().from(payments)).toHaveLength(1);
    expect((await loadAuditLog(db, { gate: "payment" })).items[0].snapshot).toMatchObject({ quoteFen: 39900, amountFen: 39900 });
    await expect(setQuote(db, project.id, 19900)).rejects.toThrow("不能直接改价");
    await expect(setFounderMinutes(db, project.id, -1)).rejects.toThrow("非负整数");
    await expect(setFounderMinutes(db, project.id, 2.5)).rejects.toThrow("非负整数");
  });
});

describe("全公司操作记录", () => {
  it("合并审批与状态变化，按项目、事项、角色筛选并稳定分页", async () => {
    const first = await fixture(); const other = await fixture();
    await db.insert(decisions).values(Array.from({ length: 30 }, (_, index) => ({ projectId: first.project.id,
      gate: "quote", subjectVersion: index + 1, actorRole: index % 2 ? "customer" : "founder", verdict: "approve", createdAt: new Date("2026-11-01T00:00:00Z") })));
    await db.insert(stateTransitions).values({ projectId: other.project.id, fromStatus: "awaiting_quote", toStatus: "awaiting_quote_acceptance", actor: "founder", reason: "确认报价" });
    await db.insert(decisions).values({ gate: "charter", subjectVersion: 1, actorRole: "founder", verdict: "approve" });
    const page1 = await loadAuditLog(db); const page2 = await loadAuditLog(db, { page: 2 });
    expect(page1.items).toHaveLength(25); expect(page1.hasNext).toBe(true);
    expect(page2.items).toHaveLength(7); expect(page2.hasNext).toBe(false);
    expect(new Set([...page1.items, ...page2.items].map((item) => item.id)).size).toBe(32);
    expect(page1.items[0].at).toBeInstanceOf(Date);
    const filtered = await loadAuditLog(db, { projectId: first.project.id, actor: "customer", gate: "quote" });
    expect(filtered.items).toHaveLength(15);
    expect(filtered.items.every((item) => item.projectId === first.project.id && item.actor === "customer" && item.event === "quote")).toBe(true);
    const transitions = await loadAuditLog(db, { gate: "transition" });
    expect(transitions.items).toHaveLength(1);
    expect(transitions.items[0].snapshot).toMatchObject({ fromStatus: "awaiting_quote", toStatus: "awaiting_quote_acceptance" });
  });
});
