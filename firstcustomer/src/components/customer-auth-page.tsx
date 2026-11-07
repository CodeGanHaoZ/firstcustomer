import { ArrowLeft } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { BrandMark } from "@/components/brand-mark";
import { CustomerAuthForm } from "@/components/customer-auth-form";
import { getCustomerSession } from "@/lib/customer-auth";
import "@/app/editorial.css";

export async function CustomerAuthPage({ register = false }: { register?: boolean }) {
  if (await getCustomerSession()) redirect("/account");
  return (
    <>
      <header className="nav nav--static">
        <div className="nav__inner container">
          <Link href="/" className="nav__brand" aria-label="首客首页">
            <BrandMark />
          </Link>
          <div className="nav__actions">
            <Link href="/" className="btn btn--ghost btn--sm">
              <ArrowLeft size={14} aria-hidden="true" /> 返回主页
            </Link>
            <Link href={register ? "/login" : "/register"} className="btn btn--primary btn--sm">
              {register ? "登录" : "注册账号"}
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto grid min-h-dvh w-full max-w-[62rem] content-center gap-8 px-5 py-8 sm:px-8 sm:py-12">
        <div className="grid overflow-hidden rounded-2xl border bg-card md:grid-cols-[1fr_1.05fr]">
          <aside className="hidden flex-col items-center justify-center bg-[#f1e8d3] px-8 py-10 text-center md:flex">
            {/* 与首页首屏同源的 Lumi 动态形象：静音自动循环播放，动效减弱时停留在海报帧 */}
            <video
              className="h-auto w-[264px] rounded-full"
              width={264}
              height={264}
              src="/brand/lumi-welcome.mp4"
              poster="/brand/lumi-welcome-poster.webp"
              autoPlay
              muted
              loop
              playsInline
              disablePictureInPicture
              aria-hidden="true"
            >
              <Image src="/brand/lumi-welcome-poster.webp" alt="" width={264} height={264} unoptimized />
            </video>
            <p className="max-w-[17em] text-xl font-bold">回来看看你的出海项目</p>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">lumi 在首客办公室等你。</p>
          </aside>
          <section aria-labelledby="customer-auth-title" className="grid content-center gap-6 px-5 py-7 sm:px-9 sm:py-10 lg:px-12">
            <header>
              <h1 id="customer-auth-title" className="text-[1.8rem] leading-tight font-bold tracking-tight">{register ? "创建首客账号" : "登录首客"}</h1>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {register ? "把新提交的出海项目收在同一个账号里。" : "进入你的项目，查看初诊和交付进度。"}
              </p>
            </header>
            <CustomerAuthForm register={register} />
            <p className="border-t pt-4 text-sm text-muted-foreground">
              {register ? "已有账号？" : "第一次来首客？"}{" "}
              <Link href={register ? "/login" : "/register"} className="font-semibold text-foreground underline underline-offset-4">{register ? "登录" : "注册账号"}</Link>
            </p>
          </section>
        </div>
      </main>
    </>
  );
}
