import { T } from "@/components/ui-text";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTime, formatYuan } from "@/lib/format";
import type { OperatingMetrics } from "@/workflow/operating-metrics";

export function OperatingNumbers({ metrics }: { metrics: OperatingMetrics }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle><T>首客的服务经营</T></CardTitle>
          <CardDescription><T>统计首客向客户提供服务的订单、收款和成本。</T></CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p><T>确认收入 </T>{formatYuan(metrics.revenueFen)}<T> · 仅老板确认的外部客户实收</T></p>
          <p><T>订单 </T>{metrics.orders}<T> · 已报价 </T>{metrics.quoted}<T> · 已接受 </T>{metrics.accepted}<T> · 已付款 </T>{metrics.paid}<T> · 已验收 </T>{metrics.delivered}</p>
          <p><T>首客首笔服务实收　</T><T>{metrics.firstPaymentAt ? formatDateTime(new Date(metrics.firstPaymentAt)) : "待确认到账"}</T></p>
          <p><T>老板人工 </T>{metrics.founderMinutes}<T> 分钟</T></p>
          <p><T>模型标价费用 ¥</T>{metrics.modelCost.toFixed(2)}<T>{process.env.MODEL_COST_SPONSORED === "1" ? "（赛事赞助）" : ""}</T><T>{metrics.unpricedTasks ? ` · ${metrics.unpricedTasks} 个任务未计价` : ""}</T></p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle><T>客户项目的交付成效</T></CardTitle>
          <CardDescription><T>汇总客户产品验证页的访问和线索，供首客内部复盘。</T></CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p><T>独立访问 </T>{metrics.growth.visits}<T> · CTA 点击 </T>{metrics.growth.ctaClicks}</p>
          <p><T>有效留资 </T>{metrics.growth.leads}<T> · 回复和评论 </T>{metrics.growth.replies}</p>
          <p><T>客户项目首条有效线索　</T><T>{metrics.firstLeadAt ? formatDateTime(new Date(metrics.firstLeadAt)) : "等待外部客户项目的有效线索"}</T></p>
          <p><T>客户产品成交　未知</T></p>
        </CardContent>
      </Card>
    </div>
  );
}
