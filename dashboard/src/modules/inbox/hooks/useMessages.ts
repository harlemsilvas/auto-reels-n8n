import { useCallback, useEffect, useRef, useState } from "react";
import inboxService from "../services/inbox.service";
import type { Conversation, Message } from "../types/inbox.types";

function errorMessage(error: unknown, fallback: string) {
  const failure = error as { response?: { data?: { message?: string } }; message?: string };
  return failure?.response?.data?.message || failure?.message || fallback;
}

function unique(messages: Message[]) {
  return [...new Map(messages.map((message) => [message.id, message])).values()]
    .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
}

export function useMessages(conversation?: Conversation | null, onRead?: (id: string, unreadCount: number) => void, readEnabled = true) {
  const id = conversation?.id;
  const accountId = conversation?.accountId;
  const recipientId = conversation?.instagramUserId;
  const generation = useRef(0);
  const fetching = useRef(false);
  const sendPending = useRef(false);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState<{ id?: string; items: Message[] }>({ items: [] });
  const itemsRef = useRef<Message[]>([]);
  const readEnabledRef = useRef(readEnabled);

  const acknowledge = useCallback(async (messageIds: string[], version: number) => {
    if (!id || !readEnabledRef.current || document.visibilityState !== "visible") return;
    const result = await inboxService.markConversationAsRead(id, messageIds);
    if (version === generation.current && typeof result.unreadCount === "number") {
      onRead?.(id, result.unreadCount);
    }
  }, [id, onRead]);

  useEffect(() => {
    readEnabledRef.current = readEnabled;
    const version = generation.current;
    const ids = itemsRef.current.filter((message) => message.conversationId === id && !message.id.startsWith("temp-")).map((message) => message.id);
    if (readEnabled && ids.length) {
      void acknowledge(ids, version).catch((failure: unknown) => {
        if (version === generation.current) setError(errorMessage(failure, "Falha ao marcar mensagem como lida."));
      });
    }
  }, [id, readEnabled, acknowledge]);

  const update = useCallback((transform: (items: Message[]) => Message[]) => {
    const items = transform(itemsRef.current);
    itemsRef.current = items;
    setState({ id, items });
  }, [id]);

  const loadMessages = useCallback(async () => {
    if (!id || fetching.current) return;
    const version = generation.current;
    fetching.current = true;
    const previousIds = new Set(itemsRef.current.map((item) => item.id));
    setLoading(true);
    try {
      const response = await inboxService.listMessages(id);
      if (version !== generation.current) return;
      // Preserve pending sends and SSE messages received after this request began.
      update((current) => unique([...response.items.filter((item) => item.conversationId === id),
        ...current.filter((item) => item.id.startsWith("temp-") || !previousIds.has(item.id))]));
      await acknowledge(response.items.map((message) => message.id), version);
    } catch (failure: unknown) {
      if (version === generation.current) setError(errorMessage(failure, "Falha ao carregar mensagens."));
    } finally {
      if (version === generation.current) {
        fetching.current = false;
        setLoading(false);
      }
    }
  }, [id, update, acknowledge]);

  useEffect(() => {
    generation.current += 1;
    fetching.current = false;
    sendPending.current = false;
    itemsRef.current = [];
    // Reset the subscription state when its conversation changes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState({ id, items: [] });
    setError(null);
    setSending(false);
    setLoading(false);
    void loadMessages();
    const interval = id ? setInterval(() => void loadMessages(), 5000) : undefined;
    return () => {
      generation.current += 1;
      if (interval) clearInterval(interval);
    };
  }, [id, loadMessages]);

  const receiveMessage = useCallback((message: Message) => {
    if (message.conversationId !== id) return;
    update((items) => unique([...items, message]));
    const version = generation.current;
    void acknowledge([message.id], version).catch((failure: unknown) => {
      if (version === generation.current) setError(errorMessage(failure, "Falha ao marcar mensagem como lida."));
    });
  }, [id, update, acknowledge]);

  async function sendMessage(messageText: string) {
    const trimmed = messageText.trim();
    if (!id || !accountId || !recipientId || !trimmed || sendPending.current) return;
    const version = generation.current;
    const temporaryId = `temp-${crypto.randomUUID()}`;
    sendPending.current = true;
    setSending(true);
    setError(null);
    update((items) => [...items, { id: temporaryId, conversationId: id,
      senderId: accountId, recipientId, messageText: trimmed, sentBy: "bot",
      createdAt: new Date().toISOString() }]);
    try {
      const created = await inboxService.sendMessage({
        conversationId: id, accountId, recipientId, messageText: trimmed,
      });
      if (version === generation.current) {
        update((items) => unique([...items.filter((item) => item.id !== temporaryId), created]));
      }
    } catch (failure: unknown) {
      if (version === generation.current) {
        update((items) => items.filter((item) => item.id !== temporaryId));
        setError(errorMessage(failure, "Falha ao enviar mensagem."));
      }
      throw failure;
    } finally {
      if (version === generation.current) {
        sendPending.current = false;
        setSending(false);
      }
    }
  }

  async function sendImage(image: File) {
    if (!id || sendPending.current) return;
    const version = generation.current;
    sendPending.current = true;
    setSending(true);
    setError(null);
    try {
      const created = await inboxService.sendImage(id, image);
      if (version === generation.current) update((items) => unique([...items, created]));
    } catch (failure: unknown) {
      if (version === generation.current) setError(errorMessage(failure, "Falha ao enviar imagem."));
      throw failure;
    } finally {
      if (version === generation.current) {
        sendPending.current = false;
        setSending(false);
      }
    }
  }

  return { loading, sending, error, messages: state.id === id ? state.items : [],
    sendMessage, sendImage, receiveMessage, refresh: loadMessages };
}

export default useMessages;
