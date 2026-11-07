import { getLocale } from "@/lib/locale-server";
import { translateUi } from "@/lib/ui-translation";
import { T } from "@/components/ui-text";
import Link from "next/link";
import { ProjectIntake } from "@/components/project-intake";
import { PageHead } from "@/components/site-chrome";
import { requireAdmin } from "@/lib/auth";
import { createFounderProjectAction } from "./actions";

export async function generateMetadata() {
  const locale = await getLocale();
  return { title: translateUi(locale, "经营台新建项目"), robots: { index: false, follow: false } };
}

export default async function NewFounderProjectPage({ searchParams }: PageProps<"/admin/projects/new">) {
  await requireAdmin();
  const { error } = await searchParams;
  return (
    <main className="site-main site-main--narrow">
      <PageHead eyebrow={<Link href="/admin" className="link-u"><T>返回办公室</T></Link>} title={<T>新建项目</T>}
        lead={<T>一句话说清产品，点选阶段和目标，就能开始。其余资料可以之后再补。</T>} />
      {error ? <p className="notice notice--fail" role="alert"><T>{String(error)}</T></p> : null}
      <ProjectIntake action={createFounderProjectAction} founder />
    </main>
  );
}
