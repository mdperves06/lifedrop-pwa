import en, { type Dictionary } from "./en";
import bn from "./bn";

export type Locale = "en" | "bn";
export const LOCALES: Locale[] = ["en", "bn"];
export const LOCALE_COOKIE = "ld_locale";
export const dictionaries: Record<Locale, Dictionary> = { en, bn };
export type { Dictionary };

export function isLocale(v: unknown): v is Locale {
  return v === "en" || v === "bn";
}

/** Replace {placeholders}. */
export function fmt(template: string, vars: Record<string, string | number> = {}) {
  return template.replace(/\{(\w+)\}/g, (_, k) => (k in vars ? String(vars[k]) : `{${k}}`));
}

const BN_DIGITS = "০১২৩৪৫৬৭৮৯";
export function localizeDigits(s: string | number, locale: Locale) {
  const str = String(s);
  return locale === "bn" ? str.replace(/\d/g, (d) => BN_DIGITS[+d]) : str;
}

export function formatNumber(n: number, locale: Locale) {
  return new Intl.NumberFormat(locale === "bn" ? "bn-BD" : "en-US").format(n);
}
