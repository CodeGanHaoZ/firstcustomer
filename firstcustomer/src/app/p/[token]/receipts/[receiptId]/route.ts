import { notFound } from "next/navigation";
import { z } from "zod";
import { getDb } from "@/db";
import { findCustomerProject } from "@/lib/customer-project";
import { loadReceiptImage } from "@/workflow/commerce";
import { imageResponse } from "@/workflow/queries";

export async function GET(_request: Request, { params }: RouteContext<"/p/[token]/receipts/[receiptId]">) {
  const { token, receiptId } = await params;
  if (!z.uuid().safeParse(receiptId).success) notFound();
  const db = getDb();
  const project = await findCustomerProject(db, token);
  if (!project) notFound();
  const image = await loadReceiptImage(db, project.id, receiptId);
  if (!image) notFound();
  return imageResponse(image, "private, no-store");
}
