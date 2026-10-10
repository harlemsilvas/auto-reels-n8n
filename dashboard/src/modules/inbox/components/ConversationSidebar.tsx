import { useState } from "react";
import { Camera, RefreshCw, Search } from "lucide-react";
import type { Conversation } from "../types/inbox.types";
import ConversationItem from "./ConversationItem";

interface Props {
  loading?: boolean;
  conversations: Conversation[];
  selectedConversation: Conversation | null;
  onSelectConversation: (conversation: Conversation) => void;
  onRefresh: () => void;
}

export default function ConversationSidebar({ loading, conversations, selectedConversation, onSelectConversation, onRefresh }: Props) {
  const [search, setSearch] = useState("");
  const [unreadOnly, setUnreadOnly] = useState(false);
  const unread = conversations.filter((item) => (item.unreadCount ?? 0) > 0).length;
  const filtered = conversations.filter((item) => {
    const text = [item.instagramName, item.instagramUsername, item.instagramUserId, item.lastMessageText].join(" ").toLocaleLowerCase();
    return text.includes(search.trim().toLocaleLowerCase()) && (!unreadOnly || (item.unreadCount ?? 0) > 0);
  });
  return <aside className="inbox-sidebar" aria-label="Conversas Instagram">
    <header className="inbox-sidebar-header">
      <div className="inbox-heading"><Camera size={21} /><h2>Instagram Inbox</h2></div>
      <button className="inbox-icon-button" title="Atualizar conversas" aria-label="Atualizar conversas" disabled={loading} onClick={onRefresh}><RefreshCw size={18} className={loading ? "inbox-spin" : ""} /></button>
    </header>
    <div className="inbox-sidebar-tools">
      <label className="inbox-search"><Search size={17} /><input aria-label="Buscar conversas" placeholder="Buscar conversa" value={search} onChange={(event) => setSearch(event.target.value)} /></label>
      <div className="inbox-filters" aria-label="Filtrar conversas">
        <button aria-pressed={!unreadOnly} onClick={() => setUnreadOnly(false)}>Todas <span>{conversations.length}</span></button>
        <button aria-pressed={unreadOnly} onClick={() => setUnreadOnly(true)}>Nao lidas <span>{unread}</span></button>
      </div>
    </div>
    <div className="inbox-conversation-list" aria-busy={loading}>
      {loading && !conversations.length ? <p className="inbox-state">Carregando conversas...</p> : null}
      {!loading && !filtered.length ? <p className="inbox-state">{search || unreadOnly ? "Nenhuma conversa encontrada." : "Nenhuma conversa recebida."}</p> : null}
      {filtered.map((conversation) => <ConversationItem key={conversation.id} conversation={conversation} selected={selectedConversation?.id === conversation.id} onClick={onSelectConversation} />)}
    </div>
  </aside>;
}
