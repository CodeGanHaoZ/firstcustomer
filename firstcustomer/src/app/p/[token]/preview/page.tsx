import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { PageContent } from "@/agents/schemas";
import { LandingPreviewBar, LandingView } from "@/components/landing-view";
import { getDb } from "@/db";
import { findProjectByToken } from "@/workflow/actions";
import { parseLandingVersion } from "@/workflow/landing-edits";
import { loadLandingPreview } from "@/workflow/queries";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { robots: { index: false, follow: false }, referrer: "no-referrer" };

export default async function CustomerPreviewPage({ params, searchParams }: PageProps<"/p/[token]/preview">) {
  const [{ token }, { version: rawVersion }] = await Promise.all([params, searchParams]);
  const version = parseLandingVersion(rawVersion);
  if (version === null) notFound();
  const db = getDb();
  const project = await findProjectByToken(db, token);
  if (!project) notFound();
  const preview = await loadLandingPreview(db, project.id, version);
  if (!preview) notFound();
  const { page, claims, simulated, hasImage } = preview;
  return (
    <>
      <LandingPreviewBar returnHref={`/p/${token}`} version={page.version} published={page.status === "published"} />
      <LandingView
        content={page.content as PageContent}
        claims={claims}
        productName={project.productName}
        productUrl={project.productUrl}
        slug={page.slug}
        simulated={simulated}
        screenshotHref={hasImage ? `/p/${token}/preview/image?version=${page.version}` : undefined}
      />
    </>
  );
}
