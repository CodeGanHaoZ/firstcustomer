import { and, eq } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "@/db";
import { projects } from "@/db/schema";
import { findProjectByToken } from "@/workflow/actions";
import { getCustomerSession } from "./customer-auth";

const accountPrefix = "account.";

export const accountProjectToken = (id: string) => `${accountPrefix}${id}`;
export const isAccountProjectToken = (token: string) => token.startsWith(accountPrefix);

export async function findCustomerProject(db: Db, token: string) {
  if (!isAccountProjectToken(token)) return findProjectByToken(db, token);

  const id = z.uuid().safeParse(token.slice(accountPrefix.length));
  if (!id.success) return null;
  const session = await getCustomerSession();
  if (!session) return null;

  const [project] = await db.select().from(projects)
    .where(and(eq(projects.id, id.data), eq(projects.customerId, session.user.id)));
  return project ?? null;
}
