import Fuse from "fuse.js";

export type EvidenceKind = "pain" | "pricing" | "revenue" | "signal" | "channel" | "product";
export type Stance = "support" | "against" | "neutral";
export type Grade = "A" | "B" | "C" | "D" | "E";

export const GRADE_LABELS: Record<Grade | "unknown", string> = {
  A: "A 支付数据验证",
  B: "B 交易平台披露",
  C: "C 创始人公开说法",
  D: "D 第三方估算",
  E: "E 只有付费信号",
  unknown: "未知",
};

const MIN_QUOTE_CHARS = 12;
const FUZZY_REVIEW_THRESHOLD = 0.3;

export function normalizeText(value: string) {
  return value
    .normalize("NFKC")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export type QuoteCheck = {
  status: "verified" | "needs_review" | "rejected";
  score: number | null;
  reason?: string;
};

// 第一道证据闸门：只有摘录原样出现在来源文本中才算已验证；近似匹配只留给人工核对。
export function verifyQuote(quote: string, sourceText: string): QuoteCheck {
  const q = normalizeText(quote);
  const source = normalizeText(sourceText);
  if (q.length < MIN_QUOTE_CHARS) {
    return { status: "rejected", score: null, reason: "摘录太短，无法核对" };
  }
  if (source.includes(q)) return { status: "verified", score: 1 };

  const windows: string[] = [];
  const step = Math.max(8, Math.floor(q.length / 2));
  for (let i = 0; i < source.length; i += step) {
    windows.push(source.slice(i, i + q.length + step));
  }
  const best = new Fuse(windows, {
    includeScore: true,
    ignoreLocation: true,
    threshold: FUZZY_REVIEW_THRESHOLD,
  }).search(q.slice(0, 32))[0];
  if (best?.score !== undefined) {
    return {
      status: "needs_review",
      score: 1 - best.score,
      reason: "摘录与来源近似但不一致，需要人工核对",
    };
  }
  return { status: "rejected", score: null, reason: "来源文本里找不到这段摘录" };
}

const PLATFORM_DISCLOSURE = ["microns.io", "acquire.com", "flippa.com"];
const FOUNDER_STATEMENT = ["getlatka.com", "starterstory.com", "indiehackers.com"];

function hostMatches(url: string, hosts: string[]) {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    return hosts.some((h) => host === h || host.endsWith(`.${h}`));
  } catch {
    return false;
  }
}

// 等级由程序根据来源决定，模型不能给自己的证据打高分。
export function gradeFor(
  kind: EvidenceKind,
  url: string,
  options: { customerAuthorized?: boolean } = {},
): Grade | null {
  if (kind === "pain" || kind === "channel" || kind === "product") return null;
  if (options.customerAuthorized) return "A";
  if (kind === "pricing" || kind === "signal") return "E";
  if (hostMatches(url, PLATFORM_DISCLOSURE)) return "B";
  if (hostMatches(url, FOUNDER_STATEMENT)) return "C";
  return "D";
}

const DAY_MS = 86_400_000;
const VALID_DAYS: Record<EvidenceKind, number> = {
  pricing: 7,
  revenue: 30,
  signal: 30,
  pain: 90,
  channel: 90,
  product: 90,
};

export function expiresAt(kind: EvidenceKind, collectedAt: Date) {
  return new Date(collectedAt.getTime() + VALID_DAYS[kind] * DAY_MS);
}

export function isSignalOnly(grade: string | null) {
  return grade === "E";
}
