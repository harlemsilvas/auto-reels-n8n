import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useTranslation } from "react-i18next";
import { LanguageSelector } from "../../../shared/i18n/LanguageSelector";

export function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const { t, i18n } = useTranslation("auth");

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [hasError, setHasError] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) return;
    setHasError(false);
    setIsSubmitting(true);
    try {
      const ok = await login({ username, password });
      if (!ok) { setHasError(true); return; }
      navigate("/dashboard", { replace: true });
    } catch {
      setHasError(true);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="login-shell">
      <section className="login-card">
        <div className="login-card-heading"><p className="eyebrow">SocialBot</p><LanguageSelector /></div>
        <h1>{t("loginTitle")}</h1>
        <p className="hero-copy">{t("loginDescription")}</p>

        <form onSubmit={handleSubmit} className="login-form">
          <label>
            {t("username")}
            <input
              autoComplete="username"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </label>

          <label>
            {t("password")}
            <input
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>

          {hasError ? <p className="error-text" role="alert">{t("invalidCredentials")}</p> : null}

          <button type="submit" disabled={isSubmitting} aria-busy={isSubmitting}>
            {t(isSubmitting ? "signingIn" : "signIn")}
          </button>
        </form>
        <p>
          <a href={i18n.resolvedLanguage?.startsWith("en") ? "/privacy.en.html" : "/privacy.html"}>{t("privacyPolicy")}</a>
          {" · "}
          <a href={i18n.resolvedLanguage?.startsWith("en") ? "/data-deletion.en.html" : "/data-deletion.html"}>{t("dataDeletion")}</a>
        </p>
      </section>
    </main>
  );
}
