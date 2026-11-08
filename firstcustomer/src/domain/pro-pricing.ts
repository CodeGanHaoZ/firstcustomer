import { createHash } from "node:crypto";

// Incremental Pro budget, calibrated against the current workflow and small
// local MiMo samples. Free intake/research already delivered is not rerun here.
// Estimates and operating reserves are not actual usage or cash receipts.
export const PRO_PRICING_VERSION = "mimo-cn-2026-09-22-service-v3";
export const PRO_INCLUDED_ROUNDS = 3;
const NANO_PER_FEN = 10_000_000;
const rates = {
  flash: { hit: 20, miss: 1_000, output: 2_000 },
  pro: { hit: 25, miss: 3_000, output: 6_000 },
} as const;
const roundWorkload = [
  { stage: "research_plan", model: "flash", input: 10_000, hit: 0, output: 2_000, searches: 0 },
  { stage: "research", model: "pro", input: 100_000, hit: 0, output: 16_000, searches: 12 },
  { stage: "strategy", model: "pro", input: 30_000, hit: 0, output: 12_000, searches: 0 },
  // The same Launch response generates both the page and channel materials.
  { stage: "launch", model: "flash", input: 36_000, hit: 0, output: 8_000, searches: 0 },
  { stage: "growth", model: "flash", input: 10_000, hit: 0, output: 2_500, searches: 0 },
  { stage: "support", model: "flash", input: 24_000, hit: 0, output: 3_000, searches: 0 },
] as const;

// Missing allowance belongs to a historical single-round purchase. Always read
// entitlements from the accepted snapshot rather than today's package default.
export function proRoundProgress(quote: { round: number; includedRounds?: number }, currentRound: number) {
  const included = quote.includedRounds ?? 1;
  const valid = Number.isSafeInteger(included) && included >= 1 && included <= 100 &&
    Number.isSafeInteger(quote.round) && quote.round >= 1 && Number.isSafeInteger(currentRound);
  const started = currentRound - quote.round + 1;
  const covered = valid && started >= 1 && started <= included;
  return { included: valid ? included : 0, started: covered ? started : 0,
    remaining: covered ? included - started : 0, covered };
}

export type ProPricingConfig = { minPriceFen: number; markupPercent: number; infraFen: number; reserveFen: number };
export type QuoteScope = { id: string; requirementVersion: number; scopeVersion: number; round: number };
export const DEFAULT_PRO_PRICING: ProPricingConfig = { minPriceFen: 9_900, markupPercent: 200, infraFen: 500, reserveFen: 4_000 };

export function proPricingConfig(env: Readonly<Record<string, string | undefined>> = process.env): ProPricingConfig {
  return {
    minPriceFen: Number(env.PRO_MIN_PRICE_FEN ?? DEFAULT_PRO_PRICING.minPriceFen),
    markupPercent: Number(env.PRO_MARKUP_PERCENT ?? DEFAULT_PRO_PRICING.markupPercent),
    infraFen: Number(env.PRO_INFRA_FEN ?? DEFAULT_PRO_PRICING.infraFen),
    reserveFen: Number(env.PRO_RESERVE_FEN ?? DEFAULT_PRO_PRICING.reserveFen),
  };
}

function buildQuote(scope: QuoteScope, config: ProPricingConfig, includedRounds: number, trial = false) {
  if (!Number.isSafeInteger(config.minPriceFen) || config.minPriceFen < 1 || config.minPriceFen > 2_147_483_600 ||
      !Number.isSafeInteger(config.markupPercent) || config.markupPercent < 100 || config.markupPercent > 1000 ||
      !Number.isSafeInteger(config.infraFen) || config.infraFen < 0 || config.infraFen > 1_000_000 ||
      !Number.isSafeInteger(config.reserveFen) || config.reserveFen < 0 || config.reserveFen > 1_000_000) {
    throw new Error("Pro 计价配置无效，请联系首客处理");
  }
  const stages = roundWorkload.map((stage) => {
    // Budget all three rounds at full per-round cost; reuse is an upside.
    const item = { ...stage, input: stage.input * includedRounds, hit: stage.hit * includedRounds,
      output: stage.output * includedRounds, searches: stage.searches * includedRounds };
    const rate = rates[item.model];
    const tokenCostNanoYuan = item.hit * rate.hit + (item.input - item.hit) * rate.miss + item.output * rate.output;
    // Overseas search assumption: $5 / 1,000 calls, USD/CNY 7.1.
    return { ...item, tokenCostNanoYuan, searchCostNanoYuan: item.searches * 35_500_000 };
  });
  const subtotal = stages.reduce((sum, item) => sum + item.tokenCostNanoYuan + item.searchCostNanoYuan, 0);
  const estimatedAiCostNanoYuan = Math.ceil(subtotal * 125 / 100);
  const estimatedDirectCostNanoYuan = estimatedAiCostNanoYuan + config.infraFen * NANO_PER_FEN;
  const estimatedTotalCostNanoYuan = estimatedDirectCostNanoYuan + config.reserveFen * NANO_PER_FEN;
  const quoteFen = trial ? 0 : Math.max(config.minPriceFen, Math.ceil(estimatedTotalCostNanoYuan * config.markupPercent / 100 / 1_000_000_000) * 100);
  const snapshot = {
    version: trial ? `${PRO_PRICING_VERSION}-trial-v1` : PRO_PRICING_VERSION, currency: "CNY" as const, projectId: scope.id,
    requirementVersion: scope.requirementVersion, scopeVersion: scope.scopeVersion, round: scope.round,
    sku: trial ? "hifirst-pro-trial-v1" : "hifirst-pro-project-3-rounds-v1", includedRounds, config, stages, retryPercent: 125, humanServiceFen: 0,
    estimatedInputTokens: stages.reduce((sum, stage) => sum + stage.input, 0),
    estimatedOutputTokens: stages.reduce((sum, stage) => sum + stage.output, 0),
    estimatedAiCostNanoYuan, estimatedDirectCostNanoYuan, estimatedTotalCostNanoYuan, quoteFen,
    budgetScope: "pro-increment" as const,
    routing: "all-realtime" as const,
  };
  return { ...snapshot, fingerprint: createHash("sha256").update(JSON.stringify(snapshot)).digest("hex") };
}

export function proQuote(scope: QuoteScope, config = proPricingConfig()) {
  return buildQuote(scope, config, PRO_INCLUDED_ROUNDS);
}

export function proTrialQuote(scope: QuoteScope) {
  return buildQuote(scope, proPricingConfig(), 1, true);
}

// Persisted pre-package snapshots have no includedRounds field.
export type ProQuote = Omit<ReturnType<typeof proQuote>, "includedRounds"> & { includedRounds?: number };
