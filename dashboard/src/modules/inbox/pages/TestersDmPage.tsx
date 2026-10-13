import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { EyeOff, ListChecks, LoaderCircle, RefreshCw, Send } from "lucide-react";
import inboxService from "../services/inbox.service";
import type { TesterConversation } from "../types/inbox.types";
import { inboxErrorKey, type InboxErrorKey } from "../error-key";
import { deliveryUncertain } from "../uncertain-send";
import { formatDateTime } from "../../../shared/i18n/formatters";
import "../styles/inbox.css";

function wait(ms: number) { return new Promise(resolve => window.setTimeout(resolve, ms)); }
function recipient(conversation: TesterConversation) {
  return conversation.instagramUsername ? `@${conversation.instagramUsername}` : conversation.instagramUserId;
}

export default function TestersDmPage() {
  const { t } = useTranslation("inbox");
  const [defaultMessage] = useState(() => t("testers.defaultMessage"));
  const [loading, setLoading] = useState(true);
  const [operation, setOperation] = useState<{ id: string; kind: "send" | "flow" | "hide" } | null>(null);
  const [error, setError] = useState<InboxErrorKey | null>(null);
  const [success, setSuccess] = useState<{ key: "sendSuccess" | "flowSuccess" | "hideSuccess"; recipient: string } | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [conversations, setConversations] = useState<TesterConversation[]>([]);
  const pending = useRef(false);
  const loadVersion = useRef(0);
  const busy = operation !== null;

  const loadConversations = useCallback(async () => {
    const version = ++loadVersion.current;
    try {
      const response = await inboxService.listTesterConversations();
      if (version === loadVersion.current) { setConversations(response.items); setError(null); }
    } catch (failure) {
      if (version === loadVersion.current) setError(inboxErrorKey(failure, "testerLoad"));
    } finally {
      if (version === loadVersion.current) setLoading(false);
    }
  }, []);
  useEffect(() => {
    let active = true;
    const version = ++loadVersion.current;
    void inboxService.listTesterConversations().then(response => {
      if (active && version === loadVersion.current) setConversations(response.items);
    }).catch(failure => {
      if (active && version === loadVersion.current) setError(inboxErrorKey(failure, "testerLoad"));
    }).finally(() => {
      if (active && version === loadVersion.current) setLoading(false);
    });
    return () => { active = false; };
  }, []);

  function refresh() { setLoading(true); setError(null); return loadConversations(); }
  async function handleSend(conversation: TesterConversation) {
    if (pending.current) return;
    const draft = (drafts[conversation.id] ?? defaultMessage).trim();
    setSuccess(null);
    if (!draft) { setError("emptyDraft"); return; }
    pending.current = true; setOperation({ id: conversation.id, kind: "send" }); setError(null);
    try {
      await inboxService.sendTesterDm({ conversationId: conversation.id, message: draft });
      setSuccess({ key: "sendSuccess", recipient: recipient(conversation) });
      await refresh();
    } catch (failure) { setError(deliveryUncertain(failure) ? "deliveryUncertain" : inboxErrorKey(failure, "testerSend")); }
    finally { pending.current = false; setOperation(null); }
  }
  async function handleFlow(conversation: TesterConversation) {
    if (pending.current) return;
    // Snapshot generated content once; switching locale must not change an in-flight flow.
    const messages = [t("testers.flow1"), t("testers.flow2"), t("testers.flow3")];
    pending.current = true; setOperation({ id: conversation.id, kind: "flow" }); setError(null); setSuccess(null);
    try {
      for (let index = 0; index < messages.length; index++) {
        await inboxService.sendTesterDm({ conversationId: conversation.id, message: messages[index] });
        if (index < messages.length - 1) await wait(2000);
      }
      setSuccess({ key: "flowSuccess", recipient: recipient(conversation) });
      await refresh();
    } catch (failure) { setError(deliveryUncertain(failure) ? "deliveryUncertain" : inboxErrorKey(failure, "testerFlow")); }
    finally { pending.current = false; setOperation(null); }
  }
  async function handleHide(conversation: TesterConversation) {
    if (pending.current || !window.confirm(t("testers.hideConfirm", { recipient: recipient(conversation) }))) return;
    pending.current = true; setOperation({ id: conversation.id, kind: "hide" }); setError(null); setSuccess(null);
    try {
      await inboxService.hideTesterConversation(conversation.id);
      setConversations(items => items.filter(item => item.id !== conversation.id));
      setSuccess({ key: "hideSuccess", recipient: recipient(conversation) });
    } catch (failure) { setError(inboxErrorKey(failure, "testerHide")); }
    finally { pending.current = false; setOperation(null); }
  }

  return <section className="testers-page" aria-label={t("testers.title")}>
    <header className="testers-heading"><h2>{t("testers.title")}</h2>
      <button type="button" className="inbox-icon-button" title={t("testers.refresh")} aria-label={t("testers.refresh")}
        disabled={busy || loading} onClick={() => void refresh()}><RefreshCw size={18} /></button>
    </header>
    <div className="testers-notice"><strong>{t("testers.firstMessage")}</strong><span>{t("testers.authorizedOnly")}</span></div>
    {error ? <p className="inbox-error" role="alert">{t(`errors.${error}`)}</p> : null}
    {success ? <p className="testers-success" role="status">{t(`testers.${success.key}`, { recipient: success.recipient })}</p> : null}
    {loading ? <p role="status">{t("testers.loading")}</p> : !conversations.length ? <p>{t("testers.empty")}</p> : <div className="table-wrap" role="region" aria-label={t("testers.title")}>
      <table className="testers-table"><thead><tr>
        <th>{t("testers.name")}</th><th>{t("testers.username")}</th><th>{t("testers.userId")}</th>
        <th>{t("testers.lastMessage")}</th><th>{t("testers.lastDate")}</th><th>{t("testers.message")}</th><th>{t("testers.actions")}</th>
      </tr></thead><tbody>{conversations.map(conversation => {
        const current = operation?.id === conversation.id ? operation.kind : null;
        return <tr key={conversation.id}>
          <td>{conversation.instagramName || "-"}</td><td>{conversation.instagramUsername ? `@${conversation.instagramUsername}` : "-"}</td>
          <td className="mono-text">{conversation.instagramUserId}</td><td>{conversation.lastMessageText || "-"}</td>
          <td>{conversation.lastMessageAt ? <time dateTime={conversation.lastMessageAt}>{formatDateTime(conversation.lastMessageAt, { dateStyle: "short", timeStyle: "short" })}</time> : "-"}</td>
          <td><textarea value={drafts[conversation.id] ?? defaultMessage} aria-label={t("testers.draftLabel", { recipient: recipient(conversation) })}
            onChange={event => setDrafts(items => ({ ...items, [conversation.id]: event.target.value }))} rows={3} disabled={busy} /></td>
          <td><div className="testers-actions">
            <button type="button" disabled={busy} onClick={() => void handleSend(conversation)}>
              {current === "send" ? <LoaderCircle size={16} className="inbox-spin" /> : <Send size={16} />}{t(current === "send" ? "testers.sending" : "testers.send")}
            </button>
            <button type="button" disabled={busy} onClick={() => void handleFlow(conversation)}>
              {current === "flow" ? <LoaderCircle size={16} className="inbox-spin" /> : <ListChecks size={16} />}{t(current === "flow" ? "testers.flowing" : "testers.flow")}
            </button>
            <button type="button" disabled={busy} title={t("testers.hideTitle")} onClick={() => void handleHide(conversation)}>
              {current === "hide" ? <LoaderCircle size={16} className="inbox-spin" /> : <EyeOff size={16} />}{t(current === "hide" ? "testers.hiding" : "testers.hide")}
            </button>
          </div></td>
        </tr>;
      })}</tbody></table>
    </div>}
  </section>;
}
