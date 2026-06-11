import { useDashboardData } from "../hooks/useDashboardData";
import type { MetricTone } from "../../../shared/types/dashboard";

function toneClass(tone: MetricTone) {
  if (tone === "danger") return "tone-danger";
  if (tone === "warn") return "tone-warn";
  return "tone-ok";
}

function formatScheduledAt(scheduledAt: string | null) {
  if (!scheduledAt) {
    return "-";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(scheduledAt));
}

export function DashboardPage() {
  const { summary, isLoading, error } = useDashboardData();

  if (isLoading) {
    return <p>Carregando dashboard...</p>;
  }

  if (error || !summary) {
    return (
      <p className="error-text">{error ?? "Falha ao carregar dashboard."}</p>
    );
  }

  const metrics = summary.metrics;

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
                    <td>{formatScheduledAt(item.scheduledAt)}</td>
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
