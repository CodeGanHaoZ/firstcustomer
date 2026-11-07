"use client";

import { useEffect, useRef, type ReactNode } from "react";

type Intake = "admin" | "public";
const draftKey = (intake: Intake) => `fc:intake:${intake}`;
const fields = ["stage", "productName", "productUrl", "targetMarket", "goal", "budgetNote", "contact", "own"];

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
  return <form ref={form} action={action} onChange={save} className="grid gap-4 rounded-xl border bg-card p-4 sm:grid-cols-2 sm:p-6">{children}</form>;
}

export function ClearProjectDraft({ intake }: { intake: Intake }) {
  useEffect(() => {
    try { localStorage.removeItem(draftKey(intake)); } catch { /* Storage is optional. */ }
  }, [intake]);
  return null;
}
