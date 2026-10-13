import "../styles/inbox.css";
import { useEffect, useState } from "react";
import { ArrowLeft, Camera } from "lucide-react";
import { useConversations } from "../hooks/useConversations";
import { useMessages } from "../hooks/useMessages";
import ConversationSidebar from "../components/ConversationSidebar";
import ConversationMessages from "../components/ConversationMessages";
import MessageComposer from "../components/MessageComposer";
import EmptyConversation from "../components/EmptyConversation";
import useRealtimeInbox from "../hooks/useRealtimeInbox";
import { useAuth } from "../../auth/context/AuthContext";
import { useTranslation } from "react-i18next";

export default function InstagramInboxPage() {
  const { t } = useTranslation("inbox");
  const { can } = useAuth();
  const { loading: conversationsLoading, error: conversationsError, conversations, selectedConversation, setSelectedConversation, updateUnreadCount, refresh: refreshConversations } = useConversations();
  const [mobileChat, setMobileChat] = useState(false);
  const [narrowScreen, setNarrowScreen] = useState(() => window.matchMedia("(max-width: 760px)").matches);
  useEffect(() => {
    const media = window.matchMedia("(max-width: 760px)");
    const changed = () => setNarrowScreen(media.matches);
    media.addEventListener("change", changed);
    return () => media.removeEventListener("change", changed);
  }, []);
  const { loading: messagesLoading, error: messagesError, sending, uncertain, draftToRestore, onDraftChange, discardUncertain, messages, sendMessage, sendImage, receiveMessage } = useMessages(selectedConversation, updateUnreadCount, !narrowScreen || mobileChat);
  useRealtimeInbox({
    selectedConversation,
    onNewMessage: receiveMessage,
    onConnected() { void refreshConversations(); },
    onConversationUpdate() { void refreshConversations(); },
  });
  const name = selectedConversation?.instagramName || selectedConversation?.instagramUsername || `ID ${selectedConversation?.instagramUserId}`;
  return <section className={`instagram-inbox ${mobileChat ? "is-chat-open" : ""}`} aria-label={t("title")}>
    {conversationsError ? <p className="inbox-error" role="alert">{conversationsError}</p> : null}
    <div className="inbox-workspace">
      <ConversationSidebar loading={conversationsLoading} conversations={conversations} selectedConversation={selectedConversation} onRefresh={() => void refreshConversations()} onSelectConversation={(conversation) => { setSelectedConversation(conversation); setMobileChat(true); }} />
      <div className="inbox-chat">
        {!selectedConversation ? <EmptyConversation /> : <>
          <header className="inbox-chat-header">
            <button className="inbox-icon-button inbox-back" aria-label={t("back")} title={t("back")} onClick={() => setMobileChat(false)}><ArrowLeft size={20} /></button>
            <div className="inbox-avatar">{selectedConversation.profilePictureUrl ? <img src={selectedConversation.profilePictureUrl} alt="" /> : name.charAt(0).toUpperCase()}</div>
            <div className="inbox-chat-identity"><strong>{name}</strong><span>{selectedConversation.instagramUsername ? `@${selectedConversation.instagramUsername}` : selectedConversation.instagramUserId}</span></div>
            <span className="inbox-channel"><Camera size={16} /><span>{selectedConversation.accountName || "Instagram"}</span></span>
          </header>
          {messagesError ? <p className="inbox-error" role="alert">{messagesError}</p> : null}
          <ConversationMessages conversationId={selectedConversation.id} loading={messagesLoading} messages={messages} />
          {can("inbox.reply") ? <MessageComposer key={`${selectedConversation.id}:${uncertain}`} initialDraft={draftToRestore} onDraftChange={onDraftChange} sending={sending} uncertain={uncertain} onDiscardUncertain={discardUncertain} onSend={sendMessage} onSendImage={sendImage} /> : <p className="inbox-readonly-notice">{t("readonly")}</p>}
        </>}
      </div>
    </div>
  </section>;
}
