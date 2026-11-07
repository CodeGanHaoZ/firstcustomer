import { T } from "@/components/ui-text";
import { ArrowRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SiteHeader, SceneFooter } from "@/components/site-chrome";
import { CustomerAuthForm } from "@/components/customer-auth-form";
import { getCustomerSession } from "@/lib/customer-auth";

export async function CustomerAuthPage({ register = false }: { register?: boolean }) {
  if (await getCustomerSession()) redirect("/account");
  return (
    <div className="site-shell">
      <SiteHeader current="auth" extra={
        <Link href={register ? "/login" : "/register"} className="btn btn--primary btn--sm"><T>{register ? "登录" : "注册账号"}</T></Link>
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
            <p className="meta"><T>lumi 在首客办公室等你。</T></p>
          </aside>
          <section aria-labelledby="customer-auth-title" className="auth-card__form">
            <header>
              <p className="eyebrow">{register ? "Sign up" : "Sign in"}</p>
              <h1 id="customer-auth-title" className="page-head__title text-[clamp(1.9rem,3vw,2.5rem)]"><T>{register ? "创建首客账号" : "登录首客"}</T></h1>
              <p className="page-head__lead text-[0.9375rem]">
                <T>{register ? "注册后，当前浏览器的试用项目会保存到账号。" : "登录后，可保存本浏览器的试用项目，并在不同设备继续。"}</T>
              </p>
            </header>
            <CustomerAuthForm register={register} />
            <Link href="/account" className="btn btn--ghost w-full"><T>暂不登录，进入试用工作台</T><ArrowRight size={14} className="arw" aria-hidden="true" /></Link>
            <p className="meta border-t pt-4">
              <T>{register ? "已有账号？" : "第一次来首客？"}</T>{" "}
              <Link href={register ? "/login" : "/register"} className="link-u font-semibold"><T>{register ? "登录" : "注册账号"}</T></Link>
            </p>
          </section>
        </div>
      </main>
      <SceneFooter low />
    </div>
  );
}
