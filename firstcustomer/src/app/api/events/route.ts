import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/db";
import { events, landingPages } from "@/db/schema";
import { hasAdminSession } from "@/lib/auth";
import { visitorHash, withinLimit } from "@/lib/request";

const BOT_PATTERN = /bot|crawl|spider|slurp|preview|headless|lighthouse|monitor|curl|wget|python-requests|node-fetch/i;

const schema = z.object({
  slug: z.string().max(100),
  type: z.enum(["visit", "cta_click"]),
});

export async function POST(request: Request) {
  if (!(await withinLimit("events", 60, 60))) {
    return new NextResponse(null, { status: 429 });
  }
  if (BOT_PATTERN.test(request.headers.get("user-agent") ?? "") || (await hasAdminSession())) {
    return new NextResponse(null, { status: 204 });
  }
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return new NextResponse(null, { status: 400 });

  const db = getDb();
  const [page] = await db
    .select({ id: landingPages.id })
    .from(landingPages)
    .where(and(eq(landingPages.slug, parsed.data.slug), eq(landingPages.status, "published")));
  if (!page) return new NextResponse(null, { status: 404 });

  await db.insert(events).values({
    landingPageId: page.id,
    type: parsed.data.type,
    visitorHash: await visitorHash(),
  });
  return new NextResponse(null, { status: 204 });
}
