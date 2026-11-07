import { Check, Circle, AlertCircle } from "lucide-react";
import type { workPackageReadiness } from "@/workflow/work-packages";

export function WorkPackageList({ readiness }: { readiness: Awaited<ReturnType<typeof workPackageReadiness>> }) {
  return <section id="work-packages" className="rounded-xl border bg-card p-5 sm:p-6">
    <h2 className="text-lg font-semibold">工作包与验收检查</h2><p className="mt-2 text-sm leading-relaxed text-muted-foreground">同一工作包的重试累计为运行次数；检查依据是已保存的成果、指标和审批记录。</p>
    <ul className="mt-4 divide-y">{readiness.packages.map((item) => <li key={item.key} className="py-4">
      <div className="flex flex-wrap justify-between gap-2 text-sm"><h3 className="font-semibold">{item.label}</h3><span className={item.status === "verified" ? "text-primary" : item.status === "failed" ? "text-destructive" : "text-muted-foreground"}>{item.status === "verified" ? "成果检查通过" : item.status === "failed" ? "运行失败，待处理" : "等待成果或确认"}</span></div>
      <p className="mt-1 text-xs text-muted-foreground">{item.version} · 已运行 {item.attempts} 次</p>
      <ul className="mt-3 grid gap-2 text-sm">{item.checks.map((check) => <li key={check.label} className="flex items-start gap-2">{check.passed ? <Check size={16} className="mt-0.5 shrink-0 text-primary" aria-hidden /> : <Circle size={16} className="mt-0.5 shrink-0 text-muted-foreground" aria-hidden />}<span>{check.label}{check.passed ? "：已核对" : "：待完成"}</span></li>)}</ul>
    </li>)}</ul>
    {readiness.packages.some((item) => item.key === "launch") && !readiness.channelExecuted ? <p className="mt-3 flex items-start gap-2 text-xs leading-relaxed text-muted-foreground"><AlertCircle size={16} className="mt-0.5 shrink-0" aria-hidden />渠道执行凭证尚未记录，不能将素材准备写成已对外执行。</p> : null}
  </section>;
}
