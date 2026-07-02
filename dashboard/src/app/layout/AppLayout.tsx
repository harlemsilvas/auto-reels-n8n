import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../../modules/auth/context/AuthContext";

const links = [
  { to: "/dashboard", label: "Dashboard" },
  { to: "/uploads", label: "Uploads" },
  { to: "/agendamentos", label: "Agendamentos" },
  { to: "/horarios", label: "Horarios" },
  { to: "/historico", label: "Historico" },
  { to: "/inbox", label: "Inbox" },
  { to: "/inbox/testers-dm", label: "Testers DM" },
];

export function AppLayout() {
  const { logout, user } = useAuth();
  const userName = user?.displayName?.trim() || user?.username || null;
  const roleLabel = user?.role === "admin" ? "Administrador" : "Operador";
  const visibleLinks =
    user?.role === "admin"
      ? [
          ...links,
          { to: "/contas", label: "Contas" },
          { to: "/usuarios", label: "Usuários" },
        ]
      : links;

  return (
    <main className="dashboard-shell">
      <header className="topbar">
        <strong>SocialBot Admin</strong>
        <div className="session-summary">
          {userName ? (
            <div className="session-user" aria-label="usuário conectado">
              <strong title={user?.username}>{userName}</strong>
              <span>{roleLabel}</span>
            </div>
          ) : null}
          <button type="button" className="link-button" onClick={logout}>
            Sair
          </button>
        </div>
      </header>

      <nav className="tabs" aria-label="navegacao principal">
        {visibleLinks.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            className={({ isActive }) => `tab-link ${isActive ? "active" : ""}`}
          >
            {link.label}
          </NavLink>
        ))}
      </nav>

      <section>
        <Outlet />
      </section>
    </main>
  );
}
