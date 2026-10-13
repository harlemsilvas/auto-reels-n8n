import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { authService } from "../services/auth.service";
import { useTranslation } from "react-i18next";
import { LanguageSelector } from "../../../shared/i18n/LanguageSelector";

export function ChangePasswordPage() {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const { t } = useTranslation("auth");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState<"passwordMismatch" | "passwordUnchanged" | "passwordChangeFailed" | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) return;
    setError(null);

    if (newPassword !== confirmation) {
      setError("passwordMismatch");
      return;
    }
    if (currentPassword === newPassword) {
      setError("passwordUnchanged");
      return;
    }

    setIsSubmitting(true);
    try {
      await authService.changePassword({ currentPassword, newPassword });
      await logout();
      navigate("/login", { replace: true });
    } catch {
      setError("passwordChangeFailed");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="login-shell">
      <section className="login-card">
        <div className="login-card-heading"><p className="eyebrow">SocialBot</p><LanguageSelector /></div>
        <h1>{t("changeTitle")}</h1>
        <p className="hero-copy">{t("changeDescription", { count: 12 })}</p>
        <form className="login-form" onSubmit={submit}>
          <label>
            {t("currentPassword")}
            <input
              type="password"
              autoComplete="current-password"
              required
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
            />
          </label>
          <label>
            {t("newPassword")}
            <input
              type="password"
              autoComplete="new-password"
              minLength={12}
              required
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
            />
          </label>
          <label>
            {t("confirmPassword")}
            <input
              type="password"
              autoComplete="new-password"
              minLength={12}
              required
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
            />
          </label>
          {error ? <p className="error-text" role="alert">{t(error)}</p> : null}
          <button type="submit" disabled={isSubmitting} aria-busy={isSubmitting}>
            {t(isSubmitting ? "changingPassword" : "changePassword")}
          </button>
        </form>
      </section>
    </main>
  );
}
