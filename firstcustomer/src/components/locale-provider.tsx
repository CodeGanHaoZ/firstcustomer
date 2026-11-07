"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { Locale } from "@/lib/locale";

const LocaleContext = createContext<Locale>("zh");
export const useLocale = () => useContext(LocaleContext);
export function LocaleProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  return <LocaleContext value={locale}>{children}</LocaleContext>;
}
