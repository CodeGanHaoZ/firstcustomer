import { z } from "zod";
import { emptyIntakeDraft, INTAKE_GOALS, INTAKE_STAGES, INTAKE_STEPS, intakeAnswerError, parseIntakeDraft, type IntakeAnswers } from "./project-intake";
import type { Locale } from "./locale";
import { translateUi } from "./ui-translation";

export const LUMI_INTAKE_DRAFT_KEY = "fc:intake:conversation";
export const INTAKE_MESSAGE_LIMIT = 2400;
export const INTAKE_HISTORY_LIMIT = 24;
export const INTAKE_MESSAGE_SCHEMA = z.object({ role: z.enum(["user", "assistant"]), content: z.string().trim().min(1).max(INTAKE_MESSAGE_LIMIT) });
export type IntakeMessage = z.infer<typeof INTAKE_MESSAGE_SCHEMA>;

const fieldSchema = {
  productName: z.string().max(500), stage: z.enum(["", ...INTAKE_STAGES]), goal: z.enum(["", ...INTAKE_GOALS]),
  targetMarket: z.string().max(200), productUrl: z.string().max(2048), budgetNote: z.string().max(200),
  currentWorkflow: z.string().max(1000), successCriteria: z.string().max(1000), constraints: z.string().max(1000), contact: z.string().max(200),
};
export const intakeUpdatesSchema = z.object(fieldSchema).partial();
export const intakeRequestSchema = z.object({
  messages: z.array(INTAKE_MESSAGE_SCHEMA).min(1).max(INTAKE_HISTORY_LIMIT),
  answers: intakeUpdatesSchema,
}).refine((value) => value.messages.at(-1)?.role === "user");

export const intakeResponseSchema = z.object({
  reply: z.string().trim().min(1).max(INTAKE_MESSAGE_LIMIT),
  updates: intakeUpdatesSchema.default({}),
  choices: z.array(z.object({ label: z.string().trim().min(1).max(120), value: z.string().trim().min(1).max(600) })).max(4).default([]),
});
export type IntakeReply = z.infer<typeof intakeResponseSchema> & { answers: IntakeAnswers; ready: boolean };
export type IntakeConversationDraft = { messages: IntakeMessage[]; answers: IntakeAnswers; input: string; hadImages: boolean; choices: IntakeReply["choices"] };

export function intakeReady(answers: IntakeAnswers) {
  return INTAKE_STEPS.every((step) => step.field === "screenshots" || !intakeAnswerError(step.field, answers[step.field]));
}

// Keep completion claims consistent with the same validation that enables creation,
// including conversations restored from before the missing information was noticed.
export function intakeDisplayReply(reply: string, answers: IntakeAnswers, locale: Locale) {
  const missing = INTAKE_STEPS.find((step) => step.field !== "screenshots" && intakeAnswerError(step.field, answers[step.field]));
  const invitesConfirmation = /确认创建|(?:资料|信息).{0,8}(?:齐了|齐全)|(?:confirm|create).{0,40}project|(?:brief|details|information).{0,24}(?:ready|complete)/i.test(reply);
  if (!missing || !invitesConfirmation) return reply;
  const copy = LUMI_INTAKE_COPY[locale];
  return `${copy.missingInfo} ${translateUi(locale, missing.question)} ${copy.confirmWhenReady}`;
}

export function applyIntakeUpdates(current: Partial<IntakeAnswers>, updates: unknown): IntakeAnswers {
  const valid = intakeUpdatesSchema.parse(updates);
  const answers = { ...emptyIntakeDraft().answers, ...intakeUpdatesSchema.parse(current), ...valid };
  // A model-suggested URL must pass the same check as a submitted project.
  if (answers.productUrl && intakeAnswerError("productUrl", answers.productUrl)) answers.productUrl = "";
  return answers;
}

export function parseConversationDraft(raw: string | null, legacy: string | null = null): IntakeConversationDraft {
  const draft: IntakeConversationDraft = { messages: [], answers: parseIntakeDraft(legacy).answers, input: "", hadImages: parseIntakeDraft(legacy).hadImages, choices: [] };
  try {
    const saved = z.object({ messages: z.array(INTAKE_MESSAGE_SCHEMA).max(80), answers: intakeUpdatesSchema, input: z.string().max(INTAKE_MESSAGE_LIMIT), hadImages: z.boolean(), choices: intakeResponseSchema.shape.choices }).parse(JSON.parse(raw ?? "null"));
    return { ...saved, answers: applyIntakeUpdates({}, saved.answers) };
  } catch { return draft; }
}

// Only expose the JSON reply string while the model is still generating. Never
// stream internal fields or unfinished JSON syntax into the conversation.
export function streamingIntakeReply(json: string): string {
  const start = /^\s*\{\s*"reply"\s*:\s*"/.exec(json);
  if (!start) return "";
  let reply = "";
  for (let index = start[0].length; index < json.length; index++) {
    const char = json[index];
    if (char === '"') break;
    if (char !== "\\") { reply += char; continue; }
    const next = json[++index];
    if (!next) break;
    if (next === "u") {
      const hex = json.slice(index + 1, index + 5);
      if (!/^[a-f0-9]{4}$/i.test(hex)) break;
      reply += String.fromCharCode(parseInt(hex, 16)); index += 4;
    } else {
      const escapes: Record<string, string> = { '"': '"', "\\": "\\", "/": "/", n: "\n", r: "\r", t: "\t", b: "\b", f: "\f" };
      if (!(next in escapes)) break;
      reply += escapes[next];
    }
  }
  return reply.slice(0, INTAKE_MESSAGE_LIMIT);
}

export type IntakeStreamEvent = { event: string; data: unknown };
export async function readIntakeStream(body: ReadableStream<Uint8Array>, handle: (event: IntakeStreamEvent) => void) {
  const reader = body.getReader(); const decoder = new TextDecoder(); let buffer = "";
  try {
    for (;;) {
      const chunk = await reader.read();
      buffer += decoder.decode(chunk.value, { stream: !chunk.done });
      let end: number;
      while ((end = buffer.indexOf("\n\n")) !== -1) {
        const frame = buffer.slice(0, end); buffer = buffer.slice(end + 2);
        const event = /^event: (.+)$/m.exec(frame)?.[1]; const data = /^data: (.+)$/m.exec(frame)?.[1];
        if (event && data) handle({ event, data: JSON.parse(data) });
      }
      if (buffer.length > 64 * 1024) throw new Error("Invalid intake stream");
      if (chunk.done) break;
    }
  } finally { reader.releaseLock(); }
}

export const LUMI_INTAKE_COPY = {
  zh: {
    loading: "Lumi 正在准备对话…",
    title: "和 Lumi 一起，把想法聊清楚", subtitle: "直接说说你在做什么。Lumi 会理解上下文、追问关键问题，并整理成可确认的项目需求。",
    greeting: "你好，我是 Lumi。你想做一个什么产品，或者目前有什么出海上的困惑？可以一次说完整，也可以边聊边想。",
    restored: "之前聊过的资料已保留。你可以继续补充，也可以直接告诉我哪里需要改。", speaker: "MiMo AI 出海引导", you: "你",
    placeholder: "描述你的想法、回答 Lumi，或告诉她哪里需要修改…", send: "发送消息", stop: "停止回复", thinking: "Lumi 正在理解你的想法…",
    stopped: "已停止回复，你可以补充内容或重试。", retry: "重新回复", failed: "这次没有完成回复，你的对话和资料已保留。", rateLimit: "消息有点多，请稍后再试。",
    attach: "添加产品截图", remove: "移除截图", fileHelp: "最多 3 张截图，Lumi 会结合图片理解你的产品。", unknown: "尚未聊到", draft: "需求草稿", summaryHint: "这里同步展示已聊到的需求。补充、修改和最终确认都在对话中完成。",
    ready: "资料已齐，核对项目内容后即可确认", incomplete: "继续和 Lumi 聊清产品、阶段、目标和联系方式", organized: "已整理", review: "确认需求草稿",
    confirmPrompt: "资料已补充完整。确认后将创建项目，免费分析出海机会；需要修改也可以继续告诉我。",
    missingInfo: "创建项目前，还需要补充信息。", confirmWhenReady: "补充完整后，我会在这条对话下方显示「确认创建项目」按钮。",
    revise: "继续修改", unsentChanges: "先发送补充内容，等 Lumi 更新需求后再确认。", confirm: "确认创建项目", submitting: "正在创建项目…",
    footer: "对话草稿保存在本浏览器。只有确认创建后才会开始项目分析。", storageError: "浏览器无法保存草稿，请保持页面打开。", lostImages: "之前的截图需要重新添加，文字资料已保留。", serverError: "项目尚未创建，请检查提示后重试。",
    choiceHint: "选一个回答，或直接输入自己的想法", imageError: "请选择最多 3 张 PNG、JPG 或 WebP 图片，每张不超过 5 MB。", imageTotal: "截图合计不能超过 4 MB。",
    starters: ["我有一个想法，想判断海外有没有需求", "我的 MVP 已经做好了，想找首批海外用户", "产品已经上线，但注册的人很少"],
  },
  en: {
    loading: "Opening your conversation with Lumi…",
    title: "Talk your idea through with Lumi", subtitle: "Tell Lumi what you’re building. She follows the conversation, asks focused questions, and turns it into a project brief you can review.",
    greeting: "Hi, I’m Lumi. What are you building, or what’s on your mind about reaching overseas users? Share it all at once, or we can figure it out together.",
    restored: "Your earlier conversation and details are here. Continue where you left off, or tell me what to change.", speaker: "MiMo AI go-to-market guide", you: "You",
    placeholder: "Describe your idea, answer Lumi, or tell her what to change…", send: "Send message", stop: "Stop reply", thinking: "Lumi is considering your idea…",
    stopped: "Reply stopped. Add more context or try again.", retry: "Retry reply", failed: "The reply didn’t finish. Your conversation and details are still here.", rateLimit: "A few too many messages. Please try again shortly.",
    attach: "Add product screenshots", remove: "Remove screenshots", fileHelp: "Up to 3 screenshots. Lumi can use them to understand your product.", unknown: "Not discussed yet", draft: "Project brief", summaryHint: "Your requirements appear here as you chat. Add details, make changes, and confirm in the conversation.",
    ready: "Review the project content, then confirm in the conversation", incomplete: "Keep chatting about your product, stage, goal, and contact preference", organized: "Summarized", review: "Confirm project brief",
    confirmPrompt: "Your details are complete. Confirm to create your project and start the free opportunity analysis, or tell me what to change.",
    missingInfo: "We still need a detail before creating your project.", confirmWhenReady: "Once the details are complete, a “Confirm and create project” button will appear below this reply.",
    revise: "Keep editing", unsentChanges: "Send your changes first, then confirm once Lumi has updated the brief.", confirm: "Confirm and create project", submitting: "Creating your project…",
    footer: "Your conversation draft stays in this browser. Project analysis starts only after you confirm.", storageError: "This browser can’t save the draft. Keep this page open.", lostImages: "Please attach your earlier screenshots again. Your text is still here.", serverError: "The project wasn’t created. Check the message and try again.",
    choiceHint: "Choose an answer or write your own", imageError: "Choose up to 3 PNG, JPG, or WebP images, no more than 5 MB each.", imageTotal: "Keep the total screenshot size within 4 MB.",
    starters: ["I have an idea and want to test overseas demand", "My MVP is ready. I need my first overseas users", "My product is live, but very few people sign up"],
  },
} as const;
