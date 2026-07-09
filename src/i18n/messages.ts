/**
 * Backward-compat shim — re-exports the English dictionary as `messages`.
 *
 * This keeps existing `import { messages } from "@/i18n/messages"` calls working
 * during the i18n refactor. New code should use `getMessages(locale)` (server)
 * or `useMessages()` (client) instead. This shim defaults to English — safe for
 * API routes and any locale-neutral code path.
 */
import { messagesEn } from "@/i18n/messages.en";

export const messages = messagesEn;
export type { Messages } from "@/i18n/messages.en";
