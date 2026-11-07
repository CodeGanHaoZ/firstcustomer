import { T } from "@/components/ui-text";
import type React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTime, formatYuan } from "@/lib/format";
import type { OperatingMetrics } from "@/workflow/operating-metrics";

function Figure({ value, label, note, i }: { value: React.ReactNode; label: string; note?: React.ReactNode; i: number }) {
  return (
    <div className="tile rise bg-background" style={{ "--i": i } as React.CSSProperties}>
      <p className="tile__meta"><T>{label}</T></p>
      <p className="tile__value m-0">{value}</p>
      {note ? <p className="tile__meta">{note}</p> : null}
    </div>
  );
}

export function OperatingNumbers({ metrics }: { metrics: OperatingMetrics }) {
  return (
    <div className="grid gap-5">
      <Card>
        <CardHeader>
          <CardTitle><T>首客的服务经营</T></CardTitle>
          <CardDescription><T>统计首客向客户提供服务的订单、收款和成本。</T></CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 text-sm">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Figure i={0} label="确认收入" value={formatYuan(metrics.revenueFen)} note={<T>仅老板确认的外部客户实收</T>} />
            <Figure i={1} label="订单" value={metrics.orders} note={<><T>已报价 </T>{metrics.quoted}<T> · 已接受 </T>{metrics.accepted}<T> · 已付款 </T>{metrics.paid}<T> · 已验收 </T>{metrics.delivered}</>} />
            <Figure i={2} label="老板人工" value={<>{metrics.founderMinutes}<small className="ms-1 font-sans text-sm text-muted-foreground"><T>分钟</T></small></>} />
            <Figure i={3} label="模型标价费用" value={`¥${metrics.modelCost.toFixed(2)}`} note={<><T>{process.env.MODEL_COST_SPONSORED === "1" ? "（赛事赞助）" : ""}</T><T>{metrics.unpricedTasks ? ` · ${metrics.unpricedTasks} 个任务未计价` : ""}</T></>} />
          </div>
          <p className="notice m-0"><T>首客首笔服务实收　</T><T>{metrics.firstPaymentAt ? formatDateTime(new Date(metrics.firstPaymentAt)) : "待确认到账"}</T></p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle><T>客户项目的交付成效</T></CardTitle>
          <CardDescription><T>汇总客户产品验证页的访问和线索，供首客内部复盘。</T></CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 text-sm">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Figure i={0} label="独立访问" value={metrics.growth.visits} />
            <Figure i={1} label="CTA 点击" value={metrics.growth.ctaClicks} />
            <Figure i={2} label="有效留资" value={metrics.growth.leads} />
            <Figure i={3} label="回复和评论" value={metrics.growth.replies} />
          </div>
          <p className="notice m-0"><T>客户项目首条有效线索　</T><T>{metrics.firstLeadAt ? formatDateTime(new Date(metrics.firstLeadAt)) : "等待外部客户项目的有效线索"}</T></p>
          <p className="meta m-0"><T>客户产品成交　未知</T></p>
        </CardContent>
      </Card>
    </div>
  );
}
