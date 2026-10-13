import type messages from "../../shared/i18n/locales/en/inbox.json";
export type InboxErrorKey = keyof typeof messages.errors;

export function inboxErrorKey(failure: unknown, fallback: InboxErrorKey): InboxErrorKey {
  const error = failure as { response?: { status?: number; data?: { code?: string } } };
  const code = error?.response?.data?.code;
  if (code === "MESSAGE_DELIVERY_UNCERTAIN") return fallback === "sendImage" ? "imageDeliveryUncertain" : "deliveryUncertain";
  if (code === "META_MESSAGE_PERMISSION_DENIED") return "metaPermission";
  if (error?.response?.status === 401) return "session";
  if (error?.response?.status === 403) return "permission";
  if (error?.response?.status === 429) return "rateLimit";
  if (error?.response?.status === 413) return "imageTooLarge";
  return fallback;
}
