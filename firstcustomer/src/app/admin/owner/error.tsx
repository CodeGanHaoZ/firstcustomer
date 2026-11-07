"use client";

import { Button } from "@/components/ui/button";
import { T } from "@/components/ui-text";

export default function OwnerError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main className="admin-section"><h1 className="font-serif text-3xl"><T>暂时无法读取经营数据</T></h1>
    <p role="alert"><T>请重试；若仍失败，请检查数据库连接与迁移状态。</T></p>
    <div><Button onClick={reset}><T>重新加载</T></Button></div></main>;
}
