import { getLocale } from "@/lib/locale-server";
import { translateUi } from "@/lib/ui-translation";
import { T } from "@/components/ui-text";
import type { Metadata } from "next";
import Image from "next/image";
import { redirect } from "next/navigation";
import { LanguageSwitch } from "@/components/language-switch";
import { BrandMark } from "@/components/brand-mark";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { isAdmin } from "@/lib/auth";
import { loginAction } from "../actions";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return { title: translateUi(locale, "经营台登录"), robots: { index: false, follow: false } };
}

export default async function LoginPage({ searchParams }: PageProps<"/admin/login">) {
  if (await isAdmin()) redirect("/admin");
  const { error } = await searchParams;
  return (
    <div className="site-shell">
      <main className="site-main grid content-center">
        <section className="auth-card rise max-w-[56rem]" aria-labelledby="login-title">
          <aside className="auth-card__scene" aria-hidden="true">
            <Image src="/brand/front-desk-rabbit.webp" alt="" width={200} height={200} className="h-auto w-[200px]" unoptimized />
            <p className="auth-card__quote"><T>内部经营台</T></p>
            <p className="meta"><T>使用首客内部账号登录，管理客户项目与公司经营。</T></p>
          </aside>
          <div className="auth-card__form">
            <div className="flex flex-wrap items-center justify-between gap-4"><BrandMark /><LanguageSwitch /></div>
            <header>
              <p className="eyebrow">HiFirst Office</p>
              <h1 id="login-title" className="page-head__title text-[clamp(1.9rem,3vw,2.4rem)]"><T>经营台登录</T></h1>
            </header>
            {error ? <p role="alert" className="notice notice--fail"><T>账号或密码不正确，或尝试太频繁。</T></p> : null}
            <form action={loginAction} className="grid gap-4">
              <div className="grid gap-2"><Label htmlFor="username"><T>内部账号</T></Label>
                <Input id="username" name="username" required autoComplete="username" maxLength={128} autoCapitalize="none" spellCheck={false} /></div>
              <div className="grid gap-2"><Label htmlFor="password"><T>密码</T></Label>
                <Input id="password" name="password" type="password" required autoComplete="current-password" maxLength={128} /></div>
              <Button type="submit" size="lg" className="mt-1"><T>登录</T></Button>
            </form>
          </div>
        </section>
      </main>
      <div className="scene-foot scene-foot--low" aria-hidden="true" />
    </div>
  );
}
