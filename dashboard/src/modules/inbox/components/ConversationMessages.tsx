import { useEffect, useRef } from "react";

import type { Message } from "../types/inbox.types";
import MessageBubble from "./MessageBubble";

/**
 * ======================================
 * PROPS
 * ======================================
 */

interface Props {
  loading?: boolean;

  messages: Message[];
}

/**
 * ======================================
 * COMPONENT
 * ======================================
 */

export default function ConversationMessages({
  loading = false,

  messages,
}: Props) {
  /**
   * ======================================
   * AUTO SCROLL
   * ======================================
   */

  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({
      behavior: "smooth",
    });
  }, [messages]);

  /**
   * ======================================
   * LOADING
   * ======================================
   */

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <span className="text-sm text-zinc-500">Carregando mensagens...</span>
      </div>
    );
  }

  /**
   * ======================================
   * EMPTY
   * ======================================
   */

  if (!messages.length) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <h3 className="font-medium text-zinc-700">Nenhuma mensagem</h3>

          <p className="mt-2 text-sm text-zinc-500">
            Esta conversa ainda não possui mensagens.
          </p>
        </div>
      </div>
    );
  }

  /**
   * ======================================
   * RENDER
   * ======================================
   */

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-zinc-100 px-4 py-4">
      <div className="flex flex-col gap-3">
        {messages.map((message) => (
          <MessageBubble key={message.id} message={message} />
        ))}

        <div ref={bottomRef} />
      </div>
    </div>
  );
}
