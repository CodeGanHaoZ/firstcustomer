import { describe, expect, it } from "vitest";
import { DEFAULT_PRO_PRICING, proPricingConfig, proQuote } from "@/domain/pro-pricing";

const scope = { id: "project-one", requirementVersion: 1, scopeVersion: 1, round: 1 };

describe("附件计价模型", () => {
  it("按实时路由、缓存命中和搜索重算，保留精度且不将估算当实收", () => {
    const quote = proQuote(scope, DEFAULT_PRO_PRICING);
    expect(quote.estimatedAiCostNanoYuan / 1e9).toBe(4.322475);
    expect(quote.estimatedTotalCostNanoYuan / 1e9).toBe(9.322475);
    expect(quote.humanServiceFen).toBe(0);
    expect(quote.quoteFen).toBe(29900);
    expect(quote.stages.find((item) => item.stage === "strategy")!.tokenCostNanoYuan / 1e9).toBe(0.903);
  });
  it("底价、成本加成和基础设施费共同决定报价，金额使用整数分", () => {
    expect(proQuote(scope, { ...DEFAULT_PRO_PRICING, minPriceFen: 1 }).quoteFen).toBe(1900);
    expect(proQuote(scope, { ...DEFAULT_PRO_PRICING, minPriceFen: 49900 }).quoteFen).toBe(49900);
    expect(proPricingConfig({ PRO_MIN_PRICE_FEN: "9900", PRO_MARKUP_PERCENT: "180", PRO_INFRA_FEN: "500" })).toEqual({ minPriceFen: 9900, markupPercent: 180, infraFen: 500 });
  });
  it("项目、需求、范围、轮次或价格变化均使旧报价指纹失效", () => {
    const initial = proQuote(scope, DEFAULT_PRO_PRICING);
    expect(proQuote(scope, DEFAULT_PRO_PRICING)).toEqual(initial);
    for (const change of [{ id: "other" }, { requirementVersion: 2 }, { scopeVersion: 2 }, { round: 2 }]) {
      expect(proQuote({ ...scope, ...change }, DEFAULT_PRO_PRICING).fingerprint).not.toBe(initial.fingerprint);
    }
    expect(proQuote(scope, { ...DEFAULT_PRO_PRICING, minPriceFen: 39900 }).fingerprint).not.toBe(initial.fingerprint);
  });
  it.each([NaN, Infinity, -1, 0, 1.5, 2_147_483_647])("拒绝无效底价 %s", (minPriceFen) => {
    expect(() => proQuote(scope, { ...DEFAULT_PRO_PRICING, minPriceFen })).toThrow("配置无效");
  });
});
