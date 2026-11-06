// 没有 MiMo Key 时用来跑通流程的模拟模型。所有数据都写明是示例，
// agent_tasks 和经营台会显示 provider=stub，不能当作真实研究结果。
import type { SourceClient, SourceResult } from "@/agents/sources";
import type { ChatMessage, ModelClient, ModelRequest, ToolCall } from "./types";

const DOCS: Record<string, SourceResult> = {
  pain: {
    url: "https://example.com/sample/consultants-notes",
    title: "示例：咨询团队的抱怨",
    text: "Sample post: we rewrite meeting notes for clients after every weekly call, and it eats our Friday afternoons.",
  },
  against: {
    url: "https://example.com/sample/too-expensive",
    title: "示例：小团队嫌贵",
    text: "Sample review: per-seat meeting note tools feel too expensive for a small consulting firm like ours.",
  },
  smb: {
    url: "https://example.com/sample/smb-notes",
    title: "示例：中小企业的需求",
    text: "Sample post: small businesses want notes but rarely pay for a dedicated meeting tool.",
  },
  smbAgainst: {
    url: "https://example.com/sample/smb-free",
    title: "示例：中小企业用免费工具",
    text: "Sample review: most small businesses we talked to already use the free notes built into their video app.",
  },
  pricing: {
    url: "https://example.com/sample/competitor-pricing",
    title: "示例：竞品定价",
    text: "Sample pricing page: the competitor sells a Business plan at $19 per seat per month.",
  },
};

export function createStubSources(): SourceClient {
  return {
    names: ["stub"],
    async search(_source, query) {
      const q = query.toLowerCase();
      const pick = q.includes("pricing")
        ? [DOCS.pricing]
        : q.includes("smb")
          ? [q.includes("complaint") ? DOCS.smbAgainst : DOCS.smb]
          : [q.includes("complaint") ? DOCS.against : DOCS.pain];
      return { results: pick, searchCalls: 0 };
    },
    async readPage(url) {
      const doc = Object.values(DOCS).find((d) => d.url === url);
      if (!doc) throw new Error("模拟来源里没有这个网址");
      return { title: doc.title, text: doc.text };
    },
  };
}

const respond = (content: string | null, toolCalls: ToolCall[] = []) => ({
  message: {
    role: "assistant",
    content,
    ...(toolCalls.length ? { tool_calls: toolCalls } : {}),
  } as ChatMessage,
  content,
  toolCalls,
  citations: [],
  provider: "stub",
  model: "stub-model",
  usage: { inputTokens: 0, outputTokens: 0, searchCalls: 0 },
});

const userInput = (request: ModelRequest) => {
  const message = request.messages.find((m) => m.role === "user");
  return JSON.parse(String(message?.content ?? "{}"));
};

const CONSULTING = "远程咨询团队";
const SMB = "全部中小企业";

const pick = (doc: SourceResult, quote: string, kind: string, stance: string) => ({
  url: doc.url,
  quote,
  kind,
  stance,
  product: null,
  number_value: null,
  metric: null,
});

const query = (q: string, purpose: string, candidate: string) => ({ source: "stub", query: q, purpose, candidate });

function researchPlanStep(request: ModelRequest) {
  const input = userInput(request);
  if (input.request) {
    return respond(
      JSON.stringify({
        categories: [],
        candidates: [CONSULTING],
        queries: [
          query("competitor pricing", "support", CONSULTING),
          query("consultants meeting notes complaint", "counter", CONSULTING),
        ],
      }),
    );
  }
  return respond(
    JSON.stringify({
      categories: [],
      candidates: [CONSULTING, SMB],
      queries: [
        query("consultants meeting notes", "support", CONSULTING),
        query("consultants meeting notes complaint", "counter", CONSULTING),
        query("smb meeting notes", "support", SMB),
        query("smb meeting notes complaint", "counter", SMB),
      ],
    }),
  );
}

function researchStep(request: ModelRequest) {
  const input = userInput(request);
  // 没填目标市场时追问一次，用来演示“等待补充信息”。
  if (!input.product.target_market && !input.clarifications?.length && !input.request) {
    return respond(
      JSON.stringify({
        status: "need_info",
        questions: [
          { question: "【模拟数据】你想先进入哪个海外市场？", why: "决定研究范围" },
          { question: "【模拟数据】现在有海外用户吗？", why: "决定从哪一步开始验证" },
        ],
      }),
    );
  }
  if (input.request) {
    return respond(
      JSON.stringify({
        status: "done",
        summary: "【模拟数据】已补查定价。",
        candidates: [
          {
            name: CONSULTING,
            why: "【模拟数据】补查后有付费信号",
            library_ids: [],
            picks: [pick(DOCS.pricing, "the competitor sells a Business plan at $19 per seat per month", "pricing", "support")],
          },
        ],
        unknowns: ["竞品的真实收入未公开"],
      }),
    );
  }
  return respond(
    JSON.stringify({
      status: "done",
      summary: "【模拟数据】找到两个候选人群，付费意愿证据还不足。",
      candidates: [
        {
          name: CONSULTING,
          why: "【模拟数据】痛点具体",
          library_ids: [],
          picks: [
            pick(DOCS.pain, "we rewrite meeting notes for clients after every weekly call", "pain", "support"),
            pick(DOCS.against, "per-seat meeting note tools feel too expensive", "pain", "against"),
          ],
        },
        {
          name: SMB,
          why: "【模拟数据】人群更大，但付费弱",
          library_ids: [],
          picks: [
            pick(DOCS.smb, "small businesses want notes but rarely pay", "pain", "support"),
            pick(DOCS.smbAgainst, "use the free notes built into their video app", "pain", "against"),
          ],
        },
      ],
      unknowns: ["付费意愿"],
    }),
  );
}

type StubEvidence = { id: string; kind: string; stance: string };

function strategyStep(request: ModelRequest) {
  const input = userInput(request);
  const evidence: StubEvidence[] = input.evidence ?? [];
  if (!evidence.some((e) => e.kind === "pricing") && !input.founder_note) {
    return respond(
      JSON.stringify({
        status: "need_more",
        request: {
          missing: "远程咨询团队的付费意愿",
          reason: "【模拟数据】目前只有痛点，没有付费信号",
          source_types: ["定价页", "差评"],
        },
      }),
    );
  }
  return respond(
    JSON.stringify({
      status: "done",
      options: [
        {
          audience: CONSULTING,
          problem: "【模拟数据】每周重写给客户的会议纪要",
          value_prop: "Client-ready meeting notes for remote consulting teams",
          why: "【模拟数据】痛点具体且容易接触",
        },
        {
          audience: SMB,
          problem: "【模拟数据】需要记录会议",
          value_prop: "Simple meeting notes for small businesses",
          why: "【模拟数据】人群更大但付费弱",
        },
      ],
      recommended_option: 0,
      rationale: "【模拟数据】先服务更容易接触、痛点更具体的人群。",
      experiment: {
        hypothesis: "【模拟数据】远程咨询团队愿意留下邮箱试用",
        channel: "特定开发者社区",
        min_visits: 20,
        pass_leads: 2,
      },
      counter_responses: evidence
        .filter((e) => e.stance === "against")
        .map((e) => ({
          evidence_id: e.id,
          response: "to_test",
          note: "【模拟数据】列为实验待验证",
        })),
      guidance_for_launch: input.launch_request ? "【模拟数据】换成有证据的卖点" : undefined,
    }),
  );
}

function launchStep(request: ModelRequest) {
  const input = userInput(request);
  const evidence: StubEvidence[] = input.evidence ?? [];
  const pain = evidence.find((e) => e.kind === "pain" && e.stance === "support");
  const pricing = evidence.find((e) => e.kind === "pricing");
  const claims = [
    {
      text: "Consultants told us they rewrite meeting notes for clients after every weekly call",
      kind: "pain",
      evidence_id: pain?.id ?? null,
      location: "page",
    },
    {
      text: "Comparable tools charge $19 per seat per month",
      kind: "comparison",
      evidence_id: pricing?.id ?? null,
      location: "asset",
    },
    // 第一次故意带一条没有证据的声明，用来演示第二道证据闸门。
    ...(input.violations
      ? []
      : [{ text: "Saves 5 hours every week", kind: "metric", evidence_id: null, location: "page" }]),
  ];
  return respond(
    JSON.stringify({
      status: "done",
      page: {
        headline: "[Sample] Client-ready meeting notes for remote consulting teams",
        subheadline: "[Sample] Stop rewriting notes after every client call.",
        value_props: ["Share notes clients can act on", "Keep your team's voice"],
        scenarios: ["After a weekly client call", "Before a project review"],
        cta_label: "Request early access",
        form_prompt: "Tell us how your team handles client notes today",
      },
      claims,
      channel: {
        name: "特定开发者社区（模拟）",
        reason: "【模拟数据】目标用户聚集",
        checklist: ["确认社区规则", "老板把关后发布"],
        assets: [
          {
            title: "社区帖子（模拟）",
            body: "We are testing client-ready notes. Comparable tools charge $19 per seat per month. Would this help your team?",
          },
        ],
      },
    }),
  );
}

function growthStep(request: ModelRequest) {
  const input = userInput(request);
  return respond(
    JSON.stringify({
      summary: `【模拟数据】结论：${input.verdict_label}。访问 ${input.metrics.visits}，留资 ${input.metrics.leads}。`,
      actions_taken: ["发布验证页（模拟）"],
      uncertainties: ["样本来自单一渠道"],
      next_steps: ["继续收集真实回复"],
      next_hypothesis:
        input.verdict === "failed" ? "【模拟数据】换一个价值主张再测一轮" : null,
    }),
  );
}

function visionStep() {
  return respond(
    JSON.stringify({
      summary: "【模拟数据】这是一张产品界面的截图。",
      visible_text: ["[Sample] Meeting summary"],
      features: ["【模拟数据】会议摘要"],
      prices: [],
      audience_hints: ["【模拟数据】经常开客户会议的团队"],
    }),
  );
}

export const stubModel: ModelClient = async (request) => {
  switch (request.agent) {
    case "vision":
      return visionStep();
    case "research:plan":
      return researchPlanStep(request);
    case "research":
      return researchStep(request);
    case "strategy":
      return strategyStep(request);
    case "launch":
      return launchStep(request);
    case "growth":
      return growthStep(request);
    default:
      throw new Error(`模拟模型不支持：${request.agent}`);
  }
};
