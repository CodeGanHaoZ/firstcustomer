import { and, asc, desc, eq, ne, sql } from "drizzle-orm";
import type { ResearchOutput } from "@/agents/schemas";
import type { Db } from "@/db";
import {
  agentTasks,
  campaigns,
  clarifications,
  claims,
  counterResponses,
  decisions,
  evidenceItems,
  evidenceSearches,
  landingPages,
  leads,
  positionings,
  projectImages,
  projects,
  stateTransitions,
} from "@/db/schema";
import { gateState, type Gate } from "@/domain/approval";
import type { ExperimentPlan, ExperimentVerdict, Metrics } from "@/domain/experiment";
import { pageMetrics, reportFor } from "./engine";

export type Project = typeof projects.$inferSelect;

export type ReportContent = {
  summary: string;
  actions_taken: string[];
  uncertainties: string[];
  next_steps: string[];
  next_hypothesis: string | null;
  experiment: ExperimentPlan;
  metrics: Metrics;
  verdict: ExperimentVerdict;
  verdict_label: string;
  feedback: { type: string; payload: { text?: string; url?: string | null } | null }[];
};

export async function isSimulated(db: Db, projectId: string) {
  const [row] = await db
    .select({ id: agentTasks.id })
    .from(agentTasks)
    .where(and(eq(agentTasks.projectId, projectId), eq(agentTasks.provider, "stub")))
    .limit(1);
  return !!row;
}

export async function loadProjectView(db: Db, project: Project) {
  const [diagnosis] = await db.select({ result: agentTasks.output }).from(agentTasks)
    .where(and(eq(agentTasks.projectId, project.id), eq(agentTasks.agent, "research"),
      eq(agentTasks.status, "succeeded"), sql`${agentTasks.output}->>'status' = 'done'`))
    .orderBy(asc(agentTasks.startedAt)).limit(1);
  const [positioning] = await db
    .select()
    .from(positionings)
    .where(eq(positionings.projectId, project.id))
    .orderBy(desc(positionings.version))
    .limit(1);

  const [page] = await db
    .select()
    .from(landingPages)
    .where(and(eq(landingPages.projectId, project.id), ne(landingPages.status, "superseded")))
    .orderBy(desc(landingPages.version))
    .limit(1);

  const evidence = await db
    .select()
    .from(evidenceItems)
    .where(eq(evidenceItems.projectId, project.id))
    .orderBy(desc(evidenceItems.createdAt));

  const searches = await db
    .select()
    .from(evidenceSearches)
    .where(eq(evidenceSearches.projectId, project.id))
    .orderBy(desc(evidenceSearches.createdAt));

  const responses = positioning
    ? await db
        .select({
          evidenceId: counterResponses.evidenceId,
          response: counterResponses.response,
          note: counterResponses.note,
          excerpt: evidenceItems.excerpt,
          url: evidenceItems.url,
        })
        .from(counterResponses)
        .innerJoin(evidenceItems, eq(counterResponses.evidenceId, evidenceItems.id))
        .where(eq(counterResponses.positioningId, positioning.id))
    : [];

  const pageClaims = page
    ? await db
        .select({
          id: claims.id,
          text: claims.text,
          kind: claims.kind,
          location: claims.location,
          excerpt: evidenceItems.excerpt,
          url: evidenceItems.url,
          grade: evidenceItems.grade,
        })
        .from(claims)
        .leftJoin(evidenceItems, eq(claims.evidenceId, evidenceItems.id))
        .where(eq(claims.landingPageId, page.id))
    : [];

  const [campaign] = page
    ? await db.select().from(campaigns).where(eq(campaigns.landingPageId, page.id)).limit(1)
    : [];

  const metrics = page?.status === "published" ? await pageMetrics(db, page.id) : null;
  const report = await reportFor(db, project);

  const allDecisions = await db.select().from(decisions).where(eq(decisions.projectId, project.id));
  const gateFor = (gate: Gate, version: number) => gateState(allDecisions, gate, version);

  const questions = await db
    .select()
    .from(clarifications)
    .where(eq(clarifications.projectId, project.id))
    .orderBy(asc(clarifications.createdAt));

  // 列表不取图片内容，图片由单独的路由按需读取。
  const images = await db
    .select({
      id: projectImages.id,
      kind: projectImages.kind,
      note: projectImages.note,
      analysisStatus: projectImages.analysisStatus,
      analysis: projectImages.analysis,
      analysisError: projectImages.analysisError,
    })
    .from(projectImages)
    .where(eq(projectImages.projectId, project.id))
    .orderBy(asc(projectImages.createdAt));

  return {
    diagnosis: (diagnosis?.result ?? null) as Extract<ResearchOutput, { status: "done" }> | null,
    clarifications: questions,
    images,
    positioning,
    page,
    evidence,
    searches,
    responses,
    pageClaims,
    campaign,
    metrics,
    report: (report?.content ?? null) as ReportContent | null,
    decisions: allDecisions,
    gates: {
      positioning: gateFor("positioning", project.positioningVersion),
      publish: gateFor("publish", page?.version ?? 0),
      next_round: gateFor("next_round", project.round),
    },
    simulated: await isSimulated(db, project.id),
  };
}

export type ProjectView = Awaited<ReturnType<typeof loadProjectView>>;

export async function loadProjectAudit(db: Db, projectId: string) {
  const tasks = await db
    .select()
    .from(agentTasks)
    .where(eq(agentTasks.projectId, projectId))
    .orderBy(desc(agentTasks.startedAt));
  const transitions = await db
    .select()
    .from(stateTransitions)
    .where(eq(stateTransitions.projectId, projectId))
    .orderBy(desc(stateTransitions.createdAt));
  return { tasks, transitions };
}

export async function loadLeads(db: Db, projectId: string) {
  return db
    .select({
      id: leads.id,
      email: leads.email,
      message: leads.message,
      isTest: leads.isTest,
      createdAt: leads.createdAt,
    })
    .from(leads)
    .innerJoin(landingPages, eq(leads.landingPageId, landingPages.id))
    .where(eq(landingPages.projectId, projectId))
    .orderBy(desc(leads.createdAt));
}

export async function loadProjectImage(db: Db, projectId: string, imageId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(imageId)) return null;
  const [image] = await db
    .select({ mimeType: projectImages.mimeType, data: projectImages.data })
    .from(projectImages)
    .where(and(eq(projectImages.id, imageId), eq(projectImages.projectId, projectId)));
  return image ?? null;
}

export function imageResponse(image: { mimeType: string; data: Buffer }, cacheControl = "private, max-age=3600") {
  return new Response(new Uint8Array(image.data), {
    headers: {
      "content-type": image.mimeType,
      "cache-control": cacheControl,
      "x-content-type-options": "nosniff",
      "content-security-policy": "default-src 'none'",
      "referrer-policy": "no-referrer",
    },
  });
}

export async function loadPublishedPage(db: Db, slug: string) {
  const [page] = await db
    .select()
    .from(landingPages)
    .where(and(eq(landingPages.slug, slug), eq(landingPages.status, "published")));
  if (!page) return null;
  const pageClaims = await db
    .select({ text: claims.text, kind: claims.kind })
    .from(claims)
    .where(and(eq(claims.landingPageId, page.id), eq(claims.location, "page")));
  const [project] = await db
    .select({ productName: projects.productName, productUrl: projects.productUrl })
    .from(projects)
    .where(eq(projects.id, page.projectId));
  return { page, claims: pageClaims, project, simulated: await isSimulated(db, page.projectId) };
}
