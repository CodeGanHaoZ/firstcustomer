"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

// Agent 运行时定时刷新，页面不用手动刷新也能看到进度。
export function AutoRefresh({ seconds = 3 }: { seconds?: number }) {
  const router = useRouter();
  useEffect(() => {
    const timer = setInterval(() => router.refresh(), seconds * 1000);
    return () => clearInterval(timer);
  }, [router, seconds]);
  return null;
}
