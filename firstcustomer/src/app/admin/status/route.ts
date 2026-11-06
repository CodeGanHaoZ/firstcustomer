import { getDb } from "@/db";
import { isAdmin } from "@/lib/auth";
import { officeRevision } from "@/workflow/office";

export async function GET() {
  if (!(await isAdmin())) return new Response(null, { status: 401 });
  const revision = await officeRevision(getDb());
  return Response.json({ revision, at: new Date().toISOString() }, { headers: { "cache-control": "private, no-store" } });
}
