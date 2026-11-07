export const STATUS_LABELS = {
  submitted: "已提交",
  researching: "分析出海机会中",
  free_ready: "出海机会报告已生成",
  drafting_quote: "起草报价中",
  awaiting_quote: "待老板确认报价",
  awaiting_quote_acceptance: "待客户接受报价",
  awaiting_payment: "等待付款或确认到账",
  reading_receipt: "读取付款截图中",
  strategizing: "制定策略",
  awaiting_positioning: "等待定位确认",
  preparing_page: "准备页面",
  awaiting_publish: "等待发布确认",
  published: "已发布",
  collecting: "收集反馈",
  reviewing: "分析复盘",
  delivered: "已交付",
  needs_info: "等待补充信息",
  failed: "执行失败（可重试）",
  awaiting_founder: "等待老板裁决",
  cancelled: "已取消",
} as const;

export type ProjectStatus = keyof typeof STATUS_LABELS;
export type ProjectPlan = "legacy" | "free" | "pro";

export const MAIN_FLOW: ProjectStatus[] = [
  "submitted",
  "researching",
  "strategizing",
  "awaiting_positioning",
  "preparing_page",
  "awaiting_publish",
  "published",
  "collecting",
  "reviewing",
  "delivered",
];

export function usesQuoteFlow(project: { requiresPayment: boolean; isOwnProduct: boolean; productPlan?: ProjectPlan }) {
  return project.requiresPayment && !project.isOwnProduct && project.productPlan !== "free";
}

export function isAccountPro(project: { productPlan: ProjectPlan; requiresPayment: boolean; proAccessSource?: string | null }) {
  return project.productPlan === "pro" && !project.requiresPayment && project.proAccessSource === "account";
}

export function isKeyActivatedPro(project: { productPlan: ProjectPlan; requiresPayment: boolean; proAccessSource?: string | null }) {
  return project.productPlan === "pro" && !project.requiresPayment && !isAccountPro(project);
}

export function hasProAccess(
  project: { productPlan: ProjectPlan; requiresPayment: boolean; proAccessSource?: string | null },
  order: { status: string } | null,
) {
  return project.productPlan === "pro" && (order?.status === "paid" ||
    (isKeyActivatedPro(project) && order?.status === "key_activated") ||
    (isAccountPro(project) && order?.status === "account_active"));
}

export function canActivateProByKey(project: {
  productPlan: ProjectPlan; status: string; paused: boolean; isOwnProduct: boolean;
  requiresPayment: boolean; failedFrom: string | null;
}) {
  if (project.paused || project.isOwnProduct) return false;
  if (project.productPlan === "free") return project.status === "free_ready";
  return project.productPlan === "pro" && project.requiresPayment && (
    ["awaiting_quote", "awaiting_quote_acceptance", "awaiting_payment"].includes(project.status) ||
    (project.status === "failed" && ["drafting_quote", "reading_receipt"].includes(project.failedFrom ?? ""))
  );
}

export function canStartFreeDiagnosis(
  project: { productPlan: ProjectPlan; status: string; paused: boolean; isOwnProduct: boolean; failedFrom: string | null },
  order: { status: string; quoteVersion: number; quoteFen: number | null; proposal: unknown } | null,
) {
  if (project.paused || project.isOwnProduct || project.productPlan === "pro") return false;
  if (project.productPlan === "free" && project.status === "failed") return project.failedFrom === "researching";
  return project.status === "submitted" &&
    (!order || (order.status === "inquiry" && order.quoteVersion === 0 && order.quoteFen === null && !order.proposal));
}

// 状态机只放行这里列出的流转，回退路径对应 PRD 5.4。
const TRANSITIONS: Record<ProjectStatus, ProjectStatus[]> = {
  submitted: ["researching"],
  needs_info: ["researching"],
  researching: ["free_ready", "drafting_quote", "strategizing", "needs_info", "awaiting_founder", "failed"],
  free_ready: ["drafting_quote", "strategizing"],
  drafting_quote: ["awaiting_quote", "failed"],
  awaiting_quote: ["awaiting_quote_acceptance", "drafting_quote", "strategizing"],
  awaiting_quote_acceptance: ["awaiting_payment", "drafting_quote", "strategizing"],
  awaiting_payment: ["reading_receipt", "strategizing"],
  reading_receipt: ["awaiting_payment", "failed"],
  strategizing: [
    "awaiting_positioning",
    "researching",
    "preparing_page",
    "awaiting_founder",
    "failed",
  ],
  awaiting_positioning: ["preparing_page", "strategizing"],
  preparing_page: [
    "awaiting_publish",
    "strategizing",
    "awaiting_founder",
    "failed",
  ],
  awaiting_publish: ["published", "preparing_page", "awaiting_publish"],
  published: ["collecting"],
  collecting: ["reviewing", "awaiting_publish"],
  reviewing: ["delivered", "strategizing", "failed"],
  delivered: [],
  failed: ["researching", "drafting_quote", "reading_receipt", "strategizing", "preparing_page", "reviewing"],
  awaiting_founder: ["researching", "strategizing", "preparing_page"],
  cancelled: [],
};

export function canTransition(from: ProjectStatus, to: ProjectStatus) {
  if (to === "cancelled") return from !== "delivered" && from !== "cancelled";
  return TRANSITIONS[from].includes(to);
}

export const AGENT_STATUSES: ProjectStatus[] = [
  "researching",
  "drafting_quote",
  "reading_receipt",
  "strategizing",
  "preparing_page",
  "reviewing",
];

export type SendBackRoute =
  | "strategy->research"
  | "launch->strategy"
  | "growth->strategy";

export const SEND_BACK_LIMITS: Record<SendBackRoute, number> = {
  "strategy->research": 2,
  "launch->strategy": 2,
  "growth->strategy": 1,
};

export function sendBackAllowed(route: SendBackRoute, usedInThisRound: number) {
  return usedInThisRound < SEND_BACK_LIMITS[route];
}
