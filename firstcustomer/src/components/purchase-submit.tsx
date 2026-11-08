"use client";

import { useFormStatus } from "react-dom";
import { T } from "./ui-text";

export function PurchaseSubmit({ label, pendingLabel, disabled = false }: { label: string; pendingLabel: string; disabled?: boolean }) {
  const { pending } = useFormStatus();
  return <button type="submit" className="btn btn--primary" disabled={disabled || pending} aria-busy={pending}>
    <T>{pending ? pendingLabel : label}</T>
  </button>;
}
