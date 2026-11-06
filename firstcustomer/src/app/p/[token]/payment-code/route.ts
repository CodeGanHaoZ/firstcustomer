import { notFound } from "next/navigation";
import { getDb } from "@/db";
import { findProjectByToken } from "@/workflow/actions";
import { customerPaymentCode } from "@/workflow/commerce";
import { imageResponse } from "@/workflow/queries";

export async function GET(_request: Request, { params }: RouteContext<"/p/[token]/payment-code">) {
  const { token } = await params;
  const db = getDb();
  const project = await findProjectByToken(db, token);
  if (!project) notFound();
  const image = await customerPaymentCode(db, project.id);
  if (!image) notFound();
  return imageResponse(image, "private, no-store");
}
