import { notFound } from "next/navigation";
import { getDb } from "@/db";
import { loadPublicVersionImage } from "@/workflow/landing-edits";
import { imageResponse } from "@/workflow/queries";

export async function GET(_request: Request, { params }: RouteContext<"/launch/[slug]/image">) {
  const { slug } = await params;
  const image = await loadPublicVersionImage(getDb(), slug);
  if (!image) notFound();
  return imageResponse(image, "no-store");
}
