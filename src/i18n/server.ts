import "server-only";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { dictionaries, isLocale, LOCALE_COOKIE, type Locale } from "@/i18n";

export const getLocale = cache(async (): Promise<Locale> => {
  const jar = await cookies();
  const c = jar.get(LOCALE_COOKIE)?.value;
  if (isLocale(c)) return c;
  const accept = (await headers()).get("accept-language") ?? "";
  return /^bn\b/i.test(accept) ? "bn" : "en";
});

export async function getDictionary() {
  const locale = await getLocale();
  return { locale, t: dictionaries[locale] };
}
