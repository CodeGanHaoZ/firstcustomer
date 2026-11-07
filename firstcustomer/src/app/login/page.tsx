import { getLocale } from "@/lib/locale-server";
import { translateUi } from "@/lib/ui-translation";
import type { Metadata } from "next";
import { CustomerAuthPage } from "@/components/customer-auth-page";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return { title: translateUi(locale, "登录首客 · HiFirst") };
}

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  return <CustomerAuthPage returnTo={(await searchParams).next} />;
}
