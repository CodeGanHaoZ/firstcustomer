"use client";

import { useSyncExternalStore } from "react";
import { parseConversationDraft } from "@/lib/lumi-intake";
import { useLocale } from "./locale-provider";

export const projectNotesKey = (projectId: string) => `fc:project-notes:${projectId}`;
export const projectNotesChanged = "fc:project-notes-changed";
const subscribe = (listener: () => void) => {
  window.addEventListener(projectNotesChanged, listener);
  return () => window.removeEventListener(projectNotesChanged, listener);
};
const serverSnapshot = () => null;

export function ProjectConversationNotes({ projectId }: { projectId: string }) {
  const en = useLocale() === "en";
  const raw = useSyncExternalStore(subscribe, () => {
    try { return sessionStorage.getItem(projectNotesKey(projectId)); } catch { return null; }
  }, serverSnapshot);
  const notes = parseConversationDraft(raw).messages.filter((message) => message.role === "assistant");
  if (!notes.length) return null;
  return <details className="fold project-conversation-notes"><summary>{en ? "Conversation notes" : "对话整理"}</summary>
    <div className="fold__body"><p className="meta">{en ? "Reception notes saved in this browser. Project facts and reports below are saved to the project." : "当前浏览器保留的接待记录。项目需求与报告另行保存在项目中。"}</p>
      {notes.map((note, index) => <article className="workspace-generated" key={index}><h3>Lumi · {index + 1}</h3><p>{note.content}</p></article>)}
    </div>
  </details>;
}
