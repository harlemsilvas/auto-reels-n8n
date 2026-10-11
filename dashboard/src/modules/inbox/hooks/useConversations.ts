import { useCallback, useEffect, useRef, useState } from "react";
import inboxService from "../services/inbox.service";
import type { Conversation } from "../types/inbox.types";

export function useConversations(accountId?: string) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const requestVersion = useRef(0);

  const loadConversations = useCallback(async () => {
    const version = ++requestVersion.current;
    setLoading(true);
    setError(null);
    try {
      const response = await inboxService.listConversations({ accountId });
      if (version !== requestVersion.current) return;
      setConversations(response.items);
      setSelectedConversation((current) => current
        ? response.items.find((item) => item.id === current.id) ?? null
        : response.items[0] ?? null);
    } catch (failure: unknown) {
      if (version !== requestVersion.current) return;
      const error = failure as { response?: { data?: { message?: string } }; message?: string };
      setError(error?.response?.data?.message || error?.message || "Falha ao carregar conversas.");
    } finally {
      if (version === requestVersion.current) setLoading(false);
    }
  }, [accountId]);

  useEffect(() => {
    // Account changes invalidate the selection as well as in-flight requests.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelectedConversation(null);
    setConversations([]);
    void loadConversations();
    return () => { requestVersion.current += 1; };
  }, [loadConversations]);

  const updateUnreadCount = useCallback((id: string, unreadCount: number) => {
    // A list response captured before this acknowledgement has an obsolete badge.
    requestVersion.current += 1;
    setLoading(false);
    setConversations((items) => items.map((item) => item.id === id ? { ...item, unreadCount } : item));
    setSelectedConversation((item) => item?.id === id ? { ...item, unreadCount } : item);
  }, []);

  return { loading, error, conversations, selectedConversation,
    setSelectedConversation, updateUnreadCount, refresh: loadConversations };
}
