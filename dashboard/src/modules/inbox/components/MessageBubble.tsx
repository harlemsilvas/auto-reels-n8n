import { Clock3 } from "lucide-react";
import { useState } from "react";
import { messageImages, textParts } from "../message-content";
import type { Message } from "../types/inbox.types";

function ImageAttachment({ url, private: authenticated }: { url: string; private: boolean }) {
  const [failed, setFailed] = useState(false);
  return failed ? <span className="inbox-image-unavailable">Imagem indisponivel</span> :
    <a className="inbox-image-link" href={url} target="_blank" rel="noopener noreferrer" aria-label="Abrir imagem">
      <img src={url} alt="Imagem da conversa" loading="lazy" referrerPolicy="no-referrer"
        crossOrigin={authenticated ? "use-credentials" : undefined} onError={() => setFailed(true)} />
    </a>;
}

export default function MessageBubble({ message }: { message: Message }) {
  const outgoing = message.sentBy === "bot";
  const date = new Date(message.createdAt);
  const images = messageImages(message);
  const text = images.length && ["[image]", "[attachment]"].includes(message.messageText ?? "") ? "" : message.messageText;
  return <div className={`inbox-message-row ${outgoing ? "is-outgoing" : ""}`}>
    <div className="inbox-message-bubble">
      {images.map((image, index) => <ImageAttachment key={`${image.url}-${index}`} {...image} />)}
      {text || !images.length ? <div className="inbox-message-text">{textParts(text || "[Mensagem sem texto]").map((part, index) =>
        <span key={index}>{part.url ? <a href={part.url} target="_blank" rel="noopener noreferrer">{part.text}</a> : part.text}{part.suffix}</span>
      )}</div> : null}
      <div className="inbox-message-time">{message.deliveryState === "uncertain" ? <span>Entrega incerta</span> : String(message.id).startsWith("temp-") ? <Clock3 size={12} aria-label="Envio pendente" /> : null}<time dateTime={message.createdAt} title={date.toLocaleString("pt-BR")}>{Number.isNaN(date.getTime()) ? "-" : date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</time></div>
    </div>
  </div>;
}
