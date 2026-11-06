import { notFound } from "next/navigation";
import { z } from "zod";
import { getDb } from "@/db";
import { requireAdmin } from "@/lib/auth";
import { loadVersionImage, parseLandingVersion } from "@/workflow/landing-edits";
import { imageResponse } from "@/workflow/queries";

export async function GET(request: Request, { params }: RouteContext<"/admin/projects/[id]/preview/image">) {
  await requireAdmin();
  const { id } = await params;
  const version = parseLandingVersion(new URL(request.url).searchParams.getAll("version"));
  if (!z.uuid().safeParse(id).success || version === null) notFound();
  const image = await loadVersionImage(getDb(), id, version);
  if (!image) notFound();
  return imageResponse(image, "private, no-store");
}
