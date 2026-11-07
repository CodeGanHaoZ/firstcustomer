export const PUBLIC_INTAKE_DRAFT_KEY = "fc:intake:public";

export const INTAKE_STAGES = ["没有产品", "有想法", "已有 MVP", "已上线"] as const;
export const INTAKE_GOALS = ["找需求", "验证", "找首批用户", "提升转化"] as const;

export const INTAKE_STEPS = [
  { field: "productName", label: "产品名称或想法", question: "先聊聊，你想做一个什么样的产品？", help: "一两句话就好：叫什么、帮谁、解决什么问题。", placeholder: "例如：一款帮独立开发者快速制作英文产品演示的工具。", max: 500 },
  { field: "stage", label: "当前阶段", question: "这个产品现在走到哪一步了？", help: "选择最接近的状态，我们会按这个阶段分析出海机会。", options: INTAKE_STAGES },
  { field: "goal", label: "当前最想解决的事", question: "眼下，你最希望先解决什么？", help: "先聚焦一件事，让这次出海机会分析更有方向。", options: INTAKE_GOALS },
  { field: "targetMarket", label: "希望进入的市场", question: "有没有特别想进入的市场？", help: "可以说国家、地区或目标人群。还没想好也没关系。", placeholder: "例如：北美的独立开发者", max: 200, optional: true, skip: "还没想好，请帮我判断" },
  { field: "productUrl", label: "产品网址", question: "方便让我看看你的产品吗？", help: "如果已有官网或演示链接，可以放在这里。没有也可以继续。", placeholder: "https://", max: 2048, optional: true, skip: "暂时没有网址" },
  { field: "budgetNote", label: "预算和时间", question: "这次尝试，有预算或时间上的考虑吗？", help: "写一个大致范围即可，帮助我们安排下一步。", placeholder: "例如：先用两周验证，预算 1000 元以内", max: 200, optional: true, skip: "暂时不确定" },
  { field: "screenshots", label: "产品截图", question: "要不要带上几张产品截图？", help: "界面、原型或功能截图都可以，让我们更容易理解你的产品。", optional: true, skip: "先不上传截图" },
  { field: "currentWorkflow", label: "现行做法", question: "现在，你或目标用户是怎么处理这个问题的？", help: "说说最近一次的做法、替代工具，或最容易卡住的一步。", placeholder: "例如：先手动整理素材，再用表格记录，最费时间的是反复修改。", max: 1000, optional: true, skip: "这项还不清楚，先记为未知" },
  { field: "successCriteria", label: "希望验证的结果", question: "这次出海机会分析，你最希望确认哪件事？", help: "尽量说一个可以检查的结果，帮助我们聚焦验证。", placeholder: "例如：明确先服务哪类人，以及通过哪个渠道验证需求。", max: 1000, optional: true, skip: "请先帮我整理待验证问题" },
  { field: "constraints", label: "限制条件", question: "有哪些必须保留的工具或不能做的事？", help: "比如技术栈、时间、可提供的样本，以及不希望公开的内容。", placeholder: "例如：保留现有网站，只能提供脱敏截图，暂不投放广告。", max: 1000, optional: true, skip: "暂时没有补充" },
  { field: "contact", label: "联系方式", question: "最后，怎么联系到你？", help: "留下微信或邮箱，用于交付与必要联系。", placeholder: "你的微信号或邮箱", max: 200 },
] as const;

export type IntakeField = Exclude<typeof INTAKE_STEPS[number]["field"], "screenshots">;
export type IntakeAnswers = Record<IntakeField, string>;
export type IntakeDraft = { answers: IntakeAnswers; step: number; reached: number; hadImages: boolean };

export function emptyIntakeDraft(): IntakeDraft {
  return { answers: { productName: "", stage: "", goal: "", targetMarket: "", productUrl: "", budgetNote: "", contact: "", currentWorkflow: "", successCriteria: "", constraints: "" }, step: 0, reached: 0, hadImages: false };
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
    const migrate = (value: unknown) => typeof value === "number" && data.__version !== 2 && value >= 7 ? value + 3 : value;
    draft.step = progress(migrate(data.__step));
    draft.reached = Math.max(draft.step, progress(migrate(data.__reached)));
    draft.hadImages = data.__hadImages === true;
    // A damaged or partial draft must not bypass the required answers.
    const invalid = INTAKE_STEPS.findIndex((step, index) => index < draft.step && step.field !== "screenshots" && Boolean(intakeAnswerError(step.field, draft.answers[step.field])));
    if (invalid >= 0) draft.step = invalid;
  } catch { /* A damaged draft starts a fresh conversation. */ }
  return draft;
}

export function serializeIntakeDraft(draft: IntakeDraft): string {
  return JSON.stringify({ ...draft.answers, __version: 2, __step: draft.step, __reached: draft.reached, __hadImages: draft.hadImages });
}

export function intakeStepIndices(draft: IntakeDraft) {
  return INTAKE_STEPS.flatMap((step, index) => {
    const early = ["没有产品", "有想法"].includes(draft.answers.stage);
    if (early && step.field === "productUrl" && !draft.answers.productUrl) return [];
    if (early && step.field === "screenshots" && !draft.hadImages) return [];
    return [index];
  });
}

export function intakeQuestion(field: typeof INTAKE_STEPS[number]["field"], fallback: string, answers: IntakeAnswers) {
  if (field === "successCriteria" && answers.goal === "提升转化") return "你希望重点检查哪一段转化？";
  if (field === "successCriteria" && answers.stage === "没有产品") return "做产品之前，你最想先验证哪个需求？";
  if (field === "currentWorkflow" && answers.stage === "已上线") return "目前是怎么获客和跟进用户的？哪一步最容易卡住？";
  return fallback;
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
