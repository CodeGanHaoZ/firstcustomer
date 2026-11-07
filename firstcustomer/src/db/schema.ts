import { sql } from "drizzle-orm";
import type { ProposalOutput, ReceiptOutput } from "@/agents/schemas";
import type { ProjectPlan } from "@/domain/workflow";
import type { KnowledgeContent, PublishedKnowledge } from "@/knowledge/types";
import type { RequirementSnapshot } from "@/domain/requirements";
import {
  boolean,
  customType,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { authUsers } from "./customer-auth-schema";

export { authAccounts, authRateLimits, authSessions, authUsers, authVerifications } from "./customer-auth-schema";

const id = () => uuid("id").primaryKey().default(sql`gen_random_uuid()`);
const createdAt = () =>
  timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const bytea = customType<{ data: Buffer }>({ dataType: () => "bytea" });

export const knowledgeArticles = pgTable("knowledge_articles", {
  id: id(),
  seedKey: text("seed_key").unique(),
  draft: jsonb("draft").$type<KnowledgeContent>().notNull(),
  revision: integer("revision").notNull().default(1),
  publication: integer("publication").notNull().default(0),
  published: jsonb("published").$type<PublishedKnowledge>(),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  createdAt: createdAt(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const knowledgeHistory = pgTable("knowledge_history", {
  id: id(),
  articleId: uuid("article_id").notNull().references(() => knowledgeArticles.id, { onDelete: "cascade" }),
  version: integer("version").notNull(),
  snapshot: jsonb("snapshot").$type<PublishedKnowledge>().notNull(),
  createdAt: createdAt(),
}, (table) => [uniqueIndex("knowledge_history_article_version_idx").on(table.articleId, table.version)]);

export const projects = pgTable("projects", {
  id: id(),
  tokenHash: text("token_hash").notNull().unique(),
  customerId: text("customer_id").references(() => authUsers.id, { onDelete: "set null" }),
  productName: text("product_name").notNull(),
  productUrl: text("product_url"),
  stage: text("stage").notNull(),
  goal: text("goal").notNull(),
  targetMarket: text("target_market"),
  budgetNote: text("budget_note"),
  currentWorkflow: text("current_workflow").notNull().default(""),
  successCriteria: text("success_criteria").notNull().default(""),
  constraints: text("constraints").notNull().default(""),
  requirementVersion: integer("requirement_version").notNull().default(1),
  scopeVersion: integer("scope_version").notNull().default(1),
  clarificationRounds: integer("clarification_rounds").notNull().default(0),
  clarificationsClosed: boolean("clarifications_closed").notNull().default(false),
  contact: text("contact").notNull(),
  isOwnProduct: boolean("is_own_product").notNull().default(false),
  requiresPayment: boolean("requires_payment").notNull().default(false),
  productPlan: text("product_plan").$type<ProjectPlan>().notNull().default("legacy"),
  paused: boolean("paused").notNull().default(false),
  status: text("status").notNull().default("submitted"),
  failedFrom: text("failed_from"),
  failedReason: text("failed_reason"),
  escalation: jsonb("escalation"),
  pendingRequest: jsonb("pending_request"),
  founderNote: text("founder_note"),
  positioningVersion: integer("positioning_version").notNull().default(0),
  round: integer("round").notNull().default(1),
  createdAt: createdAt(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
}, (table) => [index("projects_customer_idx").on(table.customerId)]);

export const projectRequirements = pgTable("project_requirements", {
  id: id(), projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  version: integer("version").notNull(), scopeVersion: integer("scope_version").notNull(),
  snapshot: jsonb("snapshot").$type<RequirementSnapshot>().notNull(),
  actor: text("actor").notNull(), reason: text("reason").notNull(), confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
  createdAt: createdAt(),
}, (table) => [uniqueIndex("project_requirements_version_idx").on(table.projectId, table.version)]);

export const stateTransitions = pgTable(
  "state_transitions",
  {
    id: id(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    fromStatus: text("from_status").notNull(),
    toStatus: text("to_status").notNull(),
    actor: text("actor").notNull(),
    reason: text("reason"),
    createdAt: createdAt(),
  },
  (t) => [index("state_transitions_project_idx").on(t.projectId)],
);

export const clarifications = pgTable(
  "clarifications",
  {
    id: id(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    scopeVersion: integer("scope_version").notNull().default(1),
    batch: integer("batch").notNull().default(1),
    question: text("question").notNull(),
    why: text("why").notNull(),
    answer: text("answer"),
    answeredBy: text("answered_by"),
    answeredAt: timestamp("answered_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index("clarifications_project_idx").on(t.projectId)],
);

export const projectImages = pgTable(
  "project_images",
  {
    id: id(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    scopeVersion: integer("scope_version").notNull().default(1),
    note: text("note"),
    mimeType: text("mime_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    data: bytea("data").notNull(),
    uploadedBy: text("uploaded_by").notNull(),
    analysisStatus: text("analysis_status").notNull().default("pending"),
    analysis: jsonb("analysis"),
    analysisError: text("analysis_error"),
    createdAt: createdAt(),
  },
  (t) => [index("project_images_project_idx").on(t.projectId)],
);

export const orders = pgTable("orders", {
  id: id(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  sku: text("sku").notNull(),
  quoteFen: integer("quote_fen"),
  quoteVersion: integer("quote_version").notNull().default(0),
  proposal: jsonb("proposal").$type<ProposalOutput>(),
  status: text("status").notNull().default("inquiry"),
  deliveryStatus: text("delivery_status").notNull().default("not_started"),
  founderMinutes: integer("founder_minutes").notNull().default(0),
  createdAt: createdAt(),
});

export const payments = pgTable("payments", {
  id: id(),
  orderId: uuid("order_id")
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" }),
  amountFen: integer("amount_fen").notNull(),
  method: text("method").notNull(),
  reference: text("reference"),
  paidAt: timestamp("paid_at", { withTimezone: true }).notNull().defaultNow(),
});

export const paymentCode = pgTable("payment_code", {
  id: integer("id").primaryKey(),
  mimeType: text("mime_type").notNull(),
  data: bytea("data").notNull(),
});

export const paymentReceipts = pgTable(
  "payment_receipts",
  {
    id: id(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    mimeType: text("mime_type").notNull(),
    data: bytea("data").notNull(),
    uploadedBy: text("uploaded_by").notNull(),
    analysisStatus: text("analysis_status").notNull().default("pending"),
    analysis: jsonb("analysis").$type<ReceiptOutput>(),
    createdAt: createdAt(),
  },
  (t) => [index("payment_receipts_order_idx").on(t.orderId, t.createdAt)],
);

export const supportMessages = pgTable(
  "support_messages",
  {
    id: id(),
    projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
    question: text("question").notNull(),
    status: text("status").notNull().default("queued"),
    risk: text("risk"),
    reply: text("reply"),
    draft: text("draft"),
    createdAt: createdAt(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("support_messages_project_idx").on(t.projectId, t.createdAt)],
);

export const companySettings = pgTable("company_settings", {
  id: integer("id").primaryKey(),
  charter: text("charter").notNull().default(""),
  brand: text("brand").notNull().default(""),
  service: text("service").notNull().default(""),
  operations: text("operations").notNull().default(""),
  forbiddenTerms: jsonb("forbidden_terms").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
  charterVersion: integer("charter_version").notNull().default(0),
  charterConfirmedAt: timestamp("charter_confirmed_at", { withTimezone: true }),
});

export const companyReports = pgTable("company_reports", {
  id: id(),
  kind: text("kind").notNull(),
  dedupeKey: text("dedupe_key").unique(),
  status: text("status").notNull().default("queued"),
  input: jsonb("input"),
  output: jsonb("output"),
  provider: text("provider"),
  model: text("model"),
  listCostYuan: doublePrecision("list_cost_yuan").notNull().default(0),
  error: text("error"),
  createdAt: createdAt(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
});

export const agentTasks = pgTable(
  "agent_tasks",
  {
    id: id(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    agent: text("agent").notNull(),
    requirementVersion: integer("requirement_version").notNull().default(1),
    scopeVersion: integer("scope_version").notNull().default(1),
    status: text("status").notNull().default("running"),
    trigger: text("trigger").notNull().default("normal"),
    parentTaskId: uuid("parent_task_id"),
    sendBackRoute: text("send_back_route"),
    sendBackReason: text("send_back_reason"),
    round: integer("round").notNull().default(1),
    provider: text("provider"),
    model: text("model"),
    input: jsonb("input"),
    output: jsonb("output"),
    error: text("error"),
    inputTokens: integer("input_tokens").notNull().default(0),
    outputTokens: integer("output_tokens").notNull().default(0),
    searchCalls: integer("search_calls").notNull().default(0),
    listCostYuan: doublePrecision("list_cost_yuan").notNull().default(0),
    startedAt: timestamp("started_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
  },
  (t) => [index("agent_tasks_project_idx").on(t.projectId)],
);

// project_id 为空表示赛前手工录入、各项目可共用的种子证据。
export const evidenceItems = pgTable(
  "evidence_items",
  {
    id: id(),
    projectId: uuid("project_id").references(() => projects.id, {
      onDelete: "cascade",
    }),
    candidate: text("candidate"),
    scopeVersion: integer("scope_version").notNull().default(1),
    product: text("product"),
    category: text("category"),
    kind: text("kind").notNull(),
    stance: text("stance").notNull(),
    numberValue: text("number_value"),
    metric: text("metric"),
    url: text("url").notNull(),
    sourceName: text("source_name").notNull(),
    excerpt: text("excerpt").notNull(),
    grade: text("grade"),
    status: text("status").notNull(),
    matchScore: doublePrecision("match_score"),
    licenseStatus: text("license_status").notNull(),
    createdBy: text("created_by").notNull(),
    collectedAt: timestamp("collected_at", { withTimezone: true }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("evidence_items_project_idx").on(t.projectId)],
);

export const sourceDocuments = pgTable("source_documents", {
  id: id(),
  url: text("url").notNull().unique(),
  title: text("title"),
  text: text("text").notNull(),
  fetchedAt: timestamp("fetched_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const evidenceSearches = pgTable(
  "evidence_searches",
  {
    id: id(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    candidate: text("candidate"),
    scopeVersion: integer("scope_version").notNull().default(1),
    purpose: text("purpose").notNull(),
    source: text("source").notNull(),
    query: text("query").notNull(),
    resultCount: integer("result_count").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("evidence_searches_project_idx").on(t.projectId)],
);

export const positionings = pgTable(
  "positionings",
  {
    id: id(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    options: jsonb("options").notNull(),
    recommendedOption: integer("recommended_option").notNull(),
    chosenOption: integer("chosen_option"),
    rationale: text("rationale").notNull(),
    experiment: jsonb("experiment").notNull(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("positionings_version_idx").on(t.projectId, t.version)],
);

export const counterResponses = pgTable("counter_responses", {
  id: id(),
  positioningId: uuid("positioning_id")
    .notNull()
    .references(() => positionings.id, { onDelete: "cascade" }),
  evidenceId: uuid("evidence_id")
    .notNull()
    .references(() => evidenceItems.id, { onDelete: "cascade" }),
  response: text("response").notNull(),
  note: text("note").notNull(),
});

export const decisions = pgTable(
  "decisions",
  {
    id: id(),
    projectId: uuid("project_id").references(() => projects.id, { onDelete: "cascade" }),
    subjectId: uuid("subject_id"),
    gate: text("gate").notNull(),
    subjectVersion: integer("subject_version").notNull(),
    actorRole: text("actor_role").notNull(),
    verdict: text("verdict").notNull(),
    snapshot: jsonb("snapshot"),
    reason: text("reason"),
    createdAt: createdAt(),
  },
  (t) => [index("decisions_project_idx").on(t.projectId)],
);

export const landingPages = pgTable("landing_pages", {
  id: id(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  version: integer("version").notNull(),
  positioningVersion: integer("positioning_version").notNull(),
  slug: text("slug").notNull().unique(),
  content: jsonb("content").notNull(),
  status: text("status").notNull().default("draft"),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  createdAt: createdAt(),
});

export const landingPageImages = pgTable("landing_page_images", {
  landingPageId: uuid("landing_page_id").primaryKey().references(() => landingPages.id, { onDelete: "cascade" }),
  mimeType: text("mime_type").notNull(),
  data: bytea("data").notNull(),
});

export const claims = pgTable("claims", {
  id: id(),
  landingPageId: uuid("landing_page_id")
    .notNull()
    .references(() => landingPages.id, { onDelete: "cascade" }),
  location: text("location").notNull(),
  text: text("text").notNull(),
  kind: text("kind").notNull(),
  evidenceId: uuid("evidence_id").references(() => evidenceItems.id, {
    onDelete: "cascade",
  }),
  checkPassed: boolean("check_passed").notNull(),
});

export const campaigns = pgTable("campaigns", {
  id: id(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  landingPageId: uuid("landing_page_id")
    .notNull()
    .references(() => landingPages.id, { onDelete: "cascade" }),
  channel: text("channel").notNull(),
  reason: text("reason").notNull(),
  checklist: jsonb("checklist").notNull(),
  assets: jsonb("assets").notNull(),
  status: text("status").notNull().default("draft"),
  executedUrl: text("executed_url"),
  executedAt: timestamp("executed_at", { withTimezone: true }),
  createdAt: createdAt(),
});

export const events = pgTable(
  "events",
  {
    id: id(),
    landingPageId: uuid("landing_page_id")
      .notNull()
      .references(() => landingPages.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    visitorHash: text("visitor_hash"),
    payload: jsonb("payload"),
    createdAt: createdAt(),
  },
  (t) => [index("events_page_type_idx").on(t.landingPageId, t.type)],
);

export const leads = pgTable(
  "leads",
  {
    id: id(),
    landingPageId: uuid("landing_page_id")
      .notNull()
      .references(() => landingPages.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    isTest: boolean("is_test").notNull().default(false),
    message: text("message"),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("leads_page_email_idx").on(t.landingPageId, t.email)],
);

export const deliverables = pgTable("deliverables", {
  id: id(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  kind: text("kind").notNull(),
  round: integer("round").notNull(),
  content: jsonb("content").notNull(),
  createdAt: createdAt(),
});
