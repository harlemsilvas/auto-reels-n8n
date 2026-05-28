import "../styles/inbox.css";
import { useEffect, useState } from "react";
import { useConversations } from "../hooks/useConversations";
import { useMessages } from "../hooks/useMessages";

import ConversationSidebar from "../components/ConversationSidebar";
import ConversationMessages from "../components/ConversationMessages";
import MessageComposer from "../components/MessageComposer";
import EmptyConversation from "../components/EmptyConversation";
import useRealtimeInbox from "../hooks/useRealtimeInbox";

/**
 * ======================================
 * PAGE
 * ======================================
 */

export default function InstagramInboxPage() {
  /**
   * ======================================
   * CONVERSATIONS
   * ======================================
   */

  const {
    loading: conversationsLoading,
    conversations,
    selectedConversation,
    setSelectedConversation,
  } = useConversations();

  /**
   * ======================================
   * MESSAGES
   * ======================================
   */

  const {
    loading: messagesLoading,
    sending,
    messages,
    sendMessage,
  } = useMessages(selectedConversation);

  const [realtimeMessages, setRealtimeMessages] = useState(messages);

  useEffect(() => {
    setRealtimeMessages(messages);
  }, [messages]);

  useRealtimeInbox({
    selectedConversation,

    /**
     * ======================================
     * NEW MESSAGE
     * ======================================
     */

    onNewMessage(message) {
      setRealtimeMessages((prev) => {
        /**
         * Avoid duplicates
         */

        const exists = prev.some((m) => m.id === message.id);

        if (exists) {
          return prev;
        }

        return [...prev, message];
      });
    },

    /**
     * ======================================
     * CONVERSATION UPDATE
     * ======================================
     */

    onConversationUpdate(conversationId, message) {
      console.log("[Realtime] conversation updated", conversationId, message);
    },
  });

  /**
   * ======================================
   * RENDER
   * ======================================
   */

  return (
    <div className="flex h-screen w-full overflow-hidden bg-zinc-100">
      {/* ======================================
          SIDEBAR
      ====================================== */}

      <div className="w-[360px] border-r border-zinc-200 bg-white">
        <ConversationSidebar
          loading={conversationsLoading}
          conversations={conversations}
          selectedConversation={selectedConversation}
          onSelectConversation={setSelectedConversation}
        />
      </div>

      {/* ======================================
          CHAT AREA
      ====================================== */}

      <div className="flex flex-1 flex-col">
        {!selectedConversation ? (
          <EmptyConversation />
        ) : (
          <>
            {/* ======================================
                HEADER
            ====================================== */}

            <div className="flex items-center gap-3 border-b border-zinc-200 bg-white px-4 py-3">
              <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-full bg-zinc-200">
                {selectedConversation.profilePictureUrl ? (
                  <img
                    src={selectedConversation.profilePictureUrl}
                    alt={
                      selectedConversation.instagramUsername || "Instagram User"
                    }
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="text-sm font-semibold text-zinc-600">
                    {selectedConversation.instagramUsername
                      ?.charAt(0)
                      ?.toUpperCase() || "U"}
                  </span>
                )}
              </div>

              <div className="flex flex-col">
                <span className="font-medium text-zinc-800">
                  {selectedConversation.instagramName ||
                    selectedConversation.instagramUsername}
                </span>

                <span className="text-xs text-zinc-500">
                  @{selectedConversation.instagramUsername}
                </span>
              </div>
            </div>

            {/* ======================================
                MESSAGES
            ====================================== */}

            <div className="flex-1 overflow-hidden">
              <ConversationMessages
                loading={messagesLoading}
                messages={realtimeMessages}
              />
            </div>

            {/* ======================================
                COMPOSER
            ====================================== */}

            <div className="border-t border-zinc-200 bg-white">
              <MessageComposer sending={sending} onSend={sendMessage} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
