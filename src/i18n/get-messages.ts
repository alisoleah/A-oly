import type { Locale } from "@/i18n/config";
import { messagesEn, type Messages } from "@/i18n/messages.en";
import { messagesAr } from "@/i18n/messages.ar";

/**
 * Resolve the message dictionary for a locale (server-side, synchronous).
 *
 * Server Components call `const messages = getMessages(locale)` where `locale`
 * comes from `params`. Client Components use `useMessages()` from the provider
 * instead (they can't call this directly during render without a request scope).
 *
 * The dictionaries are statically imported (not dynamic import) so:
 *  - the lookup is synchronous (no async/await in server components)
 *  - tree-shaking keeps both bundles small (each dict is ~3KB)
 */
const DICTS: Record<Locale, Messages> = {
  en: messagesEn,
  ar: messagesAr,
};

export function getMessages(locale: Locale): Messages {
  return DICTS[locale];
}
