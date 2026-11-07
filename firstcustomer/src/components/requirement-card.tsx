import { T } from "@/components/ui-text";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { REQUIREMENT_ROUTES, requirementSnapshot, MAX_FREE_SCOPE_VERSIONS } from "@/domain/requirements";
import { INTAKE_GOALS, INTAKE_STAGES } from "@/lib/project-intake";
import { isKeyActivatedPro } from "@/domain/workflow";
import { formatDateTime } from "@/lib/format";
import { canReviseRequirements, type requirementHistory } from "@/workflow/requirements";
import type { Project } from "@/workflow/queries";

export function RequirementCard({ project, history, action }: { project: Project;
  history: Awaited<ReturnType<typeof requirementHistory>>; action?: (data: FormData) => Promise<void> }) {
  const current = history.at(-1)?.snapshot ?? requirementSnapshot(project);
  const keyActivated = isKeyActivatedPro(project);
  const rows = [ ["产品", current.productName], ["本次分析重点", REQUIREMENT_ROUTES[current.route]], ["现行做法", current.currentWorkflow],
    ["希望验证的结果", current.successCriteria], ["限制条件", current.constraints], ["预算和时间", current.budgetNote] ];
  return <section id="requirements" className="paper rise">
    <div className="flex flex-wrap items-baseline justify-between gap-2"><h2 className="paper__title"><T>项目需求卡</T></h2><p className="text-xs text-muted-foreground"><T>{`需求第 ${project.requirementVersion} 版 · 范围第 ${project.scopeVersion} 版`}</T></p></div>
    <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-2">{rows.map(([label,value]) => <div key={label} className="grid content-start gap-1 rounded-xl border bg-background px-4 py-3"><dt className="eyebrow m-0"><T>{label}</T></dt><dd className="m-0 whitespace-pre-wrap break-words text-foreground"><T>{value ? label === "本次分析重点" ? <T>{value}</T> : value : <T>待确认</T>}</T></dd></div>)}</dl>
    <p className="mt-3 text-xs leading-relaxed text-muted-foreground">{current.unknowns.length ? <><T>待明确：</T>{current.unknowns.map((item, index) => <span key={item}>{index ? ", " : ""}<T>{item}</T></span>)}. </> : <T>{keyActivated ? "关键资料已填写，密钥授权适用于当前需求范围。" : "关键资料已填写，实际范围以确认的提案为准。"}</T>}<T>补充回答会形成新版本，每个范围最多补充 3 轮。</T></p>
    {action && canReviseRequirements(project) ? <details className="fold mt-5 bg-background"><summary><span><span className="fold__title block"><T>修订需求并重新分析出海机会</T></span><span className="fold__hint block"><T>只在需要调整方向时展开</T></span></span></summary>
      <form key={project.requirementVersion} action={action} className="fold__body grid gap-4 sm:grid-cols-2">
        <input type="hidden" name="version" value={project.requirementVersion} />
        <div className="grid gap-2 sm:col-span-2"><Label htmlFor="requirement-product"><T>产品名称或想法</T></Label><Textarea id="requirement-product" name="productName" defaultValue={current.productName} required maxLength={500} /></div>
        <fieldset className="grid gap-2 sm:col-span-2"><legend className="mb-2 text-sm font-medium"><T>当前阶段</T></legend><div className="choice-group">{INTAKE_STAGES.map((value) => <label className="choice" key={value}><input type="radio" name="stage" value={value} defaultChecked={value === current.stage} /><span><T>{value}</T></span></label>)}</div></fieldset>
        <fieldset className="grid gap-2 sm:col-span-2"><legend className="mb-2 text-sm font-medium"><T>优先目标</T></legend><div className="choice-group">{INTAKE_GOALS.map((value) => <label className="choice" key={value}><input type="radio" name="goal" value={value} defaultChecked={value === current.goal} /><span><T>{value}</T></span></label>)}</div></fieldset>
        {([ ["productUrl", "产品网址", 2048], ["targetMarket", "目标市场", 200], ["budgetNote", "预算和时间", 200] ] as const).map(([name,label,max]) => <div key={name} className="grid gap-2"><Label htmlFor={`requirement-${name}`}><T>{label}</T><T>（选填）</T></Label><Input id={`requirement-${name}`} name={name} type={name === "productUrl" ? "url" : "text"} defaultValue={current[name]} maxLength={max} className="min-h-11" /></div>)}
        {([ ["currentWorkflow", "现行做法"], ["successCriteria", "希望验证的结果"], ["constraints", "限制条件"] ] as const).map(([name,label]) => <div key={name} className="grid gap-2 sm:col-span-2"><Label htmlFor={`requirement-${name}`}><T>{label}</T><T>（选填）</T></Label><Textarea id={`requirement-${name}`} name={name} defaultValue={current[name]} maxLength={1000} /></div>)}
        <p className="text-xs leading-relaxed text-muted-foreground sm:col-span-2"><T>确认后新建需求版本并重新分析出海机会，旧范围的回答、证据和截图保留为历史；需要使用的截图请重新上传。免费项目最多确认 </T>{MAX_FREE_SCOPE_VERSIONS}<T> 个范围版本；Pro 范围变更请交经营者处理。</T></p>
        <Button type="submit" className="min-h-11 justify-self-start sm:col-span-2"><T>确认新需求，重新分析出海机会</T></Button>
      </form>
    </details> : <p className="mt-4 text-xs text-muted-foreground"><T>{!action ? "需求资料和补充回答按版本留存，历史确认与本次成果分开核对。" : project.paused ? "项目已暂停，请联系经营者恢复后继续。" : project.productPlan === "free" && project.scopeVersion >= MAX_FREE_SCOPE_VERSIONS ? "已达到免费范围修订上限，后续调整请联系经营者。" : project.productPlan === "free" ? "出海机会分析进行中，完成或需要补充信息时可修订需求。" : keyActivated ? "密钥授权适用于当前需求范围，如需变更请联系经营者。" : "服务范围以已确认的提案为准，如需变更请联系经营者。"}</T></p>}
    {history.length ? <details className="fold mt-3 bg-background"><summary><span className="fold__hint"><T>查看 </T>{history.length}<T> 个需求版本</T></span></summary><ol className="fold__body m-0 grid gap-4 ps-0 text-sm list-none">{history.toReversed().map((item) => <li key={item.id}>
      <p className="font-medium"><T>第 </T>{item.version}<T> 版 · </T>{item.reason}</p><p className="mt-1 text-xs text-muted-foreground">{formatDateTime(item.createdAt)} · <T>{item.actor === "legacy" ? "历史资料快照，未补造确认" : item.actor === "customer" ? "客户确认" : "经营者确认"}</T></p>
      <details className="mt-2"><summary className="cursor-pointer text-xs"><T>查看本版内容</T></summary><p className="mt-2 whitespace-pre-wrap break-words text-muted-foreground">{item.snapshot.productName}<br /><T>目标：</T><T>{item.snapshot.goal}</T><T> · 市场：</T>{item.snapshot.targetMarket || <T>未知</T>}<br /><T>希望验证：</T>{item.snapshot.successCriteria || <T>未知</T>}<br /><T>限制：</T>{item.snapshot.constraints || <T>未知</T>}</p>{item.snapshot.answers.map((answer,index) => <p key={index} className="mt-2 whitespace-pre-wrap break-words text-muted-foreground">{answer.question}：{answer.answer || <T>未回答</T>}</p>)}</details>
    </li>)}</ol></details> : null}
  </section>;
}
