import { T } from "@/components/ui-text";
import { ArrowRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SiteHeader, SceneFooter } from "@/components/site-chrome";
import { CustomerAuthForm } from "@/components/customer-auth-form";
import { getCustomerSession } from "@/lib/customer-auth";
import { customerLandingPath, customerReturnTo } from "@/lib/auth-return";
import { getDb } from "@/db";
import { customerMembership } from "@/workflow/membership";

export async function CustomerAuthPage({ register = false, returnTo }: { register?: boolean; returnTo?: unknown }) {
  const next = customerReturnTo(returnTo);
  const alternate = `${register ? "/login" : "/register"}?next=${encodeURIComponent(next)}`;
  const session = await getCustomerSession();
  if (session) redirect(customerLandingPath(next, (await customerMembership(getDb(), session.user.id)).plan));
  return (
    <div className="site-shell">
      <SiteHeader current="auth" extra={
        <Link href={alternate} className="btn btn--primary btn--sm"><T>{register ? "登录" : "注册账号"}</T></Link>
      } />
      <main className="site-main grid content-center">
        <div className="auth-card rise">
          <aside className="auth-card__scene" aria-hidden="true">
            {/* 与首页首屏同源的 Lumi 动态形象：静音自动循环播放，动效减弱时停留在海报帧 */}
            <video
              className="auth-card__lumi"
              width={232}
              height={232}
              src="/brand/lumi-welcome.mp4"
              poster="/brand/lumi-welcome-poster.webp"
              autoPlay
              muted
              loop
              playsInline
              disablePictureInPicture
            >
              <Image src="/brand/lumi-welcome-poster.webp" alt="" width={232} height={232} unoptimized />
            </video>
            <p className="auth-card__quote"><T>回来看看你的出海项目</T></p>
          </aside>
          <section aria-labelledby="customer-auth-title" className="auth-card__form">
            <header>
              <p className="eyebrow">{register ? "Sign up" : "Sign in"}</p>
              <h1 id="customer-auth-title" className="page-head__title text-[clamp(1.9rem,3vw,2.5rem)]"><T>{register ? "创建首客账号" : "登录首客"}</T></h1>
            </header>
            <CustomerAuthForm register={register} returnTo={next} />
            <Link href="/account" className="btn btn--ghost w-full"><T>暂不登录，进入试用工作台</T><ArrowRight size={14} className="arw" aria-hidden="true" /></Link>
            <p className="meta border-t pt-4">
              <T>{register ? "已有账号？" : "第一次来首客？"}</T>{" "}
              <Link href={alternate} className="link-u font-semibold"><T>{register ? "登录" : "注册账号"}</T></Link>
            </p>
          </section>
        </div>
      </main>
      <SceneFooter low />
    </div>
  );
}
