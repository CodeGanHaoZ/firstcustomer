import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { redirect } from "next/navigation";
import type { Db } from "@/db";
import { projects } from "@/db/schema";
import { findProjectByToken } from "@/workflow/actions";
import { getCustomerSession } from "./customer-auth";
import { customerReturnTo } from "./auth-return";
import { isAccountPro, isPurchasedPro } from "@/domain/workflow";

const accountPrefix = "account.";

export const accountProjectToken = (id: string) => `${accountPrefix}${id}`;
export const isAccountProjectToken = (token: string) => token.startsWith(accountPrefix);

export async function requireCustomerProjectSession(token: string) {
  if (isAccountProjectToken(token) && !(await getCustomerSession())) {
    redirect(`/login?next=${encodeURIComponent(customerReturnTo(`/p/${token}`))}`);
  }
}

export async function findCustomerProject(db: Db, token: string) {
  if (!isAccountProjectToken(token)) {
    const project = await findProjectByToken(db, token);
    if (project && (isAccountPro(project) || (isPurchasedPro(project) && project.customerId))) {
      const session = await getCustomerSession();
      return session?.user.id === project.customerId ? project : null;
    }
    return project;
  }

  const id = z.uuid().safeParse(token.slice(accountPrefix.length));
  if (!id.success) return null;
  const session = await getCustomerSession();
  if (!session) return null;

  const [project] = await db.select().from(projects)
    .where(and(eq(projects.id, id.data), eq(projects.customerId, session.user.id)));
  return project ?? null;
}
