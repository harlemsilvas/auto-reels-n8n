import { Fragment, useEffect, useRef } from "react";
import type { Message } from "../types/inbox.types";
import MessageBubble from "./MessageBubble";
import { useTranslation } from "react-i18next";
import { formatDateTime } from "../../../shared/i18n/formatters";

export default function ConversationMessages({ loading = false, messages, conversationId }: { loading?: boolean; messages: Message[]; conversationId: string }) {
  const { t } = useTranslation("inbox");
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const nearBottom = useRef(true);
  const previousConversationId = useRef(conversationId);
  const lastMessageId = messages.at(-1)?.id;
  useEffect(() => {
    if (previousConversationId.current !== conversationId) {
      previousConversationId.current = conversationId;
      nearBottom.current = true;
    }
    if (nearBottom.current && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [lastMessageId, conversationId]);
  const day = (value: string) => {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? t("dateUnavailable") : formatDateTime(date, { day: "numeric", month: "long", year: "numeric" });
  };
  return <div ref={scrollRef} className="inbox-messages" aria-label={t("messages")} aria-busy={loading} onScroll={(event) => {
    const node = event.currentTarget;
    nearBottom.current = node.scrollHeight - node.scrollTop - node.clientHeight < 80;
  }}>
    {!messages.length ? <p className="inbox-state">{t(loading ? "loadingMessages" : "noMessages")}</p> : null}
    {messages.map((message, index) => <Fragment key={message.id}>
      {index === 0 || day(message.createdAt) !== day(messages[index - 1].createdAt) ? <div className="inbox-date-divider"><span>{day(message.createdAt)}</span></div> : null}
      <MessageBubble message={message} />
    </Fragment>)}
  </div>;
}
