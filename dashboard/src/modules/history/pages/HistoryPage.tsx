import { Fragment, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  historyService,
  type MetricItem,
  type PostEventItem,
} from "../services/history.service";
import { getEventLabel } from "../../../shared/lib/status-dictionary";
import { getReelTitle } from "../lib/reel-title";

const PAGE_SIZE = 10;
const POST_EVENTS_LIMIT = 30;

type SortOrder = "desc" | "asc";

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("pt-BR");
}

function formatEventDetails(details: Record<string, unknown>) {
  const raw = JSON.stringify(details);

  if (raw.length <= 180) {
    return raw;
  }

  return `${raw.slice(0, 177)}...`;
}

function PaginationControls({
  currentPage,
  pageSize,
  total,
  onChange,
}: {
  currentPage: number;
  pageSize: number;
  total: number;
  onChange: (page: number) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const canGoBack = currentPage > 1;
  const canGoForward = currentPage < totalPages;

  return (
    <div className="history-pagination">
      <span className="history-pagination-summary">
        Pagina {currentPage} de {totalPages} • {total} reel
        {total === 1 ? "" : "s"}
      </span>
      <div className="history-pagination-actions">
        <button
          type="button"
          disabled={!canGoBack}
          onClick={() => onChange(currentPage - 1)}
        >
          Anterior
        </button>
        <button
          type="button"
          disabled={!canGoForward}
          onClick={() => onChange(currentPage + 1)}
        >
          Proxima
        </button>
      </div>
    </div>
  );
}

export function HistoryPage() {
  const [events, setEvents] = useState<PostEventItem[]>([]);
  const [metrics, setMetrics] = useState<MetricItem[]>([]);
  const [eventsTotal, setEventsTotal] = useState(0);
  const [metricsTotal, setMetricsTotal] = useState(0);
  const [eventsPage, setEventsPage] = useState(1);
  const [metricsPage, setMetricsPage] = useState(1);
  const [expandedEventPosts, setExpandedEventPosts] = useState<
    Record<string, boolean>
  >({});
  const [expandedMetricPosts, setExpandedMetricPosts] = useState<
    Record<string, boolean>
  >({});
  const [eventTypeFilters, setEventTypeFilters] = useState<
    Record<string, string>
  >({});
  const [eventSortOrders, setEventSortOrders] = useState<
    Record<string, SortOrder>
  >({});
  const [postEventsByPostId, setPostEventsByPostId] = useState<
    Record<string, PostEventItem[]>
  >({});
  const [loadingPostEvents, setLoadingPostEvents] = useState<
    Record<string, boolean>
  >({});
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
        historyService.getEvents({
          limit: PAGE_SIZE,
          offset: (eventsPage - 1) * PAGE_SIZE,
          groupByPost: true,
        }),
        historyService.getMetrics({
          limit: PAGE_SIZE,
          offset: (metricsPage - 1) * PAGE_SIZE,
          groupByPost: true,
        }),
      ]);

      setEvents(eventsData.items);
      setEventsTotal(eventsData.total);
      setMetrics(metricsData.items);
      setMetricsTotal(metricsData.total);
    } catch {
      setError("Falha ao carregar historico operacional.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadData().catch(() => null);
  }, [eventsPage, metricsPage]);

  const postEventTypeOptions = useMemo(() => {
    return Object.fromEntries(
      Object.entries(postEventsByPostId).map(([postId, items]) => [
        postId,
        Array.from(new Set(items.map((event) => event.eventType))).sort(),
      ]),
    ) as Record<string, string[]>;
  }, [postEventsByPostId]);

  async function ensurePostEventsLoaded(postId: string) {
    if (postEventsByPostId[postId] || loadingPostEvents[postId]) {
      return;
    }

    setLoadingPostEvents((current) => ({ ...current, [postId]: true }));

    try {
      const response = await historyService.getEvents({
        postId,
        limit: POST_EVENTS_LIMIT,
        offset: 0,
      });

      setPostEventsByPostId((current) => ({
        ...current,
        [postId]: response.items,
      }));
    } catch {
      setError("Falha ao carregar os eventos do reel.");
    } finally {
      setLoadingPostEvents((current) => ({ ...current, [postId]: false }));
    }
  }

  async function onCollectMetrics() {
    setIsCollecting(true);
    setMessage(null);
    setError(null);

    try {
      const result = await historyService.collectMetrics(collectLimit);
      setMessage(
        `Coleta concluida: ${result.collected} coletados, ${result.unchanged ?? 0} sem alteracao, ${result.skipped} pulados, modo ${result.mode}.`,
      );
      await loadData();
    } catch {
      setError("Falha ao executar coleta manual de metricas.");
    } finally {
      setIsCollecting(false);
    }
  }

  function getFilteredEvents(postId: string) {
    const items = postEventsByPostId[postId] ?? [];
    const selectedType = eventTypeFilters[postId] ?? "all";
    const sortOrder = eventSortOrders[postId] ?? "desc";

    return items
      .filter((event) =>
        selectedType === "all" ? true : event.eventType === selectedType,
      )
      .sort((left, right) => {
        const leftTime = new Date(left.createdAt).getTime();
        const rightTime = new Date(right.createdAt).getTime();

        return sortOrder === "asc"
          ? leftTime - rightTime
          : rightTime - leftTime;
      });
  }

  function toggleExpandedPost(
    section: "events" | "metrics",
    postId: string,
    nextOpen: boolean,
  ) {
    const setter =
      section === "events" ? setExpandedEventPosts : setExpandedMetricPosts;

    setter((current) => ({
      ...current,
      [postId]: nextOpen,
    }));

    if (nextOpen) {
      void ensurePostEventsLoaded(postId);
    }
  }

  function renderExpandedEvents(postId: string) {
    const isLoadingEvents = loadingPostEvents[postId] ?? false;
    const selectedType = eventTypeFilters[postId] ?? "all";
    const sortOrder = eventSortOrders[postId] ?? "desc";
    const filteredEvents = getFilteredEvents(postId);
    const eventTypes = postEventTypeOptions[postId] ?? [];

    return (
      <div className="history-expanded-panel">
        <div className="history-expanded-toolbar">
          <strong>Eventos recentes deste Reel</strong>
          <label>
            Filtrar
            <select
              value={selectedType}
              onChange={(event) =>
                setEventTypeFilters((current) => ({
                  ...current,
                  [postId]: event.target.value,
                }))
              }
            >
              <option value="all">Todos</option>
              {eventTypes.map((eventType) => (
                <option key={eventType} value={eventType}>
                  {getEventLabel(eventType).label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Ordenar
            <select
              value={sortOrder}
              onChange={(event) =>
                setEventSortOrders((current) => ({
                  ...current,
                  [postId]: event.target.value as SortOrder,
                }))
              }
            >
              <option value="desc">Mais recentes</option>
              <option value="asc">Mais antigos</option>
            </select>
          </label>
        </div>

        {isLoadingEvents ? <p className="history-empty-state">Carregando eventos...</p> : null}

        {!isLoadingEvents && filteredEvents.length > 0 ? (
          <div className="table-wrap">
            <table className="history-subtable">
              <thead>
                <tr>
                  <th>Quando</th>
                  <th>Evento</th>
                  <th>Detalhes</th>
                </tr>
              </thead>
              <tbody>
                {filteredEvents.map((event) => (
                  <tr key={event.id}>
                    <td>{formatDateTime(event.createdAt)}</td>
                    <td>
                      <span
                        className={`status-pill status-${getEventLabel(event.eventType).tone}`}
                        title={event.eventType}
                      >
                        {getEventLabel(event.eventType).label}
                      </span>
                    </td>
                    <td className="mono-text">
                      {formatEventDetails(event.details)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        {!isLoadingEvents && filteredEvents.length === 0 ? (
          <p className="history-empty-state">
            Nenhum evento recente encontrado para esse filtro.
          </p>
        ) : null}
      </div>
    );
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
        <div className="history-section-header">
          <h2>Eventos por Reel</h2>
          <p>Mostrando o evento mais recente de cada post, com acesso ao historico completo.</p>
        </div>
        <div
          className="table-wrap"
          role="region"
          aria-label="eventos operacionais"
        >
          <table>
            <thead>
              <tr>
                <th aria-label="expandir reel"></th>
                <th>Quando</th>
                <th>Post</th>
                <th>Evento</th>
                <th>Detalhes</th>
              </tr>
            </thead>
            <tbody>
              {events.map((event) => {
                const isExpanded = expandedEventPosts[event.postId] ?? false;
                const totalPostEvents =
                  postEventsByPostId[event.postId]?.length ?? null;

                return (
                  <Fragment key={event.id}>
                    <tr key={event.id}>
                      <td>
                        <button
                          type="button"
                          className="history-expand-button"
                          onClick={() =>
                            toggleExpandedPost(
                              "events",
                              event.postId,
                              !isExpanded,
                            )
                          }
                          aria-expanded={isExpanded}
                          aria-label={`${
                            isExpanded ? "Ocultar" : "Mostrar"
                          } eventos do reel`}
                        >
                          {isExpanded ? "−" : "+"}
                        </button>
                      </td>
                      <td>{formatDateTime(event.createdAt)}</td>
                      <td>
                        <div className="history-post-cell">
                          <Link to={`/reels/${event.postId}`} title={event.postId}>
                            {getReelTitle(event)}
                          </Link>
                          <span className="history-inline-note">
                            {totalPostEvents !== null
                              ? `${totalPostEvents} evento${totalPostEvents === 1 ? "" : "s"} carregado${totalPostEvents === 1 ? "" : "s"}`
                              : "Abra para ver os eventos deste reel"}
                          </span>
                        </div>
                      </td>
                      <td>
                        <span
                          className={`status-pill status-${getEventLabel(event.eventType).tone}`}
                          title={event.eventType}
                        >
                          {getEventLabel(event.eventType).label}
                        </span>
                      </td>
                      <td className="mono-text">
                        {formatEventDetails(event.details)}
                      </td>
                    </tr>
                    {isExpanded ? (
                      <tr className="history-expanded-row">
                        <td colSpan={5}>{renderExpandedEvents(event.postId)}</td>
                      </tr>
                    ) : null}
                  </Fragment>
                );
              })}
              {events.length === 0 ? (
                <tr>
                  <td colSpan={5}>Nenhum evento registrado.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <PaginationControls
          currentPage={eventsPage}
          pageSize={PAGE_SIZE}
          total={eventsTotal}
          onChange={setEventsPage}
        />
      </article>

      <article className="panel-card full-width">
        <div className="history-section-header">
          <h2>Metricas coletadas por Reel</h2>
          <p>Mostrando a coleta mais recente de cada post, com eventos relacionados.</p>
        </div>
        <div
          className="table-wrap"
          role="region"
          aria-label="metricas coletadas"
        >
          <table>
            <thead>
              <tr>
                <th aria-label="expandir reel"></th>
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
              {metrics.map((metric) => {
                const isExpanded = expandedMetricPosts[metric.postId] ?? false;
                const totalPostEvents =
                  postEventsByPostId[metric.postId]?.length ?? null;

                return (
                  <Fragment key={metric.id}>
                    <tr key={metric.id}>
                      <td>
                        <button
                          type="button"
                          className="history-expand-button"
                          onClick={() =>
                            toggleExpandedPost(
                              "metrics",
                              metric.postId,
                              !isExpanded,
                            )
                          }
                          aria-expanded={isExpanded}
                          aria-label={`${
                            isExpanded ? "Ocultar" : "Mostrar"
                          } eventos do reel`}
                        >
                          {isExpanded ? "−" : "+"}
                        </button>
                      </td>
                      <td>{formatDateTime(metric.fetchedAt)}</td>
                      <td>
                        <div className="history-post-cell">
                          <Link
                            to={`/reels/${metric.postId}`}
                            title={`Post: ${metric.postId}${metric.metaMediaId ? ` | Meta: ${metric.metaMediaId}` : ""}${metric.caption ? ` | Legenda: ${metric.caption}` : ""}`}
                          >
                            {getReelTitle(metric)}
                          </Link>
                          <span className="history-inline-note">
                            {totalPostEvents !== null
                              ? `${totalPostEvents} evento${totalPostEvents === 1 ? "" : "s"} carregado${totalPostEvents === 1 ? "" : "s"}`
                              : "Abra para ver os eventos deste reel"}
                          </span>
                        </div>
                      </td>
                      <td>{metric.views}</td>
                      <td>{metric.likes}</td>
                      <td>{metric.comments}</td>
                      <td>{metric.shares}</td>
                      <td>{metric.reach}</td>
                      <td>{metric.engagementRate}</td>
                    </tr>
                    {isExpanded ? (
                      <tr className="history-expanded-row">
                        <td colSpan={9}>{renderExpandedEvents(metric.postId)}</td>
                      </tr>
                    ) : null}
                  </Fragment>
                );
              })}
              {metrics.length === 0 ? (
                <tr>
                  <td colSpan={9}>Nenhuma metrica coletada ainda.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <PaginationControls
          currentPage={metricsPage}
          pageSize={PAGE_SIZE}
          total={metricsTotal}
          onChange={setMetricsPage}
        />
      </article>
    </section>
  );
}
