import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  historyService,
  type ReelDetail,
} from "../services/history.service";
import { getEventLabel, getStatusLabel } from "../../../shared/lib/status-dictionary";
import { getReelTitle } from "../lib/reel-title";

function formatDateTime(value: string | null) {
  if (!value) {
    return "-";
  }

  return new Date(value).toLocaleString("pt-BR");
}

function formatDelta(value: number) {
  if (value > 0) {
    return `+${value}`;
  }

  return String(value);
}

function getPublishTypeLabel(value: ReelDetail["post"]["publishType"]) {
  const labels: Record<ReelDetail["post"]["publishType"], string> = {
    feed_carousel: "Carrossel",
    feed_image: "Feed imagem",
    reel: "Reel",
    story_image: "Story imagem",
    story_video: "Story vídeo",
  };

  return labels[value] ?? value;
}

function getPostOrigin(detail: ReelDetail) {
  if (!detail.post.mediaTemplateId) {
    return {
      title: "Upload/manual",
      detail: "Sem modelo/TAG",
    };
  }

  return {
    title: detail.post.mediaTemplateTag
      ? `TAG ${detail.post.mediaTemplateTag}`
      : "Modelo por TAG",
    detail: [
      detail.post.mediaTemplateName,
      detail.post.mediaTemplateTextVariantTitle
        ? `Texto: ${detail.post.mediaTemplateTextVariantTitle}`
        : null,
    ]
      .filter(Boolean)
      .join(" · "),
  };
}

function buildPolylinePoints(values: number[], maxValue: number) {
  if (values.length === 0) {
    return "";
  }

  if (values.length === 1) {
    const y = 110 - (values[0] / maxValue) * 90;
    return `20,${y} 320,${y}`;
  }

  return values
    .map((value, index) => {
      const x = 20 + (index / (values.length - 1)) * 300;
      const y = 110 - (value / maxValue) * 90;

      return `${x},${y}`;
    })
    .join(" ");
}

export function ReelDetailsPage() {
  const { id } = useParams();
  const [detail, setDetail] = useState<ReelDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) {
      setError("Post nao informado.");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    historyService
      .getReelDetail(id)
      .then((data) => setDetail(data))
      .catch(() => setError("Falha ao carregar detalhes do post."))
      .finally(() => setIsLoading(false));
  }, [id]);

  const maxTimelineValue = useMemo(() => {
    if (!detail?.timeline.length) {
      return 1;
    }

    return Math.max(
      1,
      ...detail.timeline.flatMap((item) => [item.likes, item.views, item.reach]),
    );
  }, [detail]);

  if (isLoading) {
    return <p>Carregando post...</p>;
  }

  if (error || !detail) {
    return <p className="error-text">{error ?? "Post nao encontrado."}</p>;
  }

  const title = getReelTitle({
    postId: detail.post.id,
    postTitle: detail.post.title,
    videoFilename: detail.post.videoFilename,
    caption: detail.post.caption,
  });
  const status = getStatusLabel(detail.post.status);
  const latest = detail.latestMetrics;
  const origin = getPostOrigin(detail);

  const metricCards = [
    ["Likes", latest?.likes ?? 0, detail.delta.likes],
    ["Views", latest?.views ?? 0, detail.delta.views],
    ["Reach", latest?.reach ?? 0, detail.delta.reach],
    ["Shares", latest?.shares ?? 0, null],
    ["Comments", latest?.comments ?? 0, null],
    ["Saves", latest?.saved ?? 0, null],
  ];
  const likesPoints = buildPolylinePoints(
    detail.timeline.map((item) => item.likes),
    maxTimelineValue,
  );
  const viewsPoints = buildPolylinePoints(
    detail.timeline.map((item) => item.views),
    maxTimelineValue,
  );
  const reachPoints = buildPolylinePoints(
    detail.timeline.map((item) => item.reach),
    maxTimelineValue,
  );

  return (
    <section className="dashboard-grid">
      <article className="panel-card full-width">
        <div className="workflow-next-actions">
          <Link className="link-button" to="/historico">
            Voltar para histórico
          </Link>
          <Link className="link-button" to="/agendamentos">
            Ver agendamentos
          </Link>
          {detail.post.mediaTemplateId ? (
            <Link className="link-button" to="/modelos">
              Ver modelos
            </Link>
          ) : null}
        </div>
        <p className="eyebrow">Detalhes do post</p>
        <h2 style={{ marginTop: 12 }}>{title}</h2>
        <dl className="stat-list">
          <div>
            <dt>Tipo</dt>
            <dd>{getPublishTypeLabel(detail.post.publishType)}</dd>
          </div>
          <div>
            <dt>Origem</dt>
            <dd>
              <strong>{origin.title}</strong>
              <br />
              <span className="history-inline-note">{origin.detail}</span>
            </dd>
          </div>
          <div>
            <dt>Status</dt>
            <dd>
              <span className={`status-pill status-${status.tone}`}>
                {status.label}
              </span>
            </dd>
          </div>
          <div>
            <dt>Agendado para</dt>
            <dd>{formatDateTime(detail.post.scheduledAt)}</dd>
          </div>
          <div>
            <dt>Publicado em</dt>
            <dd>{formatDateTime(detail.post.publishedAt)}</dd>
          </div>
          <div>
            <dt>Criado em</dt>
            <dd>{formatDateTime(detail.post.createdAt)}</dd>
          </div>
          <div>
            <dt>Atualizado em</dt>
            <dd>{formatDateTime(detail.post.updatedAt)}</dd>
          </div>
          <div>
            <dt>Retry</dt>
            <dd>{detail.post.retryCount}/2</dd>
          </div>
          <div>
            <dt>Erro</dt>
            <dd>{detail.post.errorMessage ?? "-"}</dd>
          </div>
          <div>
            <dt>Meta Container ID</dt>
            <dd>{detail.post.metaContainerId ?? "-"}</dd>
          </div>
          <div>
            <dt>Meta Media ID</dt>
            <dd>{detail.post.metaMediaId ?? "-"}</dd>
          </div>
          <div>
            <dt>Conta Instagram</dt>
            <dd>{detail.post.accountName ?? detail.post.instagramId ?? "-"}</dd>
          </div>
          <div>
            <dt>Mídia principal</dt>
            <dd>
              {detail.post.mediaFile ?? "-"}
              {detail.post.mediaItemsCount > 1
                ? ` (+${detail.post.mediaItemsCount - 1})`
                : ""}
            </dd>
          </div>
        </dl>
      </article>

      {metricCards.map(([label, value, delta]) => (
        <article key={label} className="metric-card">
          <p className="metric-label">{label}</p>
          <p className="metric-value">{value}</p>
          {typeof delta === "number" ? (
            <p className="metric-trend tone-ok">{formatDelta(delta)}</p>
          ) : (
            <p className="metric-trend">Ultima coleta</p>
          )}
        </article>
      ))}

      <article className="panel-card full-width">
        <h2>Evolucao</h2>
        {detail.timeline.length > 0 ? (
          <div className="line-chart" aria-label="evolucao de metricas">
            <div className="chart-legend">
              <span className="legend-likes">Likes</span>
              <span className="legend-views">Views</span>
              <span className="legend-reach">Reach</span>
            </div>
            <svg viewBox="0 0 340 130" role="img" aria-label="grafico temporal">
              <line x1="20" y1="110" x2="320" y2="110" />
              <line x1="20" y1="20" x2="20" y2="110" />
              <polyline className="line-likes" points={likesPoints} />
              <polyline className="line-views" points={viewsPoints} />
              <polyline className="line-reach" points={reachPoints} />
            </svg>
            <div className="chart-range">
              <span>{formatDateTime(detail.timeline[0]?.date ?? null)}</span>
              <strong>Ultimos {detail.timeline.length} pontos</strong>
              <span>
                {formatDateTime(
                  detail.timeline[detail.timeline.length - 1]?.date ?? null,
                )}
              </span>
            </div>
          </div>
        ) : (
          <p>Nenhuma metrica coletada ainda.</p>
        )}
      </article>

      <article className="panel-card full-width">
        <h2>Eventos</h2>
        <div className="table-wrap" role="region" aria-label="eventos do post">
          <table>
            <thead>
              <tr>
                <th>Quando</th>
                <th>Evento</th>
                <th>Detalhes</th>
              </tr>
            </thead>
            <tbody>
              {detail.events.map((event) => {
                const eventLabel = getEventLabel(event.eventType);

                return (
                  <tr key={event.id}>
                    <td>{formatDateTime(event.createdAt)}</td>
                    <td>
                      <span
                        className={`status-pill status-${eventLabel.tone}`}
                        title={event.eventType}
                      >
                        {eventLabel.label}
                      </span>
                    </td>
                    <td className="mono-text">{JSON.stringify(event.details)}</td>
                  </tr>
                );
              })}
              {detail.events.length === 0 ? (
                <tr>
                  <td colSpan={3}>Nenhum evento registrado.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </article>
    </section>
  );
}
