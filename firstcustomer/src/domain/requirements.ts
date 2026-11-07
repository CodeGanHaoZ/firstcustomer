import { z } from "zod";

export const MAX_CLARIFICATION_ROUNDS = 3;
export const MAX_FREE_SCOPE_VERSIONS = 3;
export const REQUIREMENT_ROUTES = {
  market_validation: "需求与人群验证",
  launch_validation: "定位与首批用户",
  growth_diagnosis: "转化与增长诊断",
} as const;

export const requirementFields = z.object({
  productName: z.string().trim().min(1).max(500),
  productUrl: z.string().trim().max(2048).refine((value) => {
    if (!value) return true;
    try { return ["http:", "https:"].includes(new URL(value).protocol); } catch { return false; }
  }, "请填写完整的 HTTP 或 HTTPS 网址"),
  stage: z.enum(["没有产品", "有想法", "已有 MVP", "已上线"]),
  goal: z.enum(["找需求", "验证", "找首批用户", "提升转化"]),
  targetMarket: z.string().trim().max(200),
  budgetNote: z.string().trim().max(200),
  currentWorkflow: z.string().trim().max(1000),
  successCriteria: z.string().trim().max(1000),
  constraints: z.string().trim().max(1000),
});
export type RequirementFields = z.infer<typeof requirementFields>;
export type RequirementSnapshot = RequirementFields & {
  route: keyof typeof REQUIREMENT_ROUTES;
  unknowns: string[];
  answers: { question: string; answer: string | null; batch: number }[];
};

export function requirementSnapshot(project: {
  productName: string; productUrl: string | null; stage: string; goal: string;
  targetMarket: string | null; budgetNote: string | null; currentWorkflow: string;
  successCriteria: string; constraints: string;
}, answers: RequirementSnapshot["answers"] = []): RequirementSnapshot {
  const route = project.goal === "提升转化" ? "growth_diagnosis"
    : ["没有产品", "有想法"].includes(project.stage) || project.goal === "找需求" ? "market_validation" : "launch_validation";
  const unknowns = [
    ["目标市场", project.targetMarket], ["预算和时间", project.budgetNote],
    ["现行做法", project.currentWorkflow], ["希望验证的结果", project.successCriteria], ["限制条件", project.constraints],
  ].filter(([, value]) => !value?.trim()).map(([label]) => label as string);
  return { productName: project.productName, productUrl: project.productUrl ?? "", stage: project.stage as RequirementFields["stage"],
    goal: project.goal as RequirementFields["goal"], targetMarket: project.targetMarket ?? "", budgetNote: project.budgetNote ?? "",
    currentWorkflow: project.currentWorkflow, successCriteria: project.successCriteria, constraints: project.constraints, route, unknowns, answers };
}

export function clarificationProblem(input: { rounds: number; closed: boolean; previous: string[]; questions: string[] }) {
  if (input.closed || input.rounds >= MAX_CLARIFICATION_ROUNDS) return `本范围已完成 ${MAX_CLARIFICATION_ROUNDS} 轮补充，转经营者处理，继续时将未明确项列为未知。`;
  const normalize = (value: string) => value.normalize("NFKC").replace(/[\s\p{P}]/gu, "").toLowerCase();
  const known = new Set(input.previous.map(normalize));
  for (const question of input.questions) {
    const key = normalize(question);
    if (!key || known.has(key)) return "没有新的补充问题，请使用已有回答，或将不确定项转经营者处理。";
    known.add(key);
  }
  return "";
}
