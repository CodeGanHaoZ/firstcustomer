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
