"use client";

import { createContext, useContext, useMemo } from "react";
import type { Messages } from "@/i18n/messages.en";
import type { Locale } from "@/i18n/config";
import { defaultLocale } from "@/i18n/config";

/**
 * Client-side i18n context.
 *
 * Mounted once in [locale]/layout.tsx with the resolved dictionary + locale.
 * Client Components call `useMessages()` (or `useLocale()`) instead of importing
 * the static `messages` module — this is what makes the copy switch with the URL.
 */

interface I18nContextValue {
  messages: Messages;
  locale: Locale;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function MessagesProvider({
  messages,
  locale,
  children,
}: {
  messages: Messages;
  locale: Locale;
  children: React.ReactNode;
}) {
  const value = useMemo(() => ({ messages, locale }), [messages, locale]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

/** Access the message dictionary in any client component. */
export function useMessages(): Messages {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useMessages must be used within <MessagesProvider>");
  return ctx.messages;
}

/** Access the current locale in any client component. */
export function useLocale(): Locale {
  const ctx = useContext(I18nContext);
  return ctx?.locale ?? defaultLocale;
}
