"use client";

import { Dialog } from "@base-ui/react/dialog";
import { ArrowRight, ArrowUp, LoaderCircle, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { BRAND } from "@/lib/brand";
import { LUMI_HISTORY_LIMIT, LUMI_MESSAGE_LIMIT, LUMI_STARTERS, type LumiMessage } from "@/lib/lumi-chat";
import { LumiWelcome } from "@/components/lumi-welcome";

const rabbit = "/brand/front-desk-rabbit.webp";

export function LumiChat() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<LumiMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const scrollArea = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const area = scrollArea.current;
    if (open && area) area.scrollTop = area.scrollHeight;
  }, [open, messages, pending, error]);

  async function replyTo(history: LumiMessage[]) {
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/lumi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(history.slice(-LUMI_HISTORY_LIMIT)),
      });
      if (response.status === 429) {
        setError("消息有点多，请稍等再试。你也可以直接开始免费初诊。");
        return;
      }
      if (!response.ok) throw new Error("Chat unavailable");
      const data = await response.json();
      if (typeof data.reply !== "string" || !data.reply.trim()) throw new Error("Empty reply");
      setMessages([...history, { role: "assistant", content: data.reply }]);
    } catch {
      setError("这次没收到回复。你可以重试，或直接开始免费初诊。");
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
      <LumiWelcome paused={open} />

      <Dialog.Portal keepMounted>
        <Dialog.Backdrop className="lumi-chat-backdrop" />
        <Dialog.Popup className="lumi-chat">
          <header className="lumi-chat-header">
            <span className="lumi-chat-avatar">
              <Image src={rabbit} alt="" width={44} height={44} unoptimized />
            </span>
            <div>
              <Dialog.Title className="lumi-chat-title"><span lang="en">{BRAND.mascotName}</span> · 首客前台</Dialog.Title>
              <Dialog.Description className="lumi-chat-description">AI 出海引导</Dialog.Description>
            </div>
            <Dialog.Close className="lumi-chat-close" aria-label="关闭对话">
              <X size={20} aria-hidden="true" />
            </Dialog.Close>
          </header>

          <div className="lumi-chat-scroll" ref={scrollArea}>
            <div className="lumi-chat-log" role="log" aria-label="对话记录" aria-live="polite">
              <p className="lumi-chat-message">嗨，我是 {BRAND.mascotName}！你在做什么产品？还在想法阶段、有了 MVP，还是已经上线了？</p>
              {messages.map(({ role, content }, index) => (
                <p className="lumi-chat-message" data-speaker={role} key={index}>
                  <span className="sr-only">{role === "user" ? "你说：" : `${BRAND.mascotName} 说：`}</span>{content}
                </p>
              ))}
            </div>
            {!messages.length && (
              <div className="lumi-chat-starters" aria-label="试着这样开场">
                {LUMI_STARTERS.map(({ question }) => <button key={question} type="button" onClick={() => send(question)}>{question}</button>)}
              </div>
            )}
            {pending && <p className="lumi-chat-status" role="status"><LoaderCircle size={15} aria-hidden="true" /> {BRAND.mascotName} 正在回复</p>}
            {error && (
              <div className="lumi-chat-retry">
                <p role="alert">{error}</p>
                <button type="button" onClick={() => void replyTo(messages)}>重试</button>
              </div>
            )}
          </div>

          <footer className="lumi-chat-footer">
            <form className="lumi-chat-compose" onSubmit={(event) => { event.preventDefault(); send(draft); }}>
              <textarea
                aria-label="给 lumi 发消息"
                placeholder="说说你的产品，或问个问题…"
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
              <button type="submit" aria-label="发送消息" disabled={pending || !draft.trim()}>
                <ArrowUp size={19} aria-hidden="true" />
              </button>
            </form>
            <Link href="/projects/new" className="lumi-chat-next">开始免费初诊 <ArrowRight size={15} aria-hidden="true" /></Link>
          </footer>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
