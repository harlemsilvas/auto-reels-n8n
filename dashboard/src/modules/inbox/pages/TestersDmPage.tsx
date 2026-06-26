import { useEffect, useMemo, useState } from "react";
import inboxService from "../services/inbox.service";
import type { TesterConversation } from "../types/inbox.types";

const TEST_FLOW_MESSAGES = [
  "Ola! Este e um teste do SocialBot.",
  "Mensagem 2: recebemos sua DM corretamente.",
  "Mensagem 3: teste finalizado com sucesso.",
] as const;

function formatDate(value?: string | null) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

function wait(ms: number) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

export default function TestersDmPage() {
  const [loading, setLoading] = useState(true);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [flowingId, setFlowingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [messageDrafts, setMessageDrafts] = useState<Record<string, string>>({});
  const [conversations, setConversations] = useState<TesterConversation[]>([]);

  const primaryButtonStyle = {
    border: "none",
    borderRadius: "10px",
    background: "#18181b",
    color: "#fafafa",
    padding: "0.7rem 1rem",
    fontWeight: 600,
    cursor: "pointer",
  } as const;

  const secondaryButtonStyle = {
    border: "1px solid #d4d4d8",
    borderRadius: "10px",
    background: "#ffffff",
    color: "#18181b",
    padding: "0.7rem 1rem",
    fontWeight: 600,
    cursor: "pointer",
  } as const;

  const hasConversations = useMemo(
    () => conversations.length > 0,
    [conversations.length],
  );

  async function loadConversations() {
    setLoading(true);
    setError(null);

    try {
      const response = await inboxService.listTesterConversations();
      setConversations(response.items);
    } catch (loadError: any) {
      setError(
        loadError?.response?.data?.message ||
          loadError?.message ||
          "Falha ao carregar conversas de teste.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadConversations();
  }, []);

  function updateDraft(conversationId: string, value: string) {
    setMessageDrafts((current) => ({
      ...current,
      [conversationId]: value,
    }));
  }

  async function handleSend(conversation: TesterConversation) {
    const draft = String(messageDrafts[conversation.id] ?? "").trim();

    if (!draft) {
      setError("Digite uma mensagem antes de enviar.");
      setSuccess(null);
      return;
    }

    setSendingId(conversation.id);
    setError(null);
    setSuccess(null);

    try {
      await inboxService.sendTesterDm({
        conversationId: conversation.id,
        message: draft,
      });

      setSuccess(`DM enviada para @${conversation.instagramUsername || "tester"}.`);
      await loadConversations();
    } catch (sendError: any) {
      setError(
        sendError?.response?.data?.message ||
          sendError?.message ||
          "Falha ao enviar DM de teste.",
      );
    } finally {
      setSendingId(null);
    }
  }

  async function handleFlow(conversation: TesterConversation) {
    setFlowingId(conversation.id);
    setError(null);
    setSuccess(null);

    try {
      for (let index = 0; index < TEST_FLOW_MESSAGES.length; index += 1) {
        await inboxService.sendTesterDm({
          conversationId: conversation.id,
          message: TEST_FLOW_MESSAGES[index],
        });

        if (index < TEST_FLOW_MESSAGES.length - 1) {
          await wait(2000);
        }
      }

      setSuccess(
        `Fluxo de teste enviado para @${conversation.instagramUsername || "tester"}.`,
      );
      await loadConversations();
    } catch (flowError: any) {
      setError(
        flowError?.response?.data?.message ||
          flowError?.message ||
          "Falha ao enviar o fluxo de teste.",
      );
    } finally {
      setFlowingId(null);
    }
  }

  return (
    <section className="dashboard-grid">
      <article className="panel-card full-width">
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: "1rem",
            alignItems: "flex-start",
            flexWrap: "wrap",
          }}
        >
          <div>
            <h2>Teste de DM com Testadores Instagram</h2>
            <p style={{ margin: 0, color: "#71717a" }}>
              Painel interno para responder testers autorizados da Meta.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void loadConversations()}
            style={secondaryButtonStyle}
          >
            Atualizar
          </button>
        </div>

        <div
          style={{
            display: "grid",
            gap: "0.75rem",
            marginTop: "1rem",
            padding: "1rem",
            borderRadius: "16px",
            background: "#fff7ed",
            border: "1px solid #fdba74",
          }}
        >
          <strong>Primeiro o tester precisa enviar uma DM para @hrmmotos.</strong>
          <span>Use apenas com testadores autorizados.</span>
        </div>

        {error ? <p className="error-text">{error}</p> : null}
        {success ? <p style={{ color: "#166534", marginTop: "1rem" }}>{success}</p> : null}

        {loading ? <p style={{ marginTop: "1rem" }}>Carregando conversas...</p> : null}

        {!loading && !hasConversations ? (
          <p style={{ marginTop: "1rem" }}>
            Nenhuma conversa encontrada ainda. Aguarde o tester enviar a primeira DM.
          </p>
        ) : null}

        {!loading && hasConversations ? (
          <div style={{ overflowX: "auto", marginTop: "1rem" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "980px" }}>
              <thead>
                <tr style={{ textAlign: "left", borderBottom: "1px solid #d4d4d8" }}>
                  <th style={{ padding: "0.75rem" }}>Nome</th>
                  <th style={{ padding: "0.75rem" }}>Username</th>
                  <th style={{ padding: "0.75rem" }}>Instagram User ID</th>
                  <th style={{ padding: "0.75rem" }}>Ultima mensagem</th>
                  <th style={{ padding: "0.75rem" }}>Ultima data</th>
                  <th style={{ padding: "0.75rem", width: "280px" }}>Mensagem</th>
                  <th style={{ padding: "0.75rem", width: "240px" }}>Acoes</th>
                </tr>
              </thead>
              <tbody>
                {conversations.map((conversation) => {
                  const isSending = sendingId === conversation.id;
                  const isFlowing = flowingId === conversation.id;
                  const isBusy = isSending || isFlowing;

                  return (
                    <tr key={conversation.id} style={{ borderBottom: "1px solid #e4e4e7" }}>
                      <td style={{ padding: "0.75rem" }}>
                        {conversation.instagramName || "-"}
                      </td>
                      <td style={{ padding: "0.75rem" }}>
                        {conversation.instagramUsername
                          ? `@${conversation.instagramUsername}`
                          : "-"}
                      </td>
                      <td style={{ padding: "0.75rem", fontFamily: "monospace" }}>
                        {conversation.instagramUserId}
                      </td>
                      <td style={{ padding: "0.75rem" }}>
                        {conversation.lastMessageText || "-"}
                      </td>
                      <td style={{ padding: "0.75rem" }}>
                        {formatDate(conversation.lastMessageAt)}
                      </td>
                      <td style={{ padding: "0.75rem" }}>
                        <textarea
                          value={messageDrafts[conversation.id] ?? "Mensagem de teste SocialBot"}
                          onChange={(event) =>
                            updateDraft(conversation.id, event.target.value)
                          }
                          rows={3}
                          disabled={isBusy}
                          style={{
                            width: "100%",
                            resize: "vertical",
                            borderRadius: "12px",
                            border: "1px solid #d4d4d8",
                            padding: "0.75rem",
                          }}
                        />
                      </td>
                      <td style={{ padding: "0.75rem" }}>
                        <div style={{ display: "grid", gap: "0.5rem" }}>
                          <button
                            type="button"
                            onClick={() => void handleSend(conversation)}
                            disabled={isBusy}
                            style={primaryButtonStyle}
                          >
                            {isSending ? "Enviando..." : "Enviar DM de teste"}
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleFlow(conversation)}
                            disabled={isBusy}
                            style={secondaryButtonStyle}
                          >
                            {isFlowing ? "Enviando fluxo..." : "Enviar fluxo teste"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : null}
      </article>
    </section>
  );
}
