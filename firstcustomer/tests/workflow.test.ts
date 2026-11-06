import { rmSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { asc, eq } from "drizzle-orm";
import EmbeddedPostgres from "embedded-postgres";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createStubSources, stubModel } from "@/ai/stub-model";
import type { ChatMessage, ModelClient, ModelRequest } from "@/ai/types";
import { createDb, type Db } from "@/db";
import {
  agentTasks,
  campaigns,
  clarifications,
  claims,
  companyReports,
  companySettings,
  decisions,
  deliverables,
  events,
  evidenceItems,
  landingPages,
  leads,
  payments,
  projectImages,
  projects,
  stateTransitions,
} from "@/db/schema";
import { loadProjectImage } from "@/workflow/queries";
import { confirmReceipt, customerPaymentCode, decideQuote, latestReceipt, projectOrder, savePaymentCode, uploadReceipt } from "@/workflow/commerce";
import { companyDocuments, saveCompanySettings } from "@/workflow/company-context";
import { decideWeekly, requestCompanyReport, runCompanyReport } from "@/workflow/company-reports";
import { loadCoo, loadDepartments, officeRevision, projectAttention } from "@/workflow/office";
import { loadTaskBoard } from "@/workflow/task-board";
import { editLandingPage, loadPublicVersionImage, loadVersionImage } from "@/workflow/landing-edits";
import { openSupportMessage, projectSupport, replyToSupport } from "@/workflow/support";
import type { PageContent } from "@/agents/schemas";
import {
  addManualEvidence,
  addProjectImage,
  answerClarifications,
  createProject,
  decide,
  deleteProjectImage,
  deliverProject,
  findProjectByToken,
  markCampaignExecuted,
  recordFeedback,
  regenerateProjectLink,
  resolveEscalation,
  retryFailedImages,
  retryProject,
  setPaused,
  skipClarifications,
  startResearch,
  startReview,
} from "@/workflow/actions";
import { advanceProject, visibleEvidence, type EngineDeps } from "@/workflow/engine";
import { gatherSources } from "@/agents/gather";
import { copyLibraryEvidence, libraryEvidence } from "@/agents/library";
import type { SourceClient } from "@/agents/sources";
import { createResearchTools } from "@/agents/tools";

let pg: EmbeddedPostgres;
let db: Db;
let close: () => Promise<unknown>;
let dir: string;
const PORT = 54391;

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), "fc-pg-"));
  pg = new EmbeddedPostgres({
    databaseDir: dir,
    user: "test",
    password: "test",
    port: PORT,
    persistent: false,
    autoRehydrateSymlinks: true,
    onLog: () => {},
    onError: () => {},
  });
  await pg.initialise();
  await pg.start();
  await pg.createDatabase("test");
  const created = createDb(`postgres://test:test@127.0.0.1:${PORT}/test`);
  db = created.db;
  close = () => created.sql.end();
  await migrate(db, { migrationsFolder: "./drizzle" });
});

afterAll(async () => {
  await close?.();
  await pg?.stop();
  rmSync(dir, { recursive: true, force: true });
});

beforeEach(async () => {
  await db.delete(projects);
  await db.delete(evidenceItems);
  await db.delete(companyReports);
  await db.delete(companySettings);
  await db.delete(decisions);
});

// 用队列数组代替 pg-boss，循环执行直到项目停在需要人决定的状态。
function harness(model: ModelClient = stubModel) {
  const queue: string[] = [];
  const enqueue = async (id: string) => {
    queue.push(id);
  };
  const deps: EngineDeps = { db, model, sources: createStubSources(), enqueue };
  const drain = async () => {
    for (let i = 0; queue.length && i < 30; i++) {
      await advanceProject(deps, queue.shift() as string);
    }
  };
  return { deps, enqueue, drain };
}

const newProject = (extra = {}) =>
  createProject(db, {
    productName: "Note Taker",
    stage: "已有 MVP",
    goal: "找首批用户",
    targetMarket: "北美",
    contact: "dev@example.com",
    isOwnProduct: true,
    ...extra,
  });

const statusOf = async (id: string) =>
  (await db.select({ s: projects.status }).from(projects).where(eq(projects.id, id)))[0].s;

const tasksOf = (id: string) =>
  db.select().from(agentTasks).where(eq(agentTasks.projectId, id)).orderBy(asc(agentTasks.startedAt));

describe("初诊、报价与到账", () => {
  it("退回报价会生成新版本，到账前不运行 Strategy，重复确认只记一笔", async () => {
    const h = harness();
    const { project } = await newProject({ isOwnProduct: false });
    const { project: other } = await newProject({ isOwnProduct: false });
    const projectId = project.id;
    const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
    await savePaymentCode(db, png);
    await startResearch(db, h.enqueue, projectId);
    await h.drain();
    expect(await statusOf(projectId)).toBe("awaiting_quote");
    expect((await projectOrder(db, projectId))?.quoteFen).toBe(29_900);
    expect(await customerPaymentCode(db, projectId)).toBeNull();
    await expect(decideQuote(db, h.enqueue, { projectId, version: 1, actor: "customer", verdict: "approve" })).rejects.toThrow();

    const approve = (version: number) => decideQuote(db, h.enqueue, {
      projectId, version, actor: "founder", verdict: "approve", quoteFen: 29_900,
    });
    await approve(1);
    expect(await customerPaymentCode(db, projectId)).toBeNull();
    await decideQuote(db, h.enqueue, { projectId, version: 1, actor: "customer", verdict: "reject", reason: "请说明需要我确认几次" });
    await h.drain();
    expect((await projectOrder(db, projectId))?.quoteVersion).toBe(2);
    await expect(approve(1)).rejects.toThrow();
    await approve(2);
    await decideQuote(db, h.enqueue, { projectId, version: 2, actor: "customer", verdict: "approve" });
    expect(await customerPaymentCode(db, projectId)).toMatchObject({ mimeType: "image/png" });
    expect(await customerPaymentCode(db, other.id)).toBeNull();
    await uploadReceipt(db, h.enqueue, { projectId, bytes: png, actor: "customer" });
    await h.drain();
    expect(await statusOf(projectId)).toBe("awaiting_payment");
    expect(await db.select().from(payments)).toHaveLength(0);
    expect((await tasksOf(projectId)).map((task) => task.agent)).toEqual(["research", "quote", "quote", "receipt"]);

    const order = (await projectOrder(db, projectId))!;
    const receipt = (await latestReceipt(db, order.id))!;
    await expect(confirmReceipt(db, h.enqueue, { projectId, receiptId: receipt.id, amountFen: 28_900 })).rejects.toThrow("不一致");
    const confirm = () => confirmReceipt(db, h.enqueue, { projectId, receiptId: receipt.id, amountFen: 29_900 });
    const confirmations = await Promise.allSettled([confirm(), confirm()]);
    expect(confirmations.filter(({ status }) => status === "fulfilled")).toHaveLength(1);
    expect(await db.select().from(payments)).toHaveLength(1);
    expect(await customerPaymentCode(db, projectId)).toBeNull();
    await h.drain();
    expect(await statusOf(projectId)).toBe("awaiting_positioning");
    expect((await tasksOf(projectId)).filter((task) => task.agent === "quote")).toHaveLength(2);
  });
});

async function bothApprove(enqueue: (id: string) => Promise<void>, projectId: string, gate: "positioning" | "publish") {
  await decide(db, enqueue, { projectId, gate, actor: "founder", verdict: "approve" });
  await decide(db, enqueue, { projectId, gate, actor: "customer", verdict: "approve" });
}

async function toPublished() {
  const h = harness();
  const { project, token } = await newProject();
  await startResearch(db, h.enqueue, project.id);
  await h.drain();
  await bothApprove(h.enqueue, project.id, "positioning");
  await h.drain();
  await bothApprove(h.enqueue, project.id, "publish");
  const [page] = await db.select().from(landingPages).where(eq(landingPages.status, "published"));
  return { h, project, token, page };
}

describe("办公室新增交付能力", () => {
  it("编辑后需要重新审批，截图只随对应的已发布版本公开", async () => {
    const { h, project, page } = await toPublished();
    const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
    await addProjectImage(db, { projectId: project.id, kind: "product", bytes: png, uploadedBy: "customer" });
    const [image] = await db.select().from(projectImages).where(eq(projectImages.projectId, project.id));
    const content = { ...(page.content as PageContent), headline: "Find what matters in your calls" };
    await expect(editLandingPage(db, {
      projectId: project.id, version: page.version, content: { ...content, headline: "Save 99%" }, image: image.id, claim: null,
    })).rejects.toThrow("数字只能写在已登记的声明里");
    await editLandingPage(db, { projectId: project.id, version: page.version, content, image: image.id, claim: null });
    expect(await statusOf(project.id)).toBe("awaiting_publish");
    const drafts = await db.select().from(landingPages).where(eq(landingPages.projectId, project.id));
    const next = drafts.find((row) => row.version === page.version + 1)!;
    expect(drafts.find((row) => row.id === page.id)?.status).toBe("published");
    expect(await loadVersionImage(db, project.id)).toMatchObject({ mimeType: "image/png" });
    expect(await loadPublicVersionImage(db, next.slug)).toBeNull();
    await expect(decide(db, h.enqueue, { projectId: project.id, gate: "publish", actor: "founder", verdict: "approve", version: page.version })).rejects.toThrow("已更新");
    await bothApprove(h.enqueue, project.id, "publish");
    expect(await loadPublicVersionImage(db, next.slug)).toMatchObject({ mimeType: "image/png" });
    expect(await loadPublicVersionImage(db, page.slug)).toBeNull();
  });

  it("客服升级走人工，周报决定入库，卷宗导出脱敏", async () => {
    const h = harness();
    const { project } = await newProject({ contact: "context-qa@example.invalid" });
    await openSupportMessage(db, h.enqueue, project.id, "我想投诉，要求退款");
    await openSupportMessage(db, h.enqueue, project.id, "现在进行到哪一步？");
    await h.drain();
    const inbox = await projectSupport(db, project.id);
    const escalated = inbox.find((row) => row.status === "escalated")!;
    expect(escalated.reply).toBeNull();
    expect(inbox.find((row) => row.status === "replied")?.reply).toContain("已提交");
    await replyToSupport(db, project.id, escalated.id, "请通过 context-qa@example.invalid 核对订单。");
    expect((await projectSupport(db, project.id)).find((row) => row.id === escalated.id)?.status).toBe("resolved");
    const reportId = await requestCompanyReport(db, async () => {}, "weekly");
    await runCompanyReport(db, stubModel, reportId);
    await decideWeekly(db, reportId, "continue", "保持当前服务");
    const [report] = await db.select().from(companyReports).where(eq(companyReports.id, reportId));
    expect(report.status).toBe("succeeded");
    expect(report.input).toMatchObject({ revenueFen: 0, totalTasks: 2 });
    await saveCompanySettings(db, { charter: "服务有 MVP 的开发者。" }, true);
    const docs = await companyDocuments(db);
    expect(docs).toHaveLength(9);
    expect(docs[0].body).toContain("确认");
    expect(docs[8].body).toContain("保持当前服务");
    expect(docs.map((doc) => doc.body).join("\n")).not.toContain("context-qa@example.invalid");
  });
});

describe("完整流程", () => {
  it("从研究走到交付，并留下打回、拦截和审批记录", async () => {
    const { h, project, page } = await toPublished();
    expect(await statusOf(project.id)).toBe("collecting");

    const tasks = await tasksOf(project.id);
    // AC-13：Strategy 证据不足时打回 Research，新任务能关联回打回任务。
    const sentBack = tasks.find((t) => t.status === "sent_back");
    expect(sentBack?.sendBackRoute).toBe("strategy->research");
    const followUp = tasks.find((t) => t.parentTaskId === sentBack?.id);
    expect(followUp?.agent).toBe("research");
    expect(followUp?.trigger).toBe("send_back");
    const [current] = await db.select().from(projects).where(eq(projects.id, project.id));
    const rooms = await loadDepartments(db, current);
    expect(rooms.find(({ key }) => key === "strategy")).toMatchObject({
      state: "completed", handoff: { id: sentBack?.id, to: "research", reason: sentBack?.sendBackReason },
    });
    // 补查后新旧证据都在。
    const evidence = await db.select().from(evidenceItems).where(eq(evidenceItems.projectId, project.id));
    expect(evidence.length).toBe(5);
    expect(evidence.filter((e) => e.grade === "E")).toHaveLength(1);
    expect(evidence.every((e) => e.status === "verified")).toBe(true);

    // AC-16：第一次页面带无证据声明被拦下，改写后才通过。
    const launch = tasks.filter((t) => t.agent === "launch");
    expect(launch.map((t) => t.status)).toEqual(["rejected", "succeeded"]);
    expect(launch[0].sendBackReason).toContain("Saves 5 hours every week");
    expect(launch[1].trigger).toBe("rewrite");
    const saved = await db.select().from(claims).where(eq(claims.landingPageId, page.id));
    expect(saved.every((c) => c.evidenceId && c.checkPassed)).toBe(true);
    expect(saved.map((c) => c.text)).not.toContain("Saves 5 hours every week");

    // AC-12：每一步记录了实际模型。
    expect(tasks.every((t) => t.provider === "stub")).toBe(true);

    // AC-19：两道审批分开记录。
    const recorded = await db.select().from(decisions).where(eq(decisions.projectId, project.id));
    expect(recorded.map((d) => `${d.gate}:${d.actorRole}`).sort()).toEqual([
      "positioning:customer",
      "positioning:founder",
      "publish:customer",
      "publish:founder",
    ]);

    // AC-06：批准后的活动才能标记已执行。
    const [campaign] = await db.select().from(campaigns).where(eq(campaigns.landingPageId, page.id));
    await markCampaignExecuted(db, campaign.id, "https://example.com/post/1");

    await recordFeedback(db, { landingPageId: page.id, type: "reply", text: "Interesting" });
    await startReview(db, h.enqueue, project.id);
    await h.drain();
    // AC-18：没有访问就是样本不足，不能开启下一轮。
    const [report] = await db.select().from(deliverables).where(eq(deliverables.projectId, project.id));
    const content = report.content as { verdict: string; verdict_label: string; next_hypothesis: string | null };
    expect(content.verdict).toBe("insufficient");
    expect(content.verdict_label).toBe("样本不足");
    expect(content.next_hypothesis).toBeNull();
    await expect(
      decide(db, h.enqueue, { projectId: project.id, gate: "next_round", actor: "founder", verdict: "approve" }),
    ).rejects.toThrow("不能开启下一轮");

    await deliverProject(db, project.id);
    expect(await statusOf(project.id)).toBe("delivered");

    const history = await db
      .select({ to: stateTransitions.toStatus })
      .from(stateTransitions)
      .where(eq(stateTransitions.projectId, project.id))
      .orderBy(asc(stateTransitions.createdAt));
    expect(history.map((h) => h.to)).toEqual([
      "researching",
      "strategizing",
      "researching",
      "strategizing",
      "awaiting_positioning",
      "preparing_page",
      "awaiting_publish",
      "published",
      "collecting",
      "reviewing",
      "delivered",
    ]);
  });

  it("未达标时开启下一轮，定位确认重新开始", async () => {
    const { h, project, page } = await toPublished();
    const visits = Array.from({ length: 20 }, (_, i) => ({
      landingPageId: page.id,
      type: "visit",
      visitorHash: `v${i}`,
    }));
    await db.insert(events).values(visits);
    await startReview(db, h.enqueue, project.id);
    await h.drain();
    const [report] = await db.select().from(deliverables).where(eq(deliverables.projectId, project.id));
    expect((report.content as { verdict: string }).verdict).toBe("failed");

    await decide(db, h.enqueue, { projectId: project.id, gate: "next_round", actor: "founder", verdict: "approve" });
    expect(await statusOf(project.id)).toBe("reviewing");
    await decide(db, h.enqueue, { projectId: project.id, gate: "next_round", actor: "customer", verdict: "approve" });
    await h.drain();
    const [row] = await db.select().from(projects).where(eq(projects.id, project.id));
    expect(row.round).toBe(2);
    expect(row.status).toBe("awaiting_positioning");
    expect(row.positioningVersion).toBe(2);
    // 已发布页面不会被自动修改。
    const [stillLive] = await db.select().from(landingPages).where(eq(landingPages.id, page.id));
    expect(stillLive.status).toBe("published");
  });
});

describe("跨项目任务板与 COO", () => {
  it("按时间分页，筛选时合并项目任务和公司报告", async () => {
    const { project: first } = await newProject();
    const { project: second } = await newProject({ productName: "Another project" });
    const started = new Date("2026-11-06T09:00:00Z");
    await db.insert(agentTasks).values(Array.from({ length: 25 }, (_, i) => ({
      projectId: i === 0 ? second.id : first.id, agent: "research",
      status: i === 0 ? "failed" : "succeeded", startedAt: new Date(started.getTime() + i * 1000),
    })));
    await db.insert(companyReports).values({ kind: "weekly", status: "failed", createdAt: new Date(started.getTime() + 26_000) });

    const page = await loadTaskBoard(db, "", 1);
    expect(page.rows).toHaveLength(25);
    expect(page.hasMore).toBe(true);
    expect(page.rows[0]).toMatchObject({ agent: "weekly", projectId: null });
    expect(await loadTaskBoard(db, "", 2)).toMatchObject({ rows: [{ projectId: second.id }], hasMore: false });
    expect((await loadTaskBoard(db, "failed", 1)).rows).toMatchObject([
      { agent: "weekly", status: "failed" }, { agent: "research", projectId: second.id, status: "failed" },
    ]);
  });

  it("区分等待客户与老板操作，并在待办跨过提醒时间后刷新办公室", async () => {
    const { project } = await newProject({ isOwnProduct: false });
    const entered = new Date("2026-11-06T09:00:00Z");
    const [waiting] = await db.update(projects).set({ status: "awaiting_quote_acceptance", updatedAt: entered })
      .where(eq(projects.id, project.id)).returning();
    expect(await projectAttention(db, waiting)).toMatchObject({ owner: false, action: "等客户接受报价" });
    const [pending] = await db.update(projects).set({ status: "awaiting_quote" })
      .where(eq(projects.id, project.id)).returning();
    expect(await projectAttention(db, pending)).toMatchObject({ owner: true, since: entered });
    expect(await officeRevision(db, new Date("2026-11-07T08:59:00Z")))
      .not.toBe(await officeRevision(db, new Date("2026-11-07T09:01:00Z")));

    const [stalled] = await db.insert(agentTasks).values({ projectId: project.id, agent: "quote", startedAt: new Date(Date.now() - 31 * 60_000) }).returning();
    expect((await loadCoo(db)).stalled).toMatchObject([{ id: stalled.id, projectId: project.id }]);
  });
});

// 只替换某个 Agent 的回复，其余沿用模拟模型。
function overriding(agent: string, reply: (request: ModelRequest, call: number) => unknown): ModelClient {
  let calls = 0;
  return async (request) => {
    if (request.agent !== agent) return stubModel(request);
    const content = JSON.stringify(reply(request, ++calls));
    return {
      message: { role: "assistant", content } as ChatMessage,
      content,
      toolCalls: [],
      citations: [],
      provider: "stub",
      model: "stub-model",
      usage: { inputTokens: 0, outputTokens: 0, searchCalls: 0 },
    };
  };
}

const strategyNeedMore = {
  status: "need_more",
  request: { missing: "付费证据", reason: "不够", source_types: ["定价页"] },
};

describe("打回上限（AC-14）", () => {
  it("Strategy 连续要补查，超过 2 次后停下来等老板", async () => {
    let strategyCalls = 0;
    const h = harness(
      overriding("strategy", (request) => {
        strategyCalls++;
        const input = JSON.parse(String(request.messages[1].content));
        if (input.founder_note) {
          return {
            status: "done",
            options: [{ audience: "a", problem: "p", value_prop: "v", why: "w" }],
            recommended_option: 0,
            rationale: "按老板决定",
            experiment: { hypothesis: "h", channel: "c", min_visits: 10, pass_leads: 1 },
            counter_responses: input.evidence
              .filter((e: { stance: string }) => e.stance === "against")
              .map((e: { id: string }) => ({ evidence_id: e.id, response: "to_test", note: "待验证" })),
          };
        }
        return strategyNeedMore;
      }),
    );
    const { project } = await newProject();
    await startResearch(db, h.enqueue, project.id);
    await h.drain();

    expect(await statusOf(project.id)).toBe("awaiting_founder");
    expect(strategyCalls).toBe(3);
    const before = (await tasksOf(project.id)).length;
    await h.drain();
    expect((await tasksOf(project.id)).length).toBe(before);

    await resolveEscalation(db, h.enqueue, {
      projectId: project.id,
      target: "strategizing",
      note: "按尚未验证继续",
    });
    await h.drain();
    expect(await statusOf(project.id)).toBe("awaiting_positioning");
  });
});

describe("打回后定位是否改变（AC-15）", () => {
  const needClaim = {
    status: "need_more",
    request: { missing: "卖点证据", reason: "没有来源", source_types: [] },
  };

  async function toPage(strategy: ModelClient) {
    const h = harness(strategy);
    const { project } = await newProject();
    await startResearch(db, h.enqueue, project.id);
    await h.drain();
    await bothApprove(h.enqueue, project.id, "positioning");
    await h.drain();
    return { h, project };
  }

  it("定位不变时不用重新确认，直接回到准备页面", async () => {
    const model: ModelClient = async (request) => {
      if (request.agent === "launch") {
        const input = JSON.parse(String(request.messages[1].content));
        if (!input.guidance) {
          const content = JSON.stringify(needClaim);
          return {
            message: { role: "assistant", content } as ChatMessage,
            content,
            toolCalls: [],
            citations: [],
            provider: "stub",
            model: "stub-model",
            usage: { inputTokens: 0, outputTokens: 0, searchCalls: 0 },
          };
        }
      }
      return stubModel(request);
    };
    const { project } = await toPage(model);
    expect(await statusOf(project.id)).toBe("awaiting_publish");
    const [row] = await db.select().from(projects).where(eq(projects.id, project.id));
    expect(row.positioningVersion).toBe(1);
    const route = (await tasksOf(project.id)).find((t) => t.sendBackRoute === "launch->strategy");
    expect(route?.status).toBe("sent_back");
  });

  it("定位改变时之前的确认失效，旧页面不能发布", async () => {
    let launchCalls = 0;
    let strategyCalls = 0;
    const model: ModelClient = async (request) => {
      const stub = async (value: unknown) => {
        const content = JSON.stringify(value);
        return {
          message: { role: "assistant", content } as ChatMessage,
          content,
          toolCalls: [],
          citations: [],
          provider: "stub",
          model: "stub-model",
          usage: { inputTokens: 0, outputTokens: 0, searchCalls: 0 },
        };
      };
      if (request.agent === "launch" && ++launchCalls === 1) return stub(needClaim);
      if (request.agent === "strategy" && JSON.parse(String(request.messages[1].content)).launch_request) {
        strategyCalls++;
        const base = JSON.parse(String((await stubModel(request)).content));
        base.options[0].value_prop = "Changed positioning";
        return stub(base);
      }
      return stubModel(request);
    };
    const { h, project } = await toPage(model);
    expect(strategyCalls).toBe(1);
    expect(await statusOf(project.id)).toBe("awaiting_positioning");
    const [row] = await db.select().from(projects).where(eq(projects.id, project.id));
    expect(row.positioningVersion).toBe(2);
    await expect(
      decide(db, h.enqueue, { projectId: project.id, gate: "publish", actor: "founder", verdict: "approve" }),
    ).rejects.toThrow("当前阶段");
  });
});

describe("审批（AC-03、AC-19）", () => {
  it("老板把关前客户不能确认，老板批准后客户未确认也不能往下走", async () => {
    const h = harness();
    const { project } = await newProject();
    await startResearch(db, h.enqueue, project.id);
    await h.drain();
    await expect(
      decide(db, h.enqueue, { projectId: project.id, gate: "positioning", actor: "customer", verdict: "approve" }),
    ).rejects.toThrow("老板把关");
    await decide(db, h.enqueue, { projectId: project.id, gate: "positioning", actor: "founder", verdict: "approve" });
    await h.drain();
    expect(await statusOf(project.id)).toBe("awaiting_positioning");
  });

  it("客户退回定位后生成新版本，不会发布旧方向", async () => {
    const h = harness();
    const { project } = await newProject();
    await startResearch(db, h.enqueue, project.id);
    await h.drain();
    await decide(db, h.enqueue, { projectId: project.id, gate: "positioning", actor: "founder", verdict: "approve" });
    await decide(db, h.enqueue, {
      projectId: project.id,
      gate: "positioning",
      actor: "customer",
      verdict: "reject",
      reason: "方向不对",
    });
    await h.drain();
    const [row] = await db.select().from(projects).where(eq(projects.id, project.id));
    expect(row.status).toBe("awaiting_positioning");
    expect(row.positioningVersion).toBe(2);
    expect(await db.select().from(landingPages).where(eq(landingPages.projectId, project.id))).toHaveLength(0);
  });

  it("退回必须写明原因", async () => {
    const h = harness();
    const { project } = await newProject();
    await startResearch(db, h.enqueue, project.id);
    await h.drain();
    await expect(
      decide(db, h.enqueue, { projectId: project.id, gate: "positioning", actor: "founder", verdict: "reject" }),
    ).rejects.toThrow("原因");
  });

  it("发布被退回时页面不会公开", async () => {
    const h = harness();
    const { project } = await newProject();
    await startResearch(db, h.enqueue, project.id);
    await h.drain();
    await bothApprove(h.enqueue, project.id, "positioning");
    await h.drain();
    await decide(db, h.enqueue, { projectId: project.id, gate: "publish", actor: "founder", verdict: "approve" });
    await decide(db, h.enqueue, {
      projectId: project.id,
      gate: "publish",
      actor: "customer",
      verdict: "reject",
      reason: "标题要改",
    });
    await h.drain();
    const pages = await db.select().from(landingPages).where(eq(landingPages.projectId, project.id));
    expect(pages.map((p) => p.status).sort()).toEqual(["checked", "superseded"]);
    expect(await statusOf(project.id)).toBe("awaiting_publish");
  });
});

describe("失败恢复（AC-08）", () => {
  it("模型失败时保留已完成部分，重试后继续，不重复研究", async () => {
    let failures = 1;
    const flaky: ModelClient = async (request) => {
      if (request.agent === "launch" && failures-- > 0) throw new Error("MiMo 503");
      return stubModel(request);
    };
    const h = harness(flaky);
    const { project } = await newProject();
    await startResearch(db, h.enqueue, project.id);
    await h.drain();
    await bothApprove(h.enqueue, project.id, "positioning");
    await h.drain();

    const [failed] = await db.select().from(projects).where(eq(projects.id, project.id));
    expect(failed.status).toBe("failed");
    expect(failed.failedReason).toContain("503");
    const researchBefore = (await tasksOf(project.id)).filter((t) => t.agent === "research").length;
    const failedTask = (await tasksOf(project.id)).find((t) => t.status === "failed");
    expect(failedTask?.error).toContain("503");

    await retryProject(db, h.enqueue, project.id);
    await h.drain();
    expect(await statusOf(project.id)).toBe("awaiting_publish");
    expect((await tasksOf(project.id)).filter((t) => t.agent === "research").length).toBe(researchBefore);
  });
});

describe("Agent 输出检查", () => {
  it("没有回应全部反面证据时，要求 Strategy 修正（AC-17）", async () => {
    const seen: string[] = [];
    const model: ModelClient = async (request) => {
      if (request.agent !== "strategy") return stubModel(request);
      const last = request.messages.at(-1);
      seen.push(String(last?.role));
      const response = await stubModel(request);
      const parsed = JSON.parse(String(response.content));
      if (parsed.status === "done" && last?.role !== "assistant" && seen.filter((s) => s === "user").length === 2) {
        parsed.counter_responses = [];
      }
      const content = JSON.stringify(parsed);
      return { ...response, content, message: { role: "assistant", content } as ChatMessage };
    };
    const h = harness(model);
    const { project } = await newProject();
    await startResearch(db, h.enqueue, project.id);
    await h.drain();
    expect(await statusOf(project.id)).toBe("awaiting_positioning");
    // 第一次要补查，第二次漏了回应被程序打回，第三次才通过。
    expect(seen).toHaveLength(3);
    const responses = await db.select().from(agentTasks).where(eq(agentTasks.agent, "strategy"));
    expect(responses.some((t) => t.status === "succeeded")).toBe(true);
  });

  it("模型要写入没读取过的网址时被拒绝（AC-22）", async () => {
    const results: string[] = [];
    let turn = 0;
    const model: ModelClient = async (request) => {
      if (request.agent !== "research" || turn > 1) return stubModel(request);
      turn++;
      if (turn === 1) {
        const content = JSON.stringify({
          status: "done",
          summary: "s",
          candidates: [
            {
              name: "远程咨询团队",
              why: "w",
              library_ids: ["not-a-library-id"],
              picks: [
                {
                  url: "https://evil.example/made-up",
                  quote: "Revenue doubled to one million dollars",
                  kind: "revenue",
                  stance: "support",
                  product: null,
                  number_value: "1000000",
                  metric: "ARR",
                },
              ],
            },
          ],
          unknowns: [],
        });
        return {
          message: { role: "assistant", content } as ChatMessage,
          content,
          toolCalls: [],
          citations: [],
          provider: "stub",
          model: "stub-model",
          usage: { inputTokens: 0, outputTokens: 0, searchCalls: 0 },
        };
      }
      results.push(String(request.messages.at(-1)?.content));
      request.messages.splice(2);
      return stubModel(request);
    };
    const h = harness(model);
    const { project } = await newProject();
    await startResearch(db, h.enqueue, project.id);
    await h.drain();
    expect(results[0]).toContain("不在资料里");
    expect(await statusOf(project.id)).toBe("awaiting_positioning");
    const fabricated = await db.select().from(evidenceItems).where(eq(evidenceItems.url, "https://evil.example/made-up"));
    expect(fabricated).toHaveLength(0);
  });

  it("对不上原文的摘录被丢掉并记下原因，其余证据照常保存", async () => {
    const model: ModelClient = async (request) => {
      const response = await stubModel(request);
      if (request.agent !== "research") return response;
      const output = JSON.parse(String(response.content));
      if (output.status !== "done") return response;
      output.candidates[0].picks.push({
        url: "https://example.com/sample/consultants-notes",
        quote: "this sentence was never written on that page",
        kind: "pain",
        stance: "support",
        product: null,
        number_value: null,
        metric: null,
      });
      const content = JSON.stringify(output);
      return { ...response, content, message: { role: "assistant", content } as ChatMessage };
    };
    const h = harness(model);
    const { project } = await newProject();
    await startResearch(db, h.enqueue, project.id);
    await h.drain();
    const [task] = (await tasksOf(project.id)).filter((t) => t.agent === "research");
    const output = task.output as { dropped?: string[]; candidates: { evidence_ids: string[] }[] };
    expect(output.dropped?.[0]).toContain("找不到");
    expect(output.candidates[0].evidence_ids).toHaveLength(2);
  });
});

describe("项目专属链接（AC-20）", () => {
  it("错误或作废的链接找不到项目", async () => {
    const { project, token } = await newProject();
    expect((await findProjectByToken(db, token))?.id).toBe(project.id);
    expect(await findProjectByToken(db, "wrong")).toBeNull();
    const fresh = await regenerateProjectLink(db, project.id);
    expect(await findProjectByToken(db, token)).toBeNull();
    expect((await findProjectByToken(db, fresh))?.id).toBe(project.id);
  });

  it("数据库里不保存可用的链接令牌", async () => {
    const { project, token } = await newProject();
    const [row] = await db.select().from(projects).where(eq(projects.id, project.id));
    expect(row.tokenHash).not.toContain(token);
  });
});

describe("人工证据", () => {
  it("摘录不在来源文本里时不能入库", async () => {
    await expect(
      addManualEvidence(db, {
        url: "https://www.microns.io/x",
        quote: "This quote was never on the page",
        sourceText: "TTM revenue $170, asking price $1,600",
        kind: "revenue",
        stance: "support",
      }),
    ).rejects.toThrow();
  });

  it("交易平台的挂牌定为 B 级，客户授权数据定为 A 级", async () => {
    const seed = await addManualEvidence(db, {
      url: "https://www.microns.io/x",
      quote: "TTM revenue $170, asking price $1,600",
      sourceText: "Listing. TTM revenue $170, asking price $1,600. More text.",
      kind: "revenue",
      stance: "support",
      createdBy: "seed",
    });
    expect(seed.grade).toBe("B");
    expect(seed.projectId).toBeNull();
    const customer = await addManualEvidence(db, {
      url: "https://customer.example/stripe-export",
      quote: "MRR in October was $420",
      sourceText: "MRR in October was $420",
      kind: "revenue",
      stance: "support",
      customerAuthorized: true,
    });
    expect(customer.grade).toBe("A");
    expect(customer.licenseStatus).toBe("customer_authorized");
  });
});

const researchInputs = (seen: ModelRequest[]) =>
  seen
    .filter((r) => r.agent === "research")
    .map((r) => JSON.parse(String(r.messages[1].content)));

function recording(model: ModelClient = stubModel) {
  const seen: ModelRequest[] = [];
  const wrapped: ModelClient = async (request) => {
    seen.push({ ...request, messages: [...request.messages] });
    return model(request);
  };
  return { seen, wrapped };
}

describe("信息不足时追问客户", () => {
  const unclear = () => newProject({ targetMarket: null });

  it("研究暂停等客户回答，全部回答后带着答案继续", async () => {
    const { seen, wrapped } = recording();
    const h = harness(wrapped);
    const { project } = await unclear();
    await startResearch(db, h.enqueue, project.id);
    await h.drain();

    expect(await statusOf(project.id)).toBe("needs_info");
    const questions = await db.select().from(clarifications).where(eq(clarifications.projectId, project.id));
    expect(questions).toHaveLength(2);
    // 等客户期间不继续消耗模型。
    const before = seen.length;
    await h.drain();
    expect(seen.length).toBe(before);

    // 只回答一个时已填内容保存，研究不继续。
    const partial = await answerClarifications(db, h.enqueue, {
      projectId: project.id,
      answers: { [questions[0].id]: "北美" },
      by: "customer",
    });
    expect(partial).toEqual({ complete: false, remaining: 1 });
    expect(await statusOf(project.id)).toBe("needs_info");

    const done = await answerClarifications(db, h.enqueue, {
      projectId: project.id,
      answers: { [questions[1].id]: "还没有" },
      by: "customer",
    });
    expect(done.complete).toBe(true);
    await h.drain();
    expect(await statusOf(project.id)).toBe("awaiting_positioning");

    const inputs = researchInputs(seen);
    const answered = inputs.find((i) => i.clarifications.length);
    expect(answered.clarifications.map((c: { answer: string }) => c.answer)).toEqual(["北美", "还没有"]);
    // Strategy 也能看到客户的回答。
    const strategy = seen.find((r) => r.agent === "strategy");
    expect(String(strategy?.messages[1].content)).toContain("还没有");
  });

  it("老板可以不再等客户，未回答的问题交给 Research 记录", async () => {
    const { seen, wrapped } = recording();
    const h = harness(wrapped);
    const { project } = await unclear();
    await startResearch(db, h.enqueue, project.id);
    await h.drain();
    await skipClarifications(db, h.enqueue, project.id);
    await h.drain();
    expect(await statusOf(project.id)).toBe("awaiting_positioning");
    const answered = researchInputs(seen).find((i) => i.clarifications.length);
    expect(answered.clarifications[0].answer).toContain("没有回答");
  });

  it("整个项目只能追问一次", async () => {
    let asks = 0;
    const model: ModelClient = async (request) => {
      const input = request.agent === "research" ? JSON.parse(String(request.messages[1].content)) : null;
      const lastIsUser = request.messages.at(-1)?.role === "user";
      if (input?.clarifications.length && asks === 1 && lastIsUser && request.messages.length === 2) {
        asks++;
        const content = JSON.stringify({ status: "need_info", questions: [{ question: "再问一次", why: "w" }] });
        return {
          message: { role: "assistant", content } as ChatMessage,
          content,
          toolCalls: [],
          citations: [],
          provider: "stub",
          model: "stub-model",
          usage: { inputTokens: 0, outputTokens: 0, searchCalls: 0 },
        };
      }
      if (request.agent === "research" && !input?.clarifications.length && asks === 0) asks = 1;
      if (request.agent === "research" && request.messages.at(-1)?.role === "user" && request.messages.length > 2) {
        request.messages.splice(2);
      }
      return stubModel(request);
    };
    const h = harness(model);
    const { project } = await unclear();
    await startResearch(db, h.enqueue, project.id);
    await h.drain();
    const questions = await db.select().from(clarifications).where(eq(clarifications.projectId, project.id));
    await answerClarifications(db, h.enqueue, {
      projectId: project.id,
      answers: Object.fromEntries(questions.map((q) => [q.id, "答案"])),
      by: "customer",
    });
    await h.drain();
    expect(asks).toBe(2);
    expect(await statusOf(project.id)).toBe("awaiting_positioning");
    expect(await db.select().from(clarifications).where(eq(clarifications.projectId, project.id))).toHaveLength(2);
  });

  it("不需要补充信息时不能提交回答", async () => {
    const h = harness();
    const { project } = await newProject();
    await expect(
      answerClarifications(db, h.enqueue, { projectId: project.id, answers: {}, by: "customer" }),
    ).rejects.toThrow("不需要");
  });
});

describe("截图上传和图片理解", () => {
  const png = () => Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);
  const upload = (projectId: string, bytes = png(), note: string | null = null) =>
    addProjectImage(db, { projectId, bytes, kind: "product", note, uploadedBy: "customer" });

  it("把图片按官方格式传给模型，结果进入后续 Agent，但不算证据", async () => {
    const { seen, wrapped } = recording();
    const h = harness(wrapped);
    const { project } = await newProject();
    await upload(project.id, png(), "首页");
    await startResearch(db, h.enqueue, project.id);
    await h.drain();

    const vision = seen.find((r) => r.agent === "vision");
    expect(vision?.tier).toBe("vision");
    const parts = vision?.messages[1].content as { type: string; image_url?: { url: string } }[];
    expect(parts[0].type).toBe("image_url");
    expect(parts[0].image_url?.url).toMatch(/^data:image\/png;base64,/);

    const [saved] = await db.select().from(projectImages).where(eq(projectImages.projectId, project.id));
    expect(saved.analysisStatus).toBe("done");
    expect(researchInputs(seen)[0].screenshots[0].analysis.summary).toContain("模拟数据");
    expect(String(seen.find((r) => r.agent === "strategy")?.messages[1].content)).toContain("首页");
    // 任务记录里只留图片编号，不存图片内容。
    const task = (await tasksOf(project.id)).find((t) => t.agent === "vision");
    expect(JSON.stringify(task?.input)).not.toContain("base64");
    // 截图内容不会变成证据。
    const evidence = await db.select().from(evidenceItems).where(eq(evidenceItems.projectId, project.id));
    expect(evidence.some((e) => e.excerpt.includes("Meeting summary"))).toBe(false);
    // 每张只读一次。
    await h.drain();
    expect(seen.filter((r) => r.agent === "vision")).toHaveLength(1);
  });

  it("读取失败不影响研究，可以重试", async () => {
    let fail = true;
    const model: ModelClient = async (request) => {
      if (request.agent === "vision" && fail) throw new Error("图片模型不可用");
      return stubModel(request);
    };
    const h = harness(model);
    const { project } = await newProject();
    await upload(project.id);
    await startResearch(db, h.enqueue, project.id);
    await h.drain();
    expect(await statusOf(project.id)).toBe("awaiting_positioning");
    const [failed] = await db.select().from(projectImages).where(eq(projectImages.projectId, project.id));
    expect(failed.analysisStatus).toBe("failed");
    expect(failed.analysisError).toContain("不可用");

    fail = false;
    await retryFailedImages(db, project.id);
    await decide(db, h.enqueue, { projectId: project.id, gate: "positioning", actor: "founder", verdict: "approve" });
    await decide(db, h.enqueue, { projectId: project.id, gate: "positioning", actor: "customer", verdict: "approve" });
    await h.drain();
    const [ok] = await db.select().from(projectImages).where(eq(projectImages.projectId, project.id));
    expect(ok.analysisStatus).toBe("done");
  });

  it("暂停时完成正在读的截图，恢复前不启动下一张图或初诊", async () => {
    const { project } = await newProject();
    let pauseOnFirstImage = true;
    const h = harness(async (request) => {
      if (request.agent === "vision" && pauseOnFirstImage) {
        pauseOnFirstImage = false;
        await setPaused(db, h.enqueue, project.id, true);
      }
      return stubModel(request);
    });
    await upload(project.id);
    await upload(project.id);
    await startResearch(db, h.enqueue, project.id);
    await h.drain();
    expect((await tasksOf(project.id)).map(({ agent, status }) => [agent, status])).toEqual([["vision", "succeeded"]]);
    expect(await statusOf(project.id)).toBe("researching");
    await setPaused(db, h.enqueue, project.id, false);
    await h.drain();
    expect((await tasksOf(project.id)).filter((task) => task.agent === "vision")).toHaveLength(2);
    expect(await statusOf(project.id)).toBe("awaiting_positioning");
  });

  it("拒绝伪装成图片的文件，并限制数量", async () => {
    const { project } = await newProject();
    await expect(upload(project.id, new TextEncoder().encode("<svg onload=alert(1)>"))).rejects.toThrow("只支持");
    for (let i = 0; i < 6; i++) await upload(project.id);
    await expect(upload(project.id)).rejects.toThrow("最多");
  });

  it("A 项目不能读取或删除 B 项目的截图（AC-10）", async () => {
    const a = await newProject();
    const b = await newProject();
    await upload(b.project.id);
    const [image] = await db.select().from(projectImages).where(eq(projectImages.projectId, b.project.id));
    expect(await loadProjectImage(db, a.project.id, image.id)).toBeNull();
    expect((await loadProjectImage(db, b.project.id, image.id))?.mimeType).toBe("image/png");
    expect(await loadProjectImage(db, b.project.id, "not-a-uuid")).toBeNull();
    await deleteProjectImage(db, a.project.id, image.id);
    expect(await db.select().from(projectImages).where(eq(projectImages.id, image.id))).toHaveLength(1);
    await deleteProjectImage(db, b.project.id, image.id);
    expect(await db.select().from(projectImages).where(eq(projectImages.id, image.id))).toHaveLength(0);
  });

  it("项目结束后不能再上传", async () => {
    const { project } = await newProject();
    await db.update(projects).set({ status: "delivered" }).where(eq(projects.id, project.id));
    await expect(upload(project.id)).rejects.toThrow("已结束");
  });
});

describe("产品事实证据", () => {
  it("客户提供的产品事实可以绑定声明，且不带付费证据等级", async () => {
    const row = await addManualEvidence(db, {
      url: "https://example.com/product",
      quote: "Works with Zoom recordings out of the box",
      sourceText: "Features: Works with Zoom recordings out of the box.",
      kind: "product",
      stance: "neutral",
    });
    expect(row.grade).toBeNull();
    expect(row.status).toBe("verified");
  });
});

describe("订单和留资的唯一约束（AC-05）", () => {
  it("同一页面同一邮箱不能重复", async () => {
    const { page } = await toPublished();
    await db.insert(leads).values({ landingPageId: page.id, email: "a@example.com" });
    await expect(
      db.insert(leads).values({ landingPageId: page.id, email: "a@example.com" }),
    ).rejects.toThrow();
  });
});

describe("预检索和品类证据库", () => {
  const fakeSources = (calls: string[]): SourceClient => ({
    names: ["hn", "boom"],
    async search(source, query) {
      calls.push(`${source}:${query}`);
      if (source === "boom") throw new Error("来源挂了");
      return {
        searchCalls: 0,
        results: [
          { url: "https://news.ycombinator.com/item?id=1", title: "a", text: "Same thread shows up for both queries here." },
          { url: `https://news.ycombinator.com/item?id=${query.length}`, title: "b", text: `Result for ${query} with enough text.` },
        ],
      };
    },
    async readPage() {
      throw new Error("不读网页");
    },
  });

  it("并行检索时跳过重复的检索词和网址，失败的来源不影响其他来源", async () => {
    const { project } = await newProject();
    const calls: string[] = [];
    const report = await gatherSources(
      db,
      fakeSources(calls),
      [
        { source: "hn", query: "meeting notes", purpose: "support", candidate: "A" },
        { source: "hn", query: "Meeting  Notes", purpose: "support", candidate: "A" },
        { source: "hn", query: "meeting bot", purpose: "counter", candidate: "A" },
        { source: "boom", query: "x", purpose: "support", candidate: "A" },
        { source: "unknown", query: "x", purpose: "support", candidate: "A" },
      ],
      { projectId: project.id },
    );
    expect(calls.sort()).toEqual(["boom:x", "hn:meeting bot", "hn:meeting notes"]);
    expect(report.skippedDuplicates).toBe(1);
    expect(report.failures).toHaveLength(1);
    expect(new Set(report.results.map((r) => r.url)).size).toBe(report.results.length);

    // 同一项目再检索一次，已搜过的检索词不再请求。
    calls.length = 0;
    await gatherSources(db, fakeSources(calls), [{ source: "hn", query: "meeting notes", purpose: "support", candidate: "A" }], {
      projectId: project.id,
    });
    expect(calls).toEqual([]);
  });

  it("预存证据只有被选中复制后，项目才能看到；重复复制不会多存", async () => {
    const { project } = await newProject();
    const seed = await addManualEvidence(db, {
      url: "https://news.ycombinator.com/item?id=9",
      quote: "I would pay for a private meeting notes tool",
      sourceText: "Honestly I would pay for a private meeting notes tool today.",
      kind: "signal",
      stance: "support",
      category: "ai_meeting_notes",
      createdBy: "library",
    });
    expect((await visibleEvidence(db, project.id)).map((e) => e.id)).not.toContain(seed.id);
    expect((await libraryEvidence(db, ["ai_meeting_notes"])).map((e) => e.id)).toContain(seed.id);
    const first = await copyLibraryEvidence(db, project.id, [seed.id], "顾问");
    const again = await copyLibraryEvidence(db, project.id, [seed.id], "顾问");
    expect(again[0].evidence_id).toBe(first[0].evidence_id);
    const visible = await visibleEvidence(db, project.id);
    expect(visible).toHaveLength(1);
    expect(visible[0]).toMatchObject({ candidate: "顾问", createdBy: "library:library", excerpt: seed.excerpt });
  });

  it("现场检索有次数上限，同一检索词不重复搜，同一摘录不重复存", async () => {
    const { project } = await newProject();
    const calls: string[] = [];
    const tools = createResearchTools({ db, projectId: project.id, sources: fakeSources(calls), onSearchCalls: () => {}, searchLimit: 2 });
    const search = (query: string) =>
      tools.search_evidence.execute({ query, source: "hn", purpose: "support", candidate: "A" } as never) as Promise<unknown>;
    await search("one");
    expect(await search("ONE")).toMatchObject({ error: expect.stringContaining("刚刚搜过") });
    await search("two");
    expect(await search("three")).toMatchObject({ error: expect.stringContaining("用完") });
    expect(calls).toEqual(["hn:one", "hn:two"]);

    const save = () =>
      tools.save_evidence.execute({
        url: "https://news.ycombinator.com/item?id=1",
        quote: "Same thread shows up for both queries",
        kind: "pain",
        stance: "support",
        candidate: "A",
        product: null,
        category: null,
        number_value: null,
        metric: null,
      } as never) as Promise<{ evidence_id: string }>;
    const a = await save();
    const b = await save();
    expect(b.evidence_id).toBe(a.evidence_id);
    expect(await visibleEvidence(db, project.id)).toHaveLength(1);
  });

  it("Research 先规划检索，再把预检索结果和预存证据交给模型", async () => {
    const { seen, wrapped } = recording();
    const h = harness(wrapped);
    const { project } = await newProject();
    await startResearch(db, h.enqueue, project.id);
    await h.drain();
    const plan = seen.findIndex((r) => r.agent === "research:plan");
    const research = seen.findIndex((r) => r.agent === "research");
    expect(plan).toBeGreaterThanOrEqual(0);
    expect(plan).toBeLessThan(research);
    const input = JSON.parse(String(seen[research].messages[1].content));
    expect(input.prefetched.length).toBeGreaterThan(0);
    expect(input).toHaveProperty("library");
    const [task] = (await tasksOf(project.id)).filter((t) => t.agent === "research");
    expect(task.model).toBe("stub-model");
  });
});
