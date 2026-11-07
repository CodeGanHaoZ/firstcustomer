import Link from "next/link";
import { ProjectIntake } from "@/components/project-intake";
import { requireAdmin } from "@/lib/auth";
import { createFounderProjectAction } from "./actions";

export const metadata = { title: "经营台新建项目", robots: { index: false, follow: false } };

export default async function NewFounderProjectPage({ searchParams }: PageProps<"/admin/projects/new">) {
  await requireAdmin();
  const { error } = await searchParams;
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-5 py-8 sm:px-6 sm:py-10">
      <Link href="/admin" className="self-start text-sm underline">返回办公室</Link>
      <h1 className="text-3xl font-bold tracking-tight">新建项目</h1>
      {error ? <p className="text-sm text-destructive">{String(error)}</p> : null}
      <ProjectIntake action={createFounderProjectAction} founder />
    </main>
  );
}
