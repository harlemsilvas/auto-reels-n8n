import { useRef, useState, type KeyboardEvent } from "react";
import { LoaderCircle, Send } from "lucide-react";

export default function MessageComposer({ sending = false, onSend }: { sending?: boolean; onSend: (message: string) => Promise<void> }) {
  const [message, setMessage] = useState("");
  const pending = useRef(false);
  async function handleSend() {
    const trimmed = message.trim();
    if (!trimmed || sending || pending.current) return;
    pending.current = true;
    try {
      await onSend(trimmed);
      setMessage("");
    } catch {
      // The hook displays the API error; keep this draft available for correction.
    } finally {
      pending.current = false;
    }
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
