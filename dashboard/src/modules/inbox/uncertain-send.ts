import type { Message } from "./types/inbox.types";

export function deliveryUncertain(failure: unknown) {
  const error = failure as { response?: { status?: number; data?: { code?: string } }; code?: string };
  return error?.response?.data?.code === "MESSAGE_DELIVERY_UNCERTAIN"
    || !error?.response || (error.response.status ?? 0) >= 500;
}

export function pendingKey(userId: string | undefined, accountId: string | undefined, conversationId: string | undefined) {
  return `socialbot.inbox.pending.${JSON.stringify([userId, accountId, conversationId])}`;
}

export function readPending(key: string, conversationId?: string): Message | null {
  try {
    const item = JSON.parse(sessionStorage.getItem(key) ?? "null") as Message | null;
    if (item && item.conversationId === conversationId && typeof item.id === "string" && item.id.startsWith("temp-")
        && typeof item.messageText === "string" && typeof item.createdAt === "string") {
      return { id: item.id, conversationId: item.conversationId, messageText: item.messageText,
        createdAt: item.createdAt, sentBy: "bot", deliveryState: "uncertain",
        sendAttemptId: item.sendAttemptId ?? item.id.slice(5),
        unsentDraft: typeof item.unsentDraft === "string" ? item.unsentDraft : undefined,
        metaMessageId: typeof item.metaMessageId === "string" ? item.metaMessageId : null };
    }
  } catch { /* Storage can be unavailable; in-memory protection still applies. */ }
  return null;
}

export function storePending(key: string, message: Message | null) {
  try {
    if (message) sessionStorage.setItem(key, JSON.stringify(message));
    else sessionStorage.removeItem(key);
  } catch { /* Never turn a storage failure into a duplicate send. */ }
}
