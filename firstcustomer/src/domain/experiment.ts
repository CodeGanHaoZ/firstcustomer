export type ExperimentPlan = {
  hypothesis: string;
  min_visits: number;
  pass_leads: number;
};

export type Metrics = {
  visits: number;
  ctaClicks: number;
  leads: number;
  replies: number;
};

export type ExperimentVerdict = "insufficient" | "passed" | "failed";

export const VERDICT_LABELS: Record<ExperimentVerdict, string> = {
  insufficient: "样本不足",
  passed: "达到预设标准",
  failed: "未达到预设标准",
};

// 结论由预设标准直接算出，模型不能改写。
export function evaluateExperiment(
  plan: ExperimentPlan,
  metrics: Metrics,
): ExperimentVerdict {
  if (metrics.visits < plan.min_visits) return "insufficient";
  return metrics.leads >= plan.pass_leads ? "passed" : "failed";
}

// 比赛周末一个渠道能拿到的量有限，门槛定得太高只会得出“样本不足”。
export const EXPERIMENT_LIMITS = { maxMinVisits: 300, maxPassLeads: 10 };
const PAID_CHANNEL = /\bads?\b|advertis|sponsor|paid|广告|付费|赞助|投放|推广位/i;
const CHANNEL_SEPARATOR = /\s\+\s|\+|、|，|,|；|;|\band\b|以及|和|及/;

export function experimentProblems(plan: { channel: string; min_visits: number; pass_leads: number }) {
  const problems: string[] = [];
  if (plan.min_visits > EXPERIMENT_LIMITS.maxMinVisits) {
    problems.push(`min_visits 不能超过 ${EXPERIMENT_LIMITS.maxMinVisits}，比赛周末一个渠道达不到这么多访问`);
  }
  if (plan.pass_leads > EXPERIMENT_LIMITS.maxPassLeads) {
    problems.push(`pass_leads 不能超过 ${EXPERIMENT_LIMITS.maxPassLeads}`);
  }
  if (plan.pass_leads > plan.min_visits) problems.push("pass_leads 不能大于 min_visits");
  if (CHANNEL_SEPARATOR.test(plan.channel)) problems.push("experiment.channel 只能写一个渠道");
  if (PAID_CHANNEL.test(plan.channel)) problems.push("experiment.channel 不能用付费广告或赞助，付费投放需要老板另外授权");
  return problems;
}

const MONEY_OR_PERCENT = /(?:[$¥￥€£]\s?\d[\d,]*(?:\.\d+)?)|(?:\d[\d,]*(?:\.\d+)?\s?(?:%|％|美元|元|刀|dollars?|usd))/gi;

const canonical = (token: string) => token.replace(/[\s,]/g, "").replace(/[￥]/g, "¥").replace(/％/g, "%").toLowerCase();
const digitsOf = (token: string) => (token.match(/\d+(?:\.\d+)?/) ?? [""])[0];

// 价格和百分比必须能在证据或输入里找到，不能凭印象写。
export function unsupportedFigures(text: string, sources: string[]) {
  const pool = sources.join(" \n ");
  const known = new Set((pool.match(/\d[\d,]*(?:\.\d+)?/g) ?? []).map((n) => n.replace(/,/g, "")));
  const found = text.match(MONEY_OR_PERCENT) ?? [];
  return [...new Set(found.map(canonical))].filter((token) => !known.has(digitsOf(token)));
}
