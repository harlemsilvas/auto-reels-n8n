import axios from "axios";
import { getApiBaseUrl } from "../../../shared/config/api";

import type {
  Conversation,
  Message,
  PaginatedResponse,
  SendMessagePayload,
  SendTesterDmPayload,
  TesterConversation,
  SendAttempt,
} from "../types/inbox.types";

/**
 * ======================================
 * API BASE URL
 * ======================================
 */

/**
 * ======================================
 * AXIOS INSTANCE
 * ======================================
 */

const api = axios.create({
  baseURL: getApiBaseUrl(),
  withCredentials: true,

  headers: {
    "Content-Type": "application/json",
  },
});

api.interceptors.request.use((config) => {
  const method = (config.method ?? "get").toLowerCase();

  if (!["get", "head", "options"].includes(method)) {
    const csrfToken = sessionStorage.getItem("socialbot.admin.csrf");

    if (csrfToken) {
      config.headers.set("X-CSRF-Token", csrfToken);
    }
  }

  return config;
});

/**
 * ======================================
 * LIST CONVERSATIONS
 * ======================================
 */

export async function listConversations(params?: {
  accountId?: string | null;

  limit?: number;
}) {
  const response = await api.get<PaginatedResponse<Conversation>>(
    "/api/internal/conversations",
    {
      params,
    },
  );

  return response.data;
}

/**
 * ======================================
 * LIST MESSAGES
 * ======================================
 */

export async function listMessages(conversationId: string) {
  const response = await api.get<PaginatedResponse<Message>>(
    `/api/internal/conversations/${conversationId}/messages`,
  );

  return response.data;
}

/**
 * ======================================
 * SEND MESSAGE
 * ======================================
 */

export async function sendMessage(payload: SendMessagePayload) {
  const response = await api.post("/api/internal/messages/send", payload);

  return response.data;
}

export async function getSendAttempt(conversationId: string, requestId?: string) {
  const response = await api.get<{ attempt: SendAttempt | null; message?: Message | null }>(
    `/api/internal/messages/attempts/${encodeURIComponent(conversationId)}`, { params: { requestId } });
  return response.data;
}

export async function reconcileSendAttempt(conversationId: string, requestId: string) {
  const response = await api.post<{ attempt: SendAttempt; message: Message }>(
    `/api/internal/messages/attempts/${encodeURIComponent(conversationId)}/reconcile`, { requestId });
  return response.data;
}

export async function dismissSendAttempt(conversationId: string, requestId: string) {
  await api.post(`/api/internal/messages/attempts/${encodeURIComponent(conversationId)}/dismiss`,
    { requestId, acknowledged: true });
}

export async function sendImage(conversationId: string, image: File) {
  const form = new FormData();
  form.append("image", image);
  const response = await api.post<Message>(
    `/api/internal/conversations/${encodeURIComponent(conversationId)}/images`, form,
    { headers: { "Content-Type": undefined } },
  );
  return response.data;
}

/**
 * ======================================
 * MARK AS READ
 * ======================================
 */

export async function markConversationAsRead(conversationId: string, messageIds?: string[]) {
  const response = await api.post(
    `/api/internal/conversations/${conversationId}/read`,
    messageIds === undefined ? undefined : { messageIds },
  );

  return response.data;
}

/**
 * ======================================
 * SEND INSTAGRAM MESSAGE
 * ======================================
 */

export async function sendInstagramMessage(
  conversationId: string,
  messageText: string,
  accountId: string,
  recipientId: string,
) {
  const response = await api.post("/api/internal/messages/send", {
    conversationId,
    accountId,
    recipientId,
    messageText,
  });

  return response.data;
}

export async function listTesterConversations() {
  const response = await api.get<PaginatedResponse<TesterConversation>>(
    "/api/internal/testers-dm/conversations",
  );

  return response.data;
}

export async function sendTesterDm(payload: SendTesterDmPayload) {
  const response = await api.post("/api/internal/testers-dm/send", payload);

  return response.data;
}

export async function hideTesterConversation(conversationId: string) {
  const response = await api.delete(
    `/api/internal/testers-dm/conversations/${encodeURIComponent(conversationId)}`,
  );
  return response.data;
}

export default {
  getSendAttempt,
  reconcileSendAttempt,
  dismissSendAttempt,
  listConversations,
  listMessages,
  sendMessage,
  sendImage,
  markConversationAsRead,
  sendInstagramMessage,
  listTesterConversations,
  sendTesterDm,
  hideTesterConversation,
};
