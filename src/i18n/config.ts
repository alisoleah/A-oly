/**
 * i18n configuration — the single source of truth for locales.
 *
 * Homegrown (no next-intl): the app has exactly two locales (en, ar), so a
 * lightweight switch + provider is simpler than a 40KB dependency and keeps the
 * build clean (CLAUDE.md: no unapproved deps).
 */

export const locales = ["en", "ar"] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "en";

/** Runtime check: is this string a valid locale? */
export function isLocale(value: string | undefined | null): value is Locale {
  return !!value && (locales as readonly string[]).includes(value);
}

/** Text direction for a locale — drives <html dir>. */
export function dir(locale: Locale): "ltr" | "rtl" {
  return locale === "ar" ? "rtl" : "ltr";
}

/** BCP-47 language tag for a locale (drives <html lang>). */
export function langTag(locale: Locale): string {
  return locale === "ar" ? "ar" : "en";
}

/** Intl locale string for number formatting (formatPrice). */
export function intlLocale(locale: Locale): string {
  return locale === "ar" ? "ar-EG" : "en-EG";
}
