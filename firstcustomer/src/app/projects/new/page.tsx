import { ProjectIntake } from "@/components/project-intake";
import { createProjectAction } from "./actions";

export default async function NewProjectPage({ searchParams }: PageProps<"/projects/new">) {
  const { error } = await searchParams;
  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-6 px-6 py-12">
      <h1 className="text-2xl font-semibold">新建出海项目</h1>
      {error ? <p className="text-sm text-destructive">{String(error)}</p> : null}
      <ProjectIntake action={createProjectAction} />
    </main>
  );
}
