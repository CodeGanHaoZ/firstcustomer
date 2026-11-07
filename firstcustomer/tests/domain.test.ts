import { experimentProblems, unsupportedFigures } from "@/domain/experiment";
import { vendorCopyProblem } from "@/domain/evidence";
import { describe, expect, it } from "vitest";
import { decisionError, gateState } from "@/domain/approval";
import { checkClaims, type ClaimEvidence, type PageSlots } from "@/domain/claims";
import { candidatesWithoutCounterSearch, unansweredCounterEvidence } from "@/domain/counter";
import { customerProgress } from "@/domain/customer-progress";
import { expiresAt, gradeFor, verifyQuote } from "@/domain/evidence";
import { evaluateExperiment } from "@/domain/experiment";
import { canStartFreeDiagnosis, canTransition, sendBackAllowed, usesQuoteFlow } from "@/domain/workflow";

const now = new Date("2026-11-05T00:00:00Z");
const later = new Date("2026-12-01T00:00:00Z");
const page: PageSlots = {
  headline: "Client-ready meeting notes",
  subheadline: "For remote consulting teams",
  value_props: ["Share notes clients can act on"],
  scenarios: ["After a weekly client call"],
  cta_label: "Start free",
  form_prompt: "Tell us about your team",
};
const usable: ClaimEvidence = {
  id: "e1",
  projectId: "p1",
  status: "verified",
  licenseStatus: "public_reference",
  expiresAt: later,
};
const check = (overrides: Partial<Parameters<typeof checkClaims>[0]>) =>
  checkClaims({ projectId: "p1", page, claims: [], assets: [], evidence: [usable], now, ...overrides });

describe("状态机", () => {
  it("只放行 PRD 列出的流转和回退", () => {
    expect(canTransition("strategizing", "researching")).toBe(true);
    expect(canTransition("preparing_page", "strategizing")).toBe(true);
    expect(canTransition("reviewing", "strategizing")).toBe(true);
    expect(canTransition("awaiting_positioning", "strategizing")).toBe(true);
    expect(canTransition("awaiting_publish", "preparing_page")).toBe(true);
    expect(canTransition("submitted", "published")).toBe(false);
    expect(canTransition("preparing_page", "published")).toBe(false);
    expect(canTransition("delivered", "cancelled")).toBe(false);
  });

  it("打回次数按路线限制", () => {
    expect(sendBackAllowed("strategy->research", 1)).toBe(true);
    expect(sendBackAllowed("strategy->research", 2)).toBe(false);
    expect(sendBackAllowed("growth->strategy", 1)).toBe(false);
  });

  it("免费初诊完成后可请求 Pro 报价，或通过密钥进入策略", () => {
    expect(canTransition("researching", "free_ready")).toBe(true);
    expect(canTransition("free_ready", "drafting_quote")).toBe(true);
    expect(canTransition("free_ready", "strategizing")).toBe(true);
    expect(canTransition("awaiting_quote_acceptance", "strategizing")).toBe(true);
    expect(usesQuoteFlow({ requiresPayment: true, isOwnProduct: false, productPlan: "free" })).toBe(false);
    expect(usesQuoteFlow({ requiresPayment: true, isOwnProduct: false, productPlan: "pro" })).toBe(true);
  });

  it("存量项目仅在尚未开始且没有有效报价时能自助初诊", () => {
    const project = { productPlan: "legacy" as const, status: "submitted", paused: false, isOwnProduct: false, failedFrom: null };
    const inquiry = { status: "inquiry", quoteVersion: 0, quoteFen: null, proposal: null };
    expect(canStartFreeDiagnosis(project, inquiry)).toBe(true);
    expect(canStartFreeDiagnosis({ ...project, isOwnProduct: true }, inquiry)).toBe(false);
    expect(canStartFreeDiagnosis({ ...project, status: "awaiting_payment" }, inquiry)).toBe(false);
    expect(canStartFreeDiagnosis(project, { ...inquiry, status: "paid" })).toBe(false);
  });
});

describe("客户项目进度", () => {
  const progress = (input: Partial<Parameters<typeof customerProgress>[0]> = {}) => customerProgress({
    status: "researching", paused: false, runningAgents: [], openGate: null, reportReady: false,
    quoteVisible: false, awaitingPayment: false, receiptUploaded: false, ...input,
  });

  it("区分排队、正在工作的员工和暂停收尾", () => {
    expect(progress({ runningAgents: ["support"] }).detail).toContain("等待研究员");
    expect(progress({ runningAgents: ["research"] }).detail).toContain("研究员正在收集");
    expect(progress({ runningAgents: ["vision"] }).detail).toContain("截图读取员正在");
    expect(progress({ runningAgents: ["research"], paused: true })).toMatchObject({ title: "项目已暂停", detail: expect.stringContaining("已开始的步骤") });
    expect(progress({ paused: true })).toMatchObject({ title: "项目已暂停", refreshSeconds: 12 });
  });

  it("只在客户能处理时指向对应事项，上传截图后等待核对", () => {
    expect(progress({ status: "awaiting_publish" }).action).toBeUndefined();
    expect(progress({ status: "awaiting_publish", openGate: "publish" }).action?.href).toBe("#approval");
    expect(progress({ status: "awaiting_quote_acceptance", quoteVisible: true }).action?.href).toBe("#proposal");
    expect(progress({ status: "awaiting_payment", awaitingPayment: true }).action?.href).toBe("#payment");
    expect(progress({ status: "awaiting_payment", awaitingPayment: true, receiptUploaded: true }).title).toBe("待首客确认到账");
    expect(progress({ status: "delivered", deliveryStatus: "changes_requested" }).action?.href).toBe("#delivery");
  });
});

describe("两道审批（AC-19）", () => {
  const at = (minute: number) => new Date(2026, 10, 5, 10, minute);
  const d = (actorRole: string, verdict: string, minute: number, subjectVersion = 1) => ({
    gate: "publish",
    subjectVersion,
    actorRole,
    verdict,
    createdAt: at(minute),
  });

  it("老板批准后仍要等客户确认", () => {
    const state = gateState([d("founder", "approve", 1)], "publish", 1);
    expect(state).toEqual({ founder: "approved", customer: "pending", complete: false });
  });

  it("客户不能抢在老板之前确认", () => {
    expect(decisionError(gateState([], "publish", 1), "customer")).toContain("老板把关");
  });

  it("退回会让之前的批准失效", () => {
    const state = gateState(
      [d("founder", "approve", 1), d("customer", "reject", 2), d("customer", "approve", 3)],
      "publish",
      1,
    );
    expect(state.founder).toBe("pending");
    expect(state.complete).toBe(false);
  });

  it("新版本不继承旧版本的批准（AC-15）", () => {
    const decisions = [d("founder", "approve", 1), d("customer", "approve", 2)];
    expect(gateState(decisions, "publish", 1).complete).toBe(true);
    expect(gateState(decisions, "publish", 2).complete).toBe(false);
  });
});

describe("第一道证据闸门", () => {
  const source = "Our team lost 3 hours a week — rewriting meeting notes for clients.";

  it("摘录原样出现才算已验证，空白和标点差异不影响", () => {
    expect(verifyQuote("lost 3 hours a week - rewriting  meeting notes", source).status).toBe("verified");
  });

  it("编造的摘录不能通过（AC-22）", () => {
    expect(verifyQuote("Customers doubled revenue within one month of use", source).status).not.toBe("verified");
  });

  it("近似摘录只能进入人工核对", () => {
    const result = verifyQuote("lost 3 hours a week rewriting meeting notes", source);
    expect(result.status).toBe("needs_review");
  });

  it("太短的摘录直接拒绝", () => {
    expect(verifyQuote("3 hours", source).status).toBe("rejected");
  });
});

describe("付费证据等级（AC-21）", () => {
  it("等级由来源决定", () => {
    expect(gradeFor("pricing", "https://otter.ai/pricing")).toBe("E");
    expect(gradeFor("revenue", "https://www.microns.io/x")).toBe("B");
    expect(gradeFor("revenue", "https://getlatka.com/companies/x")).toBe("C");
    expect(gradeFor("revenue", "https://some-blog.example/estimate")).toBe("D");
    expect(gradeFor("revenue", "https://x.example", { customerAuthorized: true })).toBe("A");
    expect(gradeFor("pain", "https://news.ycombinator.com/item?id=1")).toBeNull();
  });

  it("定价 7 天、收入 30 天过期", () => {
    expect(expiresAt("pricing", now).toISOString()).toBe("2026-11-12T00:00:00.000Z");
    expect(expiresAt("revenue", now).toISOString()).toBe("2026-12-05T00:00:00.000Z");
  });
});

describe("第二道证据闸门（AC-16）", () => {
  const claim = (over = {}) => ({
    text: "Saves 5 hours a week",
    kind: "metric" as const,
    evidence_id: "e1",
    location: "page" as const,
    ...over,
  });

  it("合格的声明能通过", () => {
    expect(check({ claims: [claim()] })).toEqual([]);
  });

  it("没有证据、证据不存在、别的项目、未核对、未授权、已过期都不能通过", () => {
    expect(check({ claims: [claim({ evidence_id: null })] })[0].message).toContain("没有绑定");
    expect(check({ claims: [claim({ evidence_id: "nope" })] })[0].message).toContain("不存在");
    expect(check({ claims: [claim()], evidence: [{ ...usable, projectId: "p2" }] })[0].message).toContain("无权");
    expect(check({ claims: [claim()], evidence: [{ ...usable, status: "needs_review" }] })[0].message).toContain("尚未");
    expect(check({ claims: [claim()], evidence: [{ ...usable, licenseStatus: "restricted" }] })[0].message).toContain("许可");
    expect(check({ claims: [claim()], evidence: [{ ...usable, expiresAt: now }], now: later })[0].message).toContain("过期");
  });

  it("赛前种子证据（无项目）可以被任何项目使用", () => {
    expect(check({ claims: [claim()], evidence: [{ ...usable, projectId: null }] })).toEqual([]);
  });

  it("模板文案里出现数字直接报错", () => {
    const v = check({ page: { ...page, headline: "Save 5 hours" } });
    expect(v[0].message).toContain("数字");
    expect(check({ page: { ...page, value_props: ["Cut costs by half％"] } })).toHaveLength(1);
  });

  it("素材里的数字必须是已登记的声明", () => {
    const assets = [{ title: "HN post", body: "Saves 5 hours a week for consultants" }];
    expect(check({ assets })[0].message).toContain("未登记");
    expect(check({ assets, claims: [claim({ location: "asset" })] })).toEqual([]);
  });
});

describe("反面证据检查（AC-17）", () => {
  it("列出没有回应的反面证据", () => {
    const responses = [{ evidence_id: "a", response: "to_test" as const, note: "待验证" }];
    expect(unansweredCounterEvidence(["a", "b"], responses)).toEqual(["b"]);
  });

  it("列出没有做反向检索的候选人群", () => {
    const searches = [
      { candidate: "咨询团队", purpose: "counter" },
      { candidate: "中小企业", purpose: "support" },
    ];
    expect(candidatesWithoutCounterSearch(["咨询团队", "中小企业"], searches)).toEqual(["中小企业"]);
  });
});

describe("实验判定（AC-18）", () => {
  const plan = { hypothesis: "h", min_visits: 50, pass_leads: 3 };
  const metrics = { visits: 0, ctaClicks: 0, leads: 0, replies: 0 };

  it("样本不够时不判定，哪怕留资已经达标", () => {
    expect(evaluateExperiment(plan, { ...metrics, visits: 10, leads: 5 })).toBe("insufficient");
  });

  it("达到样本后按预设标准判定", () => {
    expect(evaluateExperiment(plan, { ...metrics, visits: 50, leads: 3 })).toBe("passed");
    expect(evaluateExperiment(plan, { ...metrics, visits: 50, leads: 2 })).toBe("failed");
  });
});

describe("实验方案检查", () => {
  const ok = { channel: "Hacker News 的 Show HN", min_visits: 100, pass_leads: 3 };
  it("周末规模、一个免费渠道可以通过", () => {
    expect(experimentProblems(ok)).toEqual([]);
    expect(experimentProblems({ ...ok, channel: "Reddit r/consulting" })).toEqual([]);
  });
  it("门槛过高、多个渠道、付费广告都要改", () => {
    expect(experimentProblems({ ...ok, min_visits: 1200, pass_leads: 25 })).toHaveLength(2);
    expect(experimentProblems({ ...ok, channel: "LinkedIn + Reddit" }).join()).toContain("一个渠道");
    expect(experimentProblems({ ...ok, channel: "LinkedIn Ads" }).join()).toContain("付费");
    expect(experimentProblems({ ...ok, channel: "顾问 newsletter 赞助位" }).join()).toContain("付费");
  });
});

describe("Strategy 里的价格和百分比", () => {
  const evidence = ['{"excerpt":"In 73% of cases clients showed hesitation"}', '{"excerpt":"ProFor teams$18$10per seat / month"}'];
  it("证据里有的数字可以写", () => {
    expect(unsupportedFigures("73% 的客户犹豫，竞品每席位 $10", evidence)).toEqual([]);
  });
  it("证据里没有的价格和百分比会被找出来，普通数字不管", () => {
    expect(unsupportedFigures("Otter 约 $16.99，转化提升 40%，每周 3 次会议", evidence)).toEqual(["$16.99", "40%"]);
  });
});

describe("厂商文案", () => {
  const appPage = "https://apps.apple.com/us/app/otter/id1276437113?uo=4";
  it("应用介绍不能当痛点或付费信号", () => {
    expect(vendorCopyProblem("pain", appPage, "The most important conversations happen anywhere")).not.toBeNull();
    expect(vendorCopyProblem("signal", appPage, "Trusted by over 10 million people")).not.toBeNull();
  });
  it("评分数、产品事实、用户评价不受限制", () => {
    expect(vendorCopyProblem("signal", appPage, "App Store user rating count: 88284.")).toBeNull();
    expect(vendorCopyProblem("product", appPage, "Records meetings")).toBeNull();
    expect(vendorCopyProblem("pain", "https://apps.apple.com/us/app/id1?see-all=reviews", "charged me twice")).toBeNull();
  });
});
