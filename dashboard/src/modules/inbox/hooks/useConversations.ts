import { useCallback, useEffect, useState } from "react";

import inboxService from "../services/inbox.service";

import type { Conversation } from "../types/inbox.types";

/**
 * ======================================
 * HOOK
 * ======================================
 */

export function useConversations(accountId?: string) {
  /**
   * ======================================
   * STATE
   * ======================================
   */

  const [loading, setLoading] = useState(false);

  const [error, setError] = useState<string | null>(null);

  const [conversations, setConversations] = useState<Conversation[]>([]);

  const [selectedConversation, setSelectedConversation] =
    useState<Conversation | null>(null);

  /**
   * ======================================
   * LOAD CONVERSATIONS
   * ======================================
   */

  const loadConversations = useCallback(async () => {
    try {
      setLoading(true);

      setError(null);

      const response = await inboxService.listConversations(accountId);

      setConversations(response.items);

      /**
       * Auto select first conversation
       */

      if (response.items.length > 0 && !selectedConversation) {
        setSelectedConversation(response.items[0]);
      }
    } catch (err: any) {
      console.error(err);

      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Failed to load conversations.",
      );
    } finally {
      setLoading(false);
    }
  }, [accountId, selectedConversation]);

  /**
   * ======================================
   * INITIAL LOAD
   * ======================================
   */

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  /**
   * ======================================
   * REFRESH
   * ======================================
   */

  async function refresh() {
    await loadConversations();
  }

  /**
   * ======================================
   * RETURN
   * ======================================
   */

  return {
    loading,

    error,

    conversations,

    selectedConversation,

    setSelectedConversation,

    refresh,
  };
}

export default useConversations;
