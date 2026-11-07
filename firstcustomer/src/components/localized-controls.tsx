"use client";

import type { ComponentProps, ElementType, JSX } from "react";
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
/** 任意原生标签：服务端组件里需要翻译 aria-label / title 时用它（I18n 在服务端渲染时拿不到服务端元素的属性）。 */
export function LocalizedTag<K extends keyof JSX.IntrinsicElements>({ as, ...props }: { as: K } & ComponentProps<K>) {
  const Tag = as as ElementType;
  return <Tag {...useAttributes(props)} />;
}
export function LocalizedImage(props: ComponentProps<typeof Image>) {
  const localized = useAttributes(props);
  return <Image {...localized} alt={localized.alt} />;
}
