import { useEffect, useRef } from "react";
import { buildApiUrl } from "../../../shared/config/api";

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
  onConnected?: () => void;
}

/**
 * ======================================
 * HOOK
 * ======================================
 */

export function useRealtimeInbox({
  selectedConversation,
  onNewMessage,
  onConversationUpdate,
  onConnected,
}: Props) {
  /**
   * ======================================
   * REFS
   * ======================================
   */

  const eventSourceRef = useRef<EventSource | null>(null);
  const handlers = useRef({ selectedConversation, onNewMessage, onConversationUpdate, onConnected });

  useEffect(() => {
    handlers.current = { selectedConversation, onNewMessage, onConversationUpdate, onConnected };
  }, [selectedConversation, onNewMessage, onConversationUpdate, onConnected]);

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

    const eventSource = new EventSource(buildApiUrl("/api/realtime/inbox"), {
      withCredentials: true,
    });

    eventSourceRef.current = eventSource;

    /**
     * ======================================
     * CONNECTED
     * ======================================
     */

    eventSource.onopen = () => {
      console.log("[Realtime Inbox] connected");
      handlers.current.onConnected?.();
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

        handlers.current.onConversationUpdate?.(message.conversationId, message);

        /**
         * Only append if selected
         */

        if (handlers.current.selectedConversation?.id === message.conversationId) {
          handlers.current.onNewMessage?.(message);
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
  }, []);
}

export default useRealtimeInbox;
