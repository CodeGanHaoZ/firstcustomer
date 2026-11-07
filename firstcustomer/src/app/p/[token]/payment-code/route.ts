import { notFound } from "next/navigation";
import { getDb } from "@/db";
import { findCustomerProject } from "@/lib/customer-project";
import { customerPaymentCode } from "@/workflow/commerce";
import { imageResponse } from "@/workflow/queries";

export async function GET(_request: Request, { params }: RouteContext<"/p/[token]/payment-code">) {
  const { token } = await params;
  const db = getDb();
  const project = await findCustomerProject(db, token);
  if (!project) notFound();
  const image = await customerPaymentCode(db, project.id);
  if (!image) notFound();
  return imageResponse(image, "private, no-store");
}
