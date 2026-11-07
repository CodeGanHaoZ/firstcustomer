import { getLocale } from "@/lib/locale-server";
import { translateUi } from "@/lib/ui-translation";
import { T } from "@/components/ui-text";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LanguageSwitch } from "@/components/language-switch";
import { BrandMark } from "@/components/brand-mark";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { passwordDisabled } from "@/lib/auth";
import { loginAction } from "../actions";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return { title: translateUi(locale, "经营台登录"), robots: { index: false, follow: false } };
}

export default async function LoginPage({ searchParams }: PageProps<"/admin/login">) {
  if (passwordDisabled()) redirect("/admin");
  const { error } = await searchParams;
  return (
    <main className="mx-auto grid min-h-dvh w-full max-w-md content-center px-5 py-10">
      <section className="flex flex-col gap-5 rounded-xl border bg-card p-6 sm:p-8" aria-labelledby="login-title">
        <div className="flex flex-wrap items-center justify-between gap-4"><BrandMark /><LanguageSwitch /></div>
        <h1 id="login-title" className="text-2xl font-bold tracking-tight"><T>经营台登录</T></h1>
        {error ? <p role="alert" className="text-sm text-destructive"><T>密码不对或尝试太频繁。</T></p> : null}
        <form action={loginAction} className="flex flex-col gap-3">
          <Label htmlFor="password"><T>密码</T></Label>
          <Input id="password" name="password" type="password" required autoComplete="current-password" maxLength={128} />
          <Button type="submit"><T>登录</T></Button>
        </form>
      </section>
    </main>
  );
}
