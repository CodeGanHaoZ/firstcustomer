"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { LUMI_INTAKE_DRAFT_KEY } from "@/lib/lumi-intake";
import { projectNotesChanged, projectNotesKey } from "./project-conversation-notes";

type Intake = "admin" | "public";
const draftKey = (intake: Intake) => `fc:intake:${intake}`;
const fields = ["stage", "productName", "productUrl", "targetMarket", "goal", "budgetNote", "contact", "own", "currentWorkflow", "successCriteria", "constraints"];

export function ProjectDraftForm({ action, intake, children }: {
  action: (formData: FormData) => Promise<void>;
  intake: Intake;
  children: ReactNode;
}) {
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    try {
      const current = form.current;
      const saved = JSON.parse(localStorage.getItem(draftKey(intake)) ?? "{}") as Record<string, string>;
      if (!current) return;
      for (const name of fields) {
        const input = current.elements.namedItem(name);
        if (input instanceof HTMLInputElement && input.type === "checkbox") input.checked = saved[name] === "1";
        else if ((input instanceof HTMLInputElement || input instanceof HTMLTextAreaElement || input instanceof HTMLSelectElement)
          && typeof saved[name] === "string") input.value = saved[name];
        else if (input instanceof RadioNodeList && typeof saved[name] === "string") input.value = saved[name];
      }
    } catch {
      // Drafts are optional when browser storage is unavailable.
    }
  }, [intake]);
  const save = (event: React.FormEvent<HTMLFormElement>) => {
    try {
      const formData = new FormData(event.currentTarget);
      const values = Object.fromEntries(fields.flatMap((field) => {
        const value = formData.get(field);
        return typeof value === "string" ? [[field, value]] : [];
      }));
      localStorage.setItem(draftKey(intake), JSON.stringify(values));
    } catch {
      // The form can still be submitted.
    }
  };
  return <form ref={form} action={action} onChange={save} className="paper rise grid gap-5 sm:grid-cols-2">{children}</form>;
}

export function ClearProjectDraft({ intake, projectId }: { intake: Intake; projectId?: string }) {
  useEffect(() => {
    try {
      if (intake === "public" && projectId) {
        const conversation = localStorage.getItem(LUMI_INTAKE_DRAFT_KEY);
        if (conversation && !sessionStorage.getItem(projectNotesKey(projectId))) {
          sessionStorage.setItem(projectNotesKey(projectId), conversation);
          window.dispatchEvent(new Event(projectNotesChanged));
        }
      }
      localStorage.removeItem(draftKey(intake));
      if (intake === "public") localStorage.removeItem(LUMI_INTAKE_DRAFT_KEY);
    } catch { /* Storage is optional. */ }
  }, [intake, projectId]);
  return null;
}
