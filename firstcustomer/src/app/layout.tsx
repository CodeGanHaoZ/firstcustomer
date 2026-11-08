import { translateUi } from "@/lib/ui-translation";
import type { Metadata } from "next";
import { BRAND } from "@/lib/brand";
import { AmbientMotion } from "@/components/ambient-motion";
import { BackToTop } from "@/components/back-to-top";
import { PageTransition } from "@/components/page-transition";
import { LocaleProvider } from "@/components/locale-provider";
import { getLocale } from "@/lib/locale-server";
import { localeTag } from "@/lib/locale";
import "./globals.css";
import "./editorial.css";
import "./ambient.css";
import "./site.css";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return {
  title: locale === "en" ? BRAND.englishName : `${BRAND.name} ${BRAND.englishName}`,
  description: translateUi(locale, "帮中国创业者找到第一批真实海外客户的 MiMo AI 出海服务"),
  };
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const locale = await getLocale();
  return (
    <html lang={localeTag(locale)} data-scroll-behavior="smooth" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <LocaleProvider locale={locale}><AmbientMotion /><BackToTop variant="float" locale={locale} /><PageTransition />{children}</LocaleProvider>
      </body>
    </html>
  );
}
