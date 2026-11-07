import { getDb } from "@/db";
import { requireAdmin } from "@/lib/auth";
import { markdownArchive } from "@/lib/markdown-archive";
import { companyDocuments } from "@/workflow/company-context";

export async function GET() {
  await requireAdmin("company.manage", "/admin/context");
  const files = await companyDocuments(getDb());
  return new Response(markdownArchive(files), {
    headers: {
      "content-type": "application/zip",
      "content-disposition": 'attachment; filename="firstcustomer-context.zip"',
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff",
    },
  });
}
