import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { PageContent } from "@/agents/schemas";
import { LandingView } from "@/components/landing-view";
import { getDb } from "@/db";
import { findProjectByToken } from "@/workflow/actions";
import { hasVersionImage } from "@/workflow/landing-edits";
import { loadProjectView } from "@/workflow/queries";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { robots: { index: false, follow: false }, referrer: "no-referrer" };

export default async function CustomerPreviewPage({ params }: PageProps<"/p/[token]/preview">) {
  const { token } = await params;
  const db = getDb();
  const project = await findProjectByToken(db, token);
  if (!project) notFound();
  const view = await loadProjectView(db, project);
  if (!view.page) notFound();
  const hasImage = await hasVersionImage(db, view.page.id);
  return (
    <>
      <p className="bg-muted px-6 py-2 text-center text-sm">预览：页面还没有公开，表单不会提交。</p>
      <LandingView
        content={view.page.content as PageContent}
        claims={view.pageClaims.filter((c) => c.location === "page")}
        productName={project.productName}
        productUrl={project.productUrl}
        slug={view.page.slug}
        simulated={view.simulated}
        screenshotHref={hasImage ? `/p/${token}/preview/image` : undefined}
      />
    </>
  );
}
