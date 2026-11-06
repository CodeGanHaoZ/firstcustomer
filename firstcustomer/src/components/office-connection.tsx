"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

const time = new Intl.DateTimeFormat("zh-CN", {
  hour: "2-digit", minute: "2-digit", timeZone: "Asia/Shanghai", hour12: false,
});

export function OfficeConnection({ revision, updatedAt }: { revision: string; updatedAt: string }) {
  const router = useRouter();
  const seen = useRef(revision);
  const [connection, setConnection] = useState({ online: true, at: updatedAt });
  useEffect(() => {
    seen.current = revision;
  }, [revision]);

  useEffect(() => {
    let stopped = false;
    let timer: number | undefined;
    let current: AbortController | undefined;
    const check = async () => {
      current?.abort();
      const request = new AbortController();
      current = request;
      const timeout = window.setTimeout(() => request.abort("timeout"), 4000);
      try {
        const response = await fetch("/admin/status", { signal: request.signal, cache: "no-store" });
        if (!response.ok) throw new Error("无法连接经营台");
        const data: { revision: string; at: string } = await response.json();
        if (stopped || current !== request) return;
        setConnection({ online: true, at: data.at });
        if (data.revision !== seen.current) {
          seen.current = data.revision;
          router.refresh();
        }
      } catch {
        if (!stopped && current === request) setConnection((previous) => ({ ...previous, online: false }));
      } finally {
        window.clearTimeout(timeout);
        if (!stopped && current === request) timer = window.setTimeout(check, 6000);
      }
    };
    const offline = () => setConnection((previous) => ({ ...previous, online: false }));
    const online = () => {
      window.clearTimeout(timer);
      void check();
    };
    window.addEventListener("offline", offline);
    window.addEventListener("online", online);
    timer = window.setTimeout(check, 3000);
    return () => {
      stopped = true;
      current?.abort();
      window.clearTimeout(timer);
      window.removeEventListener("offline", offline);
      window.removeEventListener("online", online);
    };
  }, [router]);

  return (
    <p role="status" className="office-connection" data-offline={!connection.online}>
      <span aria-hidden="true" />
      {connection.online ? "经营台已连接" : "连接中断"} · 上次更新 {time.format(new Date(connection.at))}
    </p>
  );
}
