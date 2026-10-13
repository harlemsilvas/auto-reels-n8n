import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../../modules/auth/context/AuthContext";
import { useTranslation } from "react-i18next";
import { LanguageSelector } from "../../shared/i18n/LanguageSelector";

const links = [
  { to: "/dashboard", label: "dashboard", permission: "metrics.view" },
  { to: "/uploads", label: "uploads", permission: "posts.create" },
  { to: "/agendamentos", label: "schedule", permission: "posts.view" },
  {
    to: "/horarios",
    label: "slots",
    permission: "schedule_slots.manage",
  },
  { to: "/modelos", label: "templates", permission: "media_templates.view" },
  { to: "/ia/credenciais", label: "ai", permission: "ai_credentials.view" },
  { to: "/historico", label: "history", permission: "metrics.view" },
  { to: "/inbox", label: "inbox", permission: "inbox.view" },
  {
    to: "/inbox/testers-dm",
    label: "testers",
    permission: "inbox.manage_testers",
  },
] as const;

export function AppLayout() {
  const { can, logout, user } = useAuth();
  const { t } = useTranslation();
  const userName = user?.displayName?.trim() || user?.username || null;
  const roleLabel = t(user?.role === "admin" ? "role.admin" : "role.operator");
  const visibleLinks = [
    ...links,
    { to: "/contas", label: "accounts" as const, permission: "accounts.manage" },
    { to: "/usuarios", label: "users" as const, permission: "users.manage" },
  ].filter((link) => can(link.permission));

  return (
    <main className="dashboard-shell">
      <header className="topbar">
        <strong>SocialBot Admin</strong>
        <div className="session-summary">
          {userName ? (
            <div className="session-user" aria-label={t("signedInUser")}>
              <strong title={user?.username}>{userName}</strong>
              <span>{roleLabel}</span>
            </div>
          ) : null}
          <LanguageSelector />
          <button type="button" className="link-button" onClick={logout}>
            {t("logout")}
          </button>
        </div>
      </header>

      <nav className="tabs" aria-label={t("navigationLabel")}>
        {visibleLinks.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            className={({ isActive }) => `tab-link ${isActive ? "active" : ""}`}
          >
            {t(`navigation.${link.label}`)}
          </NavLink>
        ))}
      </nav>

      <section>
        <Outlet />
      </section>
    </main>
  );
}
