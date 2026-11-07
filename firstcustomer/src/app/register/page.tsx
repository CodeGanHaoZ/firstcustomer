import type { Metadata } from "next";
import { CustomerAuthPage } from "@/components/customer-auth-page";

export const metadata: Metadata = { title: "注册首客 · HiFirst" };

export default function RegisterPage() {
  return <CustomerAuthPage register />;
}
