import { Fragment, useEffect, useRef } from "react";
import type { Message } from "../types/inbox.types";
import MessageBubble from "./MessageBubble";

export default function ConversationMessages({ loading = false, messages }: { loading?: boolean; messages: Message[] }) {
  const bottomRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => { bottomRef.current?.scrollIntoView({ block: "nearest" }); }, [messages]);
  const day = (value: string) => {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "Data indisponivel" : date.toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" });
  };
  return <div className="inbox-messages" aria-label="Mensagens da conversa" aria-busy={loading}>
    {!messages.length ? <p className="inbox-state">{loading ? "Carregando mensagens..." : "Nenhuma mensagem nesta conversa."}</p> : null}
    {messages.map((message, index) => <Fragment key={message.id}>
      {index === 0 || day(message.createdAt) !== day(messages[index - 1].createdAt) ? <div className="inbox-date-divider"><span>{day(message.createdAt)}</span></div> : null}
      <MessageBubble message={message} />
    </Fragment>)}
    <div ref={bottomRef} />
  </div>;
}
