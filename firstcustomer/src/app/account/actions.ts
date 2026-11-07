"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getCustomerAuth } from "@/lib/customer-auth";

export async function signOutAction() {
  await getCustomerAuth().api.signOut({ headers: await headers() });
  redirect("/");
}
