"use client";

import { cloneElement, isValidElement, type ReactElement, type ReactNode } from "react";
import { useLocale } from "./locale-provider";
import { translateUi } from "@/lib/ui-translation";

// Explicit UI boundaries only. Project content and stored records are never walked or translated.
export function T({ children }: { children: ReactNode }) {
  const locale = useLocale();
  return typeof children === "string" ? translateUi(locale, children) : children;
}

export function I18n({ children }: { children: ReactElement<Record<string, unknown>> }) {
  const locale = useLocale();
  if (!isValidElement(children)) return children;
  const attributes: Record<string, unknown> = {};
  for (const name of ["placeholder", "aria-label", "title", "alt"]) {
    const value = children.props[name];
    if (typeof value === "string") attributes[name] = translateUi(locale, value);
  }
  return cloneElement(children, attributes);
}
