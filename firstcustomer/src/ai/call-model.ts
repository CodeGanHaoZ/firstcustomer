import OpenAI from "openai";
import { stubModel } from "./stub-model";
import type {
  ChatMessage,
  ModelClient,
  ModelRequest,
  ModelResponse,
  ModelUsage,
  ToolCall,
  UrlCitation,
} from "./types";

const MIMO_BASE_URL = "https://api.xiaomimimo.com/v1";
// Step Plan 套餐的地址，和按量计费的 /v1 不同。
const STEPFUN_BASE_URL = "https://api.stepfun.com/step_plan/v1";

// MiMo 官方标价（元/百万 token）。经营台按标价折算，赛事赞助的部分另行标注。
const LIST_PRICES: Record<string, { input: number; output: number }> = {
  "mimo-v2.6-pro": { input: 3, output: 6 },
  "mimo-v2.6-flash": { input: 1, output: 2 },
};
const WEB_SEARCH_YUAN_PER_CALL = 16 / 1000;

export const hasModelListPrice = (model: string | null) =>
  model !== null && model.split("+").every((name) => Object.hasOwn(LIST_PRICES, name));

export function listCostYuan(model: string, usage: ModelUsage) {
  const price = LIST_PRICES[model];
  const tokens = price
    ? (usage.inputTokens * price.input + usage.outputTokens * price.output) /
      1_000_000
    : 0;
  return tokens + usage.searchCalls * WEB_SEARCH_YUAN_PER_CALL;
}

type RawMessage = {
  content?: string | null;
  tool_calls?: ToolCall[];
  annotations?: {
    type: string;
    url?: string;
    title?: string;
    summary?: string;
    publish_time?: string;
  }[];
};

type RawUsage = {
  prompt_tokens?: number;
  completion_tokens?: number;
  web_search_usage?: { tool_usage?: number };
};

function toResponse(
  completion: OpenAI.Chat.Completions.ChatCompletion,
  provider: string,
): ModelResponse {
  const choice = completion?.choices?.[0];
  if (!choice) throw new Error("模型没有返回内容");
  const raw = choice.message as unknown as RawMessage;
  const usage = completion.usage as unknown as RawUsage | undefined;
  const citations: UrlCitation[] = (raw.annotations ?? [])
    .filter((a) => a.type === "url_citation" && a.url)
    .map((a) => ({
      url: a.url as string,
      title: a.title ?? "",
      summary: a.summary ?? "",
      publishTime: a.publish_time,
    }));
  return {
    message: choice.message as ChatMessage,
    content: raw.content ?? null,
    toolCalls: raw.tool_calls ?? [],
    citations,
    provider,
    model: completion.model,
    usage: {
      inputTokens: usage?.prompt_tokens ?? 0,
      outputTokens: usage?.completion_tokens ?? 0,
      searchCalls: usage?.web_search_usage?.tool_usage ?? 0,
    },
  };
}

type Endpoint = {
  provider: string;
  client: OpenAI;
  models: Record<ModelRequest["tier"], string>;
};

async function callEndpoint(endpoint: Endpoint, request: ModelRequest) {
  const tools: unknown[] = [...(request.tools ?? [])];
  if (request.webSearch) {
    tools.push({
      type: "web_search",
      max_keyword: 3,
      force_search: true,
      limit: 5,
    });
  }
  const payload = {
    model: endpoint.models[request.tier],
    messages: request.messages,
    max_completion_tokens: request.maxCompletionTokens ?? 8000,
    stream: false,
    ...(tools.length ? { tools: tools as OpenAI.Chat.ChatCompletionTool[] } : {}),
    ...(request.jsonMode
      ? { response_format: { type: "json_object" as const } }
      : {}),
    // MiMo 默认先思考再回答，思考也计入输出 token。
    ...(endpoint.provider === "mimo" && request.thinking === false
      ? ({ thinking: { type: "disabled" } } as Record<string, unknown>)
      : {}),
  } as OpenAI.Chat.ChatCompletionCreateParamsNonStreaming;
  if (endpoint.provider === "mimo" && !tools.length && request.preferStreaming) {
    return streamMimoCompletion(endpoint, payload);
  }
  const { data, response } = await endpoint.client.chat.completions.create(payload).withResponse();
  if (!Array.isArray(data?.choices)) {
    throw responseFormatError(endpoint.provider, response);
  }
  return toResponse(data, endpoint.provider);
}

async function streamMimoCompletion(endpoint: Endpoint, payload: OpenAI.Chat.ChatCompletionCreateParamsNonStreaming) {
  const { data, response } = await endpoint.client.chat.completions.create({
    ...payload,
    stream: true,
    stream_options: { include_usage: true },
  }).withResponse();
  let content = "";
  let model = payload.model;
  let usage: OpenAI.Completions.CompletionUsage | undefined;
  for await (const chunk of data) {
    model = chunk.model || model;
    usage = chunk.usage ?? usage;
    content += chunk.choices?.[0]?.delta?.content ?? "";
  }
  if (!content.trim()) throw responseFormatError(endpoint.provider, response);
  return toResponse({
    model, usage, choices: [{ message: { role: "assistant", content } }],
  } as OpenAI.Chat.ChatCompletion, endpoint.provider);
}

function responseFormatError(provider: string, response: Response) {
  const media = response.headers.get("content-type")?.split(";")[0] ?? "未知格式";
  return new Error(`${provider} 返回了非聊天响应（HTTP ${response.status}，${media}）`);
}

const client = (apiKey: string, baseURL: string) =>
  new OpenAI({ apiKey, baseURL, timeout: 180_000 });

// 主力服务商由 LLM_PROVIDER 决定，默认 MiMo。比赛演示前要切回 MiMo。
function primaryFromEnv(env: NodeJS.ProcessEnv): Endpoint {
  if (env.LLM_PROVIDER === "stepfun") {
    if (!env.STEPFUN_API_KEY) throw new Error("缺少 STEPFUN_API_KEY");
    const main = env.STEPFUN_MODEL_PRO ?? "step-5-preview";
    return {
      provider: "stepfun",
      client: client(env.STEPFUN_API_KEY, env.STEPFUN_BASE_URL ?? STEPFUN_BASE_URL),
      models: {
        pro: main,
        flash: env.STEPFUN_MODEL_FLASH ?? main,
        vision: env.STEPFUN_MODEL_VISION ?? main,
      },
    };
  }
  if (env.LLM_PROVIDER && env.LLM_PROVIDER !== "mimo") {
    throw new Error(`不支持的 LLM_PROVIDER：${env.LLM_PROVIDER}`);
  }
  if (!env.MIMO_API_KEY) throw new Error("缺少 MIMO_API_KEY");
  const flash = env.MIMO_MODEL_FLASH ?? "mimo-v2.6-flash";
  return {
    provider: "mimo",
    client: client(env.MIMO_API_KEY, env.MIMO_BASE_URL ?? MIMO_BASE_URL),
    models: { pro: env.MIMO_MODEL_PRO ?? "mimo-v2.6-pro", flash, vision: flash },
  };
}

function endpointsFromEnv(env: NodeJS.ProcessEnv): {
  primary: Endpoint;
  fallback?: Endpoint;
} {
  const primary = primaryFromEnv(env);
  if (!env.FALLBACK_API_KEY || !env.FALLBACK_BASE_URL || !env.FALLBACK_MODEL) {
    return { primary };
  }
  const model = env.FALLBACK_MODEL;
  return {
    primary,
    fallback: {
      provider: env.FALLBACK_PROVIDER ?? "fallback",
      client: client(env.FALLBACK_API_KEY, env.FALLBACK_BASE_URL),
      models: { pro: model, flash: model, vision: model },
    },
  };
}

export function createModelClient(
  env: NodeJS.ProcessEnv = process.env,
): ModelClient {
  if (env.LLM_PROVIDER === "stub") {
    if (env.ALLOW_STUB !== "1") {
      throw new Error("使用模拟模型必须同时设置 ALLOW_STUB=1");
    }
    return stubModel;
  }
  const { primary, fallback } = endpointsFromEnv(env);
  return async (request) => {
    if (request.mimoOnly && primary.provider !== "mimo") throw new Error("付款截图读取需要 MiMo");
    try {
      return await callEndpoint(primary, request);
    } catch (error) {
      // 备用模型只在主力服务商故障时启用，实际使用的 provider 会写入 agent_tasks。
      if (!fallback || request.webSearch || request.mimoOnly) throw error;
      console.error(`${primary.provider} 调用失败，切换备用模型`, error);
      return callEndpoint(fallback, request);
    }
  };
}
