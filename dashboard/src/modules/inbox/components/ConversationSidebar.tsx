import type { Conversation } from "../types/inbox.types";

import ConversationItem from "./ConversationItem";

/**
 * ======================================
 * PROPS
 * ======================================
 */

interface Props {
  loading?: boolean;

  conversations: Conversation[];

  selectedConversation: Conversation | null;

  onSelectConversation: (conversation: Conversation) => void;
}

/**
 * ======================================
 * COMPONENT
 * ======================================
 */

export default function ConversationSidebar({
  loading = false,
  conversations,
  selectedConversation,
  onSelectConversation,
}: Props) {
  /**
   * ======================================
   * LOADING
   * ======================================
   */

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <span className="text-sm text-zinc-500">Carregando conversas...</span>
      </div>
    );
  }

  /**
   * ======================================
   * EMPTY
   * ======================================
   */

  if (!conversations.length) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-center">
        <div>
          <h3 className="font-medium text-zinc-700">Nenhuma conversa</h3>

          <p className="mt-2 text-sm text-zinc-500">
            As mensagens Instagram aparecerão aqui.
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
    <div className="flex h-full flex-col">
      {/* ======================================
          HEADER
      ====================================== */}

      <div className="border-b border-zinc-200 bg-white px-4 py-4">
        <h2 className="text-lg font-semibold text-zinc-800">Instagram Inbox</h2>

        <p className="mt-1 text-xs text-zinc-500">
          {conversations.length} conversa(s)
        </p>
      </div>

      {/* ======================================
          LIST
      ====================================== */}

      <div className="flex-1 overflow-y-auto">
        {conversations.map((conversation) => (
          <ConversationItem
            key={conversation.id}
            conversation={conversation}
            selected={selectedConversation?.id === conversation.id}
            onClick={onSelectConversation}
          />
        ))}
      </div>
    </div>
  );
}
