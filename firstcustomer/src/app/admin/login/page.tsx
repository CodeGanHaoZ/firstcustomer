import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { BrandMark } from "@/components/brand-mark";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { passwordDisabled } from "@/lib/auth";
import { loginAction } from "../actions";

export const metadata: Metadata = { title: "经营台登录", robots: { index: false, follow: false } };

export default async function LoginPage({ searchParams }: PageProps<"/admin/login">) {
  if (passwordDisabled()) redirect("/admin");
  const { error } = await searchParams;
  return (
    <main className="mx-auto grid min-h-dvh w-full max-w-md content-center px-5 py-10">
      <section className="flex flex-col gap-5 rounded-xl border bg-card p-6 sm:p-8" aria-labelledby="login-title">
        <BrandMark />
        <h1 id="login-title" className="text-2xl font-bold tracking-tight">经营台登录</h1>
        {error ? <p role="alert" className="text-sm text-destructive">密码不对或尝试太频繁。</p> : null}
        <form action={loginAction} className="flex flex-col gap-3">
          <Label htmlFor="password">密码</Label>
          <Input id="password" name="password" type="password" required autoComplete="current-password" />
          <Button type="submit">登录</Button>
        </form>
      </section>
    </main>
  );
}
