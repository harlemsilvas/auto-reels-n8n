import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../../modules/auth/context/AuthContext";

const links = [
  { to: "/dashboard", label: "Dashboard", permission: "metrics.view" },
  { to: "/uploads", label: "Uploads", permission: "posts.create" },
  { to: "/agendamentos", label: "Agendamentos", permission: "posts.view" },
  {
    to: "/horarios",
    label: "Horarios",
    permission: "schedule_slots.manage",
  },
  { to: "/modelos", label: "Modelos", permission: "media_templates.view" },
  { to: "/historico", label: "Historico", permission: "metrics.view" },
  { to: "/inbox", label: "Inbox", permission: "inbox.view" },
  {
    to: "/inbox/testers-dm",
    label: "Testers DM",
    permission: "inbox.manage_testers",
  },
];

export function AppLayout() {
  const { can, logout, user } = useAuth();
  const userName = user?.displayName?.trim() || user?.username || null;
  const roleLabel = user?.role === "admin" ? "Administrador" : "Operador";
  const visibleLinks = [
    ...links,
    { to: "/contas", label: "Contas", permission: "accounts.manage" },
    { to: "/usuarios", label: "Usuários", permission: "users.manage" },
  ].filter((link) => can(link.permission));

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
