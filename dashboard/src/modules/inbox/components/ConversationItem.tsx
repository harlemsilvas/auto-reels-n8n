import type { Conversation } from "../types/inbox.types";

interface Props { conversation: Conversation; selected?: boolean; onClick: (conversation: Conversation) => void }

export default function ConversationItem({ conversation, selected = false, onClick }: Props) {
  const name = conversation.instagramName || conversation.instagramUsername || `ID ${conversation.instagramUserId}`;
  const date = conversation.lastMessageAt ? new Date(conversation.lastMessageAt) : null;
  return <button type="button" className={`inbox-conversation-item ${selected ? "is-selected" : ""}`} aria-current={selected ? "true" : undefined} onClick={() => onClick(conversation)}>
    <span className="inbox-avatar">{conversation.profilePictureUrl ? <img src={conversation.profilePictureUrl} alt="" /> : name.charAt(0).toUpperCase()}</span>
    <span className="inbox-conversation-copy">
      <span className="inbox-conversation-title"><strong>{name}</strong>{date && !Number.isNaN(date.getTime()) ? <time dateTime={conversation.lastMessageAt!} title={date.toLocaleString("pt-BR")}>{date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}</time> : null}</span>
      <span className="inbox-conversation-username">{conversation.instagramUsername ? `@${conversation.instagramUsername}` : conversation.accountName || "Instagram"}</span>
      <span className="inbox-conversation-preview"><span>{conversation.lastMessageText || "Sem resumo de mensagem"}</span>{(conversation.unreadCount ?? 0) > 0 ? <b className="inbox-unread" aria-label={`${conversation.unreadCount} mensagens nao lidas`}>{conversation.unreadCount}</b> : null}</span>
    </span>
  </button>;
}
