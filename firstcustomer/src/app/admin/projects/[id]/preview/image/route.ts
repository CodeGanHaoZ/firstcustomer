import { notFound } from "next/navigation";
import { z } from "zod";
import { getDb } from "@/db";
import { requireAdmin } from "@/lib/auth";
import { loadVersionImage } from "@/workflow/landing-edits";
import { imageResponse } from "@/workflow/queries";

export async function GET(_request: Request, { params }: RouteContext<"/admin/projects/[id]/preview/image">) {
  await requireAdmin();
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const image = await loadVersionImage(getDb(), id);
  if (!image) notFound();
  return imageResponse(image, "private, no-store");
}
