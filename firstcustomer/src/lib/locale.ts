export type Locale = "zh" | "en";
export const LOCALE_COOKIE = "fc_locale";
export const localeFrom = (value: unknown): Locale => value === "en" ? "en" : "zh";
export const localeTag = (locale: Locale) => locale === "en" ? "en" : "zh-CN";
