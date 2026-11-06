import Link from "next/link";
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
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-16 px-6 py-20">
      <section className="flex flex-col items-start gap-6">
        <p className="text-sm text-muted-foreground">首客 FirstCustomer</p>
        <h1 className="text-4xl font-semibold tracking-tight">你的产品，第一批海外客户在哪里？</h1>
        <p className="text-lg text-muted-foreground">
          告诉首客你在做什么。MiMo AI 出海团队帮你研究市场、找到细分用户、准备英文发布和增长实验，用真实反馈决定下一步。
        </p>
        <Link href="/projects/new" className={buttonVariants()}>
          交给首客的 AI 出海团队
        </Link>
      </section>

      <section className="flex flex-col gap-4" aria-labelledby="office-demo-title">
        <div>
          <h2 id="office-demo-title" className="text-xl font-semibold">首客办公室 · 演示</h2>
          <p className="mt-1 text-sm text-muted-foreground">点开工位，看看每位员工负责什么。这里不会启动真实任务。</p>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {DEPARTMENTS.map((item, index) => {
            const staff = [[0, 0], [33.333, 0], [66.667, 0], [33.333, 100], [100, 0], [0, 100]][index];
            return (
              <details key={item.key} className="rounded-xl border border-[#d6c3a7] bg-[#fffaf0] px-3 pb-3 text-[#2d4132]">
                <summary className="cursor-pointer text-sm font-semibold">
                  <span aria-hidden="true" className="office-sprite mx-auto" style={{ backgroundPosition: `${staff[0]}% ${staff[1]}%` }} />
                  {item.room}
                </summary>
                <p className="mt-2 text-sm">{item.duty}。</p>
              </details>
            );
          })}
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-xl font-semibold">适合谁</h2>
        <p className="text-muted-foreground">
          已有可演示产品或 MVP，但还没有稳定海外用户的中国独立开发者和小团队。
        </p>
      </section>

      <section className="flex flex-col gap-4">
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
  );
}
