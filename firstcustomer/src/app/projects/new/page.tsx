import { LocalizedLink } from "@/components/localized-controls";
import { T, I18n } from "@/components/ui-text";
import Link from "next/link";
import { LanguageSwitch } from "@/components/language-switch";
import { BrandMark } from "@/components/brand-mark";
import { LumiProjectIntake } from "@/components/lumi-project-intake";
import { hostedUploadLimit } from "@/lib/uploads";
import { createProjectAction } from "./actions";
import "./intake.css";

export default async function NewProjectPage({ searchParams }: PageProps<"/projects/new">) {
  const { error } = await searchParams;
  return (
    <main className="lumi-intake-page">
      <I18n><nav className="lumi-intake-nav" aria-label="项目登记导航"><LocalizedLink href="/" aria-label="首客首页"><BrandMark /></LocalizedLink><div className="flex flex-wrap items-center justify-end gap-4"><LanguageSwitch /><Link href="/"><T>返回首页</T></Link></div></nav></I18n>
      <LumiProjectIntake action={createProjectAction} maxTotalBytes={hostedUploadLimit} serverError={error ? String(error) : undefined} />
    </main>
  );
}
