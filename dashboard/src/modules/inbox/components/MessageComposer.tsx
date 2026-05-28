import { useState, KeyboardEvent } from "react";
/**
 * ======================================
 * PROPS
 * ======================================
 */

interface Props {
  sending?: boolean;

  onSend: (message: string) => Promise<void>;
}

/**
 * ======================================
 * COMPONENT
 * ======================================
 */

export default function MessageComposer({
  sending = false,

  onSend,
}: Props) {
  /**
   * ======================================
   * STATE
   * ======================================
   */

  const [message, setMessage] = useState("");
  const [typing, setTyping] = useState(false);

  /**
   * ======================================
   * SEND
   * ======================================
   */

  async function handleSend() {
    const trimmed = message.trim();

    if (!trimmed || sending) {
      return;
    }

    await onSend(trimmed);

    setMessage("");
  }

  /**
   * ======================================
   * ENTER SEND
   * ======================================
   */

  async function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();

      await handleSend();
    }
  }

  /**
   * ======================================
   * RENDER
   * ======================================
   */

  return (
    <div className="flex items-end gap-3 px-4 py-3">
      {/* ======================================
          INPUT
      ====================================== */}

      <textarea
        value={message}
        onChange={(event) => setMessage(event.target.value)}
        onKeyDown={handleKeyDown}
        rows={1}
        placeholder="Digite sua mensagem..."
        className="
          min-h-[48px]
          flex-1
          resize-none
          rounded-2xl
          border
          border-zinc-300
          bg-white
          px-4
          py-3
          text-sm
          outline-none
          transition
          focus:border-blue-500
          focus:ring-2
          focus:ring-blue-200
        "
      />

      {/* ======================================
          BUTTON
      ====================================== */}

      <button
        type="button"
        onClick={handleSend}
        disabled={sending}
        className="
          flex
          h-12
          items-center
          justify-center
          rounded-2xl
          bg-blue-600
          px-5
          text-sm
          font-medium
          text-white
          transition
          hover:bg-blue-700
          disabled:cursor-not-allowed
          disabled:opacity-50
        "
      >
        {sending ? "Enviando..." : "Enviar"}
      </button>
    </div>
  );
}
