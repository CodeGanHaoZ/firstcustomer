import { getDb } from "@/db";
import { isAdmin } from "@/lib/auth";
import { imageResponse, loadProjectImage } from "@/workflow/queries";

export async function GET(_request: Request, context: RouteContext<"/admin/projects/[id]/images/[imageId]">) {
  if (!(await isAdmin())) return new Response(null, { status: 401 });
  const { id, imageId } = await context.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response(null, { status: 404 });
  const image = await loadProjectImage(getDb(), id, imageId);
  if (!image) return new Response(null, { status: 404 });
  return imageResponse(image);
}
