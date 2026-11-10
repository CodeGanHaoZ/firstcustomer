import { afterEach, describe, expect, it, vi } from "vitest";
import { createModelClient } from "@/ai/call-model";

const config: NodeJS.ProcessEnv = { NODE_ENV: "test", LLM_PROVIDER: "stepfun", STEPFUN_API_KEY: "test-plan-key" };
afterEach(() => vi.unstubAllGlobals());

describe("StepFun Step Plan", () => {
  it("文本、图片与工具请求均走订阅地址，保留结构化结果和实际用量", async () => {
    const bodies: Record<string, unknown>[] = [];
    const toolCall = { id: "lookup-1", type: "function", function: { name: "lookup", arguments: '{"query":"test"}' } };
    const transport = vi.fn(async (url: string, init: RequestInit) => {
      expect(String(url)).toBe("https://api.stepfun.com/step_plan/v1/chat/completions");
      expect(new Headers(init.headers).get("authorization")).toBe("Bearer test-plan-key");
      const body = JSON.parse(String(init.body)); bodies.push(body);
      return new Response(JSON.stringify({ id: "plan", object: "chat.completion", created: 0, model: body.model,
        choices: [{ index: 0, finish_reason: body.tools ? "tool_calls" : "stop", message: { role: "assistant", content: body.tools ? null : '{"ok":true}', ...(body.tools ? { tool_calls: [toolCall] } : {}) } }],
        usage: { prompt_tokens: 27, completion_tokens: 15, total_tokens: 42 },
      }), { headers: { "content-type": "application/json" } });
    });
    vi.stubGlobal("fetch", transport);
    const model = createModelClient(config);
    const text = await model({ agent: "intake", tier: "flash", jsonMode: true, thinking: false, messages: [{ role: "user", content: "Return JSON" }] });
    const tools = [{ type: "function" as const, function: { name: "lookup", description: "Read evidence", parameters: { type: "object", properties: { query: { type: "string" } } } } }];
    const tool = await model({ agent: "research", tier: "pro", preferStreaming: true, tools, messages: [{ role: "user", content: "Read evidence" }] });
    const image = [{ type: "text" as const, text: "Describe" }, { type: "image_url" as const, image_url: { url: "data:image/png;base64,fixture" } }];
    await model({ agent: "vision", tier: "vision", messages: [{ role: "user", content: image }] });
    expect(text).toMatchObject({ content: '{"ok":true}', provider: "stepfun", model: "step-5-preview", usage: { inputTokens: 27, outputTokens: 15, searchCalls: 0 } });
    expect(tool.toolCalls).toEqual([toolCall]);
    expect(bodies[0]).toMatchObject({ model: "step-5-preview", response_format: { type: "json_object" }, reasoning_effort: "low" });
    expect(bodies[0]).not.toHaveProperty("thinking");
    expect(bodies[1]).toMatchObject({ stream: false, tools });
    expect(bodies[1]).not.toHaveProperty("reasoning_effort");
    expect(bodies[2].messages).toEqual([{ role: "user", content: image }]);
  });

  it("流式回复实时返回正文，忽略推理侧信道并保留最终 token 用量", async () => {
    vi.stubGlobal("fetch", async (_url: string, init: RequestInit) => {
      expect(JSON.parse(String(init.body))).toMatchObject({ stream: true, stream_options: { include_usage: true }, reasoning_effort: "low" });
      const chunks = [
        { choices: [{ delta: { reasoning_content: "private reasoning" } }] },
        { choices: [{ delta: { content: '{"reply":' } }] },
        { choices: [{ delta: { content: '"你好"}' }, finish_reason: "stop" }] },
        { choices: [], usage: { prompt_tokens: 23, completion_tokens: 11, total_tokens: 34 } },
      ];
      return new Response(chunks.map((chunk) => `data: ${JSON.stringify({ id: "plan", object: "chat.completion.chunk", created: 0, model: "step-5-preview", ...chunk })}\n\n`).join("") + "data: [DONE]\n\n", { headers: { "content-type": "text/event-stream" } });
    });
    const deltas: string[] = [];
    const result = await createModelClient(config)({ agent: "lumi-intake", tier: "flash", jsonMode: true, thinking: false, preferStreaming: true,
      onTextDelta: (text) => deltas.push(text), messages: [{ role: "user", content: "你好" }] });
    expect(deltas).toEqual(['{"reply":', '"你好"}']);
    expect(result).toMatchObject({ content: '{"reply":"你好"}', provider: "stepfun", usage: { inputTokens: 23, outputTokens: 11, searchCalls: 0 } });
  });

  it("按任务档位覆盖模型，并保留历史付款截图的专属校验边界", async () => {
    const models: string[] = [];
    vi.stubGlobal("fetch", async (_url: string, init: RequestInit) => {
      const { model } = JSON.parse(String(init.body)); models.push(model);
      return new Response(JSON.stringify({ id: "plan", model, choices: [{ message: { role: "assistant", content: "ok" } }] }), { headers: { "content-type": "application/json" } });
    });
    const model = createModelClient({ ...config, STEPFUN_MODEL_PRO: "pro-override", STEPFUN_MODEL_FLASH: "flash-override", STEPFUN_MODEL_VISION: "vision-override" });
    for (const tier of ["pro", "flash", "vision"] as const) await model({ agent: "test", tier, messages: [{ role: "user", content: "hi" }] });
    expect(models).toEqual(["pro-override", "flash-override", "vision-override"]);
    await expect(model({ agent: "receipt", tier: "vision", mimoOnly: true, messages: [{ role: "user", content: "receipt" }] })).rejects.toThrow("付款截图读取需要 MiMo");
    expect(models).toHaveLength(3);
  });
});
