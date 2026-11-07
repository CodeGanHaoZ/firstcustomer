import Link from "next/link";
import { BrandMark } from "@/components/brand-mark";
import { ProjectIntake } from "@/components/project-intake";
import { createProjectAction } from "./actions";

export default async function NewProjectPage({ searchParams }: PageProps<"/projects/new">) {
  const { error } = await searchParams;
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-5 py-8 sm:px-6 sm:py-12">
      <Link href="/" className="self-start" aria-label="首客首页"><BrandMark /></Link>
      <header>
        <h1 className="text-3xl font-bold tracking-tight">新建出海项目</h1>
        <p className="mt-2 text-sm text-muted-foreground">提交后自动开始免费初诊，帮你整理候选人群和下一步待验证的问题。</p>
      </header>
      {error ? <p className="text-sm text-destructive">{String(error)}</p> : null}
      <ProjectIntake action={createProjectAction} />
    </main>
  );
}
