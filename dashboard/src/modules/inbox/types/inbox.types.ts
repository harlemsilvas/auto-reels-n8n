/**
 * ======================================
 * INSTAGRAM ACCOUNT
 * ======================================
 */

export interface InstagramAccount {
  id: string;

  nome?: string | null;

  instagramId?: string | null;

  username?: string | null;

  profilePictureUrl?: string | null;
}

/**
 * ======================================
 * CONVERSATION
 * ======================================
 */

export interface Conversation {
  id: string;

  accountId: string;

  instagramUserId: string;

  instagramUsername?: string | null;

  instagramName?: string | null;

  profilePictureUrl?: string | null;

  lastMessageAt?: string | null;

  lastMessageText?: string | null;

  unreadCount?: number;

  messagesCount?: number;

  createdAt?: string;

  updatedAt?: string;

  accountName?: string | null;
}

/**
 * ======================================
 * MESSAGE
 * ======================================
 */

export interface Message {
  id: string;

  conversationId: string;

  metaMessageId?: string | null;

  senderId?: string | null;

  recipientId?: string | null;

  messageText?: string | null;

  sentBy: "user" | "bot";

  createdAt: string;

  payload?: any;
}

/**
 * ======================================
 * PAGINATED RESPONSE
 * ======================================
 */

export interface PaginatedResponse<T> {
  total: number;

  items: T[];
}

/**
 * ======================================
 * SEND MESSAGE PAYLOAD
 * ======================================
 */

export interface SendMessagePayload {
  conversationId: string;
  accountId: string;
  recipientId: string;
  messageText: string;
}

/**
 * ======================================
 * QUICK REPLY
 * ======================================
 */

export interface QuickReply {
  title: string;

  payload: string;
}
