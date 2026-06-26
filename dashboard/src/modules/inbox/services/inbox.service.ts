import axios from "axios";
import { getApiBaseUrl } from "../../../shared/config/api";

import type {
  Conversation,
  Message,
  PaginatedResponse,
  SendMessagePayload,
  SendTesterDmPayload,
  TesterConversation,
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

  headers: {
    "Content-Type": "application/json",
  },
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

/**
 * ======================================
 * MARK AS READ
 * ======================================
 */

export async function markConversationAsRead(conversationId: string) {
  const response = await api.post(
    `/api/internal/conversations/${conversationId}/read`,
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

export default {
  listConversations,
  listMessages,
  sendMessage,
  markConversationAsRead,
  sendInstagramMessage,
  listTesterConversations,
  sendTesterDm,
};
