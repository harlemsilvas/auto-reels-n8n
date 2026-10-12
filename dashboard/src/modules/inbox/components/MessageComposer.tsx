import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { ImagePlus, LoaderCircle, Send, X } from "lucide-react";

export default function MessageComposer({ sending = false, uncertain = false, initialDraft = "", onDraftChange, onDiscardUncertain, onSend, onSendImage }: { sending?: boolean; uncertain?: boolean; initialDraft?: string; onDraftChange?: (value: string) => void; onDiscardUncertain?: () => void; onSend: (message: string) => Promise<void>; onSendImage?: (image: File) => Promise<void> }) {
  const [message, setMessage] = useState(initialDraft);
  const [image, setImage] = useState<{ file: File; url: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement | null>(null);
  const pending = useRef(false);
  useEffect(() => () => { if (image) URL.revokeObjectURL(image.url); }, [image]);
  function selectImage(file?: File) {
    if (!file) return;
    if (!["image/jpeg", "image/png"].includes(file.type) || file.size > 8_000_000) {
      setError("Selecione JPG ou PNG de ate 8 MB.");
      return;
    }
    setError(null);
    setImage({ file, url: URL.createObjectURL(file) });
  }
  async function handleSend() {
    const trimmed = message.trim();
    if ((!trimmed && !image) || sending || uncertain || pending.current) return;
    pending.current = true;
    setError(null);
    try {
      // Send independently: a later image failure must not resend an already delivered text.
      if (trimmed) {
        await onSend(trimmed);
        setMessage("");
        onDraftChange?.("");
      }
      if (image && onSendImage) {
        await onSendImage(image.file);
        setImage(null);
      }
    } catch (failure: unknown) {
      // The hook displays the API error; keep this draft available for correction.
      if ((failure as { response?: { data?: { code?: string } } })?.response?.data?.code === "MESSAGE_DELIVERY_UNCERTAIN") setImage(null);
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
  return <div className="inbox-composer-wrap">
    {uncertain ? <p className="inbox-error" role="status">Entrega incerta. Confira o Instagram antes de continuar.
      <button type="button" className="inbox-icon-button" title="Encerrar tentativa apos conferir entrega" aria-label="Encerrar tentativa apos conferir entrega" disabled={sending} onClick={() => {
        if (window.confirm("Isso encerra a tentativa no servidor e libera outras abas. Nao cancela a DM nem comprova falha. Ja conferiu o Instagram?")) onDiscardUncertain?.();
      }}><X size={18} /></button>
    </p> : null}
    {error ? <p className="inbox-error" role="alert">{error}</p> : null}
    {image ? <div className="inbox-image-preview"><img src={image.url} alt="Previa da imagem" /><span>{image.file.name}</span>
      <button className="inbox-icon-button" title="Remover imagem" aria-label="Remover imagem" disabled={sending} onClick={() => setImage(null)}><X size={18} /></button>
    </div> : null}
    <div className="inbox-composer">
    {onSendImage ? <><input ref={fileInput} className="inbox-file-input" type="file" accept="image/jpeg,image/png" aria-label="Selecionar imagem" onChange={(event) => { selectImage(event.target.files?.[0]); event.target.value = ""; }} />
      <button className="inbox-icon-button" type="button" title="Anexar imagem" aria-label="Anexar imagem" disabled={sending || uncertain} onClick={() => fileInput.current?.click()}><ImagePlus size={20} /></button>
    </> : null}
    <textarea aria-label="Mensagem" value={message} onChange={(event) => { setMessage(event.target.value); onDraftChange?.(event.target.value); }} onKeyDown={handleKeyDown} rows={2} placeholder="Escreva uma mensagem..." disabled={sending || uncertain} />
    <button className="inbox-send-button" type="button" title={sending ? "Enviando mensagem" : "Enviar mensagem"} aria-label={sending ? "Enviando mensagem" : "Enviar mensagem"} onClick={() => void handleSend()} disabled={sending || uncertain || (!message.trim() && !image)}>{sending ? <LoaderCircle size={20} className="inbox-spin" /> : <Send size={20} />}</button>
    </div>
  </div>;
}
