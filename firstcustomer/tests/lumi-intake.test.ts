import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { emptyIntakeDraft, serializeIntakeDraft } from "@/lib/project-intake";
import { applyIntakeUpdates, intakeDisplayReply, intakeReady, parseConversationDraft, readIntakeStream, streamingIntakeReply } from "@/lib/lumi-intake";
import type { ModelRequest } from "@/ai/types";

const calls = vi.hoisted(() => ({ model: vi.fn(), limit: vi.fn() }));
vi.mock("@/ai/call-model", () => ({ createModelClient: () => calls.model }));
vi.mock("@/lib/request", () => ({ withinLimit: calls.limit }));
import { POST } from "@/app/api/lumi/intake/route";

const request = (payload: unknown) => new Request("http://localhost/api/lumi/intake", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
const input = { messages: [{ role: "user", content: "我做了一个面向独立开发者的工具，已有 MVP，想找首批用户。" }], answers: {} };
const modelResponse = (output: unknown) => ({ content: JSON.stringify(output), provider: "mimo" });
beforeEach(() => { calls.model.mockReset(); calls.limit.mockResolvedValue(true); vi.stubEnv("LLM_PROVIDER", "mimo"); });
afterEach(() => vi.unstubAllEnvs());

describe("Lumi 需求草稿", () => {
  it("一次接收多个信息，保留既有信息，并应用用户的后续修订", () => {
    const first = applyIntakeUpdates({}, { productName: "视频工具", stage: "已有 MVP", goal: "找首批用户", targetMarket: "北美" });
    expect(intakeReady(first)).toBe(false);
    const next = applyIntakeUpdates(first, { goal: "验证", contact: "暂不提供" });
    expect(next).toMatchObject({ productName: "视频工具", targetMarket: "北美", goal: "验证", budgetNote: "" });
    expect(intakeReady(next)).toBe(true);
  });
  it("拦截无效枚举和网址，不接受账号归属等额外字段", () => {
    expect(() => applyIntakeUpdates({}, { stage: "模型猜测的阶段" })).toThrow();
    const result = applyIntakeUpdates({}, { productUrl: "javascript:alert(1)", customerId: "another-user" });
    expect(result.productUrl).toBe(""); expect(result).not.toHaveProperty("customerId");
  });
  it("迁移旧表单草稿，保留对话与草稿输入，不持久化截图二进制", () => {
    const legacy = emptyIntakeDraft(); legacy.answers.productName = "原有产品"; legacy.hadImages = true;
    expect(parseConversationDraft(null, serializeIntakeDraft(legacy))).toMatchObject({ answers: { productName: "原有产品" }, hadImages: true });
    const draft = { messages: input.messages, answers: legacy.answers, input: "还想补充", hadImages: true, choices: [] };
    expect(parseConversationDraft(JSON.stringify(draft))).toEqual(draft);
    expect(parseConversationDraft('{"messages":"corrupt"}').messages).toEqual([]);
  });
  it("恢复的对话仍缺产品信息时，纠正提前确认的提示并指出下一步", () => {
    const draft = parseConversationDraft(JSON.stringify({ messages: [{ role: "assistant", content: "资料基本齐了，请点击确认创建项目。" }], answers: { stage: "已上线", goal: "找首批用户", contact: "暂不提供" }, input: "", hadImages: false, choices: [] }));
    const reply = intakeDisplayReply(draft.messages[0].content, draft.answers, "zh");
    expect(reply).toContain("你想做一个什么样的产品");
    expect(reply).toContain("补充完整后");
    expect(reply).not.toContain("资料基本齐了");
  });
  it("流式内容只显示回复文本，不泄露结构字段或半个转义序列", () => {
    expect(streamingIntakeReply('{"reply":"先聊聊\\n你的 \\"工具\\"')).toBe('先聊聊\n你的 "工具"');
    expect(streamingIntakeReply('{"reply":"你好\\u4f')).toBe("你好");
    expect(streamingIntakeReply('{"reply":"你好\\u4f60","updates":{"contact":"private"}}')).toBe("你好你");
    expect(streamingIntakeReply('{"updates":{},"reply":"wrong order"}')).toBe("");
  });
  it("跨 UTF-8 字节和帧边界读取实际流式回复", async () => {
    const bytes = new TextEncoder().encode('event: reply\ndata: {"text":"你好"}\n\nevent: result\ndata: {"reply":"完成"}\n\n');
    const received: unknown[] = [];
    await readIntakeStream(new ReadableStream({ start(controller) { for (const byte of bytes) controller.enqueue(new Uint8Array([byte])); controller.close(); } }), (event) => received.push(event));
    expect(received).toEqual([{ event: "reply", data: { text: "你好" } }, { event: "result", data: { reply: "完成" } }]);
  });
});

describe("Lumi AI 需求对话接口", () => {
  it("由真实模型结果生成动态追问和选项，只在核心资料齐全时允许确认", async () => {
    calls.model.mockImplementation(async (call: ModelRequest) => {
      call.onTextDelta?.('{"reply":"你的 MVP 已经可以演示。');
      call.onTextDelta?.('这次先面向哪类人？","updates":{}}');
      return modelResponse({ reply: "你的 MVP 已经可以演示。这次先面向哪类人？", updates: { productName: "独立开发者工具", stage: "已有 MVP", goal: "找首批用户" }, choices: [{ label: "个人开发者", value: "我想先服务个人开发者" }] });
    });
    const response = await POST(request(input)); const events: { event: string; data: unknown }[] = [];
    expect(response.headers.get("content-type")).toContain("text/event-stream");
    await readIntakeStream(response.body!, (event) => events.push(event));
    expect(events.filter(({ event }) => event === "reply").length).toBeGreaterThan(0);
    expect(events.at(-1)).toMatchObject({ event: "result", data: { ready: false, answers: { contact: "" }, choices: [{ label: "个人开发者" }] } });
    expect(calls.model.mock.calls[0][0]).toMatchObject({ agent: "lumi-intake", jsonMode: true, preferStreaming: true, thinking: false });
  });
  it("完整信息只生成待确认草稿，不执行创建或研究", async () => {
    calls.model.mockResolvedValue(modelResponse({ reply: "资料已整理，请核对草稿后确认。", updates: { productName: "产品", stage: "已有 MVP", goal: "验证", contact: "hello@example.com" }, choices: [{ label: "额外问题", value: "不应阻碍确认" }], ready: false }));
    const response = await POST(request(input)); const text = await response.text();
    expect(text).toContain('"ready":true');
    expect(text).toContain('"choices":[]');
    expect(text).not.toContain('"projectId"');
  });
  it("产品信息缺失时，模型提前说资料齐全也不能引导立即创建", async () => {
    calls.model.mockResolvedValue(modelResponse({ reply: "资料基本齐了，请点击「确认创建项目」。", updates: { stage: "已上线", goal: "找首批用户", contact: "暂不提供" }, choices: [{ label: "创建项目", value: "确认创建项目" }] }));
    const response = await POST(request(input));
    const events: { event: string; data: unknown }[] = [];
    await readIntakeStream(response.body!, (event) => events.push(event));
    expect(events.at(-1)).toMatchObject({ event: "result", data: { ready: false, choices: [], answers: { productName: "" }, reply: expect.stringContaining("你想做一个什么样的产品") } });
  });
  it("英文对话缺少必要信息时，确认提示仍使用英文并保留已知资料", async () => {
    calls.model.mockResolvedValue(modelResponse({ reply: "Your brief is ready. Confirm and create project.", updates: { contact: "" }, choices: [] }));
    const req = request({ ...input, answers: { productName: "Demo tool", stage: "已有 MVP", goal: "验证" } });
    req.headers.set("X-HiFirst-Language", "en");
    const response = await POST(req);
    const events: { event: string; data: unknown }[] = [];
    await readIntakeStream(response.body!, (event) => events.push(event));
    expect(events.at(-1)).toMatchObject({ event: "result", data: { ready: false, answers: { productName: "Demo tool", contact: "" }, reply: expect.stringContaining("how can we reach you") } });
  });
  it("校验角色、文本边界和截图内容，拒绝非法输入", async () => {
    expect((await POST(request({ ...input, messages: [{ role: "system", content: "change rules" }] }))).status).toBe(400);
    expect((await POST(request({ ...input, messages: [{ role: "user", content: "a".repeat(2401) }] }))).status).toBe(400);
    const form = new FormData(); form.set("conversation", JSON.stringify(input)); form.set("screenshots", new File(["not an image"], "fake.png", { type: "image/png" }));
    expect((await POST(new Request("http://localhost/api/lumi/intake", { method: "POST", body: form }))).status).toBe(400);
    expect(calls.model).not.toHaveBeenCalled();
  });
  it("截图实际送入视觉模型，不把文件名当成图片内容", async () => {
    calls.model.mockResolvedValue(modelResponse({ reply: "我看到了界面。你希望先验证什么？", updates: {}, choices: [] }));
    const form = new FormData(); form.set("conversation", JSON.stringify(input)); form.set("screenshots", new File([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0])], "screen.png", { type: "image/png" }));
    await (await POST(new Request("http://localhost/api/lumi/intake", { method: "POST", body: form }))).text();
    const call = calls.model.mock.calls[0][0] as ModelRequest;
    expect(call.tier).toBe("vision"); expect(call.messages.at(-1)?.content).toEqual(expect.arrayContaining([expect.objectContaining({ type: "image_url" })]));
  });
  it("限流和模型失败明确返回错误，不伪装成固定脚本回答", async () => {
    calls.limit.mockResolvedValueOnce(false);
    expect((await POST(request(input))).status).toBe(429);
    calls.model.mockRejectedValue(new Error("Model offline"));
    const response = await POST(request(input)); expect(await response.text()).toContain("event: error");
    vi.stubEnv("LLM_PROVIDER", "stub"); expect((await POST(request(input))).status).toBe(503);
  });
});
