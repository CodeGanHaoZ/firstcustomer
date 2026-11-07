import { T } from "@/components/ui-text";
import { Check, Circle, AlertCircle } from "lucide-react";
import type { CSSProperties } from "react";
import type { workPackageReadiness } from "@/workflow/work-packages";

export function WorkPackageList({ readiness }: { readiness: Awaited<ReturnType<typeof workPackageReadiness>> }) {
  return <section id="work-packages" className="paper rise">
    <h2 className="paper__title"><T>工作包与验收检查</T></h2><p className="paper__lead"><T>同一工作包的重试累计为运行次数；检查依据是已保存的成果、指标和审批记录。</T></p>
    <ul className="card-grid mt-5">{readiness.packages.map((item, index) => <li key={item.key} className="tile rise bg-background" style={{ "--i": index } as CSSProperties}>
      <div className="flex flex-wrap items-start justify-between gap-2"><h3 className="tile__title"><T>{item.label}</T></h3><span className={item.status === "verified" ? "pill pill--ok" : item.status === "failed" ? "pill pill--fail" : "pill"}><T>{item.status === "verified" ? "成果检查通过" : item.status === "failed" ? "运行失败，待处理" : "等待成果或确认"}</T></span></div>
      <p className="tile__meta"><T>{item.version}</T><T> · 已运行 </T>{item.attempts}<T> 次</T></p>
      <div className="meter" aria-hidden="true"><span style={{ "--p": `${Math.round(item.checks.filter((check) => check.passed).length / Math.max(1, item.checks.length) * 100)}%`, "--i": index } as CSSProperties} /></div>
      <ul className="m-0 grid gap-2 ps-0 text-sm list-none">{item.checks.map((check) => <li key={check.label} className="flex items-start gap-2">{check.passed ? <Check size={16} className="mt-0.5 shrink-0 text-[#456447]" aria-hidden /> : <Circle size={16} className="mt-0.5 shrink-0 text-muted-foreground" aria-hidden />}<span><T>{check.label}</T><T>{check.passed ? "：已核对" : "：待完成"}</T></span></li>)}</ul>
    </li>)}</ul>
    {readiness.packages.some((item) => item.key === "launch") && !readiness.channelExecuted ? <p className="notice notice--wait mt-4 text-sm"><AlertCircle size={16} className="mt-0.5 shrink-0" aria-hidden /><T>渠道执行凭证尚未记录，不能将素材准备写成已对外执行。</T></p> : null}
  </section>;
}
