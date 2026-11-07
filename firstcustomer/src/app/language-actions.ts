"use server";

import { cookies } from "next/headers";
import { z } from "zod";
import { LOCALE_COOKIE } from "@/lib/locale";

export async function changeLanguage(value: unknown) {
  const locale = z.enum(["zh", "en"]).parse(value);
  (await cookies()).set(LOCALE_COOKIE, locale, {
    path: "/", maxAge: 31_536_000, sameSite: "lax", httpOnly: true,
    secure: process.env.NODE_ENV === "production",
  });
}
