import { LumiProjectIntake } from "@/components/lumi-project-intake";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { hostedUploadLimit } from "@/lib/uploads";
import { createProjectAction } from "./actions";
import "./intake.css";

export default async function NewProjectPage({ searchParams }: PageProps<"/projects/new">) {
  const { error } = await searchParams;
  return (
    <div className="lumi-intake-shell">
      <SiteHeader current="new" />
      <main className="lumi-intake-page">
        <LumiProjectIntake action={createProjectAction} maxTotalBytes={hostedUploadLimit} serverError={error ? String(error) : undefined} />
      </main>
      <SiteFooter />
    </div>
  );
}
