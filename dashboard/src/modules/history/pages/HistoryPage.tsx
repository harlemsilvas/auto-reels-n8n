import { useEffect, useState } from "react";
import {
  historyService,
  type MetricItem,
  type PostEventItem,
} from "../services/history.service";
import { buildApiUrl } from "../../../shared/config/api";
import { getEventLabel } from "../../../shared/lib/status-dictionary";

function shortId(value: string) {
  return value.slice(0, 8);
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("pt-BR");
}

export function HistoryPage() {
  const [events, setEvents] = useState<PostEventItem[]>([]);
  const [metrics, setMetrics] = useState<MetricItem[]>([]);
  const [collectLimit, setCollectLimit] = useState(5);
  const [isLoading, setIsLoading] = useState(true);
  const [isCollecting, setIsCollecting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadData() {
    setIsLoading(true);
    setError(null);

    try {
      const [eventsData, metricsData] = await Promise.all([
        historyService.getEvents(60),
        historyService.getMetrics(60),
      ]);
      setEvents(eventsData.items);
      setMetrics(metricsData.items);
    } catch {
      setError("Falha ao carregar historico operacional.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadData().catch(() => null);
  }, []);

  async function onCollectMetrics() {
    setIsCollecting(true);
    setMessage(null);
    setError(null);

    try {
      const result = await historyService.collectMetrics(collectLimit);
      setMessage(
        `Coleta concluida: ${result.collected} coletados, ${result.skipped} pulados, modo ${result.mode}.`,
      );
      await loadData();
    } catch {
      setError("Falha ao executar coleta manual de metricas.");
    } finally {
      setIsCollecting(false);
    }
  }

  return (
    <section className="dashboard-grid">
      <article className="panel-card full-width">
        <div className="panel-actions">
          <h2 style={{ margin: 0 }}>Historico operacional</h2>
          <div className="panel-actions">
            <label>
              Limite da coleta
              <input
                type="number"
                min={1}
                max={100}
                value={collectLimit}
                onChange={(event) =>
                  setCollectLimit(Number(event.target.value))
                }
                style={{ marginLeft: 8, width: 80 }}
              />
            </label>
            <button type="button" onClick={() => void loadData()}>
              Atualizar
            </button>
            <button
              type="button"
              disabled={isCollecting}
              onClick={onCollectMetrics}
            >
              {isCollecting ? "Coletando..." : "Coletar metricas"}
            </button>
          </div>
        </div>

        {message ? (
          <p style={{ color: "#0b7a38", marginTop: 12 }}>{message}</p>
        ) : null}
        {error ? (
          <p className="error-text" style={{ marginTop: 12 }}>
            {error}
          </p>
        ) : null}
        {isLoading ? <p>Carregando historico...</p> : null}
      </article>

      <article className="panel-card full-width">
        <h2>Eventos recentes</h2>
        <div
          className="table-wrap"
          role="region"
          aria-label="eventos operacionais"
        >
          <table>
            <thead>
              <tr>
                <th>Quando</th>
                <th>Post</th>
                <th>Evento</th>
                <th>Detalhes</th>
              </tr>
            </thead>
            <tbody>
              {events.map((event) => (
                <tr key={event.id}>
                  <td>{formatDateTime(event.createdAt)}</td>
                  <td className="mono-text">{shortId(event.postId)}</td>
                  <td>
                    <span
                      className={`status-pill status-${getEventLabel(event.eventType).tone}`}
                      title={event.eventType}
                    >
                      {getEventLabel(event.eventType).label}
                    </span>
                  </td>
                  <td className="mono-text">{JSON.stringify(event.details)}</td>
                </tr>
              ))}
              {events.length === 0 ? (
                <tr>
                  <td colSpan={4}>Nenhum evento registrado.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </article>

      <article className="panel-card full-width">
        <h2>Metricas coletadas</h2>
        <div
          className="table-wrap"
          role="region"
          aria-label="metricas coletadas"
        >
          <table>
            <thead>
              <tr>
                <th>Quando</th>
                <th>Post</th>
                <th>Views</th>
                <th>Likes</th>
                <th>Comments</th>
                <th>Shares</th>
                <th>Reach</th>
                <th>ER %</th>
              </tr>
            </thead>
            <tbody>
              {metrics.map((metric) => (
                <tr key={metric.id}>
                  <td>{formatDateTime(metric.fetchedAt)}</td>
                  <td className="mono-text">
                    <a
                      href={buildApiUrl(
                        `/api/internal/posts/events?postId=${metric.postId}&limit=20`,
                      )}
                      target="_blank"
                      rel="noreferrer"
                      title={`Post: ${metric.postId}${metric.metaMediaId ? ` | Meta: ${metric.metaMediaId}` : ""}${metric.caption ? ` | Legenda: ${metric.caption}` : ""}`}
                    >
                      {shortId(metric.postId)}
                    </a>
                  </td>
                  <td>{metric.views}</td>
                  <td>{metric.likes}</td>
                  <td>{metric.comments}</td>
                  <td>{metric.shares}</td>
                  <td>{metric.reach}</td>
                  <td>{metric.engagementRate}</td>
                </tr>
              ))}
              {metrics.length === 0 ? (
                <tr>
                  <td colSpan={8}>Nenhuma metrica coletada ainda.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </article>
    </section>
  );
}
