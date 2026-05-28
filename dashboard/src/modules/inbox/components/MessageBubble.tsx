import type { Message } from "../types/inbox.types";

/**
 * ======================================
 * PROPS
 * ======================================
 */

interface Props {
  message: Message;
}

/**
 * ======================================
 * COMPONENT
 * ======================================
 */

export default function MessageBubble({ message }: Props) {
  const isBot = message.sentBy === "bot";

  return (
    <div
      className={`
        flex
        ${isBot ? "justify-end" : "justify-start"}
      `}
    >
      <div
        className={`
          max-w-[75%] rounded-2xl px-4 py-3 shadow-sm
          ${isBot ? "bg-blue-600 text-white" : "bg-white text-zinc-800"}
        `}
      >
        {/* MESSAGE */}

        <div className="whitespace-pre-wrap break-words text-sm">
          {message.messageText}
        </div>

        {/* TIME */}

        <div
          className={`
            mt-2 text-right text-[11px]
            ${isBot ? "text-blue-100" : "text-zinc-400"}
          `}
        >
          {new Date(message.createdAt).toLocaleTimeString("pt-BR", {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </div>
      </div>
    </div>
  );
}
