import { ArrowDown } from "lucide-react";
import Link from "next/link";
import { BrandMark } from "@/components/brand-mark";
import { OfficeMap } from "@/components/office-map";
import { buttonVariants } from "@/components/ui/button";
import { DEPARTMENTS } from "@/domain/office";
import "./admin/office.css";

const STEPS = [
  ["免费初诊", "MiMo Agent 查公开反馈、竞品定价和反面证据，整理候选人群和待验证项。"],
  ["确认报价", "你先看提案、交付清单和报价。接受报价并由首客确认到账后，才开始正式服务。"],
  ["确认方向", "老板把关并推荐，你来确认先卖给谁、验证什么。"],
  ["英文页面", "生成真实可访问的英文验证页。事实声明没有证据，程序不让送审。"],
  ["真实发布", "你确认后执行一项推广实验，记录发布链接。"],
  ["数据复盘", "先看真实回复，再看访问和留资。样本不够就如实写样本不足。"],
];

const BOUNDARIES = [
  "不保证带来付费用户或收入",
  "不做群发私信、刷量或冒充用户",
  "没有数据就显示零，报名不算收入",
  "对外发布和预算支出都要你确认",
];

export default function Home() {
  return (
    <>
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-[74rem] flex-wrap items-center justify-between gap-3 px-5 py-4 sm:px-6">
          <Link href="/" aria-label="首客首页"><BrandMark /></Link>
          <nav className="flex items-center gap-4 text-sm font-medium sm:gap-6" aria-label="官网导航">
            <a href="#service-flow" className="hover:underline">服务流程</a>
            <Link href="/admin" prefetch={false} className="hover:underline">经营台</Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-[74rem] flex-col gap-12 px-5 py-10 sm:px-6 sm:py-14">
        <section className="grid items-center gap-7 lg:grid-cols-[.95fr_1fr] lg:gap-10">
          <div className="flex flex-col items-start gap-5">
            <h1 className="text-[2rem] leading-tight font-extrabold tracking-tight sm:text-4xl lg:text-5xl">
              你的产品，第一批<br className="hidden sm:block" />海外客户在哪里？
            </h1>
            <p className="max-w-prose leading-relaxed text-muted-foreground sm:text-lg">
              告诉首客你在做什么。MiMo AI 出海团队帮你研究市场、找到细分用户、准备英文发布和增长实验，用真实反馈决定下一步。
            </p>
            <Link href="/projects/new" className={buttonVariants({ size: "lg" })}>
              交给首客的 AI 出海团队
            </Link>
          </div>
          <figure>
            <div role="img" aria-label="首客的八位动物员工在同一间斜俯视办公室工作">
              <OfficeMap />
            </div>
            <figcaption className="mt-2 flex justify-end text-sm font-medium text-muted-foreground">
              <a className="inline-flex items-center gap-1 hover:underline" href="#office-demo-title">认识办公室的员工<ArrowDown size={14} aria-hidden="true" /></a>
            </figcaption>
          </figure>
        </section>

        <section className="flex flex-col gap-4 border-t pt-6" aria-labelledby="office-demo-title">
          <div>
            <h2 id="office-demo-title" className="text-xl font-bold">首客办公室 · 演示</h2>
            <p className="mt-1 text-sm text-muted-foreground">点开工位名称，看看每位员工负责什么。</p>
          </div>
          <div className="grid gap-x-6 sm:grid-cols-2 lg:grid-cols-3">
            {DEPARTMENTS.map((item) => (
              <details key={item.key} className="border-b py-3">
                <summary className="cursor-pointer text-sm font-semibold">{item.room}</summary>
                <p className="mt-2 text-sm text-muted-foreground">{item.duty}。</p>
              </details>
            ))}
          </div>
        </section>

        <section className="flex flex-col gap-4">
          <h2 className="text-xl font-semibold">适合谁</h2>
          <p className="text-muted-foreground">
            已有可演示产品或 MVP，但还没有稳定海外用户的中国独立开发者和小团队。
          </p>
        </section>

        <section id="service-flow" className="flex max-w-prose flex-col gap-4">
          <h2 className="text-xl font-semibold">服务流程</h2>
          <ol className="flex flex-col gap-3">
            {STEPS.map(([title, body], index) => (
              <li key={title} className="flex gap-3">
                <span className="w-6 shrink-0 text-muted-foreground">{index + 1}</span>
                <span>
                  <span className="font-medium">{title}：</span>
                  <span className="text-muted-foreground">{body}</span>
                </span>
              </li>
            ))}
          </ol>
        </section>

        <section className="flex flex-col gap-4">
          <h2 className="text-xl font-semibold">服务边界</h2>
          <ul className="flex list-disc flex-col gap-2 pl-5 text-muted-foreground">
            {BOUNDARIES.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>

        <section className="flex flex-col gap-2 text-sm text-muted-foreground">
          <p>首客启动包测试价 ¥299 / 次，具体报价以沟通结果为准。价格仍在验证中。</p>
          <p>我们只把你提交的信息用于交付和必要联系。{process.env.PRIVACY_CONTACT ? ` 联系方式 ${process.env.PRIVACY_CONTACT}。` : " 建立项目后可通过专属链接联系首客客服。"}</p>
        </section>
      </main>
    </>
  );
}
