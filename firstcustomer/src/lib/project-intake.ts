export const PUBLIC_INTAKE_DRAFT_KEY = "fc:intake:public";

export const INTAKE_STAGES = ["没有产品", "有想法", "已有 MVP", "已上线"] as const;
export const INTAKE_GOALS = ["找需求", "验证", "找首批用户", "提升转化"] as const;

export const INTAKE_STEPS = [
  { field: "productName", label: "产品名称或想法", question: "先聊聊，你想做一个什么样的产品？", help: "一两句话就好：叫什么、帮谁、解决什么问题。", placeholder: "例如：一款帮独立开发者快速制作英文产品演示的工具。", max: 500 },
  { field: "stage", label: "当前阶段", question: "这个产品现在走到哪一步了？", help: "选择最接近的状态，我们会按这个阶段做初诊。", options: INTAKE_STAGES },
  { field: "goal", label: "当前最想解决的事", question: "眼下，你最希望先解决什么？", help: "先聚焦一件事，让这次初诊更有方向。", options: INTAKE_GOALS },
  { field: "targetMarket", label: "希望进入的市场", question: "有没有特别想进入的市场？", help: "可以说国家、地区或目标人群。还没想好也没关系。", placeholder: "例如：北美的独立开发者", max: 200, optional: true, skip: "还没想好，请帮我判断" },
  { field: "productUrl", label: "产品网址", question: "方便让我看看你的产品吗？", help: "如果已有官网或演示链接，可以放在这里。没有也可以继续。", placeholder: "https://", max: 2048, optional: true, skip: "暂时没有网址" },
  { field: "budgetNote", label: "预算和时间", question: "这次尝试，有预算或时间上的考虑吗？", help: "写一个大致范围即可，帮助我们安排下一步。", placeholder: "例如：先用两周验证，预算 1000 元以内", max: 200, optional: true, skip: "暂时不确定" },
  { field: "screenshots", label: "产品截图", question: "要不要带上几张产品截图？", help: "界面、原型或功能截图都可以，让我们更容易理解你的产品。", optional: true, skip: "先不上传截图" },
  { field: "contact", label: "联系方式", question: "最后，怎么联系到你？", help: "留下微信或邮箱，用于交付与必要联系。", placeholder: "你的微信号或邮箱", max: 200 },
] as const;

export type IntakeField = Exclude<typeof INTAKE_STEPS[number]["field"], "screenshots">;
export type IntakeAnswers = Record<IntakeField, string>;
export type IntakeDraft = { answers: IntakeAnswers; step: number; reached: number; hadImages: boolean };

export function emptyIntakeDraft(): IntakeDraft {
  return { answers: { productName: "", stage: "", goal: "", targetMarket: "", productUrl: "", budgetNote: "", contact: "" }, step: 0, reached: 0, hadImages: false };
}

// Accept the existing flat form draft, but never trust stored types or progress.
export function parseIntakeDraft(raw: string | null): IntakeDraft {
  const draft = emptyIntakeDraft();
  try {
    const saved: unknown = JSON.parse(raw ?? "null");
    if (!saved || typeof saved !== "object" || Array.isArray(saved)) return draft;
    const data = saved as Record<string, unknown>;
    for (const step of INTAKE_STEPS) {
      if (step.field !== "screenshots" && typeof data[step.field] === "string") {
        draft.answers[step.field] = (data[step.field] as string).slice(0, "max" in step ? step.max : 200);
      }
    }
    if (!INTAKE_STAGES.some((stage) => stage === draft.answers.stage)) draft.answers.stage = "";
    if (!INTAKE_GOALS.some((goal) => goal === draft.answers.goal)) draft.answers.goal = "";
    const progress = (value: unknown) => typeof value === "number" && Number.isInteger(value) ? Math.max(0, Math.min(INTAKE_STEPS.length, value)) : 0;
    draft.step = progress(data.__step);
    draft.reached = Math.max(draft.step, progress(data.__reached));
    draft.hadImages = data.__hadImages === true;
    // A damaged or partial draft must not bypass the required answers.
    const invalid = INTAKE_STEPS.findIndex((step, index) => index < draft.step && step.field !== "screenshots" && Boolean(intakeAnswerError(step.field, draft.answers[step.field])));
    if (invalid >= 0) draft.step = invalid;
  } catch { /* A damaged draft starts a fresh conversation. */ }
  return draft;
}

export function serializeIntakeDraft(draft: IntakeDraft): string {
  return JSON.stringify({ ...draft.answers, __version: 1, __step: draft.step, __reached: draft.reached, __hadImages: draft.hadImages });
}

export function intakeAnswerError(field: IntakeField, raw: string): string {
  const value = raw.trim();
  if (field === "productName" && !value) return "先告诉 Lumi 一点你的产品或想法，再继续。";
  if (field === "contact" && value.length < 3) return "请填写至少 3 个字符的微信号或邮箱，方便我们联系你。";
  if (field === "stage" && !INTAKE_STAGES.some((option) => option === value)) return "请选择产品当前的阶段。";
  if (field === "goal" && !INTAKE_GOALS.some((option) => option === value)) return "请选择当前最想解决的事。";
  if (field === "productUrl" && value) {
    try {
      const url = new URL(value);
      if (!["https:", "http:"].includes(url.protocol) || !url.hostname) throw new Error();
    } catch { return "请填写以 https:// 或 http:// 开头的完整网址，或跳过这一项。"; }
  }
  const step = INTAKE_STEPS.find((item) => item.field === field);
  if (step && "max" in step && value.length > step.max) return `请缩短到 ${step.max} 个字符以内。`;
  return "";
}
