import { createHash } from "node:crypto";

// Rates and workload assumptions from the two supplied MiMo pricing plans.
// Keep estimates separate from agentTasks.listCostYuan (actual model usage).
export const PRO_PRICING_VERSION = "mimo-cn-2026-09-22-v1";
const NANO_PER_FEN = 10_000_000;
const rates = {
  flash: { hit: 20, miss: 1_000, output: 2_000 },
  pro: { hit: 25, miss: 3_000, output: 6_000 },
} as const;
const workload = [
  { stage: "parse", model: "flash", input: 30_000, hit: 0, output: 3_000, searches: 0 },
  { stage: "research", model: "flash", input: 400_000, hit: 200_000, output: 60_000, searches: 25 },
  { stage: "strategy", model: "pro", input: 300_000, hit: 120_000, output: 60_000, searches: 0 },
  { stage: "landing", model: "flash", input: 250_000, hit: 50_000, output: 50_000, searches: 0 },
  { stage: "channel", model: "flash", input: 200_000, hit: 0, output: 40_000, searches: 0 },
  { stage: "growth", model: "pro", input: 150_000, hit: 0, output: 30_000, searches: 0 },
  { stage: "support", model: "flash", input: 80_000, hit: 24_000, output: 20_000, searches: 0 },
] as const;

export type ProPricingConfig = { minPriceFen: number; markupPercent: number; infraFen: number };
export type QuoteScope = { id: string; requirementVersion: number; scopeVersion: number; round: number };
export const DEFAULT_PRO_PRICING: ProPricingConfig = { minPriceFen: 29_900, markupPercent: 200, infraFen: 500 };

export function proPricingConfig(env: Readonly<Record<string, string | undefined>> = process.env): ProPricingConfig {
  return {
    minPriceFen: Number(env.PRO_MIN_PRICE_FEN ?? DEFAULT_PRO_PRICING.minPriceFen),
    markupPercent: Number(env.PRO_MARKUP_PERCENT ?? DEFAULT_PRO_PRICING.markupPercent),
    infraFen: Number(env.PRO_INFRA_FEN ?? DEFAULT_PRO_PRICING.infraFen),
  };
}

export function proQuote(scope: QuoteScope, config = proPricingConfig()) {
  if (!Number.isSafeInteger(config.minPriceFen) || config.minPriceFen < 1 || config.minPriceFen > 2_147_483_600 ||
      !Number.isSafeInteger(config.markupPercent) || config.markupPercent < 100 || config.markupPercent > 1000 ||
      !Number.isSafeInteger(config.infraFen) || config.infraFen < 0 || config.infraFen > 1_000_000) {
    throw new Error("Pro 计价配置无效，请联系首客处理");
  }
  const stages = workload.map((item) => {
    const rate = rates[item.model];
    const tokenCostNanoYuan = item.hit * rate.hit + (item.input - item.hit) * rate.miss + item.output * rate.output;
    // Overseas search assumption: $5 / 1,000 calls, USD/CNY 7.1.
    return { ...item, tokenCostNanoYuan, searchCostNanoYuan: item.searches * 35_500_000 };
  });
  const subtotal = stages.reduce((sum, item) => sum + item.tokenCostNanoYuan + item.searchCostNanoYuan, 0);
  const estimatedAiCostNanoYuan = Math.ceil(subtotal * 125 / 100);
  const estimatedTotalCostNanoYuan = estimatedAiCostNanoYuan + config.infraFen * NANO_PER_FEN;
  const quoteFen = Math.max(config.minPriceFen, Math.ceil(estimatedTotalCostNanoYuan * config.markupPercent / 100 / 1_000_000_000) * 100);
  const snapshot = {
    version: PRO_PRICING_VERSION, currency: "CNY" as const, projectId: scope.id,
    requirementVersion: scope.requirementVersion, scopeVersion: scope.scopeVersion, round: scope.round,
    sku: "hifirst-pro-project-v1", config, stages, retryPercent: 125, humanServiceFen: 0,
    estimatedAiCostNanoYuan, estimatedTotalCostNanoYuan, quoteFen,
    routing: "all-realtime" as const,
  };
  return { ...snapshot, fingerprint: createHash("sha256").update(JSON.stringify(snapshot)).digest("hex") };
}

export type ProQuote = ReturnType<typeof proQuote>;
