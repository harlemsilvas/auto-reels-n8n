import type { Conversation } from "../types/inbox.types";

/**
 * ======================================
 * PROPS
 * ======================================
 */

interface Props {
  conversation: Conversation;

  selected?: boolean;

  onClick: (conversation: Conversation) => void;
}

/**
 * ======================================
 * COMPONENT
 * ======================================
 */

export default function ConversationItem({
  conversation,

  selected = false,

  onClick,
}: Props) {
  return (
    <button
      type="button"
      onClick={() => onClick(conversation)}
      className={`
        flex w-full items-start gap-3 border-b border-zinc-100 px-4 py-3 text-left transition
        hover:bg-zinc-50
        ${selected ? "bg-zinc-100" : "bg-white"}
      `}
    >
      {/* ======================================
          AVATAR
      ====================================== */}

      <div className="relative">
        <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-zinc-200">
          {conversation.profilePictureUrl ? (
            <img
              src={conversation.profilePictureUrl}
              alt={conversation.instagramUsername || "Instagram User"}
              className="h-full w-full object-cover"
            />
          ) : (
            <span className="text-sm font-semibold text-zinc-600">
              {conversation.instagramUsername?.[0]?.toUpperCase() || "U"}
            </span>
          )}
        </div>

        {(conversation.unreadCount ?? 0) > 0 && (
          <div className="absolute -right-1 -top-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-blue-600 px-1 text-[11px] font-semibold text-white">
            {conversation.unreadCount}
          </div>
        )}
      </div>

      {/* ======================================
          CONTENT
      ====================================== */}

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate font-medium text-zinc-800">
            {conversation.instagramName || conversation.instagramUsername}
          </span>

          {conversation.lastMessageAt && (
            <span className="shrink-0 text-[11px] text-zinc-400">
              {new Date(conversation.lastMessageAt).toLocaleTimeString(
                "pt-BR",
                {
                  hour: "2-digit",
                  minute: "2-digit",
                },
              )}
            </span>
          )}
        </div>

        <span className="truncate text-xs text-zinc-500">
          @{conversation.instagramUsername}
        </span>

        <span className="mt-1 truncate text-sm text-zinc-600">
          {conversation.lastMessageText || "Sem mensagens"}
        </span>
      </div>
    </button>
  );
}
