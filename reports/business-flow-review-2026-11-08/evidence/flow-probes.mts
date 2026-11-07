// Business-path counterexamples. Uses only a disposable database, stub model,
// controlled sources and an in-memory queue. Does not touch the configured DB.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "node:net";
import { createDb } from "../../../firstcustomer/src/db/index.ts";
import { authUsers, customerMemberships, events, leads, orders, projects, supportMessages } from "../../../firstcustomer/src/db/schema.ts";
import { createStubSources, stubModel } from "../../../firstcustomer/src/ai/stub-model.ts";
import { acceptDelivery, createProject, decide, deliverProject, retryProject, setPaused, startResearch, startReview } from "../../../firstcustomer/src/workflow/actions.ts";
import { advanceProject, pageMetrics } from "../../../firstcustomer/src/workflow/engine.ts";
import { activateAccountPro } from "../../../firstcustomer/src/workflow/membership.ts";
import { editLandingPage } from "../../../firstcustomer/src/workflow/landing-edits.ts";
import { loadProjectView, loadPublishedPage } from "../../../firstcustomer/src/workflow/queries.ts";
import { workPackageReadiness } from "../../../firstcustomer/src/workflow/work-packages.ts";
import { openSupportMessage, replyToSupport } from "../../../firstcustomer/src/workflow/support.ts";
import { canTransition } from "../../../firstcustomer/src/domain/workflow.ts";
import { checkClaims } from "../../../firstcustomer/src/domain/claims.ts";
import { verifyQuote } from "../../../firstcustomer/src/domain/evidence.ts";
import { evaluateExperiment, unsupportedFigures } from "../../../firstcustomer/src/domain/experiment.ts";

const require = createRequire(new URL("../../../firstcustomer/package.json", import.meta.url));
const { default: EmbeddedPostgres } = await import(require.resolve("embedded-postgres"));
const { migrate } = await import(require.resolve("drizzle-orm/postgres-js/migrator"));
const { eq } = await import(require.resolve("drizzle-orm"));
const probeResults: object[] = [];
const freePort = await new Promise<number>((resolve, reject) => {
  const server = createServer();
  server.once("error", reject);
  server.listen(0, "127.0.0.1", () => {
    const address = server.address();
    if (!address || typeof address === "string") return reject(new Error("No TCP port"));
    server.close(() => resolve(address.port));
  });
});
const directory = await mkdtemp(join(tmpdir(), "fc-business-probe-"));
const pg = new EmbeddedPostgres({ databaseDir: directory, user: "probe", password: "probe", port: freePort,
  persistent: false, autoRehydrateSymlinks: true, onLog: () => {}, onError: () => {} });
let connection: ReturnType<typeof createDb> | undefined;

async function attempt(run: () => Promise<unknown>) {
  try { await run(); return { rejected: false, error: null }; }
  catch (error) { return { rejected: true, error: error instanceof Error ? error.message : String(error) }; }
}

try {
  await pg.initialise();
  await pg.start();
  await pg.createDatabase("probe");
  connection = createDb(`postgres://probe:probe@127.0.0.1:${freePort}/probe`);
  const db = connection.db;
  await migrate(db, { migrationsFolder: fileURLToPath(new URL("../../../firstcustomer/drizzle", import.meta.url)) });
  const project = async (id: string) => (await db.select().from(projects).where(eq(projects.id, id)))[0];
  const queue: string[] = [];
  const enqueue = async (id: string) => { queue.push(id); };
  const deps = { db, model: stubModel, sources: createStubSources(), enqueue };
  const drain = async () => {
    for (let i = 0; queue.length && i < 40; i++) await advanceProject(deps, queue.shift()!);
    assert.equal(queue.length, 0, "Probe queue did not drain");
  };
  const input = { productName: "Note Taker", stage: "已有 MVP", goal: "找首批用户", targetMarket: "北美", contact: "probe@example.test" };
  async function accountCustomer() {
    const id = crypto.randomUUID();
    await db.insert(authUsers).values({ id, name: "Isolated business probe", email: `${id}@example.test` });
    await db.insert(customerMemberships).values({ customerId: id, plan: "pro", source: "test", testAccount: true });
    return id;
  }
  async function accountPositioning() {
    const customerId = await accountCustomer();
    const result = await createProject(db, { ...input, customerId, productPlan: "free" });
    await activateAccountPro(db, result.project.id, customerId, enqueue);
    await drain();
    assert.equal((await project(result.project.id)).status, "awaiting_positioning");
    return result.project.id;
  }
  async function accountPublished() {
    const id = await accountPositioning();
    await decide(db, enqueue, { projectId: id, gate: "positioning", actor: "customer", verdict: "approve" });
    await drain();
    await decide(db, enqueue, { projectId: id, gate: "publish", actor: "customer", verdict: "approve" });
    assert.equal((await project(id)).status, "collecting");
    return id;
  }
  async function observations(pageId: string) {
    await db.insert(events).values(Array.from({ length: 25 }, (_, index) => ({ landingPageId: pageId, type: "visit", visitorHash: `fixture-${index}` })));
    await db.insert(leads).values([1, 2].map((index) => ({ landingPageId: pageId, email: `fixture-${index}@example.test` })));
  }

  // BP01: An early review cannot be refreshed after real metrics arrive.
  {
    const id = await accountPublished();
    const initial = await loadProjectView(db, await project(id));
    await startReview(db, enqueue, id, "customer");
    await drain();
    await observations(initial.page!.id);
    const restart = await attempt(() => startReview(db, enqueue, id, "customer"));
    await advanceProject(deps, id);
    const view = await loadProjectView(db, await project(id));
    assert.equal(view.report?.verdict, "insufficient");
    assert.equal(evaluateExperiment(view.report!.experiment, view.metrics!), "passed");
    assert.equal(restart.rejected, true);
    probeResults.push({ id: "BP01", finding: "Insufficient review is frozen after new data arrives", reproduced: true,
      actual: { projectStatus: (await project(id)).status, savedVerdict: view.report!.verdict, savedMetrics: view.report!.metrics,
        liveMetrics: view.metrics, verdictUsingLiveMetrics: evaluateExperiment(view.report!.experiment, view.metrics!), restart } });
  }

  // BP02: Delivered -> changes requested never reopens editing or re-delivery.
  {
    const result = await createProject(db, { ...input, isOwnProduct: true });
    const id = result.project.id;
    await startResearch(db, enqueue, id); await drain();
    for (const actor of ["founder", "customer"] as const) await decide(db, enqueue, { projectId: id, gate: "positioning", actor, verdict: "approve" });
    await drain();
    for (const actor of ["founder", "customer"] as const) await decide(db, enqueue, { projectId: id, gate: "publish", actor, verdict: "approve" });
    await startReview(db, enqueue, id); await drain();
    const ready = await workPackageReadiness(db, await project(id)); assert.equal(ready.ready, true);
    await deliverProject(db, id, ready.stamp);
    await acceptDelivery(db, { projectId: id, verdict: "reject", reason: "Fixture: please revise the page", stamp: ready.stamp });
    const view = await loadProjectView(db, await project(id));
    const edit = await attempt(() => editLandingPage(db, { projectId: id, version: view.page!.version, content: view.page!.content as never, image: "none", claim: null }));
    const redeliver = await attempt(() => deliverProject(db, id));
    const [order] = await db.select().from(orders).where(eq(orders.projectId, id));
    assert.equal(edit.rejected, true); assert.equal(redeliver.rejected, true);
    probeResults.push({ id: "BP02", finding: "Acceptance rejection has no rework path", reproduced: true,
      actual: { projectStatus: (await project(id)).status, deliveryStatus: order.deliveryStatus,
        canReopen: canTransition("delivered", "preparing_page"), edit, redeliver } });
  }

  // BP03: A previously accepted historical quote is silently reclassified.
  {
    const customerId = await accountCustomer();
    const result = await createProject(db, { ...input, customerId, productPlan: "free" });
    const id = result.project.id;
    await db.update(projects).set({ productPlan: "pro", status: "awaiting_payment", requiresPayment: true }).where(eq(projects.id, id));
    await db.insert(orders).values({ projectId: id, sku: "Previously accepted quote fixture", status: "accepted", quoteVersion: 2,
      quoteFen: 29900, proposal: { summary: "Accepted historical scope" } as never });
    const activated = await activateAccountPro(db, id, customerId, enqueue);
    const [order] = await db.select().from(orders).where(eq(orders.projectId, id));
    assert.equal(order.status, "account_active");
    const current = await project(id);
    probeResults.push({ id: "BP03", finding: "Account entitlement overwrites accepted historical order status", reproduced: true,
      fixture: { projectStatus: "awaiting_payment", orderStatus: "accepted", quoteVersion: 2, quoteFen: 29900 },
      actual: { activated, projectStatus: current.status, requiresPayment: current.requiresPayment, orderStatus: order.status, quoteFen: order.quoteFen } });
    queue.splice(0); // The reclassification itself is the observation; don't execute this fixture's research.
  }

  // BP04: Approval is committed before the queue operation, leaving no runnable job.
  {
    const id = await accountPositioning();
    const failure = await attempt(() => decide(db, async () => { throw new Error("Injected queue failure"); },
      { projectId: id, gate: "positioning", actor: "customer", verdict: "approve" }));
    const current = await project(id);
    const retry = await attempt(() => retryProject(db, enqueue, id));
    assert.equal(current.status, "preparing_page"); assert.equal(queue.length, 0);
    probeResults.push({ id: "BP04", finding: "Queue failure after approval leaves an active state without a job", reproduced: true,
      actual: { failure, projectStatus: current.status, queuedJobs: queue.length, retry },
      boundary: "Account Pro can recover by re-entering a module; automatic atomic recovery is missing. Queue is injected, not real pg-boss." });
  }

  // BP05: The public URL used by an existing channel post stops resolving after re-publication.
  {
    const id = await accountPublished();
    const before = await loadProjectView(db, await project(id));
    await observations(before.page!.id);
    const oldMetrics = await pageMetrics(db, before.page!.id);
    await editLandingPage(db, { projectId: id, version: before.page!.version, content: before.page!.content as never, image: "none", claim: null });
    await decide(db, enqueue, { projectId: id, gate: "publish", actor: "customer", verdict: "approve" });
    const after = await loadProjectView(db, await project(id));
    const oldLink = await loadPublishedPage(db, before.page!.slug);
    assert.equal(oldLink, null); assert.equal(after.metrics!.visits, 0);
    probeResults.push({ id: "BP05", finding: "New publication invalidates old public URL and switches the metrics sample", reproduced: true,
      actual: { urlChanged: before.page!.slug !== after.page!.slug, previousPublicUrlResolvable: oldLink !== null,
        previousVersionMetrics: oldMetrics, currentVersionMetrics: after.metrics,
        historyRetained: (await pageMetrics(db, before.page!.id)).visits === 25 } });
  }

  // BP06: Successful self-service review has no terminal project transition.
  {
    const id = await accountPublished();
    const before = await loadProjectView(db, await project(id)); await observations(before.page!.id);
    await startReview(db, enqueue, id, "customer"); await drain();
    const current = await project(id); const view = await loadProjectView(db, current);
    assert.equal(view.report!.verdict, "passed"); assert.equal(current.status, "reviewing");
    const [order] = await db.select().from(orders).where(eq(orders.projectId, id));
    probeResults.push({ id: "BP06", finding: "Completed self-service review remains active without a customer close operation", reproduced: true,
      actual: { projectStatus: current.status, verdict: view.report!.verdict, nextHypothesis: view.report!.next_hypothesis,
        deliveryStatus: order.deliveryStatus, readiness: (await workPackageReadiness(db, current)).ready },
      boundary: "Review generation succeeds; this is a completion-state and retention-flow gap, not failure to generate a report." });
  }

  // BP07/BP08: Recheck the two semantic/numeric counterexamples on current source.
  {
    const source = "I complain about meeting notes but I would never pay for another notes app.";
    const excerpt = "I would never pay for another notes app";
    const claim = "Customers are willing to pay for our notes app";
    const quote = verifyQuote(excerpt, source);
    const violations = checkClaims({ projectId: "probe", now: new Date(),
      page: { headline: "Meeting notes", subheadline: "For teams", value_props: ["Clear notes"], scenarios: ["Team calls"], cta_label: "Try", form_prompt: "Your email" },
      claims: [{ text: claim, kind: "pain", evidence_id: "fixture", location: "page" }], assets: [],
      evidence: [{ id: "fixture", projectId: "probe", status: quote.status, licenseStatus: "public_reference", expiresAt: new Date(Date.now() + 86400000) }] });
    assert.equal(violations.length, 0);
    probeResults.push({ id: "BP07", finding: "Opposite meaning passes structural claim checks", reproduced: true,
      fixture: { source, excerpt, claim }, actual: { quoteStatus: quote.status, violations },
      boundary: "Structural check only; this probe does not prove an end-to-end public release or evaluate human review." });
    const statement = "Our product increased revenue by 19%.";
    const numberSource = "A competitor charges $19 per seat per month.";
    const unsupported = unsupportedFigures(statement, [numberSource]); assert.equal(unsupported.length, 0);
    probeResults.push({ id: "BP08", finding: "Numeric checks conflate a competitor price with our revenue percentage", reproduced: true,
      fixture: { source: numberSource, statement }, actual: { unsupported },
      boundary: "Numeric check only, not an observed customer-facing incident." });
  }

  // BP09: A paused project accepts support requests but cannot process or directly answer them.
  {
    const id = await accountPublished();
    await setPaused(db, enqueue, id, true);
    await openSupportMessage(db, enqueue, id, "现在进度如何？什么时候可以继续？");
    await drain();
    const [message] = await db.select().from(supportMessages).where(eq(supportMessages.projectId, id));
    assert.equal(message.status, "queued");
    const manualReply = await attempt(() => replyToSupport(db, id, message.id, "Fixture: checking the pause."));
    assert.equal(manualReply.rejected, true);
    probeResults.push({ id: "BP09", finding: "Pausing work also blocks ordinary support and its manual reply", reproduced: true,
      actual: { projectPaused: (await project(id)).paused, supportStatus: message.status, reply: message.reply, manualReply },
      boundary: "Escalated complaints are a separate path; this probe covers an ordinary progress question." });
  }

  const result = { generatedAt: new Date().toISOString(), scope: "isolated_business_counterexamples", liveModelUsed: false,
    configuredDatabaseUsed: false, externalPublishingPerformed: false, probes: probeResults };
  await writeFile(new URL("./flow-probes.json", import.meta.url), JSON.stringify(result, null, 2) + "\n");
  console.log(JSON.stringify({ completed: true, probes: probeResults.length, results: probeResults }, null, 2));
} finally {
  await connection?.sql.end();
  await pg.stop();
  await rm(directory, { recursive: true, force: true });
}
