import axios from "axios";

import type {
  Conversation,
  Message,
  PaginatedResponse,
  SendMessagePayload,
} from "../types/inbox.types";

/**
 * ======================================
 * API BASE URL
 * ======================================
 */

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:3101";

/**
 * ======================================
 * AXIOS INSTANCE
 * ======================================
 */

const api = axios.create({
  baseURL: API_BASE_URL,

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

export default {
  listConversations,
  listMessages,
  sendMessage,
  markConversationAsRead,
  sendInstagramMessage,
};
