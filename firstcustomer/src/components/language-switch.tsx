"use client";

import { Globe2 } from "lucide-react";
import { useFormStatus } from "react-dom";
import { useEffect } from "react";
import { changeLanguage } from "@/app/language-actions";
import { localeTag, type Locale } from "@/lib/locale";

function SwitchButton({ locale }: { locale: Locale }) {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={pending} aria-busy={pending}
    lang={locale === "zh" ? "en" : "zh-CN"}
    aria-label={locale === "zh" ? "Switch to English" : "切换到中文"}>
    <Globe2 size={15} aria-hidden="true" />
    <span lang="zh-CN" data-active={locale === "zh"}>中文</span><span aria-hidden="true">/</span><span lang="en" data-active={locale === "en"}>EN</span>
  </button>;
}

export function LanguageSwitch({ locale }: { locale: Locale }) {
  useEffect(() => {
    const previous = document.documentElement.lang;
    document.documentElement.lang = localeTag(locale);
    return () => { document.documentElement.lang = previous; };
  }, [locale]);
  return <form action={changeLanguage.bind(null, locale === "zh" ? "en" : "zh")} className="language-switch"><SwitchButton locale={locale} /></form>;
}
