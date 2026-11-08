import { describe, expect, it } from "vitest";
import { DEFAULT_PRO_PRICING, proPricingConfig, proQuote, proRoundProgress, proTrialQuote } from "@/domain/pro-pricing";

const scope = { id: "project-one", requirementVersion: 1, scopeVersion: 1, round: 1 };

describe("按实际服务环节估算 Pro 增量预算", () => {
  it("按实时路由、缓存命中和搜索重算，保留精度且不将估算当实收", () => {
    const quote = proQuote(scope, DEFAULT_PRO_PRICING);
    expect(quote.estimatedAiCostNanoYuan / 1e9).toBe(4.10625);
    expect(quote.estimatedDirectCostNanoYuan / 1e9).toBe(9.10625);
    expect(quote.estimatedInputTokens).toBe(630000);
    expect(quote.estimatedOutputTokens).toBe(130500);
    expect(quote.includedRounds).toBe(3);
    expect(quote.budgetScope).toBe("pro-increment");
    expect(quote.stages.some((stage) => ["parse", "landing", "channel", "quote", "receipt"].includes(stage.stage))).toBe(false);
    expect(quote.stages.find((stage) => stage.stage === "research")?.model).toBe("pro");
    expect(quote.stages.find((stage) => stage.stage === "growth")?.model).toBe("flash");
    expect(quote.estimatedTotalCostNanoYuan / 1e9).toBe(49.10625);
    expect(quote.humanServiceFen).toBe(0);
    expect(quote.quoteFen).toBe(9900);
    expect(quote.stages.find((item) => item.stage === "strategy")!.tokenCostNanoYuan / 1e9).toBe(0.486);
  });
  it("底价、成本加成和基础设施费共同决定报价，金额使用整数分", () => {
    expect(proQuote(scope, { ...DEFAULT_PRO_PRICING, minPriceFen: 1 }).quoteFen).toBe(9900);
    expect(proQuote(scope, { ...DEFAULT_PRO_PRICING, minPriceFen: 49900 }).quoteFen).toBe(49900);
    expect(proPricingConfig({ PRO_MIN_PRICE_FEN: "9900", PRO_MARKUP_PERCENT: "180", PRO_INFRA_FEN: "500" })).toEqual({ minPriceFen: 9900, markupPercent: 180, infraFen: 500, reserveFen: 4000 });
  });
  it("项目、需求、范围、轮次或价格变化均使旧报价指纹失效", () => {
    const initial = proQuote(scope, DEFAULT_PRO_PRICING);
    expect(proQuote(scope, DEFAULT_PRO_PRICING)).toEqual(initial);
    for (const change of [{ id: "other" }, { requirementVersion: 2 }, { scopeVersion: 2 }, { round: 2 }]) {
      expect(proQuote({ ...scope, ...change }, DEFAULT_PRO_PRICING).fingerprint).not.toBe(initial.fingerprint);
    }
    expect(proQuote(scope, { ...DEFAULT_PRO_PRICING, minPriceFen: 39900 }).fingerprint).not.toBe(initial.fingerprint);
  });
  it("试用为独立免费单轮，不改变额外购买三轮的价格与预算", () => {
    const trial = proTrialQuote(scope); const paid = proQuote(scope, DEFAULT_PRO_PRICING);
    expect(trial).toMatchObject({ quoteFen: 0, includedRounds: 1, estimatedInputTokens: 210000, estimatedOutputTokens: 43500 });
    expect(trial.estimatedAiCostNanoYuan / 1e9).toBe(1.36875);
    expect(paid).toMatchObject({ quoteFen: 9900, includedRounds: 3 });
    expect(trial.fingerprint).not.toBe(paid.fingerprint);
  });
  it("套餐轮数按购买快照计算，兼容旧单轮订单与非首轮起购", () => {
    const purchased = { round: 5, includedRounds: 3 };
    expect(proRoundProgress(purchased, 5)).toEqual({ included: 3, started: 1, remaining: 2, covered: true });
    expect(proRoundProgress(purchased, 7)).toEqual({ included: 3, started: 3, remaining: 0, covered: true });
    expect(proRoundProgress(purchased, 8).covered).toBe(false);
    expect(proRoundProgress(purchased, 4).covered).toBe(false);
    expect(proRoundProgress({ round: 1 }, 1).remaining).toBe(0);
    expect(proRoundProgress({ round: 1 }, 2).covered).toBe(false);
    expect(proRoundProgress({ round: 1, includedRounds: 1.5 }, 1).covered).toBe(false);
  });
  it.each([NaN, Infinity, -1, 0, 1.5, 2_147_483_647])("拒绝无效底价 %s", (minPriceFen) => {
    expect(() => proQuote(scope, { ...DEFAULT_PRO_PRICING, minPriceFen })).toThrow("配置无效");
  });
});
