import { eq } from "drizzle-orm";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { PageContent } from "@/agents/schemas";
import { LandingPreviewBar, LandingView } from "@/components/landing-view";
import { getDb } from "@/db";
import { projects } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { parseLandingVersion } from "@/workflow/landing-edits";
import { loadLandingPreview } from "@/workflow/queries";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false, follow: false }, referrer: "no-referrer" };

export default async function AdminPreviewPage({ params, searchParams }: PageProps<"/admin/projects/[id]/preview">) {
  await requireAdmin();
  const [{ id }, { version: rawVersion }] = await Promise.all([params, searchParams]);
  const version = parseLandingVersion(rawVersion);
  if (!/^[0-9a-f-]{36}$/i.test(id) || version === null) notFound();
  const db = getDb();
  const [project] = await db.select().from(projects).where(eq(projects.id, id));
  if (!project) notFound();
  const preview = await loadLandingPreview(db, project.id, version);
  if (!preview) notFound();
  const { page, claims, simulated, hasImage } = preview;
  return (
    <>
      <LandingPreviewBar returnHref={`/admin/projects/${id}`} version={page.version} published={page.status === "published"} />
      <LandingView
        content={page.content as PageContent}
        claims={claims}
        productName={project.productName}
        productUrl={project.productUrl}
        slug={page.slug}
        simulated={simulated}
        screenshotHref={hasImage ? `/admin/projects/${id}/preview/image?version=${page.version}` : undefined}
      />
    </>
  );
}
