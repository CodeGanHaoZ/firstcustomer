import { notFound } from "next/navigation";
import { getDb } from "@/db";
import { findProjectByToken } from "@/workflow/actions";
import { loadVersionImage } from "@/workflow/landing-edits";
import { imageResponse } from "@/workflow/queries";

export async function GET(_request: Request, { params }: RouteContext<"/p/[token]/preview/image">) {
  const { token } = await params;
  const db = getDb();
  const project = await findProjectByToken(db, token);
  if (!project) notFound();
  const image = await loadVersionImage(db, project.id);
  if (!image) notFound();
  return imageResponse(image, "private, no-store");
}
