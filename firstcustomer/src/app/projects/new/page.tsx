import Link from "next/link";
import { BrandMark } from "@/components/brand-mark";
import { LumiProjectIntake } from "@/components/lumi-project-intake";
import { hostedUploadLimit } from "@/lib/uploads";
import { createProjectAction } from "./actions";
import "./intake.css";

export default async function NewProjectPage({ searchParams }: PageProps<"/projects/new">) {
  const { error } = await searchParams;
  return (
    <main className="lumi-intake-page">
      <nav className="lumi-intake-nav" aria-label="项目登记导航"><Link href="/" aria-label="首客首页"><BrandMark /></Link><Link href="/">返回首页</Link></nav>
      <LumiProjectIntake action={createProjectAction} maxTotalBytes={hostedUploadLimit} serverError={error ? String(error) : undefined} />
    </main>
  );
}
