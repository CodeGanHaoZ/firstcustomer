import { cookies } from "next/headers";
import { cache } from "react";
import { LOCALE_COOKIE, localeFrom } from "./locale";

export const getLocale = cache(async () => {
  return localeFrom((await cookies()).get(LOCALE_COOKIE)?.value);
});
