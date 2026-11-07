"use client";

import { createAuthClient } from "better-auth/react";
import { Eye, EyeOff } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const auth = createAuthClient();

export function CustomerAuthForm({ register }: { register: boolean }) {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const data = new FormData(event.currentTarget);
    const email = String(data.get("email") ?? "").trim().toLowerCase();
    const password = String(data.get("password") ?? "");
    const name = String(data.get("name") ?? "").trim();
    if (register && !name) {
      setError("请填写你的称呼。");
      return;
    }

    setPending(true);
    setError("");
    try {
      const result = register
        ? await auth.signUp.email({ email, password, name })
        : await auth.signIn.email({ email, password });
      if (result.error) {
        if (result.error.status === 429) setError("尝试次数过多，请稍后再试。");
        else if (result.error.status >= 500) setError("暂时连不上账号服务，请稍后再试。");
        else setError(register ? "暂时无法注册。若邮箱已注册，请直接登录。" : "邮箱或密码不正确，请再试一次。");
        setPending(false);
        return;
      }
      router.replace("/account");
      router.refresh();
    } catch {
      setError("暂时连不上账号服务，请稍后再试。");
      setPending(false);
    }
  }

  return (
    <form className="grid gap-4" method="post" onSubmit={submit}>
      {register && <div className="grid gap-2">
        <Label htmlFor="name">称呼</Label>
        <Input className="h-11" id="name" name="name" autoComplete="name" required maxLength={60} />
      </div>}
      <div className="grid gap-2">
        <Label htmlFor="email">邮箱</Label>
        <Input className="h-11" id="email" name="email" type="email" autoComplete="email" required maxLength={254} />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="password">密码</Label>
        <div className="relative">
          <Input className="h-11 pe-12" id="password" name="password" type={showPassword ? "text" : "password"}
            autoComplete={register ? "new-password" : "current-password"} required minLength={register ? 10 : undefined}
            maxLength={128} aria-describedby={register ? "password-hint" : undefined} />
          <button className="absolute inset-y-0 end-0 grid w-11 cursor-pointer place-items-center rounded-e-lg text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring" type="button"
            onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? "隐藏密码" : "显示密码"}>
            {showPassword ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
          </button>
        </div>
        {register && <p className="text-xs text-muted-foreground" id="password-hint">至少 10 个字符。</p>}
      </div>
      {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
      <Button type="submit" size="lg" className="mt-1 h-11" disabled={pending}>
        {pending ? (register ? "正在创建账号…" : "正在登录…") : (register ? "创建账号" : "登录")}
      </Button>
    </form>
  );
}
