import { getDb } from "@/db";
import { findCustomerProject } from "@/lib/customer-project";
import { imageResponse, loadProjectImage } from "@/workflow/queries";

export async function GET(_request: Request, context: RouteContext<"/p/[token]/images/[imageId]">) {
  const { token, imageId } = await context.params;
  const db = getDb();
  const project = await findCustomerProject(db, token);
  const image = project ? await loadProjectImage(db, project.id, imageId) : null;
  if (!image) return new Response(null, { status: 404 });
  return imageResponse(image);
}
