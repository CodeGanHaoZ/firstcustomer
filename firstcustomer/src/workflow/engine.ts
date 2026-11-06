import { randomBytes } from "node:crypto";
import { and, asc, count, countDistinct, desc, eq, gt, inArray } from "drizzle-orm";
import {
  GROWTH_PROMPT,
  LAUNCH_PROMPT,
  RESEARCH_PLAN_PROMPT,
  RESEARCH_PROMPT,
  STRATEGY_PROMPT,
  VISION_PROMPT,
} from "@/agents/prompts";
import {
  growthOutput,
  launchOutput,
  researchOutput,
  researchPlan,
  strategyOutput,
  visionOutput,
  type LaunchOutput,
  type PositioningOption,
  type SendBackRequest,
} from "@/agents/schemas";
import type { SourceClient } from "@/agents/sources";
import { gatherSources } from "@/agents/gather";
import { LIBRARY_CATEGORIES, libraryEvidence } from "@/agents/library";
import { cacheDocument, createResearchTools } from "@/agents/tools";
import { listCostYuan } from "@/ai/call-model";
import { AgentRunError, runAgent, type RunSummary } from "@/ai/run-agent";
import type { ModelClient } from "@/ai/types";
import type { Db } from "@/db";
import {
  agentTasks,
  campaigns,
  clarifications,
  claims,
  counterResponses,
  deliverables,
  events,
  evidenceItems,
  evidenceSearches,
  landingPages,
  leads,
  positionings,
  projectImages,
  projects,
  stateTransitions,
} from "@/db/schema";
import { toDataUrl } from "@/domain/images";
import { checkClaims } from "@/domain/claims";
import { candidatesWithoutCounterSearch, unansweredCounterEvidence } from "@/domain/counter";
import {
  evaluateExperiment,
  VERDICT_LABELS,
  type ExperimentPlan,
  type Metrics,
} from "@/domain/experiment";
import {
  canTransition,
  sendBackAllowed,
  type ProjectStatus,
  type SendBackRoute,
} from "@/domain/workflow";

export type EngineDeps = {
  db: Db;
  model: ModelClient;
  sources: SourceClient;
  enqueue: (projectId: string) => Promise<void>;
};

export type Project = typeof projects.$inferSelect;

export type PendingRequest = {
  route: SendBackRoute | "rejected";
  request: SendBackRequest;
  fromTaskId?: string;
  guidance?: string;
};

export type Escalation = {
  route: SendBackRoute;
  request: SendBackRequest;
  from: ProjectStatus;
  taskId: string;
};

export class ConflictError extends Error {}

export async function transition(
  db: Db,
  project: { id: string; status: string },
  to: ProjectStatus,
  actor: string,
  reason: string | null,
  patch: Partial<typeof projects.$inferInsert> = {},
) {
  const from = project.status as ProjectStatus;
  if (!canTransition(from, to)) throw new Error(`不允许从 ${from} 流转到 ${to}`);
  await db.transaction(async (tx) => {
    const rows = await tx
      .update(projects)
      .set({ ...patch, status: to, updatedAt: new Date() })
      .where(and(eq(projects.id, project.id), eq(projects.status, from)))
      .returning({ id: projects.id });
    if (!rows.length) throw new ConflictError(`项目状态已不是 ${from}`);
    await tx.insert(stateTransitions).values({
      projectId: project.id,
      fromStatus: from,
      toStatus: to,
      actor,
      reason,
    });
  });
}

type TaskOptions = {
  agent: string;
  input: unknown;
  trigger?: string;
  parentTaskId?: string | null;
};

async function runTask<T>(
  deps: EngineDeps,
  project: Project,
  options: TaskOptions,
  run: (context: { addSearchCalls: (n: number) => void }) => Promise<{
    output: T;
    summary: RunSummary;
  }>,
) {
  const [task] = await deps.db
    .insert(agentTasks)
    .values({
      projectId: project.id,
      agent: options.agent,
      input: options.input,
      trigger: options.trigger ?? "normal",
      parentTaskId: options.parentTaskId ?? null,
      round: project.round,
    })
    .returning({ id: agentTasks.id });

  let toolSearchCalls = 0;
  const finish = (
    summary: RunSummary,
    fields: Partial<typeof agentTasks.$inferInsert>,
  ) => {
    const searchCalls = summary.usage.searchCalls + toolSearchCalls;
    return deps.db
      .update(agentTasks)
      .set({
        ...fields,
        provider: summary.provider,
        model: summary.model,
        inputTokens: summary.usage.inputTokens,
        outputTokens: summary.usage.outputTokens,
        searchCalls,
        listCostYuan:
          summary.listCostYuan + listCostYuan("", { inputTokens: 0, outputTokens: 0, searchCalls: toolSearchCalls }),
        finishedAt: new Date(),
      })
      .where(eq(agentTasks.id, task.id));
  };

  try {
    const { output, summary } = await run({
      addSearchCalls: (n) => {
        toolSearchCalls += n;
      },
    });
    await finish(summary, { status: "succeeded", output });
    return { taskId: task.id, output };
  } catch (error) {
    const summary: RunSummary =
      error instanceof AgentRunError
        ? error.summary
        : {
            provider: null,
            model: null,
            usage: { inputTokens: 0, outputTokens: 0, searchCalls: 0 },
            listCostYuan: 0,
          };
    await finish(summary, {
      status: "failed",
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

async function markTask(
  db: Db,
  taskId: string,
  fields: Partial<typeof agentTasks.$inferInsert>,
) {
  await db.update(agentTasks).set(fields).where(eq(agentTasks.id, taskId));
}

function productInput(project: Project) {
  return {
    name: project.productName,
    url: project.productUrl,
    stage: project.stage,
    goal: project.goal,
    target_market: project.targetMarket,
    budget: project.budgetNote,
  };
}

// 只看本项目的证据。预存证据库（project_id 为空）要由 Research 选中、复制进项目后才可见，
// 免得 Strategy 和 Launch 看到不相关品类的证据。
export async function visibleEvidence(db: Db, projectId: string) {
  return db
    .select()
    .from(evidenceItems)
    .where(and(gt(evidenceItems.expiresAt, new Date()), eq(evidenceItems.projectId, projectId)));
}

async function sendBack(
  deps: EngineDeps,
  project: Project,
  options: {
    route: SendBackRoute;
    request: SendBackRequest;
    taskId: string;
    to: ProjectStatus;
  },
) {
  const { db } = deps;
  const [{ used }] = await db
    .select({ used: count() })
    .from(agentTasks)
    .where(
      and(
        eq(agentTasks.projectId, project.id),
        eq(agentTasks.round, project.round),
        eq(agentTasks.status, "sent_back"),
        eq(agentTasks.sendBackRoute, options.route),
      ),
    );
  const reason = `${options.request.missing}：${options.request.reason}`;

  if (!sendBackAllowed(options.route, used)) {
    const escalation: Escalation = {
      route: options.route,
      request: options.request,
      from: project.status as ProjectStatus,
      taskId: options.taskId,
    };
    await markTask(db, options.taskId, {
      status: "escalated",
      sendBackRoute: options.route,
      sendBackReason: reason,
    });
    await transition(db, project, "awaiting_founder", "system", `打回超限：${reason}`, {
      escalation,
      founderNote: null,
    });
    return;
  }

  const pending: PendingRequest = {
    route: options.route,
    request: options.request,
    fromTaskId: options.taskId,
  };
  await markTask(db, options.taskId, {
    status: "sent_back",
    sendBackRoute: options.route,
    sendBackReason: reason,
  });
  await transition(db, project, options.to, options.route, reason, {
    pendingRequest: pending,
    founderNote: null,
  });
  await deps.enqueue(project.id);
}

function triggerFor(pending: PendingRequest | null) {
  return pending ? { trigger: "send_back", parentTaskId: pending.fromTaskId ?? null } : {};
}

// 单张截图读取失败不影响项目继续，失败原因留给老板看。
async function analyzePendingImages(deps: EngineDeps, project: Project) {
  const { db } = deps;
  const pending = await db
    .select()
    .from(projectImages)
    .where(and(eq(projectImages.projectId, project.id), eq(projectImages.analysisStatus, "pending")));
  for (const image of pending) {
    const question = {
      kind: image.kind === "competitor" ? "竞品截图" : "客户产品截图",
      note: image.note,
    };
    try {
      const { output } = await runTask(
        deps,
        project,
        { agent: "vision", input: { imageId: image.id, ...question } },
        () =>
          runAgent({
            agent: "vision",
            tier: "vision",
            system: VISION_PROMPT,
            input: question,
            userContent: [
              {
                type: "image_url",
                image_url: { url: toDataUrl(image.mimeType, image.data) },
              },
              { type: "text", text: JSON.stringify(question) },
            ],
            schema: visionOutput,
            model: deps.model,
          }),
      );
      await db
        .update(projectImages)
        .set({ analysisStatus: "done", analysis: output, analysisError: null })
        .where(eq(projectImages.id, image.id));
    } catch (error) {
      await db
        .update(projectImages)
        .set({
          analysisStatus: "failed",
          analysisError: error instanceof Error ? error.message : String(error),
        })
        .where(eq(projectImages.id, image.id));
    }
  }
}

async function screenshotContext(db: Db, projectId: string) {
  const rows = await db
    .select({
      kind: projectImages.kind,
      note: projectImages.note,
      analysis: projectImages.analysis,
    })
    .from(projectImages)
    .where(and(eq(projectImages.projectId, projectId), eq(projectImages.analysisStatus, "done")));
  return rows;
}

function mergeSummaries(list: RunSummary[]): RunSummary {
  const join = (values: (string | null)[]) =>
    [...new Set(values.flatMap((v) => (v ? v.split("+") : [])))].join("+") || null;
  return {
    provider: join(list.map((s) => s.provider)),
    model: join(list.map((s) => s.model)),
    usage: {
      inputTokens: list.reduce((n, s) => n + s.usage.inputTokens, 0),
      outputTokens: list.reduce((n, s) => n + s.usage.outputTokens, 0),
      searchCalls: list.reduce((n, s) => n + s.usage.searchCalls, 0),
    },
    listCostYuan: list.reduce((n, s) => n + s.listCostYuan, 0),
  };
}

async function readProductPage(deps: EngineDeps, url: string | null) {
  if (!url) return null;
  try {
    const page = await deps.sources.readPage(url);
    await cacheDocument(deps.db, { url, title: page.title, text: page.text });
    return { url, title: page.title, text: page.text.slice(0, 4000) };
  } catch (error) {
    return { url, error: error instanceof Error ? error.message : String(error) };
  }
}

async function runResearch(deps: EngineDeps, project: Project) {
  const { db } = deps;
  const pending = project.pendingRequest as PendingRequest | null;
  const asked = await db
    .select()
    .from(clarifications)
    .where(eq(clarifications.projectId, project.id))
    .orderBy(asc(clarifications.createdAt));
  const input = {
    product: productInput(project),
    request: pending?.request ?? null,
    founder_note: project.founderNote,
    clarifications: asked.map((c) => ({
      question: c.question,
      answer: c.answer ?? "（客户没有回答，把这项写进 unknowns）",
    })),
    screenshots: await screenshotContext(db, project.id),
  };
  const { output } = await runTask(
    deps,
    project,
    { agent: "research", input, ...triggerFor(pending) },
    async ({ addSearchCalls }) => {
      const summaries: RunSummary[] = [];
      try {
        // 第一步：程序先读产品页，由模型规划检索词。
        const productPage = await readProductPage(deps, project.productUrl);
        const plan = await runAgent({
          agent: "research:plan",
          tier: "flash",
          system: RESEARCH_PLAN_PROMPT,
          input: {
            ...input,
            product_page: productPage,
            sources: deps.sources.help ?? deps.sources.names.join("、"),
            library_categories: LIBRARY_CATEGORIES.map((c) => ({ id: c.id, label: c.label })),
          },
          schema: researchPlan,
          model: deps.model,
          validate: (p) => {
            const names = new Set(p.candidates);
            return [
              ...p.candidates
                .filter((c) => !p.queries.some((q) => q.candidate === c && q.purpose === "counter"))
                .map((c) => `候选人群“${c}”还没有安排 counter 检索`),
              ...p.queries
                .filter((q) => !names.has(q.candidate))
                .map((q) => `检索“${q.query}”的 candidate 不在 candidates 里`),
            ];
          },
        });
        summaries.push(plan.summary);

        // 第二步：程序并行检索，并取出相关品类的预存证据。
        const gathered = await gatherSources(db, deps.sources, plan.output.queries, { projectId: project.id });
        addSearchCalls(gathered.searchCalls);
        const categories = plan.output.categories.filter((c) => LIBRARY_CATEGORIES.some((l) => l.id === c));
        const library = (await libraryEvidence(db, categories)).slice(0, 40).map((e) => ({
          library_id: e.id,
          category: e.category,
          product: e.product,
          kind: e.kind,
          stance: e.stance,
          excerpt: e.excerpt,
          grade: e.grade,
          url: e.url,
        }));

        // 第三步：模型从已有资料里挑证据，只在缺口处少量补查。
        const result = await runAgent({
          agent: "research",
          system: RESEARCH_PROMPT,
          maxTurns: 10,
          input: {
            ...input,
            candidates_hint: plan.output.candidates,
            product_page: productPage,
            library,
            prefetched: gathered.results.slice(0, 40).map((r) => ({
              url: r.url,
              title: r.title,
              source: r.source,
              purpose: r.purpose,
              candidate: r.candidate,
              published_at: r.publishedAt,
              text: r.text.slice(0, 1200),
            })),
            search_failures: gathered.failures.map((f) => `${f.source}:${f.query}`),
          },
          schema: researchOutput,
          model: deps.model,
          tools: createResearchTools({
            db,
            projectId: project.id,
            sources: deps.sources,
            onSearchCalls: addSearchCalls,
            searchLimit: 6,
          }),
          validate: async (output) => {
            if (output.status === "need_info") {
              return asked.length || pending
                ? ["这个项目不能再追问客户了，请继续研究，把不确定的内容写进 unknowns"]
                : [];
            }
            const searches = await db
              .select({ candidate: evidenceSearches.candidate, purpose: evidenceSearches.purpose })
              .from(evidenceSearches)
              .where(eq(evidenceSearches.projectId, project.id));
            const known = new Set((await visibleEvidence(db, project.id)).map((e) => e.id));
            const missing = candidatesWithoutCounterSearch(
              output.candidates.map((c) => c.name),
              searches,
            ).map((c) => `候选人群“${c}”还没有做反向检索（purpose=counter）；名字请沿用 candidates_hint`);
            const unknown = output.candidates
              .flatMap((c) => c.evidence_ids)
              .filter((id) => !known.has(id))
              .map((id) => `证据 ${id} 不存在`);
            return [...missing, ...unknown];
          },
        });
        summaries.push(result.summary);
        return { output: result.output, summary: mergeSummaries(summaries) };
      } catch (error) {
        if (error instanceof AgentRunError) summaries.push(error.summary);
        throw new AgentRunError(error instanceof Error ? error.message : String(error), mergeSummaries(summaries));
      }
    },
  );
  if (output.status === "need_info") {
    await db.insert(clarifications).values(
      output.questions.map((q) => ({
        projectId: project.id,
        question: q.question,
        why: q.why,
      })),
    );
    await transition(db, project, "needs_info", "research", `追问客户 ${output.questions.length} 个问题`);
    return;
  }
  await transition(db, project, "strategizing", "research", null, { pendingRequest: null });
  await deps.enqueue(project.id);
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

function evidenceView(row: typeof evidenceItems.$inferSelect) {
  return {
    id: row.id,
    candidate: row.candidate,
    product: row.product,
    kind: row.kind,
    stance: row.stance,
    excerpt: row.excerpt,
    number: row.numberValue,
    metric: row.metric,
    grade: row.grade,
    status: row.status,
    url: row.url,
    collected_at: row.collectedAt,
  };
}

const sameOption = (a?: PositioningOption, b?: PositioningOption) =>
  !!a && !!b && a.audience === b.audience && a.value_prop === b.value_prop;

async function runStrategy(deps: EngineDeps, project: Project) {
  const { db } = deps;
  const pending = project.pendingRequest as PendingRequest | null;
  const evidence = await visibleEvidence(db, project.id);
  const current = await latestPositioning(db, project.id);
  const approved =
    current?.chosenOption !== null && current?.chosenOption !== undefined
      ? (current.options as PositioningOption[])[current.chosenOption]
      : undefined;
  const research = await db
    .select({ output: agentTasks.output })
    .from(agentTasks)
    .where(
      and(
        eq(agentTasks.projectId, project.id),
        eq(agentTasks.agent, "research"),
        eq(agentTasks.status, "succeeded"),
      ),
    );
  const answers = await db
    .select({ question: clarifications.question, answer: clarifications.answer })
    .from(clarifications)
    .where(eq(clarifications.projectId, project.id));

  const input = {
    product: productInput(project),
    research: research
      .map((r) => r.output as { status?: string })
      .filter((output) => output.status === "done"),
    clarifications: answers,
    screenshots: await screenshotContext(db, project.id),
    evidence: evidence.map(evidenceView),
    approved_positioning: approved ?? null,
    launch_request: pending?.route === "launch->strategy" ? pending.request : null,
    next_round: pending?.route === "growth->strategy" ? pending.request : null,
    rejection: pending?.route === "rejected" ? pending.request : null,
    founder_note: project.founderNote,
  };
  const againstIds = evidence.filter((e) => e.stance === "against").map((e) => e.id);

  const { taskId, output } = await runTask(
    deps,
    project,
    { agent: "strategy", input, ...triggerFor(pending) },
    () =>
      runAgent({
        agent: "strategy",
        system: STRATEGY_PROMPT,
        input,
        schema: strategyOutput,
        model: deps.model,
        validate: (result) => {
          if (result.status !== "done") return [];
          const problems = unansweredCounterEvidence(againstIds, result.counter_responses).map(
            (id) => `反面证据 ${id} 还没有回应`,
          );
          if (result.recommended_option >= result.options.length) {
            problems.push("recommended_option 超出了方案数量");
          }
          return problems;
        },
      }),
  );

  if (output.status === "need_more") {
    await sendBack(deps, project, {
      route: "strategy->research",
      request: output.request,
      taskId,
      to: "researching",
    });
    return;
  }

  // 定位没有变化时不用重新确认，直接回到准备页面。
  const recommended = output.options[output.recommended_option];
  if (pending?.route === "launch->strategy" && sameOption(recommended, approved)) {
    const next: PendingRequest = {
      route: "launch->strategy",
      request: pending.request,
      guidance: output.guidance_for_launch,
      fromTaskId: taskId,
    };
    await transition(db, project, "preparing_page", "strategy", "定位不变，只更换支撑卖点", {
      pendingRequest: next,
      founderNote: null,
    });
    await deps.enqueue(project.id);
    return;
  }

  const version = (current?.version ?? 0) + 1;
  await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(positionings)
      .values({
        projectId: project.id,
        version,
        options: output.options,
        recommendedOption: output.recommended_option,
        rationale: output.rationale,
        experiment: output.experiment,
      })
      .returning({ id: positionings.id });
    if (output.counter_responses.length) {
      await tx.insert(counterResponses).values(
        output.counter_responses
          .filter((r) => againstIds.includes(r.evidence_id))
          .map((r) => ({
            positioningId: row.id,
            evidenceId: r.evidence_id,
            response: r.response,
            note: r.note,
          })),
      );
    }
    await tx
      .update(landingPages)
      .set({ status: "superseded" })
      .where(
        and(
          eq(landingPages.projectId, project.id),
          inArray(landingPages.status, ["draft", "checked"]),
        ),
      );
  });
  await transition(db, project, "awaiting_positioning", "strategy", `定位方案第 ${version} 版`, {
    positioningVersion: version,
    pendingRequest: null,
    founderNote: null,
  });
}

function slugify(name: string) {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  return `${base || "product"}-${randomBytes(3).toString("hex")}`;
}

async function runLaunch(deps: EngineDeps, project: Project) {
  const { db } = deps;
  const pending = project.pendingRequest as PendingRequest | null;
  const positioning = await latestPositioning(db, project.id);
  if (positioning?.chosenOption === null || positioning?.chosenOption === undefined) {
    throw new Error("还没有确认定位，不能准备页面");
  }
  const chosen = (positioning.options as PositioningOption[])[positioning.chosenOption];
  const evidence = (await visibleEvidence(db, project.id)).filter(
    (e) => e.status === "verified",
  );
  const screenshots = await screenshotContext(db, project.id);

  let violations: { target: string; message: string }[] | null = null;
  let parentTaskId = pending?.fromTaskId ?? null;
  const MAX_ATTEMPTS = 2;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const input = {
      product: productInput(project),
      positioning: chosen,
      experiment: positioning.experiment,
      evidence: evidence.filter((e) => e.stance !== "against").map(evidenceView),
      screenshots,
      guidance: pending?.guidance ?? null,
      rejection: pending?.route === "rejected" ? pending.request : null,
      founder_note: project.founderNote,
      violations,
    };
    const { taskId, output } = await runTask<LaunchOutput>(
      deps,
      project,
      {
        agent: "launch",
        input,
        trigger: attempt > 1 ? "rewrite" : pending ? "send_back" : "normal",
        parentTaskId,
      },
      () =>
        runAgent({
          agent: "launch",
          system: LAUNCH_PROMPT,
          input,
          schema: launchOutput,
          model: deps.model,
        }),
    );
    parentTaskId = taskId;

    if (output.status === "need_more") {
      await sendBack(deps, project, {
        route: "launch->strategy",
        request: output.request,
        taskId,
        to: "strategizing",
      });
      return;
    }

    const found = checkClaims({
      projectId: project.id,
      page: output.page,
      claims: output.claims,
      assets: output.channel.assets,
      evidence,
      now: new Date(),
    });
    if (found.length === 0) {
      await saveLandingPage(deps, project, positioning.version, output);
      return;
    }

    violations = found;
    await markTask(db, taskId, {
      status: "rejected",
      output: { ...output, violations: found },
      sendBackReason: found.map((v) => `${v.target}：${v.message}`).join("；"),
    });
  }

  await sendBack(deps, project, {
    route: "launch->strategy",
    request: {
      missing: (violations ?? []).map((v) => v.target).join("；"),
      reason: "改写后仍有声明缺少证据",
      source_types: [],
    },
    taskId: parentTaskId as string,
    to: "strategizing",
  });
}

async function saveLandingPage(
  deps: EngineDeps,
  project: Project,
  positioningVersion: number,
  output: Extract<LaunchOutput, { status: "done" }>,
) {
  const { db } = deps;
  const [{ pages }] = await db
    .select({ pages: count() })
    .from(landingPages)
    .where(eq(landingPages.projectId, project.id));
  await db.transaction(async (tx) => {
    const [page] = await tx
      .insert(landingPages)
      .values({
        projectId: project.id,
        version: pages + 1,
        positioningVersion,
        slug: slugify(project.productName),
        content: output.page,
        status: "checked",
      })
      .returning({ id: landingPages.id });
    if (output.claims.length) {
      await tx.insert(claims).values(
        output.claims.map((c) => ({
          landingPageId: page.id,
          location: c.location,
          text: c.text,
          kind: c.kind,
          evidenceId: c.evidence_id,
          checkPassed: true,
        })),
      );
    }
    await tx.insert(campaigns).values({
      projectId: project.id,
      landingPageId: page.id,
      channel: output.channel.name,
      reason: output.channel.reason,
      checklist: output.channel.checklist,
      assets: output.channel.assets,
    });
  });
  await transition(db, project, "awaiting_publish", "launch", `页面第 ${pages + 1} 版通过声明检查`, {
    pendingRequest: null,
    founderNote: null,
  });
}

export async function pageMetrics(db: Db, landingPageId: string): Promise<Metrics> {
  const [visits] = await db
    .select({ value: countDistinct(events.visitorHash) })
    .from(events)
    .where(and(eq(events.landingPageId, landingPageId), eq(events.type, "visit")));
  const [clicks] = await db
    .select({ value: count() })
    .from(events)
    .where(and(eq(events.landingPageId, landingPageId), eq(events.type, "cta_click")));
  const [leadRows] = await db
    .select({ value: count() })
    .from(leads)
    .where(and(eq(leads.landingPageId, landingPageId), eq(leads.isTest, false)));
  const [replies] = await db
    .select({ value: count() })
    .from(events)
    .where(
      and(eq(events.landingPageId, landingPageId), inArray(events.type, ["reply", "comment"])),
    );
  return {
    visits: visits.value,
    ctaClicks: clicks.value,
    leads: leadRows.value,
    replies: replies.value,
  };
}

async function publishedPage(db: Db, projectId: string) {
  const [page] = await db
    .select()
    .from(landingPages)
    .where(and(eq(landingPages.projectId, projectId), eq(landingPages.status, "published")))
    .orderBy(desc(landingPages.version))
    .limit(1);
  return page;
}

export async function reportFor(db: Db, project: Pick<Project, "id" | "round">) {
  const [report] = await db
    .select()
    .from(deliverables)
    .where(
      and(
        eq(deliverables.projectId, project.id),
        eq(deliverables.kind, "report"),
        eq(deliverables.round, project.round),
      ),
    )
    .limit(1);
  return report;
}

async function runGrowth(deps: EngineDeps, project: Project) {
  const { db } = deps;
  if (await reportFor(db, project)) return;
  const page = await publishedPage(db, project.id);
  if (!page) throw new Error("没有已发布的页面，无法复盘");
  const positioning = await latestPositioning(db, project.id);
  const plan = positioning.experiment as ExperimentPlan;
  const metrics = await pageMetrics(db, page.id);
  const verdict = evaluateExperiment(plan, metrics);
  const feedback = await db
    .select({ type: events.type, payload: events.payload, createdAt: events.createdAt })
    .from(events)
    .where(and(eq(events.landingPageId, page.id), inArray(events.type, ["reply", "comment"])));
  const input = {
    product: productInput(project),
    experiment: plan,
    metrics,
    verdict,
    verdict_label: VERDICT_LABELS[verdict],
    feedback,
  };
  const { output } = await runTask(deps, project, { agent: "growth", input }, () =>
    runAgent({
      agent: "growth",
      system: GROWTH_PROMPT,
      input,
      schema: growthOutput,
      model: deps.model,
    }),
  );
  await db.insert(deliverables).values({
    projectId: project.id,
    kind: "report",
    round: project.round,
    content: {
      ...output,
      next_hypothesis: verdict === "failed" ? output.next_hypothesis : null,
      experiment: plan,
      metrics,
      verdict,
      verdict_label: VERDICT_LABELS[verdict],
      feedback,
    },
  });
}

const STEPS: Partial<Record<ProjectStatus, (deps: EngineDeps, project: Project) => Promise<void>>> = {
  researching: runResearch,
  strategizing: runStrategy,
  preparing_page: runLaunch,
  reviewing: runGrowth,
};

export async function advanceProject(deps: EngineDeps, projectId: string) {
  const [project] = await deps.db.select().from(projects).where(eq(projects.id, projectId));
  if (!project) return;
  const step = STEPS[project.status as ProjectStatus];
  if (!step || project.paused) return;
  try {
    await analyzePendingImages(deps, project);
    await step(deps, project);
  } catch (error) {
    if (error instanceof ConflictError) return;
    const message = error instanceof Error ? error.message : String(error);
    console.error(`项目 ${projectId} 执行失败：`, message);
    await transition(deps.db, project, "failed", "system", message, {
      failedFrom: project.status,
      failedReason: message,
    });
  }
}
