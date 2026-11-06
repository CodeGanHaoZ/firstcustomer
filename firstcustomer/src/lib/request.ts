import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { RateLimiterMemory } from "rate-limiter-flexible";

const limiters = new Map<string, RateLimiterMemory>();

export async function clientIp() {
  const list = await headers();
  return list.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
}

// 单台 VPS 只有一个 Web 进程，内存限流就够用。
export async function withinLimit(name: string, points: number, seconds: number) {
  let limiter = limiters.get(name);
  if (!limiter) {
    limiter = new RateLimiterMemory({ points, duration: seconds });
    limiters.set(name, limiter);
  }
  try {
    await limiter.consume(await clientIp());
    return true;
  } catch {
    return false;
  }
}

export async function visitorHash() {
  const list = await headers();
  const day = new Date().toISOString().slice(0, 10);
  return createHash("sha256")
    .update(`${process.env.SESSION_SECRET}|${await clientIp()}|${list.get("user-agent")}|${day}`)
    .digest("hex");
}

export function safeHref(url: string | null | undefined) {
  if (!url) return undefined;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed.toString() : undefined;
  } catch {
    return undefined;
  }
}
