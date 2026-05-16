import { useEffect, useMemo, useState } from "react";
import {
  scheduleService,
  type PostListItem,
  type QueueStats,
} from "../services/schedule.service";

const DEFAULT_STATS: QueueStats = {
  waiting: 0,
  active: 0,
  completed: 0,
  failed: 0,
  delayed: 0,
  paused: 0,
};

function shortId(value: string) {
  return value.slice(0, 8);
}

function formatDateTime(value: string | null) {
  if (!value) {
    return "-";
  }

  return new Date(value).toLocaleString("pt-BR");
}

function formatRelativeFromNow(value: string | null, nowMs: number) {
  if (!value) {
    return "sem horario";
  }

  const diffMs = Math.max(0, nowMs - new Date(value).getTime());
  const minutes = Math.floor(diffMs / 60000);

  if (minutes < 1) {
    return "agora";
  }

  if (minutes < 60) {
    return `ha ${minutes} min`;
  }

  const hours = Math.floor(minutes / 60);

  if (hours < 24) {
    return `ha ${hours} h`;
  }

  const days = Math.floor(hours / 24);
  return `ha ${days} d`;
}

type ToastTone = "ok" | "warn" | "error";

type ToastState = {
  text: string;
  tone: ToastTone;
} | null;

export function SchedulePage() {
  const [posts, setPosts] = useState<PostListItem[]>([]);
  const [latestPublished, setLatestPublished] = useState<PostListItem | null>(
    null,
  );
  const [stats, setStats] = useState<QueueStats>(DEFAULT_STATS);
  const [statusFilter, setStatusFilter] = useState("all");
  const [isLoading, setIsLoading] = useState(true);
  const [isEnqueueing, setIsEnqueueing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());

  const queueTotal = useMemo(
    () => stats.waiting + stats.active + stats.delayed,
    [stats],
  );

  async function loadData() {
    setIsLoading(true);
    setError(null);

    try {
      const [postsData, statsData, latestPublishedPost] = await Promise.all([
        scheduleService.getPosts(100, statusFilter),
        scheduleService.getQueueStats(),
        scheduleService.getLatestPublishedPost(),
      ]);
      setPosts(postsData.items);
      setStats(statsData);
      setLatestPublished(latestPublishedPost);
    } catch {
      setError("Falha ao carregar dados de agendamento.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadData().catch(() => null);
  }, [statusFilter]);

  useEffect(() => {
    if (!toast) {
      return;
    }

    const timer = window.setTimeout(() => {
      setToast(null);
    }, 4200);

    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNowMs(Date.now());
    }, 30000);

    return () => window.clearInterval(timer);
  }, []);

  function showToast(text: string, tone: ToastTone) {
    setToast({ text, tone });
  }

  async function onEnqueueReady() {
    setIsEnqueueing(true);
    setError(null);
    setToast(null);

    try {
      const result = await scheduleService.enqueueReady();

      if (result.totalReady === 0) {
        showToast(
          "Nenhum post pronto para fila. Crie upload novo ou use status pending/scheduled.",
          "warn",
        );
      } else if (result.queuedCount > 0) {
        showToast(
          `Enfileiramento concluido: ${result.queuedCount} em fila e ${result.skippedCount} pulados.`,
          "ok",
        );
      } else {
        showToast(
          `Nenhum novo job criado. ${result.skippedCount} item(ns) ja estavam em processamento/fila.`,
          "warn",
        );
      }

      await loadData();
    } catch {
      setError("Falha ao enfileirar posts prontos.");
      showToast("Falha ao enfileirar posts prontos.", "error");
    } finally {
      setIsEnqueueing(false);
    }
  }

  async function onEnqueueOne(postId: string) {
    setError(null);
    setToast(null);

    try {
      const result = await scheduleService.enqueueOne(postId);

      if (result.queued) {
        showToast(`Post ${shortId(postId)} enfileirado com sucesso.`, "ok");
      } else {
        showToast(
          `Post ${shortId(postId)} nao entrou na fila (${result.reason ?? "ignorado"}).`,
          "warn",
        );
      }

      await loadData();
    } catch {
      setError("Falha ao enfileirar post individual.");
      showToast("Falha ao enfileirar post individual.", "error");
    }
  }

  return (
    <section className="dashboard-grid">
      {toast ? (
        <aside className={`toast-banner toast-${toast.tone}`} role="status">
          {toast.text}
        </aside>
      ) : null}

      <article className="panel-card">
        <h2>Fila de publicacao</h2>
        <p className="hero-copy">
          Monitoramento em tempo real da fila BullMQ e reenvio dos posts
          prontos.
        </p>

        <div className="panel-actions" style={{ marginTop: 12 }}>
          <button type="button" onClick={() => void loadData()}>
            Atualizar
          </button>
          <button
            type="button"
            disabled={isEnqueueing}
            onClick={onEnqueueReady}
          >
            {isEnqueueing ? "Enfileirando..." : "Enfileirar prontos"}
          </button>
        </div>

        <div className="simple-list" style={{ marginTop: 12, paddingLeft: 18 }}>
          <span>Aguardando: {stats.waiting}</span>
          <span>Ativos: {stats.active}</span>
          <span>Concluidos: {stats.completed}</span>
          <span>Falhas: {stats.failed}</span>
          <span>Total na fila agora: {queueTotal}</span>
        </div>

        <div className="last-published-card" style={{ marginTop: 12 }}>
          <strong>Ultima publicacao real</strong>
          {latestPublished ? (
            <>
              <span
                className="fresh-chip"
                title="Recencia da ultima publicacao"
              >
                {formatRelativeFromNow(
                  latestPublished.publishedAt ?? latestPublished.updatedAt,
                  nowMs,
                )}
              </span>
              <span className="mono-text">
                Post: {shortId(latestPublished.id)}
              </span>
              <span>
                Publicado em:{" "}
                {formatDateTime(
                  latestPublished.publishedAt ?? latestPublished.updatedAt,
                )}
              </span>
              <span>Video: {latestPublished.videoFile ?? "-"}</span>
            </>
          ) : (
            <span>Ainda sem post publicado no banco.</span>
          )}
        </div>

        {error ? (
          <p className="error-text" style={{ marginTop: 12 }}>
            {error}
          </p>
        ) : null}
      </article>

      <article className="panel-card full-width">
        <div className="panel-actions">
          <h2 style={{ margin: 0 }}>Posts operacionais</h2>
          <label>
            Status
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              style={{ marginLeft: 8 }}
            >
              <option value="all">Todos</option>
              <option value="pending">pending</option>
              <option value="queued">queued</option>
              <option value="processing">processing</option>
              <option value="published">published</option>
              <option value="error">error</option>
              <option value="retrying">retrying</option>
              <option value="scheduled">scheduled</option>
            </select>
          </label>
        </div>

        {isLoading ? <p>Carregando posts...</p> : null}

        {!isLoading ? (
          <div
            className="table-wrap"
            role="region"
            aria-label="posts para agendamento"
          >
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Status</th>
                  <th>Video</th>
                  <th>Retry</th>
                  <th>Atualizado</th>
                  <th>Erro</th>
                  <th>Acoes</th>
                </tr>
              </thead>
              <tbody>
                {posts.map((post) => (
                  <tr key={post.id}>
                    <td className="mono-text">{shortId(post.id)}</td>
                    <td>{post.status}</td>
                    <td>{post.videoFile ?? "-"}</td>
                    <td>{post.retryCount}</td>
                    <td>{formatDateTime(post.updatedAt)}</td>
                    <td>{post.errorMessage ?? "-"}</td>
                    <td>
                      <button
                        type="button"
                        onClick={() => void onEnqueueOne(post.id)}
                        disabled={
                          post.status !== "pending" &&
                          post.status !== "scheduled"
                        }
                      >
                        Enfileirar
                      </button>
                    </td>
                  </tr>
                ))}
                {posts.length === 0 ? (
                  <tr>
                    <td colSpan={7}>Nenhum post encontrado para o filtro.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        ) : null}
      </article>
    </section>
  );
}
