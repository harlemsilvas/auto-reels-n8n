import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../../modules/auth/context/AuthContext";

const links = [
  { to: "/dashboard", label: "Dashboard" },
  { to: "/uploads", label: "Uploads" },
  { to: "/contas", label: "Contas" },
  { to: "/agendamentos", label: "Agendamentos" },
  { to: "/horarios", label: "Horarios" },
  { to: "/historico", label: "Historico" },
  { to: "/inbox", label: "Inbox" },
  { to: "/inbox/testers-dm", label: "Testers DM" },
];

export function AppLayout() {
  const { logout } = useAuth();

  return (
    <main className="dashboard-shell">
      <header className="topbar">
        <strong>SocialBot Admin</strong>
        <button type="button" className="link-button" onClick={logout}>
          Sair
        </button>
      </header>

      <nav className="tabs" aria-label="navegacao principal">
        {links.map((link) => (
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
