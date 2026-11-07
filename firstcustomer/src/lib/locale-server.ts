import { cookies } from "next/headers";
import { LOCALE_COOKIE, localeFrom } from "./locale";

export async function getLocale() {
  return localeFrom((await cookies()).get(LOCALE_COOKIE)?.value);
}
