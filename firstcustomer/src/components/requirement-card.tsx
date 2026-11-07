import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { REQUIREMENT_ROUTES, requirementSnapshot, MAX_FREE_SCOPE_VERSIONS } from "@/domain/requirements";
import { INTAKE_GOALS, INTAKE_STAGES } from "@/lib/project-intake";
import { formatDateTime } from "@/lib/format";
import { canReviseRequirements, type requirementHistory } from "@/workflow/requirements";
import type { Project } from "@/workflow/queries";

export function RequirementCard({ project, history, action }: { project: Project;
  history: Awaited<ReturnType<typeof requirementHistory>>; action?: (data: FormData) => Promise<void> }) {
  const current = history.at(-1)?.snapshot ?? requirementSnapshot(project);
  const rows = [ ["产品", current.productName], ["本次初诊重点", REQUIREMENT_ROUTES[current.route]], ["现行做法", current.currentWorkflow],
    ["希望验证的结果", current.successCriteria], ["限制条件", current.constraints], ["预算和时间", current.budgetNote] ];
  return <section id="requirements" className="rounded-xl border bg-card p-5 sm:p-6">
    <div className="flex flex-wrap items-baseline justify-between gap-2"><h2 className="text-lg font-semibold">项目需求卡</h2><p className="text-xs text-muted-foreground">需求第 {project.requirementVersion} 版 · 范围第 {project.scopeVersion} 版</p></div>
    <dl className="mt-4 divide-y text-sm">{rows.map(([label,value]) => <div key={label} className="grid gap-1 py-3 sm:grid-cols-[8rem_1fr]"><dt className="font-medium">{label}</dt><dd className="whitespace-pre-wrap break-words text-muted-foreground">{value || "待确认"}</dd></div>)}</dl>
    <p className="mt-3 text-xs leading-relaxed text-muted-foreground">{current.unknowns.length ? `待明确：${current.unknowns.join("、")}。` : "关键资料已填写，实际范围以确认的提案为准。"}补充回答会形成新版本，每个范围最多补充 3 轮。</p>
    {action && canReviseRequirements(project) ? <details className="mt-5 border-t pt-4"><summary className="cursor-pointer text-sm font-semibold">修订需求并重新初诊</summary>
      <form key={project.requirementVersion} action={action} className="mt-4 grid gap-4 sm:grid-cols-2">
        <input type="hidden" name="version" value={project.requirementVersion} />
        <div className="grid gap-2 sm:col-span-2"><Label htmlFor="requirement-product">产品名称或想法</Label><Textarea id="requirement-product" name="productName" defaultValue={current.productName} required maxLength={500} /></div>
        <div className="grid gap-2"><Label htmlFor="requirement-stage">当前阶段</Label><select className="min-h-11 rounded-lg border bg-background px-3 text-sm" id="requirement-stage" name="stage" defaultValue={current.stage}>{INTAKE_STAGES.map((value) => <option key={value}>{value}</option>)}</select></div>
        <div className="grid gap-2"><Label htmlFor="requirement-goal">优先目标</Label><select className="min-h-11 rounded-lg border bg-background px-3 text-sm" id="requirement-goal" name="goal" defaultValue={current.goal}>{INTAKE_GOALS.map((value) => <option key={value}>{value}</option>)}</select></div>
        {([ ["productUrl", "产品网址", 2048], ["targetMarket", "目标市场", 200], ["budgetNote", "预算和时间", 200] ] as const).map(([name,label,max]) => <div key={name} className="grid gap-2"><Label htmlFor={`requirement-${name}`}>{label}（选填）</Label><Input id={`requirement-${name}`} name={name} type={name === "productUrl" ? "url" : "text"} defaultValue={current[name]} maxLength={max} className="min-h-11" /></div>)}
        {([ ["currentWorkflow", "现行做法"], ["successCriteria", "希望验证的结果"], ["constraints", "限制条件"] ] as const).map(([name,label]) => <div key={name} className="grid gap-2 sm:col-span-2"><Label htmlFor={`requirement-${name}`}>{label}（选填）</Label><Textarea id={`requirement-${name}`} name={name} defaultValue={current[name]} maxLength={1000} /></div>)}
        <p className="text-xs leading-relaxed text-muted-foreground sm:col-span-2">确认后新建需求版本并重新初诊，旧范围的回答、证据和截图保留为历史；需要使用的截图请重新上传。免费项目最多确认 {MAX_FREE_SCOPE_VERSIONS} 个范围版本；Pro 范围变更请交经营者处理。</p>
        <Button type="submit" className="min-h-11 justify-self-start sm:col-span-2">确认新需求，重新初诊</Button>
      </form>
    </details> : <p className="mt-4 text-xs text-muted-foreground">{!action ? "需求资料和补充回答按版本留存，历史确认与本次成果分开核对。" : project.paused ? "项目已暂停，请联系经营者恢复后继续。" : project.productPlan === "free" && project.scopeVersion >= MAX_FREE_SCOPE_VERSIONS ? "已达到免费范围修订上限，后续调整请联系经营者。" : project.productPlan === "free" ? "初诊进行中，完成或需要补充信息时可修订需求。" : "服务范围以已确认的提案为准，如需变更请联系经营者。"}</p>}
    {history.length ? <details className="mt-5 border-t pt-4"><summary className="cursor-pointer text-sm">查看 {history.length} 个需求版本</summary><ol className="mt-3 grid gap-4 text-sm">{history.toReversed().map((item) => <li key={item.id}>
      <p className="font-medium">第 {item.version} 版 · {item.reason}</p><p className="mt-1 text-xs text-muted-foreground">{formatDateTime(item.createdAt)} · {item.actor === "legacy" ? "历史资料快照，未补造确认" : item.actor === "customer" ? "客户确认" : "经营者确认"}</p>
      <details className="mt-2"><summary className="cursor-pointer text-xs">查看本版内容</summary><p className="mt-2 whitespace-pre-wrap break-words text-muted-foreground">{item.snapshot.productName}<br />目标：{item.snapshot.goal} · 市场：{item.snapshot.targetMarket || "未知"}<br />希望验证：{item.snapshot.successCriteria || "未知"}<br />限制：{item.snapshot.constraints || "未知"}</p>{item.snapshot.answers.map((answer,index) => <p key={index} className="mt-2 whitespace-pre-wrap break-words text-muted-foreground">{answer.question}：{answer.answer || "未回答"}</p>)}</details>
    </li>)}</ol></details> : null}
  </section>;
}
