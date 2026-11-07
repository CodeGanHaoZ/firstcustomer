import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer, type AddressInfo } from "node:net";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { and, eq } from "drizzle-orm";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import EmbeddedPostgres from "embedded-postgres";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createDb, type Db } from "@/db";
import { agentTasks, conclusionEvidence, conclusionReviews, evidenceConclusions, evidenceItems, projects, sourceDocuments, sourceVersions } from "@/db/schema";
import { captureSource, readCapturedSource, textHash } from "@/workflow/source-versions";
import { storeEvidence } from "@/agents/tools";
import { copyLibraryEvidence } from "@/agents/library";
import { addManualEvidence, createProject, decide, startResearch } from "@/workflow/actions";
import { evidenceTraceProblems, loadProjectProvenance, recordConclusion, reviewConclusion } from "@/workflow/provenance";
import { createStubSources, stubModel } from "@/ai/stub-model";
import { advanceProject } from "@/workflow/engine";
import { workPackageReadiness } from "@/workflow/work-packages";
import { ConclusionStatus, ProvenanceSection } from "@/components/provenance-details";

let pg: EmbeddedPostgres;
let db: Db;
let close: () => Promise<unknown>;
let dir: string;
beforeAll(async () => {
  const port = await new Promise<number>((resolve, reject) => {
    const server = createServer();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const available = (server.address() as AddressInfo).port;
      server.close((error) => error ? reject(error) : resolve(available));
    });
  });
  dir = mkdtempSync(join(tmpdir(), "fc-provenance-"));
  pg = new EmbeddedPostgres({ databaseDir: dir, user: "test", password: "test", port,
    persistent: false, autoRehydrateSymlinks: true, onLog: () => {}, onError: () => {} });
  await pg.initialise(); await pg.start(); await pg.createDatabase("test");
  const client = createDb(`postgres://test:test@127.0.0.1:${port}/test`);
  db = client.db; close = () => client.sql.end();
  await migrate(db, { migrationsFolder: "./drizzle" });
});
afterAll(async () => { await close?.(); await pg?.stop(); if (dir) rmSync(dir, { recursive: true, force: true }); });
beforeEach(async () => {
  await db.delete(projects);
  await db.delete(evidenceItems);
  await db.delete(sourceVersions);
  await db.delete(sourceDocuments);
});

const url = "https://example.com/research";
const quote = "Consultants spend time rewriting meeting notes for their clients.";
const newProject = async () => (await createProject(db, { productName: "Trace test", stage: "MVP", goal: "Find users", contact: "trace@example.com", productPlan: "free" })).project;
const manual = (projectId?: string) => addManualEvidence(db, { projectId, url, quote, sourceText: quote,
  kind: "pain", stance: "support" });
const pick = (sourceVersionId: string) => ({ sourceVersionId, url, quote, kind: "pain" as const,
  stance: "support" as const, candidate: "Consultants", product: null, category: null, number_value: null, metric: null });
async function fixture() {
  const project = await newProject();
  const evidence = await manual(project.id);
  const conclusion = await recordConclusion(db, { project, subjectType: "research", subjectId: crypto.randomUUID(), key: "summary",
    statement: "Consultants may benefit from better notes", rationale: "A hypothesis pending a purchase experiment.",
    actor: "founder", evidence: [{ id: evidence.id, role: "context" }] });
  return { project, evidence, conclusion };
}

describe("不可变来源版本", () => {
  it("重复抓取保留旧正文；新证据绑定本次版本而非可变 URL", async () => {
    const project = await newProject();
    const first = await captureSource(db, { url, title: "Before", text: quote }, { projectId: project.id });
    const one = await storeEvidence(db, project.id, pick(first.id));
    const second = await captureSource(db, { url, title: "After", text: `${quote} Updated context.` }, { projectId: project.id });
    const two = await storeEvidence(db, project.id, pick(second.id));
    expect(one.evidence_id).not.toBe(two.evidence_id);
    const trace = await loadProjectProvenance(db, project.id);
    expect(trace.evidence.find((row) => row.id === one.evidence_id)?.source).toMatchObject({ id: first.id, text: quote, sha256: textHash(quote) });
    expect(trace.evidence.find((row) => row.id === two.evidence_id)?.source?.id).toBe(second.id);
    expect((await storeEvidence(db, project.id, pick(first.id))).evidence_id).toBe(one.evidence_id);
  });

  it("并发采集同一 URL 后按显式版本保存，不串用正文", async () => {
    const project = await newProject();
    const [a, b] = await Promise.all([quote, "A different study only measures trial activity."].map((text) =>
      captureSource(db, { url, title: "Concurrent", text }, { projectId: project.id })));
    await expect(storeEvidence(db, project.id, pick(a.id))).resolves.toHaveProperty("evidence_id");
    await expect(storeEvidence(db, project.id, pick(b.id))).rejects.toThrow("找不到");
    expect((await db.select().from(sourceVersions))).toHaveLength(2);
  });

  it("数据库拒绝覆盖快照、修改证据身份和伪造摘要", async () => {
    const { project, evidence } = await fixture();
    await expect(db.update(sourceVersions).set({ text: "tampered" }).where(eq(sourceVersions.id, evidence.sourceVersionId!))).rejects.toThrow();
    await expect(db.update(evidenceItems).set({ excerpt: "tampered" }).where(eq(evidenceItems.id, evidence.id))).rejects.toThrow();
    await expect(db.insert(sourceVersions).values({ projectId: project.id, url, title: "x", text: quote,
      sha256: "0".repeat(64), method: "manual", actor: "test" })).rejects.toThrow();
    await expect(db.delete(sourceVersions).where(eq(sourceVersions.id, evidence.sourceVersionId!))).rejects.toThrow();
    await expect(db.delete(evidenceItems).where(eq(evidenceItems.id, evidence.id))).rejects.toThrow();
  });

  it("旧缓存不会冒充旧快照，缺链记录阻止通过来源检查", async () => {
    const { project, evidence } = await fixture();
    await db.insert(sourceDocuments).values({ url, title: "Current cache", text: quote });
    const [legacy] = await db.insert(evidenceItems).values({ ...evidence, id: crypto.randomUUID(), sourceVersionId: null }).returning();
    const trace = await loadProjectProvenance(db, project.id);
    expect(trace.evidence.find((row) => row.id === legacy.id)).toMatchObject({ source: null, complete: false });
    expect(await evidenceTraceProblems(db, project.id, [legacy.id])).toContain("缺少可访问的来源版本");
  });

  it("复制共享证据保留原来源版本和原证据身份", async () => {
    const project = await newProject();
    const original = await manual();
    const [copied] = await copyLibraryEvidence(db, project.id, [original.id], "Consultants");
    const trace = await loadProjectProvenance(db, project.id);
    expect(trace.evidence.find((row) => row.id === copied.evidence_id)).toMatchObject({
      originEvidenceId: original.id, sourceVersionId: original.sourceVersionId, complete: true,
    });
  });
});

describe("溯源范围与评价隔离", () => {
  it("拒绝跨项目/旧范围快照、证据和评价，查询不泄露他人原文", async () => {
    const { project, evidence, conclusion } = await fixture();
    const other = await newProject();
    expect(await readCapturedSource(db, { projectId: other.id, scopeVersion: 1, url })).toBeNull();
    await expect(storeEvidence(db, other.id, pick(evidence.sourceVersionId!))).rejects.toThrow();
    await expect(recordConclusion(db, { project: other, subjectType: "claim", subjectId: crypto.randomUUID(), key: "x",
      statement: "bad", rationale: "bad", evidence: [{ id: evidence.id, role: "support" }] })).rejects.toThrow("跨项目");
    expect(await loadProjectProvenance(db, other.id)).toEqual({ evidence: [], conclusions: [] });
    await expect(reviewConclusion(db, { projectId: other.id, conclusionId: conclusion.id, basisHash: "a".repeat(64),
      level: "supported", reason: "This is a sufficiently detailed reason.", reviewer: "owner" })).rejects.toThrow("无权");
    await db.update(projects).set({ scopeVersion: 2 }).where(eq(projects.id, project.id));
    await expect(storeEvidence(db, project.id, pick(evidence.sourceVersionId!))).rejects.toThrow();
    expect(await evidenceTraceProblems(db, project.id, [evidence.id])).toContain("引用缺失、跨项目或旧范围证据");
    expect((await loadProjectProvenance(db, project.id)).evidence[0].source?.text).toBe(quote);
  });

  it("数据库也阻止跨项目引用边；事务失败不留下半条结论", async () => {
    const { project, conclusion } = await fixture();
    const other = await newProject();
    const foreign = await manual(other.id);
    await expect(db.insert(conclusionEvidence).values({ conclusionId: conclusion.id, evidenceId: foreign.id, role: "support" })).rejects.toThrow();
    await expect(recordConclusion(db, { project, subjectType: "claim", subjectId: crypto.randomUUID(), key: "bad",
      statement: "bad", rationale: "bad", evidence: [{ id: crypto.randomUUID(), role: "support" }] })).rejects.toThrow();
    expect(await db.select().from(evidenceConclusions).where(eq(evidenceConclusions.projectId, project.id))).toHaveLength(1);
  });

  it("摘录匹配不提升结论评价，人工评价独立保存且保留历史", async () => {
    const { project, evidence, conclusion } = await fixture();
    let trace = await loadProjectProvenance(db, project.id);
    expect(trace.evidence[0].status).toBe("verified");
    expect(trace.conclusions[0]).toMatchObject({ support: "not_assessed", complete: true });
    for (const level of ["limited", "supported"] as const) await reviewConclusion(db, { projectId: project.id,
      conclusionId: conclusion.id, basisHash: trace.conclusions[0].basisHash, level,
      reason: `Reviewed audience, conditions and limitations: ${level}.`, reviewer: "reviewer-one" });
    trace = await loadProjectProvenance(db, project.id);
    expect(trace.conclusions[0]).toMatchObject({ support: "supported" });
    expect(trace.conclusions[0].history).toHaveLength(2);
    expect(trace.evidence.find((row) => row.id === evidence.id)?.status).toBe("verified");
    await expect(db.update(conclusionReviews).set({ level: "insufficient" })).rejects.toThrow();
  });

  it("证据撤回或过期后旧评价失效，拒绝旧页面提交和充分支持评价", async () => {
    const { project, evidence, conclusion } = await fixture();
    let current = (await loadProjectProvenance(db, project.id)).conclusions[0];
    const input = { projectId: project.id, conclusionId: conclusion.id, basisHash: current.basisHash,
      level: "supported" as const, reason: "Reviewed original evidence and relevant conditions.", reviewer: "owner" };
    await reviewConclusion(db, input);
    await db.update(evidenceItems).set({ status: "rejected" }).where(eq(evidenceItems.id, evidence.id));
    current = (await loadProjectProvenance(db, project.id)).conclusions[0];
    expect(current.support).toBe("needs_review");
    await expect(reviewConclusion(db, input)).rejects.toThrow("依据或范围已变化");
    await expect(reviewConclusion(db, { ...input, basisHash: current.basisHash })).rejects.toThrow("不能评价为较充分");
    await db.update(evidenceItems).set({ status: "verified", expiresAt: new Date(Date.now() - 1000) }).where(eq(evidenceItems.id, evidence.id));
    expect((await loadProjectProvenance(db, project.id)).conclusions[0].support).toBe("needs_review");
    expect((await loadProjectProvenance(db, project.id)).conclusions[0].history).toHaveLength(1);
  });

  it("视图分别展示摘录状态、未评价及真实快照；原文按文本转义", async () => {
    const { project, conclusion } = await fixture();
    await addManualEvidence(db, { projectId: project.id, url, quote, sourceText: `${quote} <script>bad()</script>`, kind: "pain", stance: "support" });
    const provenance = await loadProjectProvenance(db, project.id);
    const html = renderToStaticMarkup(createElement(ProvenanceSection, { provenance }));
    expect(html).toContain("摘录已匹配"); expect(html).toContain("未评价");
    expect(html).toContain(quote); expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("name=\"level\"");
    const status = renderToStaticMarkup(createElement(ConclusionStatus, { provenance, subjectId: conclusion.subjectId, recordKey: "summary" }));
    expect(status).toContain("结论支持程度"); expect(status).toContain("未评价");
    expect(status).toContain(`#conclusion-${conclusion.id}`);
  });
});

describe("生成与发布链路集成", () => {
  it("真实工作流写入结论、版本、AI 处理记录；证据过期后拒绝发布", async () => {
    const { project } = await createProject(db, { productName: "Note Taker", stage: "已有 MVP", goal: "找首批用户", targetMarket: "北美", contact: "test@example.com", isOwnProduct: true });
    const queue: string[] = [];
    const enqueue = async (id: string) => { queue.push(id); };
    const deps = { db, sources: createStubSources(), model: stubModel, enqueue };
    const drain = async () => { for (let i = 0; queue.length && i < 20; i++) await advanceProject(deps, queue.shift()!); };
    await startResearch(db, enqueue, project.id); await drain();
    let trace = await loadProjectProvenance(db, project.id);
    expect(trace.conclusions.some((row) => row.subjectType === "research")).toBe(true);
    expect(trace.conclusions.some((row) => row.subjectType === "positioning")).toBe(true);
    expect(trace.conclusions.every((row) => row.complete && row.support === "not_assessed" && row.task?.promptHash)).toBe(true);
    expect(trace.evidence.every((row) => row.source && row.task)).toBe(true);
    for (const actor of ["founder", "customer"] as const) await decide(db, enqueue, { projectId: project.id, gate: "positioning", actor, verdict: "approve" });
    await drain();
    trace = await loadProjectProvenance(db, project.id);
    expect(trace.conclusions.some((row) => row.subjectType === "claim" && row.complete)).toBe(true);
    await decide(db, enqueue, { projectId: project.id, gate: "publish", actor: "founder", verdict: "approve" });
    await db.update(evidenceItems).set({ expiresAt: new Date(Date.now() - 1000) }).where(eq(evidenceItems.projectId, project.id));
    await expect(decide(db, enqueue, { projectId: project.id, gate: "publish", actor: "customer", verdict: "approve" })).rejects.toThrow("发布前引用检查失败");
    const [current] = await db.select().from(projects).where(eq(projects.id, project.id));
    expect(current.status).toBe("awaiting_publish");
    expect((await workPackageReadiness(db, current)).ready).toBe(false);
    expect(await db.select().from(agentTasks).where(and(eq(agentTasks.projectId, project.id), eq(agentTasks.agent, "launch")))).not.toHaveLength(0);
  });
});
