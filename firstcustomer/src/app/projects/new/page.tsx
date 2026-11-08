import { LumiProjectIntake } from "@/components/lumi-project-intake";
import { SceneFooter, SiteHeader } from "@/components/site-chrome";
import { hostedUploadLimit } from "@/lib/uploads";
import { createProjectAction } from "./actions";
import "./intake.css";
import "../../admin/office.css";
import "../../workspace.css";

export default async function NewProjectPage({ searchParams }: PageProps<"/projects/new">) {
  const { error, url, brand } = await searchParams;
  const initialUrl = typeof url === "string" ? url.trim().slice(0, 2048) : "";
  const initialBrand = typeof brand === "string" ? brand.trim().slice(0, 500) : "";
  return (
    <div className="lumi-intake-shell">
      <SiteHeader current="new" />
      <main className="lumi-intake-page">
        <LumiProjectIntake action={createProjectAction} maxTotalBytes={hostedUploadLimit} serverError={error ? String(error) : undefined} initialUrl={initialUrl} initialBrand={initialBrand} attachmentTier="free" />
      </main>
      <SceneFooter />
    </div>
  );
}
