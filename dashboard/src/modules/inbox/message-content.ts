import { buildApiUrl } from "../../shared/config/api";
import type { Message } from "./types/inbox.types";

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? value as Record<string, unknown> : {};
}

export function safeWebUrl(value: unknown) {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol) && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}

export function messageImages(message: Message) {
  const payload = object(message.payload);
  if (object(payload.inboxImage).filename) {
    return [{ url: buildApiUrl(`/api/internal/conversations/${encodeURIComponent(message.conversationId)}/messages/${encodeURIComponent(message.id)}/image`), private: true }];
  }
  const attachments = object(payload.message).attachments ?? payload.attachments;
  if (!Array.isArray(attachments)) return [];
  return attachments.filter((item) => object(item).type === "image").flatMap((item) => {
    const url = safeWebUrl(object(object(item).payload).url);
    return url?.startsWith("https:") ? [{ url, private: false }] : [];
  });
}

export function textParts(text: string) {
  return text.split(/(https?:\/\/[^\s<>"']+)/gi).filter(Boolean).map((part) => {
    const match = part.match(/^(https?:\/\/.*?)([.,!?;:)]*)$/i);
    const url = match ? safeWebUrl(match[1]) : null;
    return { text: url ? match![1] : part, url, suffix: url ? match![2] : "" };
  });
}
