"use client";

import { Dialog } from "@base-ui/react/dialog";
import { ArrowRight, ArrowUp, LoaderCircle, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { BRAND } from "@/lib/brand";
import { LUMI_HISTORY_LIMIT, LUMI_MESSAGE_LIMIT, LUMI_STARTERS, LUMI_STARTERS_EN, LUMI_CHAT_COPY, type LumiMessage } from "@/lib/lumi-chat";
import { localeTag, type Locale } from "@/lib/locale";
import { LumiWelcome } from "@/components/lumi-welcome";

const rabbit = "/brand/front-desk-rabbit.webp";

export function LumiChat({ locale = "zh" }: { locale?: Locale }) {
  const copy = LUMI_CHAT_COPY[locale];
  const starters = locale === "en" ? LUMI_STARTERS_EN : LUMI_STARTERS;
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<LumiMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<"rateLimit" | "unavailable" | null>(null);
  const [anchor, setAnchor] = useState<{ left: number; top: number; width: number; height: number } | null>(null);
  const scrollArea = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const area = scrollArea.current;
    if (open && area) area.scrollTop = area.scrollHeight;
  }, [open, messages, pending, error]);

  /* 弹窗吸附到右侧兔子卡片：同一次 getBoundingClientRect 直接给出 left/top/width/height，
     避免用 right 反算时「包含块宽度」与「视口宽度」不一致造成的十几像素露边。 */
  useEffect(() => {
    if (!open) return;
    const card = document.querySelector<HTMLElement>(".hero__visual .brand-welcome");
    if (!card) return;
    const measure = () => {
      const rect = card.getBoundingClientRect();
      // 首屏 [data-reveal] 入场时带 translateY(22px)，实测矩形会被临时下移，需补偿。
      let revealY = 0;
      const visual = card.closest<HTMLElement>("[data-reveal]");
      if (visual) {
        const raw = getComputedStyle(visual).transform;
        const nums = raw && raw !== "none" ? raw.match(/matrix\(([^)]+)\)/)?.[1].split(",").map(Number) : null;
        if (nums?.length === 6) revealY = nums[5];
      }
      const gutter = 24;
      const viewportW = document.documentElement.clientWidth;
      const left = Math.max(gutter, Math.min(rect.left, viewportW - 280 - gutter));
      const top = Math.max(gutter, Math.min(rect.top - revealY, window.innerHeight - 320));
      setAnchor({
        left,
        top,
        width: Math.max(280, Math.min(rect.width, viewportW - left - gutter)),
        height: Math.max(300, Math.min(560, window.innerHeight - top - gutter)),
      });
    };
    measure();
    // 模态滚动锁会移除滚动条、令版心变宽；稳定期与卡片尺寸变化时各重测一次。
    const raf = requestAnimationFrame(measure);
    const settle = window.setTimeout(measure, 160);
    const observer = new ResizeObserver(measure);
    observer.observe(card);
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(settle);
      observer.disconnect();
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure);
    };
  }, [open]);

  async function replyTo(history: LumiMessage[]) {
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/lumi", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-HiFirst-Language": locale },
        body: JSON.stringify(history.slice(-LUMI_HISTORY_LIMIT)),
      });
      if (response.status === 429) {
        setError("rateLimit");
        return;
      }
      if (!response.ok) throw new Error("Chat unavailable");
      const data = await response.json();
      if (typeof data.reply !== "string" || !data.reply.trim()) throw new Error("Empty reply");
      setMessages([...history, { role: "assistant", content: data.reply }]);
    } catch {
      setError("unavailable");
    } finally {
      setPending(false);
    }
  }

  function send(text: string) {
    const content = text.trim();
    if (!content || pending) return;
    const answered = messages.at(-1)?.role === "user" ? messages.slice(0, -1) : messages;
    const history: LumiMessage[] = [...answered, { role: "user", content }];
    setMessages(history);
    setDraft("");
    void replyTo(history);
  }

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <LumiWelcome paused={open} locale={locale} />

      <Dialog.Portal keepMounted>
        <Dialog.Backdrop className="lumi-chat-backdrop" />
        <Dialog.Popup
          className="lumi-chat"
          lang={localeTag(locale)}
          style={anchor ? {
            "--lumi-left": `${anchor.left}px`,
            "--lumi-top": `${anchor.top}px`,
            "--lumi-w": `${anchor.width}px`,
            "--lumi-h": `${anchor.height}px`,
          } as React.CSSProperties : undefined}
        >
          <header className="lumi-chat-header">
            <span className="lumi-chat-avatar">
              <Image src={rabbit} alt="" width={44} height={44} unoptimized />
            </span>
            <div>
              <Dialog.Title className="lumi-chat-title"><span lang="en">{BRAND.mascotName}</span> · {copy.frontdesk}</Dialog.Title>
              <Dialog.Description className="lumi-chat-description">{copy.guide}</Dialog.Description>
            </div>
            <Dialog.Close className="lumi-chat-close" aria-label={copy.close}>
              <X size={20} aria-hidden="true" />
            </Dialog.Close>
          </header>

          <div className="lumi-chat-scroll" ref={scrollArea}>
            <div className="lumi-chat-log" role="log" aria-label={copy.log} aria-live="polite">
              <p className="lumi-chat-message">{copy.hello} {BRAND.mascotName}{locale === "en" ? "! " : "！"}{copy.greeting}</p>
              {messages.map(({ role, content }, index) => (
                <p className="lumi-chat-message" data-speaker={role} key={index}>
                  <span className="sr-only">{role === "user" ? copy.user : `${BRAND.mascotName} ${copy.said}`}</span>{content}
                </p>
              ))}
            </div>
            {!messages.length && (
              <div className="lumi-chat-starters" aria-label={copy.starters}>
                {starters.map(({ question }) => <button key={question} type="button" onClick={() => send(question)}>{question}</button>)}
              </div>
            )}
            {pending && <p className="lumi-chat-status" role="status"><LoaderCircle size={15} aria-hidden="true" /> {BRAND.mascotName} {copy.replying}</p>}
            {error && (
              <div className="lumi-chat-retry">
                <p role="alert">{copy[error]}</p>
                <button type="button" onClick={() => void replyTo(messages)}>{copy.retry}</button>
              </div>
            )}
          </div>

          <footer className="lumi-chat-footer">
            <form className="lumi-chat-compose" onSubmit={(event) => { event.preventDefault(); send(draft); }}>
              <textarea
                aria-label={copy.input}
                placeholder={copy.placeholder}
                rows={2}
                maxLength={LUMI_MESSAGE_LIMIT}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing || event.keyCode === 229) return;
                  event.preventDefault();
                  send(draft);
                }}
              />
              <button type="submit" aria-label={copy.send} disabled={pending || !draft.trim()}>
                <ArrowUp size={19} aria-hidden="true" />
              </button>
            </form>
            <Link href="/projects/new" className="lumi-chat-next">{copy.cta} <ArrowRight size={15} aria-hidden="true" /></Link>
          </footer>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
