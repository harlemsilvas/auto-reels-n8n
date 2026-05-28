import { useCallback, useEffect, useState } from "react";

import inboxService from "../services/inbox.service";

import type { Conversation, Message } from "../types/inbox.types";

/**
 * ======================================
 * HOOK
 * ======================================
 */

export function useMessages(conversation?: Conversation | null) {
  /**
   * ======================================
   * STATE
   * ======================================
   */

  const [loading, setLoading] = useState(false);

  const [fetching, setFetching] = useState(false);

  const [sending, setSending] = useState(false);

  const [error, setError] = useState<string | null>(null);

  const [messages, setMessages] = useState<Message[]>([]);

  /**
   * ======================================
   * LOAD MESSAGES
   * ======================================
   */

  const loadMessages = useCallback(async () => {
    if (!conversation?.id || fetching) {
      setMessages([]);

      return;
    }
    setFetching(true);
    try {
      setLoading(true);

      setError(null);

      const response = await inboxService.listMessages(conversation.id);

      setMessages(response.items);

      /**
       * Mark as read
       */

      await inboxService.markConversationAsRead(conversation.id);
    } catch (err: any) {
      console.error(err);

      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Failed to load messages.",
      );
    } finally {
      setLoading(false);
      setFetching(false);
    }
  }, [conversation]);

  /**
   * ======================================
   * SEND MESSAGE
   * ======================================
   */

  async function sendMessage(messageText: string) {
    if (!conversation) {
      return;
    }

    const trimmed = messageText.trim();

    if (!trimmed) {
      return;
    }

    try {
      setSending(true);

      setError(null);

      /**
       * Optimistic message
       */

      const optimisticMessage: Message = {
        id: `temp-${Date.now()}`,

        conversationId: conversation.id,

        senderId: conversation.accountId,

        recipientId: conversation.instagramUserId,

        messageText: trimmed,

        sentBy: "bot",

        createdAt: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, optimisticMessage]);

      /**
       * SEND REAL MESSAGE
       */

      const createdMessage = await inboxService.sendMessage({
        conversationId: conversation.id,

        accountId: conversation.accountId,

        recipientId: conversation.instagramUserId,

        messageText: trimmed,
      });

      /**
       * Replace optimistic message
       */

      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === optimisticMessage.id ? createdMessage : msg,
        ),
      );
    } catch (err: any) {
      console.error(err);

      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Failed to send message.",
      );

      /**
       * Remove optimistic message on error
       */

      setMessages((prev) =>
        prev.filter((msg) => !String(msg.id).startsWith("temp-")),
      );
    } finally {
      setSending(false);
    }
  }

  /**
   * ======================================
   * LOAD ON CHANGE
   * ======================================
   */

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  /**
   * ======================================
   * POLLING
   * ======================================
   */

  useEffect(() => {
    if (!conversation?.id) {
      return;
    }

    /**
     * Initial load
     */

    loadMessages();

    /**
     * Polling
     */

    const interval = setInterval(() => {
      loadMessages();
    }, 5000);

    return () => {
      clearInterval(interval);
    };
  }, [conversation?.id, loadMessages]);

  /**
   * ======================================
   * RETURN
   * ======================================
   */

  return {
    loading,

    sending,

    error,

    messages,

    sendMessage,

    refresh: loadMessages,
  };
}

export default useMessages;
