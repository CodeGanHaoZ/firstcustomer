import type {
  ChatCompletionMessageParam,
  ChatCompletionTool,
} from "openai/resources/chat/completions";

export type ChatMessage = ChatCompletionMessageParam;
export type ModelTool = ChatCompletionTool;

export type ToolCall = {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
};

export type ModelRequest = {
  agent: string;
  tier: "pro" | "flash" | "vision";
  messages: ChatMessage[];
  tools?: ModelTool[];
  jsonMode?: boolean;
  webSearch?: boolean;
  maxCompletionTokens?: number;
};

export type UrlCitation = {
  url: string;
  title: string;
  summary: string;
  publishTime?: string;
};

export type ModelUsage = {
  inputTokens: number;
  outputTokens: number;
  searchCalls: number;
};

export type ModelResponse = {
  message: ChatMessage;
  content: string | null;
  toolCalls: ToolCall[];
  citations: UrlCitation[];
  provider: string;
  model: string;
  usage: ModelUsage;
};

export type ModelClient = (request: ModelRequest) => Promise<ModelResponse>;
