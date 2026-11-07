import { LocalizedTextarea, LocalizedInput } from "@/components/localized-controls";
import { T } from "@/components/ui-text";
import { ImageUploadInput } from "@/components/image-upload-input";
import { ProjectDraftForm } from "@/components/project-draft";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { hostedUploadLimit } from "@/lib/uploads";

const selectClass = "h-9 rounded-md border bg-background px-3 text-sm";

export function ProjectIntake({ action, founder = false }: {
  action: (formData: FormData) => Promise<void>;
  founder?: boolean;
}) {
  return (
      <ProjectDraftForm action={action} intake={founder ? "admin" : "public"}>
        <div className="hidden" aria-hidden>
          <Label htmlFor="website"><T>网站</T></Label>
          <Input id="website" name="website" tabIndex={-1} autoComplete="off" />
        </div>
        <div className="flex flex-col gap-2 sm:col-span-2">
          <Label htmlFor="productName"><T>产品名称或想法</T></Label>
          <LocalizedTextarea id="productName" name="productName" required maxLength={500} placeholder="一两句话即可" />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="productUrl"><T>产品网址（选填）</T></Label>
          <Input id="productUrl" name="productUrl" type="url" placeholder="https://" />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="stage"><T>当前阶段</T></Label>
          <select id="stage" name="stage" required className={selectClass} defaultValue="已有 MVP">
            <option value={"没有产品"}><T>没有产品</T></option>
            <option value={"有想法"}><T>有想法</T></option>
            <option value={"已有 MVP"}><T>已有 MVP</T></option>
            <option value={"已上线"}><T>已上线</T></option>
          </select>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="targetMarket"><T>希望进入的市场（选填）</T></Label>
          <LocalizedInput id="targetMarket" name="targetMarket" placeholder="不填则请 AI 帮你判断" maxLength={200} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="goal"><T>当前最想解决的事</T></Label>
          <select id="goal" name="goal" required className={selectClass} defaultValue="找首批用户">
            <option value={"找需求"}><T>找需求</T></option>
            <option value={"验证"}><T>验证</T></option>
            <option value={"找首批用户"}><T>找首批用户</T></option>
            <option value={"提升转化"}><T>提升转化</T></option>
          </select>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="budgetNote"><T>预算和时间（选填）</T></Label>
          <Input id="budgetNote" name="budgetNote" maxLength={200} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="contact"><T>联系方式</T></Label>
          <LocalizedInput id="contact" name="contact" required maxLength={200} placeholder="微信或邮箱，用于交付与必要联系" />
        </div>
        {([ ["currentWorkflow", "现行做法"], ["successCriteria", "希望验证的结果"], ["constraints", "限制条件"] ] as const).map(([name, label]) => <div key={name} className="flex flex-col gap-2 sm:col-span-2"><Label htmlFor={name}><T>{label}</T><T>（选填）</T></Label><Textarea id={name} name={name} maxLength={1000} /></div>)}
        <div className="flex min-w-0 flex-col gap-2 sm:col-span-2">
          <Label htmlFor="screenshots"><T>产品截图（选填，最多 3 张，</T><T>{hostedUploadLimit ? "合计不超过 4 MB" : "每张不超过 5 MB"}</T>）</Label>
          <ImageUploadInput id="screenshots" name="screenshots" multiple maxTotalBytes={hostedUploadLimit} />
        </div>
        {founder ? <label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" name="own" value="1" /><T> 这是首客自有产品</T></label> : null}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 sm:col-span-2">
          <Button type="submit"><T>提交项目</T></Button>
          <p className="text-sm text-muted-foreground">
            <T>{founder ? "提交后进入内部项目详情，可从那里取得客户专属链接。" : "提交后会打开你的客户项目工作台。"}</T><T>文本草稿保存在此浏览器。
          </T></p>
        </div>
      </ProjectDraftForm>
  );
}
