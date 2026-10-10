import { useState, type KeyboardEvent } from "react";
import { LoaderCircle, Send } from "lucide-react";

export default function MessageComposer({ sending = false, onSend }: { sending?: boolean; onSend: (message: string) => Promise<void> }) {
  const [message, setMessage] = useState("");
  async function handleSend() {
    const trimmed = message.trim();
    if (!trimmed || sending) return;
    await onSend(trimmed);
    setMessage("");
  }
  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      void handleSend();
    }
  }
  return <div className="inbox-composer">
    <textarea aria-label="Mensagem" value={message} onChange={(event) => setMessage(event.target.value)} onKeyDown={handleKeyDown} rows={2} placeholder="Escreva uma mensagem..." disabled={sending} />
    <button className="inbox-send-button" type="button" title={sending ? "Enviando mensagem" : "Enviar mensagem"} aria-label={sending ? "Enviando mensagem" : "Enviar mensagem"} onClick={() => void handleSend()} disabled={sending || !message.trim()}>{sending ? <LoaderCircle size={20} className="inbox-spin" /> : <Send size={20} />}</button>
  </div>;
}
