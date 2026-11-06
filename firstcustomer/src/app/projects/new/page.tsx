import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createProjectAction } from "./actions";

const selectClass = "h-9 rounded-md border bg-background px-3 text-sm";

export default async function NewProjectPage({ searchParams }: PageProps<"/projects/new">) {
  const { error } = await searchParams;
  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-6 px-6 py-16">
      <h1 className="text-2xl font-semibold">新建出海项目</h1>
      {error ? <p className="text-sm text-destructive">{String(error)}</p> : null}
      <form action={createProjectAction} className="flex flex-col gap-4">
        <div className="hidden" aria-hidden>
          <Label htmlFor="website">网站</Label>
          <Input id="website" name="website" tabIndex={-1} autoComplete="off" />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="stage">当前阶段</Label>
          <select id="stage" name="stage" required className={selectClass} defaultValue="已有 MVP">
            <option>没有产品</option>
            <option>有想法</option>
            <option>已有 MVP</option>
            <option>已上线</option>
          </select>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="productName">产品名称或想法</Label>
          <Textarea id="productName" name="productName" required maxLength={500} placeholder="一两句话即可" />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="productUrl">产品网址（选填）</Label>
          <Input id="productUrl" name="productUrl" type="url" placeholder="https://" />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="targetMarket">希望进入的市场（选填）</Label>
          <Input id="targetMarket" name="targetMarket" placeholder="不填则请 AI 帮你判断" maxLength={200} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="goal">当前最想解决的事</Label>
          <select id="goal" name="goal" required className={selectClass} defaultValue="找首批用户">
            <option>找需求</option>
            <option>验证</option>
            <option>找首批用户</option>
            <option>提升转化</option>
          </select>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="budgetNote">预算和时间（选填）</Label>
          <Input id="budgetNote" name="budgetNote" maxLength={200} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="contact">联系方式</Label>
          <Input id="contact" name="contact" required maxLength={200} placeholder="微信或邮箱，用于交付与必要联系" />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="screenshots">产品截图（选填，最多 3 张，每张不超过 5 MB）</Label>
          <Input id="screenshots" name="screenshots" type="file" multiple accept="image/png,image/jpeg,image/webp" />
        </div>
        <Button type="submit" className="self-start">
          提交项目
        </Button>
        <p className="text-sm text-muted-foreground">
          提交后会生成项目专属链接，请保存好。老板确认后才会开始研究。
        </p>
      </form>
    </main>
  );
}
