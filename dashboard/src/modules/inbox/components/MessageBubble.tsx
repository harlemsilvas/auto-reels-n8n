import { Clock3 } from "lucide-react";
import type { Message } from "../types/inbox.types";

export default function MessageBubble({ message }: { message: Message }) {
  const outgoing = message.sentBy === "bot";
  const date = new Date(message.createdAt);
  return <div className={`inbox-message-row ${outgoing ? "is-outgoing" : ""}`}>
    <div className="inbox-message-bubble">
      <div className="inbox-message-text">{message.messageText || "[Mensagem sem texto]"}</div>
      <div className="inbox-message-time">{String(message.id).startsWith("temp-") ? <Clock3 size={12} aria-label="Envio pendente" /> : null}<time dateTime={message.createdAt} title={date.toLocaleString("pt-BR")}>{Number.isNaN(date.getTime()) ? "-" : date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</time></div>
    </div>
  </div>;
}
