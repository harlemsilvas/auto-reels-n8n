import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Download, Eye, EyeOff, Link2, LoaderCircle, RefreshCw, Save, Wrench } from "lucide-react";
import { accountsService, type InstagramAccount } from "../services/accounts.service";
import { readOAuthFeedback } from "../oauth-feedback";
import { buildApiUrl } from "../../../shared/config/api";
import { formatDateTime } from "../../../shared/i18n/formatters";

type FormState = { nome: string; instagramId: string; pageId: string; accessToken: string; tokenExpiresAt: string };
const INITIAL_FORM: FormState = { nome: "", instagramId: "", pageId: "", accessToken: "", tokenExpiresAt: "" };
type ActionError = "saveFailed" | "statusFailed" | "importFailed";
type ActionMessage = "saved" | "statusUpdated" | "imported";

export function AccountsPage() {
  const { t } = useTranslation("accounts");
  const [params, setParams] = useSearchParams();
  const [oauth] = useState(() => readOAuthFeedback(params));
  const [accounts, setAccounts] = useState<InstagramAccount[]>([]);
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [isLoading, setIsLoading] = useState(true);
  const [listError, setListError] = useState(false);
  const [operation, setOperation] = useState<"save" | "toggle" | "import" | null>(null);
  const [message, setMessage] = useState<ActionMessage | null>(null);
  const [error, setError] = useState<ActionError | null>(null);
  const [showToken, setShowToken] = useState(false);
  const loadVersion = useRef(0);
  const pending = useRef(false);

  const loadAccounts = useCallback(async () => {
    const version = ++loadVersion.current;
    try {
      const data = await accountsService.list();
      if (!Array.isArray(data.items)) throw Error("Invalid accounts response");
      if (version === loadVersion.current) { setAccounts(data.items); setListError(false); }
    } catch {
      if (version === loadVersion.current) setListError(true);
    } finally {
      if (version === loadVersion.current) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    const version = ++loadVersion.current;
    void accountsService.list().then(data => {
      if (!active || version !== loadVersion.current) return;
      if (!Array.isArray(data.items)) throw Error("Invalid accounts response");
      setAccounts(data.items);
    }).catch(() => {
      if (active && version === loadVersion.current) setListError(true);
    }).finally(() => {
      if (active && version === loadVersion.current) setIsLoading(false);
    });
    return () => { active = false; };
  }, []);

  function refreshAccounts() {
    setIsLoading(true);
    setListError(false);
    return loadAccounts();
  }

  useEffect(() => {
    if (!["connected", "error", "accountId"].some(key => params.has(key))) return;
    const clean = new URLSearchParams(params);
    for (const key of ["connected", "error", "accountId"]) clean.delete(key);
    setParams(clean, { replace: true });
  }, [params, setParams]);

  function onChange<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm(prev => ({ ...prev, [key]: value }));
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current) return;
    pending.current = true;
    setOperation("save"); setError(null); setMessage(null);
    try {
      await accountsService.upsert({ ...form, pageId: form.pageId || undefined,
        tokenExpiresAt: form.tokenExpiresAt || undefined, ativo: true });
      setMessage("saved"); setForm(INITIAL_FORM); setShowToken(false);
      await refreshAccounts();
    } catch { setError("saveFailed"); }
    finally { pending.current = false; setOperation(null); }
  }

  async function onToggleActive(account: InstagramAccount) {
    if (pending.current) return;
    pending.current = true;
    setOperation("toggle"); setError(null); setMessage(null);
    try {
      await accountsService.setActive(account.id, !account.ativo);
      setMessage("statusUpdated"); await refreshAccounts();
    } catch { setError("statusFailed"); }
    finally { pending.current = false; setOperation(null); }
  }

  async function onBootstrapFromEnv() {
    if (pending.current || !window.confirm(t("confirmImport"))) return;
    pending.current = true;
    setOperation("import"); setError(null); setMessage(null);
    try {
      await accountsService.bootstrapFromEnv();
      setMessage("imported"); await refreshAccounts();
    } catch { setError("importFailed"); }
    finally { pending.current = false; setOperation(null); }
  }

  const connected = oauth?.kind === "connected" && !listError && !isLoading
    ? accounts.find(account => account.id.toLowerCase() === oauth.accountId && account.ativo) : null;
  const busy = operation !== null;
  return (
    <section className="accounts-page" aria-label={t("title")}>
      <header className="accounts-heading">
        <h2>{t("title")}</h2>
        <div className="accounts-toolbar">
          <button type="button" onClick={() => { window.location.href = buildApiUrl("/api/auth/meta/login"); }} disabled={busy}>
            <Link2 size={18} aria-hidden="true" />{t("connect")}
          </button>
          <button type="button" className="accounts-icon-button" onClick={() => void refreshAccounts()}
            disabled={busy || isLoading} title={t("refresh")} aria-label={t("refresh")}>
            <RefreshCw size={18} aria-hidden="true" />
          </button>
        </div>
      </header>

      {oauth?.kind === "error" ? <p className="accounts-notice accounts-notice-error" role="alert">{t(`oauthError.${oauth.code}`)}</p> : null}
      {oauth?.kind === "connected" ? <div className={`accounts-notice ${connected ? "accounts-notice-success" : "accounts-notice-warning"}`} role="status">
        {isLoading ? t("oauthChecking") : connected ? <><strong>{t("oauthConnected", { name: connected.nome })}</strong><span>{t("instagramId")}: {connected.instagramId}</span></> : t("oauthUnverified")}
      </div> : null}
      {message ? <p className="accounts-notice accounts-notice-success" role="status">{t(message)}</p> : null}
      {error ? <p className="accounts-notice accounts-notice-error" role="alert">{t(error)}</p> : null}
      {listError ? <p className="accounts-notice accounts-notice-error" role="alert">{t("loadFailed")}</p> : null}
      {isLoading ? <p role="status">{t("loading")}</p> : !listError ? (
        <div className="table-wrap" role="region" aria-label={t("listLabel")}>
          <table>
            <thead><tr>
              <th>{t("name")}</th><th>{t("instagramId")}</th><th>{t("pageId")}</th>
              <th>{t("status")}</th><th>{t("tokenExpires")}</th><th>{t("actions")}</th>
            </tr></thead>
            <tbody>{accounts.map(account => <tr key={account.id}>
              <td className="accounts-name">{account.nome}</td><td>{account.instagramId}</td><td>{account.pageId ?? "-"}</td>
              <td>{t(account.ativo ? "active" : "inactive")}</td>
              <td>{account.tokenExpiresAt ? <time dateTime={account.tokenExpiresAt}>{formatDateTime(account.tokenExpiresAt, { dateStyle: "short", timeStyle: "short" })}</time> : "-"}</td>
              <td><input type="checkbox" role="switch" checked={account.ativo} disabled={busy || isLoading}
                aria-label={t("changeStatus", { name: account.nome })} title={t("changeStatus", { name: account.nome })}
                onChange={() => void onToggleActive(account)} /></td>
            </tr>)}{accounts.length === 0 ? <tr><td colSpan={6}>{t("empty")}</td></tr> : null}</tbody>
          </table>
        </div>
      ) : null}

      <details className="accounts-maintenance">
        <summary><Wrench size={17} aria-hidden="true" />{t("maintenance")}</summary>
        <form onSubmit={onSubmit} className="simple-form accounts-manual-form" aria-label={t("manualEntry")}>
          <label>{t("name")}<input value={form.nome} onChange={event => onChange("nome", event.target.value)} placeholder={t("namePlaceholder")} required /></label>
          <label>{t("instagramId")}<input value={form.instagramId} onChange={event => onChange("instagramId", event.target.value)} placeholder="17841400000000000" required /></label>
          <label>{t("pageIdOptional")}<input value={form.pageId} onChange={event => onChange("pageId", event.target.value)} placeholder="123456789" /></label>
          <label>{t("accessToken")}<span className="accounts-secret">
            <input type={showToken ? "text" : "password"} autoComplete="off" value={form.accessToken} onChange={event => onChange("accessToken", event.target.value)} required />
            <button type="button" className="accounts-icon-button" aria-label={t(showToken ? "hideToken" : "showToken")} title={t(showToken ? "hideToken" : "showToken")}
              onClick={() => setShowToken(value => !value)}>{showToken ? <EyeOff size={18} /> : <Eye size={18} />}</button>
          </span></label>
          <label>{t("expiresOptional")}<input value={form.tokenExpiresAt} onChange={event => onChange("tokenExpiresAt", event.target.value)} placeholder="2026-12-31T23:59:59Z" /></label>
          <div className="accounts-toolbar">
            <button type="submit" disabled={busy} aria-busy={operation === "save"}>
              {operation === "save" ? <LoaderCircle size={18} className="accounts-spin" aria-hidden="true" /> : <Save size={18} aria-hidden="true" />}{t(operation === "save" ? "saving" : "save")}
            </button>
            <button type="button" onClick={() => void onBootstrapFromEnv()} disabled={busy} aria-busy={operation === "import"}>
              {operation === "import" ? <LoaderCircle size={18} className="accounts-spin" aria-hidden="true" /> : <Download size={18} aria-hidden="true" />}{t(operation === "import" ? "importing" : "import")}
            </button>
          </div>
        </form>
      </details>
    </section>
  );
}
