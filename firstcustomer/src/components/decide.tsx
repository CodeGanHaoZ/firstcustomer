import { T } from "@/components/ui-text";
import { LocalizedTextarea } from "@/components/localized-controls";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";

/**
 * 确认 / 退回：默认只露出两个按钮，不用先填表。
 * 点「退回」才展开原因输入框；原因由服务端校验必填，这里不加 required，避免折叠时挡住「确认」。
 */
export function Decide({ action, approveLabel, rejectLabel, reasonLabel = "说说需要怎么改", hidden, approveDisabled = false, approveValue = "approve", rejectValue = "reject", reasonName = "reason", multiline = false, children }: {
  action: (formData: FormData) => void | Promise<void>;
  approveLabel: string;
  rejectLabel: string;
  reasonLabel?: string;
  hidden?: Record<string, string | number | undefined | null>;
  approveDisabled?: boolean;
  approveValue?: string;
  rejectValue?: string;
  reasonName?: string;
  multiline?: boolean;
  children?: ReactNode;
}) {
  return (
    <form action={action} className="decide">
      {Object.entries(hidden ?? {}).map(([name, value]) => value === undefined || value === null ? null : <input key={name} type="hidden" name={name} value={value} />)}
      {children}
      <div className="decide__row">
        <Button type="submit" name="verdict" value={approveValue} size="lg" disabled={approveDisabled}><T>{approveLabel}</T></Button>
        <details className="decide__more">
          <summary><T>{rejectLabel}</T></summary>
          <div className="decide__panel">
            <label className="text-sm font-medium" htmlFor={`${reasonName}-${approveValue}`}><T>{reasonLabel}</T></label>
            <LocalizedTextarea id={`${reasonName}-${approveValue}`} name={reasonName} maxLength={500} rows={multiline ? 4 : 2} placeholder="一两句话就好" />
            <div className="decide__row"><Button type="submit" name="verdict" value={rejectValue} variant="outline"><T>{`提交${rejectLabel}`}</T></Button></div>
          </div>
        </details>
      </div>
    </form>
  );
}
