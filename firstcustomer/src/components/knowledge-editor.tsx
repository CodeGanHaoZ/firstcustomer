"use client";

import { LocalizedInput, LocalizedTextarea } from "@/components/localized-controls";
import { T } from "@/components/ui-text";

import { useActionState, useState, type ChangeEvent } from "react";
import { FileUp, Save, Send } from "lucide-react";
import { saveKnowledgeAction } from "@/app/admin/knowledge/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { KNOWLEDGE_AGENTS, KNOWLEDGE_CATEGORIES, type KnowledgeAgent, type KnowledgeContent } from "@/knowledge/types";


export function KnowledgeEditor({ id, revision, initial }: { id?: string; revision: number; initial: KnowledgeContent }) {
  const [draft, setDraft] = useState(initial);
  const [importError, setImportError] = useState("");
  const [state, action, pending] = useActionState(saveKnowledgeAction, { error: "" });
  const update = <K extends keyof KnowledgeContent>(field: K, value: KnowledgeContent[K]) => setDraft((previous) => ({ ...previous, [field]: value }));

  async function importText(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setImportError("");
    try {
      if (!/\.(md|txt)$/i.test(file.name) || file.size > 64 * 1024) throw new Error("请选择不超过 64 KB 的 Markdown 或 TXT 文件");
      const content = new TextDecoder("utf-8", { fatal: true }).decode(await file.arrayBuffer());
      if (content.trim().length < 10 || content.length > 12000 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(content)) {
        throw new Error("文件须为 UTF-8 文字，正文在 10 到 12000 字之间");
      }
      setDraft((previous) => ({ ...previous, content,
        title: previous.title || file.name.replace(/\.(md|txt)$/i, "").slice(0, 100),
      }));
    } catch (error) { setImportError(error instanceof Error ? error.message : "文件读取失败，请直接粘贴内容"); }
    event.target.value = "";
  }

  return (
    <form action={action} className="paper rise grid gap-6">
      <input type="hidden" name="id" value={id ?? ""} />
      <input type="hidden" name="revision" value={revision} />
      <fieldset disabled={pending} className="grid min-w-0 gap-6 disabled:opacity-70">
        <legend className="sr-only"><T>资料内容与使用范围</T></legend>
        <div className="grid gap-2">
          <Label htmlFor="knowledge-title"><T>资料标题</T></Label>
          <LocalizedInput className="min-h-10" id="knowledge-title" name="title" required minLength={2} maxLength={100}
            value={draft.title} onChange={(event) => update("title", event.target.value)} placeholder="例如：免费出海机会分析的服务范围" />
        </div>
        <fieldset className="m-0 grid gap-2 border-0 p-0">
          <legend className="mb-2 text-sm font-medium"><T>分类</T></legend>
          <div className="choice-group">
            {Object.entries(KNOWLEDGE_CATEGORIES).map(([value, label]) => (
              <label className="choice" key={value}>
                <input type="radio" name="category" value={value} checked={draft.category === value}
                  onChange={() => update("category", value as KnowledgeContent["category"])} />
                <span><T>{label}</T></span>
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset className="m-0 grid gap-2 border-0 p-0">
          <legend className="mb-2 text-sm font-medium"><T>可见范围</T></legend>
          <div className="choice-group">
            {([["internal", "仅内部 Agent"], ["public", "可用于公开答复"]] as const).map(([value, label]) => (
              <label className="choice" key={value}>
                <input type="radio" name="visibility" value={value} checked={draft.visibility === value}
                  onChange={() => setDraft((previous) => ({ ...previous,
                    visibility: value,
                    agents: value === "internal" ? previous.agents.filter((agent) => agent !== "lumi") : previous.agents,
                  }))} />
                <span><T>{label}</T></span>
              </label>
            ))}
          </div>
        </fieldset>
        <div className="grid gap-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Label htmlFor="knowledge-content"><T>正文</T></Label>
            <label className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-lg border px-3 text-sm font-medium focus-within:outline-2 focus-within:outline-ring">
              <FileUp size={16} aria-hidden="true" /><T> 导入 Markdown / TXT
              </T><input className="sr-only" type="file" accept=".md,.txt,text/plain,text/markdown" onChange={(event) => void importText(event)} />
            </label>
          </div>
          <LocalizedTextarea id="knowledge-content" name="content" required minLength={10} maxLength={12000} rows={13}
            className="min-h-64 leading-relaxed" value={draft.content} onChange={(event) => update("content", event.target.value)}
            aria-describedby="knowledge-content-help" placeholder="填写核对过的服务说明、常见问题或工作规范…" />
          <p id="knowledge-content-help" className="text-xs text-muted-foreground">{draft.content.length}<T> / 12000 字。导入会替换当前正文；请保留事实来源，不放客户隐私或密钥。</T></p>
          {importError ? <p role="alert" className="text-sm text-destructive"><T>{importError}</T></p> : null}
        </div>
        <fieldset className="grid gap-3">
          <legend className="mb-2 text-sm font-semibold"><T>哪些 Agent 可以使用</T></legend>
          <div className="grid gap-x-5 gap-y-1 sm:grid-cols-2 lg:grid-cols-3">
            {(Object.entries(KNOWLEDGE_AGENTS) as [KnowledgeAgent, string][]).map(([agent, label]) => (
              <label key={agent} className="flex min-h-10 items-center gap-2 text-sm has-disabled:text-muted-foreground">
                <input type="checkbox" name="agents" value={agent} className="size-4 accent-primary"
                  disabled={agent === "lumi" && draft.visibility !== "public"} checked={draft.agents.includes(agent)}
                  onChange={(event) => update("agents", event.target.checked ? [...draft.agents, agent] : draft.agents.filter((item) => item !== agent))} />
                <T>{label}</T>
              </label>
            ))}
          </div>
          <p className="text-xs text-muted-foreground"><T>首页 Lumi 只读取已发布、可公开且勾选给它的资料。客户项目继续按原有权限访问。</T></p>
        </fieldset>
        <div className="grid gap-2">
          <Label htmlFor="knowledge-source-url"><T>来源链接 · 选填</T></Label>
          <Input className="min-h-10" id="knowledge-source-url" name="sourceUrl" type="url" maxLength={2000}
            value={draft.sourceUrl} onChange={(event) => update("sourceUrl", event.target.value)} placeholder="https://…" />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="knowledge-source-note"><T>来源说明 · 选填</T></Label>
          <LocalizedInput className="min-h-10" id="knowledge-source-note" name="sourceNote" maxLength={500}
            value={draft.sourceNote} onChange={(event) => update("sourceNote", event.target.value)} placeholder="例如：经营者确认的服务范围，或官方渠道规则" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="knowledge-reviewed"><T>核对日期</T></Label>
            <Input className="min-h-10" type="date" id="knowledge-reviewed" name="reviewedOn" required value={draft.reviewedOn}
              onChange={(event) => update("reviewedOn", event.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="knowledge-expires"><T>到期日期 · 选填</T></Label>
            <Input className="min-h-10" type="date" id="knowledge-expires" name="expiresOn" min={draft.reviewedOn} value={draft.expiresOn}
              onChange={(event) => update("expiresOn", event.target.value)} />
          </div>
        </div>
        <p className="text-xs text-muted-foreground"><T>过期资料会停止供 Agent 读取。保存草稿保留当前发布版，发布后立即使用新版本。</T></p>
        {state.error ? <p role="alert" className="text-sm text-destructive"><T>{state.error}</T></p> : null}
        <div className="flex flex-wrap gap-3 border-t pt-5">
          <Button className="min-h-10" type="submit" name="intent" value="draft" variant="outline"><Save aria-hidden="true" /><T>{pending ? "正在保存…" : "保存草稿"}</T></Button>
          <Button className="min-h-10" type="submit" name="intent" value="publish"><Send aria-hidden="true" /><T>保存并发布</T></Button>
        </div>
      </fieldset>
    </form>
  );
}
