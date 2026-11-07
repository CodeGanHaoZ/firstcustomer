"use client";

import Image from "next/image";
import { ArrowUp, Check, ChevronDown, ClipboardList, LoaderCircle, Paperclip, RotateCcw, Square, X } from "lucide-react";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useFormStatus } from "react-dom";
import { useLocale } from "@/components/locale-provider";
import { translateUi } from "@/lib/ui-translation";
import { BRAND } from "@/lib/brand";
import { INTAKE_STEPS, PUBLIC_INTAKE_DRAFT_KEY } from "@/lib/project-intake";
import { attachmentHelp, INTAKE_ATTACHMENT_POLICY, isAllowedAttachment, isImageAttachment, isTextAttachment, type IntakeAttachmentTier } from "@/lib/intake-attachments";
import { IntakeAgentRail } from "@/components/intake-agent-rail";
import {
  applyIntakeUpdates, INTAKE_HISTORY_LIMIT, INTAKE_MESSAGE_LIMIT, intakeReady, intakeResponseSchema,
  LUMI_INTAKE_COPY, LUMI_INTAKE_DRAFT_KEY, parseConversationDraft, readIntakeStream,
  type IntakeConversationDraft, IntakeMessage,
} from "@/lib/lumi-intake";

const subscribe = () => () => {};
const rabbit = "/brand/front-desk-rabbit.webp";
type Props = { action: (data: FormData) => Promise<void>; maxTotalBytes?: number; serverError?: string; initialUrl?: string; initialBrand?: string; attachmentTier?: IntakeAttachmentTier };

function ConfirmProject({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus(); const copy = LUMI_INTAKE_COPY[useLocale()];
  return <button className="lumi-guide-confirm" type="submit" disabled={disabled || pending}>
    {pending ? <LoaderCircle size={17} aria-hidden className="lumi-guide-spinner" /> : <Check size={17} aria-hidden />}
    {pending ? copy.submitting : copy.confirm}
  </button>;
}

export function LumiProjectIntake(props: Props) {
  const ready = useSyncExternalStore(subscribe, () => true, () => false);
  const copy = LUMI_INTAKE_COPY[useLocale()];
  return ready ? <IntakeConversation {...props} /> : <div className="lumi-guide-loading" role="status">{copy.loading}</div>;
}

function IntakeConversation({ action, maxTotalBytes, serverError, initialUrl = "", initialBrand = "", attachmentTier = "free" }: Props) {
  const locale = useLocale(); const copy = LUMI_INTAKE_COPY[locale];
  const [draft, setDraft] = useState(() => {
    let base: IntakeConversationDraft;
    try { base = parseConversationDraft(localStorage.getItem(LUMI_INTAKE_DRAFT_KEY), localStorage.getItem(PUBLIC_INTAKE_DRAFT_KEY)); }
    catch { base = parseConversationDraft(null); }
    // 首页「免费分析出海机会」带参数进入：空草稿时预填项目链接/名称，并把开场白放进输入框，用户点发送即入对话。
    const fresh = base.messages.length === 0 && !Object.values(base.answers).some(Boolean);
    if (fresh && (initialUrl || initialBrand)) {
      if (initialBrand) base.answers.productName = initialBrand;
      if (initialUrl) base.answers.productUrl = initialUrl;
      const urlPart = initialUrl ? `，网址 ${initialUrl}` : "";
      base.input = locale === "en"
        ? `My product is "${initialBrand || "unnamed"}"${urlPart ? `, website ${initialUrl}` : ""}. Please analyze its go-to-market opportunities.`
        : `我的产品是「${initialBrand || "待补充"}」${urlPart}，想免费分析出海机会。`;
    }
    return base;
  });
  const [restored] = useState(() => draft.messages.length > 0 || (Object.values(draft.answers).some(Boolean) && draft.input === ""));
  const [busy, setBusy] = useState(false);
  const [creating, setCreating] = useState(false);
  const [partial, setPartial] = useState("");
  const [error, setError] = useState<"failed" | "stopped" | "rateLimit" | null>(() => draft.messages.at(-1)?.role === "user" ? "stopped" : null);
  const [storageFailed, setStorageFailed] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [fileError, setFileError] = useState("");
  const [briefOpen, setBriefOpen] = useState(() => window.matchMedia("(min-width: 1000px)").matches);
  const request = useRef<AbortController | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const scroll = useRef<HTMLDivElement>(null);
  const followOutput = useRef(true);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const ready = intakeReady(draft.answers);
  const t = (text: string) => translateUi(locale, text);
  const uploadPolicy = INTAKE_ATTACHMENT_POLICY[attachmentTier];

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try { localStorage.setItem(LUMI_INTAKE_DRAFT_KEY, JSON.stringify(draft)); setStorageFailed(false); }
      catch { setStorageFailed(true); }
    }, 100);
    return () => window.clearTimeout(timer);
  }, [draft]);
  useEffect(() => {
    const area = scroll.current;
    if (area && followOutput.current) area.scrollTop = area.scrollHeight;
  }, [draft.messages.length, busy, partial, error]);
  useEffect(() => {
    const area = scroll.current;
    if (!area) return;
    const observer = new ResizeObserver(() => { if (followOutput.current) area.scrollTop = area.scrollHeight; });
    observer.observe(area);
    return () => observer.disconnect();
  }, []);
  useEffect(() => () => { request.current?.abort(); request.current = null; }, []);

  async function replyTo(history: IntakeMessage[]) {
    if (request.current || creating || fileError) return;
    const controller = new AbortController(); request.current = controller;
    setBusy(true); setPartial(""); setError(null);
    try {
      const body = new FormData();
      body.set("conversation", JSON.stringify({ messages: history.slice(-INTAKE_HISTORY_LIMIT), answers: draft.answers }));
      for (const file of files.filter((file) => isImageAttachment(file))) body.append("screenshots", file);
      const textAttachments = files.filter((file) => isTextAttachment(file));
      if (textAttachments.length) {
        const attachmentText = await Promise.all(textAttachments.map(async (file) => {
          const text = (await file.text()).slice(0, 16_000);
          const note = /\.docx?$/i.test(file.name) ? "（Word 文件已附上，后续 Pro 资料解析会继续处理）" : "";
          return `\n\n[附件：${file.name}]${note}\n${text}`;
        }));
        const last = history.at(-1);
        if (last?.role === "user") {
          body.set("conversation", JSON.stringify({ messages: [...history.slice(0, -1), { ...last, content: `${last.content}${attachmentText.join("")}` }].slice(-INTAKE_HISTORY_LIMIT), answers: draft.answers }));
        }
      }
      const response = await fetch("/api/lumi/intake", { method: "POST", headers: { "X-HiFirst-Language": locale }, body, signal: controller.signal });
      if (response.status === 429) { setError("rateLimit"); return; }
      if (!response.ok || !response.body) throw new Error("Intake unavailable");
      let completed = false;
      await readIntakeStream(response.body, ({ event, data }) => {
        if (request.current !== controller) return;
        if (event === "error") throw new Error("Intake unavailable");
        if (event === "reply" && data && typeof data === "object" && "text" in data && typeof data.text === "string") setPartial(data.text);
        if (event === "result") {
          const result = intakeResponseSchema.parse(data);
          const answers = applyIntakeUpdates(draft.answers, result.updates);
          if (intakeReady(answers) && !intakeReady(draft.answers) && window.matchMedia("(min-width: 1000px)").matches) setBriefOpen(true);
          setDraft((previous) => ({ ...previous, messages: [...history, { role: "assistant" as const, content: result.reply }].slice(-80), answers, choices: result.choices }));
          completed = true; setPartial("");
        }
      });
      if (!completed) throw new Error("Incomplete intake reply");
    } catch {
      if (request.current === controller) setError(controller.signal.aborted ? "stopped" : "failed");
    } finally {
      if (request.current === controller) { request.current = null; setBusy(false); }
    }
  }

  function send(text: string) {
    const content = text.trim();
    if (!content || busy || creating || fileError || content.length > INTAKE_MESSAGE_LIMIT) return;
    const history: IntakeMessage[] = [...draft.messages, { role: "user" as const, content }].slice(-79);
    followOutput.current = true;
    setDraft((previous) => ({ ...previous, messages: history, input: "", choices: [] }));
    void replyTo(history);
  }
  function clearFiles() {
    setFiles([]); setFileError(""); if (fileInput.current) fileInput.current.value = "";
    setDraft((previous) => ({ ...previous, hadImages: false }));
  }

  const rows = INTAKE_STEPS.filter((step) => step.field !== "screenshots" && (draft.answers[step.field] || ["productName", "stage", "goal", "contact"].includes(step.field)));
  const canRetry = error && draft.messages.at(-1)?.role === "user";

  return <div className="lumi-guide">
    <header className="lumi-guide-title"><h1>{copy.title}</h1><p>{copy.subtitle}</p></header>
    <div className="lumi-guide-workspace">
      <section className="lumi-guide-thread" aria-label={copy.speaker}>
        <div className="lumi-guide-scroll" ref={scroll} onScroll={(event) => { const area = event.currentTarget; followOutput.current = area.scrollHeight - area.scrollTop - area.clientHeight < 80; }}>
          <div className="lumi-guide-log" role="log" aria-live="polite" aria-relevant="additions">
            <article className="lumi-guide-message" data-role="assistant">
              <div className="lumi-guide-author"><Image src={rabbit} alt="" width={32} height={32} /><strong>{BRAND.agentName}</strong><span>{copy.speaker}</span></div>
              <p>{restored ? copy.restored : copy.greeting}</p>
            </article>
            {draft.messages.map((message, index) => <article className="lumi-guide-message" data-role={message.role} key={index}>
              <div className="lumi-guide-author">{message.role === "assistant" ? <><Image src={rabbit} alt="" width={28} height={28} /><strong>{BRAND.agentName}</strong></> : <span>{copy.you}</span>}</div>
              <p>{message.content}</p>
            </article>)}
          </div>
          {busy || partial ? <article className="lumi-guide-message" data-role="assistant" aria-busy={busy}>
            <div className="lumi-guide-author"><Image src={rabbit} alt="" width={28} height={28} /><strong>{BRAND.agentName}</strong></div>
            {partial ? <p>{partial}</p> : <p className="lumi-guide-thinking" role="status"><LoaderCircle size={15} className="lumi-guide-spinner" aria-hidden />{copy.thinking}</p>}
          </article> : null}
          {error ? <div className="lumi-guide-error" role="alert"><p>{copy[error]}</p>{canRetry ? <button type="button" onClick={() => void replyTo(draft.messages)} disabled={busy || creating || Boolean(fileError)}><RotateCcw size={15} aria-hidden />{copy.retry}</button> : null}</div> : null}
          {!busy && !ready && draft.choices.length ? <fieldset className="lumi-guide-choices"><legend>{copy.choiceHint}</legend>
            {draft.choices.map((choice) => <button key={choice.value} type="button" disabled={creating} onClick={() => send(choice.value)}>{choice.label}<ArrowUp size={15} aria-hidden /></button>)}
          </fieldset> : null}
          {!draft.messages.length && !restored ? <div className="lumi-guide-starters">{copy.starters.map((text) => <button key={text} type="button" onClick={() => send(text)} disabled={busy || creating}>{text}<ArrowUp size={15} aria-hidden /></button>)}</div> : null}
        </div>

        <div className="lumi-guide-compose-area">
          {serverError ? <p className="lumi-guide-error" role="alert">{t(serverError)} {copy.serverError}</p> : null}
          {draft.hadImages && !files.length ? <p className="lumi-guide-note">{copy.lostImages}</p> : null}
          {files.length ? <div className="lumi-guide-attachments">{files.map((file, index) => <span key={index}><Paperclip size={13} aria-hidden />{file.name}</span>)}<button type="button" onClick={clearFiles} disabled={busy || creating} aria-label={copy.remove}><X size={16} aria-hidden /></button></div> : null}
          {fileError ? <p className="lumi-guide-error" role="alert">{fileError}</p> : null}
          <form className="lumi-guide-composer" onSubmit={(event) => { event.preventDefault(); send(draft.input); }}>
            <label className="sr-only" htmlFor="lumi-intake-message">{copy.send}</label>
            <textarea ref={textarea} id="lumi-intake-message" rows={3} value={draft.input} maxLength={INTAKE_MESSAGE_LIMIT} placeholder={copy.placeholder} disabled={creating}
              onChange={(event) => setDraft((previous) => ({ ...previous, input: event.target.value }))}
              onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); send(draft.input); } }} />
            <div className="lumi-guide-compose-tools">
              <button type="button" onClick={() => fileInput.current?.click()} disabled={busy || creating} aria-label={copy.attach} title={attachmentHelp(attachmentTier, locale)}><Paperclip size={19} aria-hidden /></button>
              <span>{draft.input.length ? `${draft.input.length} / ${INTAKE_MESSAGE_LIMIT}` : BRAND.agentName}</span>
              {busy ? <button type="button" className="lumi-guide-send" onClick={() => request.current?.abort()} aria-label={copy.stop}><Square size={15} fill="currentColor" aria-hidden /></button>
                : <button type="submit" className="lumi-guide-send" aria-label={copy.send} disabled={!draft.input.trim() || creating || Boolean(fileError)}><ArrowUp size={20} aria-hidden /></button>}
            </div>
          </form>
          <input ref={fileInput} className="sr-only" type="file" name="screenshots" form="lumi-project-submit" multiple accept={uploadPolicy.accept} aria-label={copy.attach} disabled={busy} tabIndex={-1}
            onChange={(event) => {
              const selected = Array.from(event.target.files ?? []);
              const images = selected.filter(isImageAttachment);
              const invalidType = selected.some((file) => !isAllowedAttachment(file, attachmentTier));
              const tooManyImages = images.length > uploadPolicy.maxImages;
              const invalidSize = selected.some((file) => file.size === 0 || (isImageAttachment(file) ? file.size > uploadPolicy.maxImageBytes : file.size > uploadPolicy.maxDocumentBytes));
              const totalLimit = maxTotalBytes ?? uploadPolicy.maxTotalBytes;
              const tooLarge = totalLimit > 0 && selected.reduce((sum, file) => sum + file.size, 0) > totalLimit;
              const errorMessage = invalidType || invalidSize
                ? (attachmentTier === "pro" ? "Pro 资料支持图片、Markdown、HTML 和 Word 文件，请检查类型与大小。" : copy.imageError)
                : tooManyImages ? (attachmentTier === "pro" ? "Pro 最多上传 50 张图片。" : copy.imageError)
                : tooLarge ? (attachmentTier === "pro" ? "Pro 本次资料总大小不能超过 20 MB。" : copy.imageTotal) : "";
              // The project creation action stores image attachments in project_images. Keep document files in the chat payload only.
              if (event.currentTarget.form) {
                const transfer = new DataTransfer();
                images.forEach((file) => transfer.items.add(file));
                event.currentTarget.files = transfer.files;
              }
              setFiles(selected); setFileError(errorMessage);
              setDraft((previous) => ({ ...previous, hadImages: images.length > 0 }));
            }} />
          <p className="lumi-guide-footnote" role="status">{storageFailed ? copy.storageError : `${copy.footer} ${attachmentHelp(attachmentTier, locale)}`}</p>
        </div>
      </section>

      <aside className="lumi-guide-sidebar">
        <div className="lumi-guide-brief">
          <details open={briefOpen} onToggle={(event) => setBriefOpen(event.currentTarget.open)}>
          <summary><span><ClipboardList size={18} aria-hidden />{copy.draft}</span>{ready ? <span className="lumi-guide-summary-status">{locale === "en" ? "Ready to confirm" : "可确认"}</span> : null}<ChevronDown size={17} aria-hidden /></summary>
          <div className="lumi-guide-brief-content">
            <p>{copy.summaryHint}</p>
            <dl>{rows.map((step) => {
              if (step.field === "screenshots") return null;
              const value = draft.answers[step.field];
              return <div key={step.field}><dt>{t(step.label)}</dt><dd data-empty={!value}>{value ? ["stage", "goal"].includes(step.field) ? t(value) : value : copy.unknown}</dd></div>;
            })}</dl>
            <form id="lumi-project-submit" action={action} onSubmit={(event) => {
              if (!ready || busy || fileError || creating) { event.preventDefault(); return; }
              setCreating(true);
            }}>
              {Object.entries(draft.answers).map(([name, value]) => <input key={name} type="hidden" name={name} value={value.trim()} />)}
              <div hidden aria-hidden><label htmlFor="website">Website</label><input id="website" name="website" tabIndex={-1} autoComplete="off" /></div>
              <p className="lumi-guide-readiness" data-ready={ready}>{ready ? <Check size={15} aria-hidden /> : null}{ready ? copy.ready : copy.incomplete}</p>
              <ConfirmProject disabled={!ready || busy || creating || Boolean(fileError)} />
            </form>
          </div>
          </details>
        </div>
        <IntakeAgentRail messageCount={draft.messages.filter((message) => message.role === "user").length} busy={busy} ready={ready} attachmentTier={attachmentTier} />
      </aside>
    </div>
  </div>;
}
