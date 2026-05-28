import { useEffect, useRef } from "react";

import type { Conversation, Message } from "../types/inbox.types";

/**
 * ======================================
 * TYPES
 * ======================================
 */

interface Props {
  selectedConversation?: Conversation | null;

  onNewMessage?: (message: Message) => void;

  onConversationUpdate?: (conversationId: string, message: Message) => void;
}

/**
 * ======================================
 * API URL
 * ======================================
 */

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:3101";

/**
 * ======================================
 * HOOK
 * ======================================
 */

export function useRealtimeInbox({
  selectedConversation,
  onNewMessage,
  onConversationUpdate,
}: Props) {
  /**
   * ======================================
   * REFS
   * ======================================
   */

  const eventSourceRef = useRef<EventSource | null>(null);

  /**
   * ======================================
   * CONNECT
   * ======================================
   */

  useEffect(() => {
    /**
     * Close previous connection
     */

    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    /**
     * Create SSE connection
     */

    const eventSource = new EventSource(`${API_BASE_URL}/api/realtime/inbox`);

    eventSourceRef.current = eventSource;

    /**
     * ======================================
     * CONNECTED
     * ======================================
     */

    eventSource.onopen = () => {
      console.log("[Realtime Inbox] connected");
    };

    /**
     * ======================================
     * NEW MESSAGE
     * ======================================
     */

    eventSource.addEventListener("new-message", (event) => {
      try {
        const message: Message = JSON.parse(event.data);

        /**
         * Update conversation list
         */

        onConversationUpdate?.(message.conversationId, message);

        /**
         * Only append if selected
         */

        if (selectedConversation?.id === message.conversationId) {
          onNewMessage?.(message);
        }
      } catch (err) {
        console.error(err);
      }
    });

    /**
     * ======================================
     * ERROR
     * ======================================
     */

    eventSource.onerror = (error) => {
      console.error("[Realtime Inbox] connection error", error);
    };

    /**
     * ======================================
     * CLEANUP
     * ======================================
     */

    return () => {
      eventSource.close();
    };
  }, [selectedConversation, onNewMessage, onConversationUpdate]);
}

export default useRealtimeInbox;
