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
  preferStreaming?: boolean;
  onTextDelta?: (delta: string) => void;
  webSearch?: boolean;
  maxCompletionTokens?: number;
  /** 简单提取/对话设为 false：MiMo 关闭思考，StepFun 使用 low 推理强度。 */
  thinking?: boolean;
  mimoOnly?: boolean;
  signal?: AbortSignal;
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
