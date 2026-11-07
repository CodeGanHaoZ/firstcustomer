import type { Metadata } from "next";
import { CustomerAuthPage } from "@/components/customer-auth-page";

export const metadata: Metadata = { title: "登录首客 · HiFirst" };

export default function LoginPage() {
  return <CustomerAuthPage />;
}
