"use client";

import Image from "next/image";
import { ArrowLeft, ArrowRight, Check, ClipboardList, LoaderCircle, Paperclip, Pencil } from "lucide-react";
import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import {
  INTAKE_STEPS, PUBLIC_INTAKE_DRAFT_KEY, intakeAnswerError, parseIntakeDraft, serializeIntakeDraft,
  type IntakeDraft, type IntakeField,
} from "@/lib/project-intake";

const subscribe = () => () => {};
const browserSnapshot = () => true;
const serverSnapshot = () => false;
const rabbit = "/brand/front-desk-rabbit.webp";

function IntakePending({ children }: { children: ReactNode }) {
  const { pending } = useFormStatus();
  return <fieldset disabled={pending} aria-busy={pending} className="lumi-intake-fields">
    {children}
    {pending ? <p className="lumi-intake-pending" role="status"><LoaderCircle size={18} aria-hidden />正在创建项目，请稍候…</p> : null}
  </fieldset>;
}

export function LumiProjectIntake(props: { action: (data: FormData) => Promise<void>; maxTotalBytes?: number; serverError?: string }) {
  const ready = useSyncExternalStore(subscribe, browserSnapshot, serverSnapshot);
  return ready ? <IntakeConversation {...props} /> : <div className="lumi-intake-loading" role="status">Lumi 正在打开项目登记本…</div>;
}

function IntakeConversation({ action, maxTotalBytes, serverError }: { action: (data: FormData) => Promise<void>; maxTotalBytes?: number; serverError?: string }) {
  const [draft, setDraft] = useState(() => {
    try { return parseIntakeDraft(localStorage.getItem(PUBLIC_INTAKE_DRAFT_KEY)); }
    catch { return parseIntakeDraft(null); }
  });
  const [restored] = useState(() => Object.values(draft.answers).some(Boolean));
  const [lostImages] = useState(draft.hadImages);
  const [storageFailed, setStorageFailed] = useState(false);
  const [error, setError] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [imageError, setImageError] = useState("");
  const [editing, setEditing] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const questionHeading = useRef<HTMLHeadingElement>(null);
  const shouldFocus = useRef(false);
  const step = INTAKE_STEPS[draft.step];
  const review = !step;

  useEffect(() => {
    if (shouldFocus.current) questionHeading.current?.focus();
  }, [draft.step]);

  function save(next: IntakeDraft) {
    setDraft(next);
    try { localStorage.setItem(PUBLIC_INTAKE_DRAFT_KEY, serializeIntakeDraft(next)); setStorageFailed(false); }
    catch { setStorageFailed(true); }
  }
  function update(field: IntakeField, value: string) {
    setError("");
    save({ ...draft, answers: { ...draft.answers, [field]: value } });
  }
  function goTo(index: number, edit = false) {
    shouldFocus.current = true;
    setError("");
    setEditing(edit);
    save({ ...draft, step: index });
  }
  function advance(skip = false) {
    if (!step) return;
    const message = step.field === "screenshots" ? (skip ? "" : imageError) : (skip ? "" : intakeAnswerError(step.field, draft.answers[step.field]));
    if (message) { setError(message); return; }
    const next = editing ? INTAKE_STEPS.length : draft.step + 1;
    const answers = { ...draft.answers };
    if (skip && step.field !== "screenshots") answers[step.field] = "";
    if (skip && step.field === "screenshots") {
      if (fileInput.current) fileInput.current.value = "";
      setFiles([]); setImageError("");
    }
    shouldFocus.current = true;
    setError(""); setEditing(false);
    save({ ...draft, answers, step: next, reached: Math.max(draft.reached, next), hadImages: skip && step.field === "screenshots" ? false : files.length > 0 });
  }
  function editAnswer(index: number) { goTo(index, review); }
  function answerText(index: number) {
    const field = INTAKE_STEPS[index].field;
    if (field === "screenshots") return files.length ? files.map((file) => file.name).join("、") : "未上传";
    return draft.answers[field].trim() || "暂未填写";
  }
  function renderAnswers(full: boolean) {
    return <dl className="lumi-intake-answers">{INTAKE_STEPS.map((item, index) => {
      if (!full && index >= draft.reached) return null;
      return <div key={item.field}>
        <dt>{item.label}</dt><dd>{answerText(index)}</dd>
        <button type="button" onClick={() => editAnswer(index)} aria-label={`修改${item.label}`}><Pencil size={14} aria-hidden /><span>修改</span></button>
      </div>;
    })}</dl>;
  }

  return <div className="lumi-intake-layout">
    <aside className="lumi-intake-host">
      <Image className="lumi-intake-rabbit" src={rabbit} alt="Lumi 露米，首客的前台兔兔" width={240} height={240} priority />
      <div><h1>和 <span lang="en">lumi</span> 聊聊<br className="lumi-intake-desktop-break" />你的出海项目</h1>
        <p>我来帮你把想法整理清楚。<br />我们一次聊一件事。</p></div>
      <div className="lumi-intake-outcome"><ClipboardList size={20} aria-hidden /><p>确认提交后，自动开始免费初诊，整理候选人群和下一步待验证的问题。</p></div>
    </aside>

    <section className="lumi-intake-desk" aria-label="Lumi 项目引导">
      <div className="lumi-intake-progress">
        <span>{review ? "项目资料已整理好" : editing ? `修改${step.label}` : `项目登记 · ${draft.step + 1} / ${INTAKE_STEPS.length}`}</span>
        <span>{review ? "请核对后提交" : "选填项可以跳过"}</span>
        <progress max={INTAKE_STEPS.length} value={draft.reached} aria-label="项目登记进度" />
      </div>
      {serverError ? <p role="alert" className="lumi-intake-notice lumi-intake-error">{serverError}。文本资料已保留，请检查后重试。</p> : null}
      {restored ? <p className="lumi-intake-notice">已接着上次的文本草稿继续。{lostImages ? "截图不会保存在浏览器中，请重新选择。" : ""}</p> : null}

      <form action={action} noValidate onSubmit={(event) => {
        if (!review) { event.preventDefault(); advance(); return; }
        const invalid = INTAKE_STEPS.findIndex((item) => item.field !== "screenshots" && Boolean(intakeAnswerError(item.field, draft.answers[item.field])));
        if (invalid >= 0 || imageError) {
          event.preventDefault();
          const index = invalid >= 0 ? invalid : 6;
          goTo(index, true);
          const field = INTAKE_STEPS[index].field;
          setError(field === "screenshots" ? imageError : intakeAnswerError(field, draft.answers[field]));
        }
      }}>
        {Object.entries(draft.answers).map(([name, value]) => <input key={name} type="hidden" name={name} value={value.trim()} />)}
        <div hidden aria-hidden><label htmlFor="website">网站</label><input id="website" name="website" tabIndex={-1} autoComplete="off" /></div>
        <IntakePending>
          {!review && draft.step > 0 && !editing ? <div className="lumi-intake-last-answer"><span>你刚刚说</span><p>{answerText(draft.step - 1)}</p><button type="button" onClick={() => goTo(draft.step - 1)} aria-label={`修改${INTAKE_STEPS[draft.step - 1].label}`}><Pencil size={14} aria-hidden />修改</button></div> : null}
          <div className="lumi-intake-question" key={draft.step}>
            <div className="lumi-intake-speaker"><Image src={rabbit} alt="" width={40} height={40} /><span lang="en">lumi</span><span>露米</span></div>
            <h2 ref={questionHeading} tabIndex={-1} id="intake-question">{review ? "收到，这是我们整理好的项目。" : step.question}</h2>
            <p id="intake-help">{review ? "看看有没有需要调整的地方，确认后我就帮你提交。" : step.help}</p>
          </div>

          {step && step.field !== "screenshots" ? <div className="lumi-intake-response">
            {"options" in step ? <fieldset className="lumi-intake-options" aria-labelledby="intake-question" aria-describedby={error ? "intake-error" : "intake-help"}>
              <legend className="sr-only">{step.label}</legend>
              {step.options.map((option) => <label key={option}>
                <input type="radio" name={`choice-${step.field}`} value={option} checked={draft.answers[step.field] === option} onChange={() => update(step.field, option)} />
                <span>{option}</span><Check size={18} aria-hidden />
              </label>)}
            </fieldset> : <>
              <label className="sr-only" htmlFor="intake-answer">{step.label}</label>
              {step.field === "productName" ? <textarea id="intake-answer" rows={4} value={draft.answers[step.field]} maxLength={step.max} placeholder={step.placeholder}
                aria-invalid={Boolean(error)} aria-describedby={error ? "intake-help intake-error" : "intake-help"} onChange={(event) => update(step.field, event.target.value)} /> :
                <input id="intake-answer" type={step.field === "productUrl" ? "url" : "text"} value={draft.answers[step.field]} maxLength={step.max} placeholder={step.placeholder}
                  autoComplete={step.field === "contact" ? "off" : undefined} aria-invalid={Boolean(error)} aria-describedby={error ? "intake-help intake-error" : "intake-help"}
                  onChange={(event) => update(step.field, event.target.value)} />}
              <div className="lumi-intake-input-note"><span>{"optional" in step ? "选填" : "必填"}</span><span>{draft.answers[step.field].length} / {step.max}</span></div>
            </>}
          </div> : null}

          {/* Keep the file input mounted so changing steps never discards selected files. */}
          <div hidden={step?.field !== "screenshots"} className="lumi-intake-response">
            <label className="lumi-intake-upload" htmlFor="intake-screenshots"><Paperclip size={20} aria-hidden /><strong>选择产品截图</strong>
              <span>PNG、JPG 或 WebP · 最多 3 张<br />{maxTotalBytes ? "合计不超过 4 MB" : "每张不超过 5 MB"}</span></label>
            <input ref={fileInput} id="intake-screenshots" className="lumi-intake-file" type="file" name="screenshots" multiple accept="image/png,image/jpeg,image/webp" aria-label="选择产品截图"
              aria-invalid={Boolean(imageError)} aria-describedby={imageError ? "intake-error" : undefined} onChange={(event) => {
                const selected = Array.from(event.target.files ?? []);
                const message = selected.length > 3 ? "最多选择 3 张截图，请重新选择。" : selected.some((file) => file.size > 5 * 1024 * 1024) ? "每张截图不能超过 5 MB，请选择较小的图片。" : maxTotalBytes && selected.reduce((sum, file) => sum + file.size, 0) > maxTotalBytes ? "截图合计不能超过 4 MB，请选择较小的图片。" : selected.some((file) => !["image/png", "image/jpeg", "image/webp"].includes(file.type)) ? "请选择 PNG、JPG 或 WebP 图片。" : "";
                setFiles(selected); setImageError(message); setError(message);
                save({ ...draft, hadImages: selected.length > 0 });
              }} />
            {files.length ? <ul className="lumi-intake-files">{files.map((file, index) => <li key={index}><Paperclip size={14} aria-hidden /><span>{file.name}</span><small>{(file.size / 1024 / 1024).toFixed(2)} MB</small></li>)}</ul> : null}
          </div>

          {review ? <div className="lumi-intake-review">{renderAnswers(true)}<p>提交后会打开你的项目工作台，查看初诊进度和结果。</p></div> : null}
          {error ? <p className="lumi-intake-error" id="intake-error" role="alert">{error}</p> : null}
          <div className="lumi-intake-actions">
            {editing ? <button type="button" className="lumi-intake-back" onClick={() => goTo(INTAKE_STEPS.length)}><ArrowLeft size={16} aria-hidden />返回核对</button> : draft.step > 0 ? <button type="button" className="lumi-intake-back" onClick={() => goTo(draft.step - 1)}><ArrowLeft size={16} aria-hidden />上一步</button> : null}
            <button type="submit" className="lumi-intake-next">{review ? "确认提交，开始免费初诊" : editing ? "保存修改" : "继续"}<ArrowRight size={17} aria-hidden /></button>
            {step && "optional" in step ? <button type="button" className="lumi-intake-skip" onClick={() => advance(true)}>{step.skip}</button> : null}
          </div>
          {!review && draft.reached > 0 && !editing ? <details className="lumi-intake-record"><summary>查看已填资料</summary>{renderAnswers(false)}</details> : null}
        </IntakePending>
      </form>
      <p className="lumi-intake-save" role="status">{storageFailed ? "当前浏览器无法保存草稿，请保持页面打开直至提交。" : "文本草稿自动保存在此浏览器，截图需在本次提交。"}</p>
    </section>
  </div>;
}
