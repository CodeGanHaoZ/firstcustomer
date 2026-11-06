import { notFound } from "next/navigation";
import { z } from "zod";
import { getDb } from "@/db";
import { requireAdmin } from "@/lib/auth";
import { loadReceiptImage } from "@/workflow/commerce";
import { imageResponse } from "@/workflow/queries";

export async function GET(_request: Request, { params }: RouteContext<"/admin/projects/[id]/receipts/[receiptId]">) {
  await requireAdmin();
  const { id, receiptId } = await params;
  if (!z.uuid().safeParse(id).success || !z.uuid().safeParse(receiptId).success) notFound();
  const image = await loadReceiptImage(getDb(), id, receiptId);
  if (!image) notFound();
  return imageResponse(image, "private, no-store");
}
