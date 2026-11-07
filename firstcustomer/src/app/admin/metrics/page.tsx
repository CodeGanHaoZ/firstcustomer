import type { Metadata } from "next";
import { OperatingNumbers } from "@/components/operating-numbers";
import { getDb } from "@/db";
import { requireAdmin } from "@/lib/auth";
import { operatingMetrics } from "@/workflow/operating-metrics";

export const metadata: Metadata = { title: "首客内部经营报表", robots: { index: false, follow: false } };

export default async function MetricsPage() {
  await requireAdmin();
  const metrics = await operatingMetrics(getDb());
  return (
    <main className="admin-section max-w-5xl">
      <header className="admin-section-heading">
        <div>
          <h1>首客内部经营报表</h1>
          <p>首客服务的实际收款和客户项目的获客成效分别统计。</p>
        </div>
      </header>
      <OperatingNumbers metrics={metrics} />
    </main>
  );
}
