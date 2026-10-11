import { useCallback, useEffect, useRef, useState } from "react";
import inboxService from "../services/inbox.service";
import type { Conversation } from "../types/inbox.types";

export function useConversations(accountId?: string) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const requestVersion = useRef(0);
  const pendingRequests = useRef(0);
  const readRevision = useRef(0);
  const readCounts = useRef(new Map<string, { revision: number; count: number }>());

  const loadConversations = useCallback(async (background = false) => {
    if (background && pendingRequests.current) return;
    const version = ++requestVersion.current;
    const revision = readRevision.current;
    pendingRequests.current += 1;
    if (!background) {
      setLoading(true);
      setError(null);
    }
    try {
      const response = await inboxService.listConversations({ accountId });
      if (version !== requestVersion.current) return;
      // Keep newer read acknowledgements without discarding other conversations.
      const items = response.items.map((item) => {
        const read = readCounts.current.get(item.id);
        return read && read.revision > revision ? { ...item, unreadCount: read.count } : item;
      });
      setConversations(items);
      setSelectedConversation((current) => current
        ? items.find((item) => item.id === current.id) ?? null
        : items[0] ?? null);
      setError(null);
    } catch (failure: unknown) {
      if (version !== requestVersion.current) return;
      const error = failure as { response?: { data?: { message?: string } }; message?: string };
      setError(error?.response?.data?.message || error?.message || "Falha ao carregar conversas.");
    } finally {
      pendingRequests.current -= 1;
      if (version === requestVersion.current) setLoading(false);
    }
  }, [accountId]);

  useEffect(() => {
    // Account changes invalidate the selection as well as in-flight requests.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelectedConversation(null);
    setConversations([]);
    readCounts.current.clear();
    void loadConversations();
    const refreshVisible = () => {
      if (document.visibilityState === "visible") void loadConversations(true);
    };
    const interval = setInterval(refreshVisible, 5000);
    window.addEventListener("focus", refreshVisible);
    document.addEventListener("visibilitychange", refreshVisible);
    return () => {
      requestVersion.current += 1;
      clearInterval(interval);
      window.removeEventListener("focus", refreshVisible);
      document.removeEventListener("visibilitychange", refreshVisible);
    };
  }, [loadConversations]);

  const updateUnreadCount = useCallback((id: string, unreadCount: number) => {
    readCounts.current.set(id, { revision: ++readRevision.current, count: unreadCount });
    setConversations((items) => items.map((item) => item.id === id ? { ...item, unreadCount } : item));
    setSelectedConversation((item) => item?.id === id ? { ...item, unreadCount } : item);
  }, []);

  return { loading, error, conversations, selectedConversation,
    setSelectedConversation, updateUnreadCount, refresh: loadConversations };
}
