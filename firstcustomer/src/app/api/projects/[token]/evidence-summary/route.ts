import { z } from "zod";
import { createModelClient } from "@/ai/call-model";
import { getDb } from "@/db";
import { findCustomerProject } from "@/lib/customer-project";
import { localeFrom } from "@/lib/locale";
import { withinLimit } from "@/lib/request";

const MAX_BODY_BYTES = 128 * 1024;

const digestSchema = z.object({
  key: z.string().min(1).max(160),
  items: z.array(z.object({
    kind: z.string().max(40),
    stance: z.string().max(20),
    status: z.string().max(40),
    grade: z.string().max(40).nullable(),
    excerpt: z.string().max(220),
    source: z.string().max(120).nullable(),
    date: z.string().max(20),
  })).max(60),
  searches: z.array(z.object({
    source: z.string().max(60),
    purpose: z.string().max(20),
    resultCount: z.number().int().min(0),
  })).max(120),
});

const instructions = `你是首客 HiFirst 的市场研究监督员，基于 Research Agent（Nori）收集并保存的市场证据，给客户写一段「证据来源与严谨性小结」。
输入 JSON 里 items 是证据清单（kind 类型、stance 支持/反面、status 核对状态、grade 分级、excerpt 摘录、source 来源域名、date 收集日期），searches 是检索记录（source 检索源、purpose 用途、resultCount 结果条数）。
用 3 到 5 句话、不超过 220 字概括：
1) 证据主要来自哪些类型的来源（如应用商店评价、官方文档、社区讨论、竞品页面），来源是否多样；
2) 整体严谨性：支持与反面证据有没有对照、已核对与待核对的比例、是否依赖厂商或竞品的自述；
3) 哪些数字或声明需要谨慎对待（自述数据、无来源、时间过旧等）；
4) 给客户一条务实的使用建议（例如先核对哪类信息再下结论）。
语气务实、克制，不夸大也不承诺；不编造输入之外的事实或数字；不改写证据内容。只返回一个纯文本段落，不写标题、列表或 Markdown。`;

async function readDigest(request: Request) {
  if (!request.body) return null;
  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let bytes = 0;
  let body = "";
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) return JSON.parse(body + decoder.decode()) as unknown;
      bytes += value.byteLength;
      if (bytes > MAX_BODY_BYTES) {
        await reader.cancel();
        return null;
      }
      body += decoder.decode(value, { stream: true });
    }
  } catch {
    return null;
  } finally {
    reader.releaseLock();
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const db = getDb();
  const project = await findCustomerProject(db, token);
  if (!project) return Response.json({ error: "not_found" }, { status: 404 });
  if (request.headers.get("content-type")?.split(";")[0]?.trim() !== "application/json") {
    return Response.json({ error: "invalid" }, { status: 415 });
  }
  if (!(await withinLimit("evidence-summary", 6, 300))) {
    return Response.json({ error: "rate_limit" }, { status: 429 });
  }
  const parsed = digestSchema.safeParse(await readDigest(request));
  if (!parsed.success) return Response.json({ error: "invalid" }, { status: 400 });

  try {
    if (process.env.LLM_PROVIDER === "stub") {
      return Response.json({ error: "unavailable" }, { status: 503 });
    }
    const model = createModelClient();
    const language = localeFrom(request.headers.get("X-HiFirst-Language")) === "en" ? "Respond in English." : "用简体中文回答。";
    const result = await model({
      agent: "research",
      tier: "flash",
      messages: [
        { role: "system", content: `${instructions}\n${language}` },
        { role: "user", content: JSON.stringify(parsed.data) },
      ],
      preferStreaming: false,
      thinking: false,
      maxCompletionTokens: 700,
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(30_000)]),
    });
    const summary = result.content?.trim().slice(0, 900);
    if (summary) return Response.json({ summary });
  } catch (error) {
    console.error("证据小结生成失败", error instanceof Error ? error.name : "UnknownError");
  }
  return Response.json({ error: "unavailable" }, { status: 503 });
}
