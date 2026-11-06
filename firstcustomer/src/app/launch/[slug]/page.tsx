import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { PageContent } from "@/agents/schemas";
import { LandingView } from "@/components/landing-view";
import { VisitTracker } from "@/components/tracker";
import { getDb } from "@/db";
import { loadPublishedPage } from "@/workflow/queries";
import { submitLead } from "./actions";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<"/launch/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const data = await loadPublishedPage(getDb(), slug);
  if (!data) return {};
  return { title: (data.page.content as PageContent).headline };
}

export default async function LaunchPage({ params, searchParams }: PageProps<"/launch/[slug]">) {
  const { slug } = await params;
  const { submitted } = await searchParams;
  const data = await loadPublishedPage(getDb(), slug);
  if (!data) notFound();
  return (
    <>
      <VisitTracker slug={slug} />
      <LandingView
        content={data.page.content as PageContent}
        claims={data.claims}
        productName={data.project.productName}
        productUrl={data.project.productUrl}
        slug={slug}
        submitted={submitted === "1"}
        simulated={data.simulated}
        formAction={submitLead.bind(null, slug)}
      />
    </>
  );
}
