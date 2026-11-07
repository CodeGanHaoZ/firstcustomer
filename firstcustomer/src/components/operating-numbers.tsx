import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTime, formatYuan } from "@/lib/format";
import type { OperatingMetrics } from "@/workflow/operating-metrics";

export function OperatingNumbers({ metrics }: { metrics: OperatingMetrics }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>首客的服务经营</CardTitle>
          <CardDescription>统计首客向客户提供服务的订单、收款和成本。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>确认收入 {formatYuan(metrics.revenueFen)} · 仅老板确认的外部客户实收</p>
          <p>订单 {metrics.orders} · 已报价 {metrics.quoted} · 已接受 {metrics.accepted} · 已付款 {metrics.paid} · 已验收 {metrics.delivered}</p>
          <p>首客首笔服务实收　{metrics.firstPaymentAt ? formatDateTime(new Date(metrics.firstPaymentAt)) : "待确认到账"}</p>
          <p>老板人工 {metrics.founderMinutes} 分钟</p>
          <p>模型标价费用 ¥{metrics.modelCost.toFixed(2)}{process.env.MODEL_COST_SPONSORED === "1" ? "（赛事赞助）" : ""}{metrics.unpricedTasks ? ` · ${metrics.unpricedTasks} 个任务未计价` : ""}</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>客户项目的交付成效</CardTitle>
          <CardDescription>汇总客户产品验证页的访问和线索，供首客内部复盘。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>独立访问 {metrics.growth.visits} · CTA 点击 {metrics.growth.ctaClicks}</p>
          <p>有效留资 {metrics.growth.leads} · 回复和评论 {metrics.growth.replies}</p>
          <p>客户项目首条有效线索　{metrics.firstLeadAt ? formatDateTime(new Date(metrics.firstLeadAt)) : "等待外部客户项目的有效线索"}</p>
          <p>客户产品成交　未知</p>
        </CardContent>
      </Card>
    </div>
  );
}
