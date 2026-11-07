"use client";

import type { ComponentProps } from "react";
import Link from "next/link";
import Image from "next/image";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useLocale } from "./locale-provider";
import { translateUi } from "@/lib/ui-translation";

function useAttributes<P extends object>(props: P): P {
  const locale = useLocale();
  const translated = { ...props } as Record<string, unknown>;
  for (const name of ["placeholder", "aria-label", "title", "alt"]) {
    if (typeof translated[name] === "string") translated[name] = translateUi(locale, translated[name]);
  }
  return translated as P;
}

// Render these controls inside the locale boundary, so their SSR attributes and
// hydrated attributes agree. Values and submission identifiers stay untouched.
export function LocalizedLink(props: ComponentProps<typeof Link>) {
  return <Link {...useAttributes(props)} />;
}
export function LocalizedInput(props: ComponentProps<typeof Input>) {
  return <Input {...useAttributes(props)} />;
}
export function LocalizedTextarea(props: ComponentProps<typeof Textarea>) {
  return <Textarea {...useAttributes(props)} />;
}
export function LocalizedImage(props: ComponentProps<typeof Image>) {
  const localized = useAttributes(props);
  return <Image {...localized} alt={localized.alt} />;
}
