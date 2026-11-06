import { notFound } from "next/navigation";
import { getDb } from "@/db";
import { findProjectByToken } from "@/workflow/actions";
import { loadVersionImage, parseLandingVersion } from "@/workflow/landing-edits";
import { imageResponse } from "@/workflow/queries";

export async function GET(request: Request, { params }: RouteContext<"/p/[token]/preview/image">) {
  const { token } = await params;
  const version = parseLandingVersion(new URL(request.url).searchParams.getAll("version"));
  if (version === null) notFound();
  const db = getDb();
  const project = await findProjectByToken(db, token);
  if (!project) notFound();
  const image = await loadVersionImage(db, project.id, version);
  if (!image) notFound();
  return imageResponse(image, "private, no-store");
}
