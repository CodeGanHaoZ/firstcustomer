import type { Metadata } from "next";
import { BRAND } from "@/lib/brand";
import { PageTransition } from "@/components/page-transition";
import "./globals.css";

export const metadata: Metadata = {
  title: `${BRAND.name} ${BRAND.englishName}`,
  description: "帮中国创业者找到第一批真实海外客户的 AI 出海服务",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="zh-CN" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <PageTransition />
        {children}
      </body>
    </html>
  );
}
