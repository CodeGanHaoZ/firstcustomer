"use client";

import { LoaderCircle, RotateCcw } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useLocale } from "@/components/locale-provider";

export type EvidenceDigest = {
  key: string;
  items: { kind: string; stance: string; status: string; grade: string | null; excerpt: string; source: string | null; date: string }[];
  searches: { source: string; purpose: string; resultCount: number }[];
};

const CACHE_PREFIX = "fc:evidence-summary:";

/** 市场证据的 AI 严谨性小结：进入页面自动生成一次，结果缓存在本浏览器，可手动重试。 */
export function EvidenceSummaryCard({ token, digest }: { token: string; digest: EvidenceDigest }) {
  const en = useLocale() === "en";
  const [state, setState] = useState<"loading" | "ready" | "failed">("loading");
  const [summary, setSummary] = useState("");
  const [attempt, setAttempt] = useState(0);
  const digestRef = useRef(digest);
  digestRef.current = digest;

  useEffect(() => {
    let cancelled = false;
    const cacheKey = `${CACHE_PREFIX}${digestRef.current.key}`;
    try {
      const cached = sessionStorage.getItem(cacheKey);
      if (cached) { setSummary(cached); setState("ready"); return; }
    } catch { /* 隐私模式下忽略缓存 */ }
    setState("loading");
    void (async () => {
      try {
        const response = await fetch(`/api/projects/${encodeURIComponent(token)}/evidence-summary`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-HiFirst-Language": en ? "en" : "zh" },
          body: JSON.stringify(digestRef.current),
        });
        if (!response.ok) throw new Error("summary unavailable");
        const data = (await response.json()) as { summary?: string };
        const text = (data.summary ?? "").trim();
        if (!text) throw new Error("summary empty");
        if (cancelled) return;
        setSummary(text); setState("ready");
        try { sessionStorage.setItem(cacheKey, text); } catch { /* ignore */ }
      } catch {
        if (!cancelled) setState("failed");
      }
    })();
    return () => { cancelled = true; };
  }, [token, en, attempt]);

  return <aside className="evidence-summary" aria-live="polite">
    <p className="evidence-summary__head">
      <span className="evidence-summary__badge">{en ? "AI notes" : "AI 小结"}</span>
      <span>{en ? "Where this evidence comes from, and how much to trust it" : "这批证据的来源与严谨性参考"}</span>
    </p>
    {state === "loading" ? (
      <p className="evidence-summary__text"><LoaderCircle size={14} className="evidence-summary__spinner" aria-hidden />{en ? "Nori is reviewing the sources and reliability of this evidence…" : "Nori 正在核对这批证据的来源与严谨性…"}</p>
    ) : state === "failed" ? (
      <p className="evidence-summary__text">{en ? "The summary didn’t generate this time. You can still judge each item by its source domain, verification status, and collection date." : "这次没有生成小结。你可以先按来源域名、核对状态和收集日期自行判断证据强弱。"}<button type="button" onClick={() => setAttempt((value) => value + 1)}><RotateCcw size={13} aria-hidden />{en ? "Retry" : "重试"}</button></p>
    ) : (
      <p className="evidence-summary__text">{summary}</p>
    )}
    <p className="evidence-summary__note">{en ? "Generated from this project’s saved evidence by MiMo AI. For reference only — not a guarantee of facts." : "由 MiMo AI 根据本项目已保存的市场证据生成，仅供决策参考，不构成事实承诺。"}</p>
  </aside>;
}
