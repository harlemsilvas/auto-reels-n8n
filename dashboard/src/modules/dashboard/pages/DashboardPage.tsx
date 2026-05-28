import { useDashboardData } from "../hooks/useDashboardData";
import type {
  DashboardOperationalOverview,
  Metric,
  MetricTone,
} from "../../../shared/types/dashboard";

function toneClass(tone: MetricTone) {
  if (tone === "danger") return "tone-danger";
  if (tone === "warn") return "tone-warn";
  return "tone-ok";
}

function buildOperationalMetrics(
  overview: DashboardOperationalOverview,
): Metric[] {
  const { posts, queue } = overview;

  return [
    {
      label: "Posts publicados",
      value: String(posts.published),
      trend: "Status atual no banco",
      tone: "ok",
    },
    {
      label: "Pendentes",
      value: String(posts.pending + posts.scheduled),
      trend: `${posts.queued} em fila para worker`,
      tone: posts.pending + posts.scheduled > 0 ? "warn" : "ok",
    },
    {
      label: "Processando",
      value: String(posts.processing),
      trend: `${queue.active} jobs ativos`,
      tone: posts.processing > 0 ? "warn" : "ok",
    },
    {
      label: "Erros",
      value: String(posts.error),
      trend: `${queue.failed} falhas na fila`,
      tone: posts.error > 0 || queue.failed > 0 ? "danger" : "ok",
    },
    {
      label: "Fila aguardando",
      value: String(queue.waiting + queue.delayed),
      trend: `Concluidos: ${queue.completed}`,
      tone: queue.waiting + queue.delayed > 0 ? "warn" : "ok",
    },
  ];
}

export function DashboardPage() {
  const { summary, overview, isLoading, error } = useDashboardData();

  if (isLoading) {
    return <p>Carregando dashboard...</p>;
  }

  if (error || !summary || !overview) {
    return (
      <p className="error-text">{error ?? "Falha ao carregar dashboard."}</p>
    );
  }

  const metrics = buildOperationalMetrics(overview);

  return (
    <>
      <header className="hero-block">
        <div>
          <p className="eyebrow">Painel Administrativo</p>
          <h1>SocialBot Dashboard</h1>
          <p className="hero-copy">
            Controle de publicacoes, filas e status das contas Instagram em um
            unico painel.
          </p>
        </div>
        <div className="hero-chip-list" aria-label="status da plataforma">
          <span className="chip chip-ok">n8n worker: ativo</span>
          <span className="chip chip-ok">postgres: conectado</span>
          <span className="chip chip-ok">redis: conectado</span>
        </div>
      </header>

      <section className="metrics-grid" aria-label="indicadores principais">
        {metrics.map((metric) => (
          <article key={metric.label} className="metric-card">
            <p className="metric-label">{metric.label}</p>
            <p className="metric-value">{metric.value}</p>
            <p className={`metric-trend ${toneClass(metric.tone)}`}>
              {metric.trend}
            </p>
          </article>
        ))}
      </section>

      <section className="dashboard-grid">
        <article className="panel-card">
          <h2>Gerenciamento</h2>
          <ul className="simple-list">
            <li>Contas Instagram</li>
            <li>Videos</li>
            <li>Legendas</li>
            <li>Agendamentos</li>
            <li>Status da publicacao</li>
          </ul>
        </article>

        <article className="panel-card">
          <h2>Fila de publicacao</h2>
          <div className="table-wrap" role="region" aria-label="fila atual">
            <table>
              <thead>
                <tr>
                  <th>Conta</th>
                  <th>Video</th>
                  <th>Horario</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {summary.queue.map((item) => (
                  <tr key={item.id}>
                    <td>{item.accountName}</td>
                    <td>{item.videoName}</td>
                    <td>{item.scheduledAt}</td>
                    <td>{item.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>

        <article className="panel-card full-width">
          <h2>Proximos blocos</h2>
          <p>
            Proximo passo tecnico: conectar este layout ao backend Node.js com
            endpoints de contas, posts, agendamentos e telemetria de workers.
          </p>
        </article>
      </section>

      <footer className="footer-note">
        MVP Dashboard pronto para integrar API.
      </footer>
    </>
  );
}
