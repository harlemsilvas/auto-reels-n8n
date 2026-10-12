import { useCallback, useEffect, useRef, useState } from "react";
import inboxService from "../services/inbox.service";
import type { Conversation, Message } from "../types/inbox.types";
import { useAuth } from "../../auth/context/AuthContext";
import { deliveryUncertain, pendingKey, readPending, storePending } from "../uncertain-send";

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
  const { user, can } = useAuth();
  const canReply = can("inbox.reply");
  const storageKey = pendingKey(user?.id, accountId, id);
  const pendingMessage = useRef<Message | null>(null);
  const [uncertain, setUncertain] = useState(false);
  const [recoveredDraft, setRecoveredDraft] = useState("");
  const draftRef = useRef("");
  const draftConversation = useRef(id);
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
      if (canReply) {
        let remote = await inboxService.getSendAttempt(id, pendingMessage.current?.sendAttemptId);
        if (version !== generation.current) return;
        if (remote.attempt && ["sending", "uncertain"].includes(remote.attempt.state)
            && remote.attempt.metaMessageId && !sendPending.current) {
          try { remote = await inboxService.reconcileSendAttempt(id, remote.attempt.id); }
          catch { /* A failed local repair never triggers another Meta send. */ }
          if (version !== generation.current) return;
        }
        const attempt = remote.attempt;
        if (attempt && ["sent", "rejected", "dismissed"].includes(attempt.state)
            && attempt.id === pendingMessage.current?.sendAttemptId) {
          storePending(storageKey, null);
          setRecoveredDraft(pendingMessage.current?.unsentDraft ?? "");
          pendingMessage.current = null;
          setUncertain(false);
          setError(null);
          update((items) => items.filter((item) => !item.id.startsWith("temp-")));
        }
        if (remote.message) response.items.push(remote.message);
        if (attempt && ["sending", "uncertain"].includes(attempt.state) && !sendPending.current) {
          const record: Message = { id: `temp-${attempt.id}`, sendAttemptId: attempt.id,
            unsentDraft: pendingMessage.current?.unsentDraft
              ?? (pendingMessage.current?.sendAttemptId !== attempt.id ? draftRef.current || undefined : undefined),
            conversationId: id, messageText: attempt.messageText, sentBy: "bot",
            metaMessageId: attempt.metaMessageId, createdAt: attempt.createdAt, deliveryState: "uncertain" };
          pendingMessage.current = record;
          storePending(storageKey, record);
          setUncertain(true);
          update((items) => [...items.filter((item) => !item.id.startsWith("temp-")), record]);
        }
      }
      const pending = pendingMessage.current;
      if (pending?.metaMessageId && response.items.some((item) => item.conversationId === id
          && item.sentBy === "bot" && item.metaMessageId === pending.metaMessageId)) {
        storePending(storageKey, null);
        setRecoveredDraft(pending.unsentDraft ?? "");
        pendingMessage.current = null;
        setUncertain(false);
        setError(null);
        update((items) => items.filter((item) => item.id !== pending.id));
      }
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
  }, [id, update, acknowledge, storageKey, canReply]);

  useEffect(() => {
    generation.current += 1;
    fetching.current = false;
    sendPending.current = false;
    draftRef.current = "";
    draftConversation.current = id;
    const restored = readPending(storageKey, id);
    pendingMessage.current = restored;
    itemsRef.current = restored ? [restored] : [];
    // Reset the subscription state when its conversation changes.
    setState({ id, items: itemsRef.current });
    setUncertain(Boolean(restored));
    setRecoveredDraft("");
    setError(null);
    setSending(false);
    setLoading(false);
    void loadMessages();
    const interval = id ? setInterval(() => void loadMessages(), 5000) : undefined;
    return () => {
      generation.current += 1;
      if (interval) clearInterval(interval);
    };
  }, [id, loadMessages, storageKey]);

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
    if (pendingMessage.current?.deliveryState === "uncertain") throw new Error("Confira a entrega antes de enviar novamente.");
    if (!id || !accountId || !recipientId || !trimmed || sendPending.current) return;
    const version = generation.current;
    const temporaryId = `temp-${crypto.randomUUID()}`;
    sendPending.current = true;
    setSending(true);
    setError(null);
    const temporary: Message = { id: temporaryId, conversationId: id,
      senderId: accountId, recipientId, messageText: trimmed, sentBy: "bot",
      createdAt: new Date().toISOString(), deliveryState: "pending", sendAttemptId: temporaryId.slice(5) };
    pendingMessage.current = temporary;
    storePending(storageKey, temporary);
    update((items) => [...items, temporary]);
    try {
      const created = await inboxService.sendMessage({
        conversationId: id, accountId, recipientId, messageText: trimmed, requestId: temporary.sendAttemptId,
      });
      storePending(storageKey, null);
      if (version === generation.current || pendingMessage.current?.id === temporaryId) {
        pendingMessage.current = null;
        setUncertain(false);
        update((items) => unique([...items.filter((item) => item.id !== temporaryId), created]));
      }
    } catch (failure: unknown) {
      const unknownDelivery = deliveryUncertain(failure);
      const metaId = (failure as { response?: { data?: { metaMessageId?: unknown } } })?.response?.data?.metaMessageId;
      const attempt = (failure as { response?: { data?: { attempt?: { id: string; messageText: string; createdAt: string } } } })?.response?.data?.attempt;
      const pending: Message = { ...temporary, deliveryState: "uncertain",
        ...(attempt ? { id: `temp-${attempt.id}`, sendAttemptId: attempt.id,
          messageText: attempt.messageText, createdAt: attempt.createdAt,
          unsentDraft: attempt.id !== temporary.sendAttemptId ? trimmed : undefined } : {}),
        metaMessageId: typeof metaId === "string" ? metaId : undefined };
      storePending(storageKey, unknownDelivery ? pending : null);
      if (version === generation.current || pendingMessage.current?.id === temporaryId) {
        pendingMessage.current = unknownDelivery ? pending : null;
        setUncertain(unknownDelivery);
        update((items) => unknownDelivery ? items.map((item) => item.id === temporaryId ? pending : item)
          : items.filter((item) => item.id !== temporaryId));
        setError(unknownDelivery ? "Entrega incerta. Confira o Instagram; nao reenvie esta mensagem." : errorMessage(failure, "Falha ao enviar mensagem."));
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
    if (pendingMessage.current?.deliveryState === "uncertain") throw new Error("Confira a entrega antes de enviar novamente.");
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

  async function discardUncertain() {
    if (!uncertain || !id || sendPending.current) return;
    const pending = pendingMessage.current;
    const version = generation.current;
    sendPending.current = true;
    setSending(true);
    try {
      if (pending?.sendAttemptId) await inboxService.dismissSendAttempt(id, pending.sendAttemptId);
      storePending(storageKey, null);
      if (version === generation.current) {
        pendingMessage.current = null;
        setRecoveredDraft(pending?.unsentDraft ?? "");
        setUncertain(false);
        setError(null);
        if (pending) update((items) => items.filter((item) => item.id !== pending.id));
      }
    } catch (failure) {
      if (version === generation.current) setError(errorMessage(failure, "Falha ao encerrar tentativa."));
    } finally {
      if (version === generation.current) { sendPending.current = false; setSending(false); }
    }
  }

  return { loading, sending, error, uncertain, discardUncertain,
    onDraftChange: (value: string) => { if (draftConversation.current === id) draftRef.current = value; },
    draftToRestore: state.id !== id ? "" : uncertain ? state.items.find(item => item.deliveryState === "uncertain")?.unsentDraft ?? "" : recoveredDraft,
    messages: state.id === id ? state.items : [],
    sendMessage, sendImage, receiveMessage, refresh: loadMessages };
}

export default useMessages;
