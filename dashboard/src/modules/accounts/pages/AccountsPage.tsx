import { useEffect, useState } from "react";
import {
  accountsService,
  type InstagramAccount,
} from "../services/accounts.service";
import { buildApiUrl } from "../../../shared/config/api";

type FormState = {
  nome: string;
  instagramId: string;
  pageId: string;
  accessToken: string;
  tokenExpiresAt: string;
};

const INITIAL_FORM: FormState = {
  nome: "",
  instagramId: "",
  pageId: "",
  accessToken: "",
  tokenExpiresAt: "",
};

export function AccountsPage() {
  const [accounts, setAccounts] = useState<InstagramAccount[]>([]);
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadAccounts() {
    setIsLoading(true);
    setError(null);

    try {
      const data = await accountsService.list();
      setAccounts(data.items);
    } catch {
      setError("Falha ao carregar contas.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadAccounts().catch(() => null);
  }, []);

  function onChange<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);
    setMessage(null);

    try {
      await accountsService.upsert({
        nome: form.nome,
        instagramId: form.instagramId,
        pageId: form.pageId || undefined,
        accessToken: form.accessToken,
        tokenExpiresAt: form.tokenExpiresAt || undefined,
        ativo: true,
      });

      setMessage("Conta salva com sucesso.");
      setForm(INITIAL_FORM);
      await loadAccounts();
    } catch {
      setError("Nao foi possivel salvar a conta.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function onToggleActive(account: InstagramAccount) {
    setError(null);
    setMessage(null);

    try {
      await accountsService.setActive(account.id, !account.ativo);
      setMessage("Status da conta atualizado.");
      await loadAccounts();
    } catch {
      setError("Falha ao atualizar status da conta.");
    }
  }

  async function onBootstrapFromEnv() {
    setError(null);
    setMessage(null);

    try {
      const result = await accountsService.bootstrapFromEnv();
      setMessage(result.message);
      await loadAccounts();
    } catch {
      setError("Nao foi possivel importar conta do env.");
    }
  }

  function onMetaLogin() {
    window.location.href = buildApiUrl("/api/auth/meta/login");
  }

  return (
    <section className="dashboard-grid">
      <article className="panel-card">
        <h2>Contas Instagram</h2>
        <p>Cadastro, ativacao e token por conta.</p>

        <form
          onSubmit={onSubmit}
          className="simple-form"
          style={{ marginTop: 16 }}
        >
          <label>
            Nome
            <input
              value={form.nome}
              onChange={(event) => onChange("nome", event.target.value)}
              placeholder="Conta principal"
              required
            />
          </label>

          <label>
            Instagram ID
            <input
              value={form.instagramId}
              onChange={(event) => onChange("instagramId", event.target.value)}
              placeholder="17841402343252358"
              required
            />
          </label>

          <label>
            Page ID (opcional)
            <input
              value={form.pageId}
              onChange={(event) => onChange("pageId", event.target.value)}
              placeholder="123456789"
            />
          </label>

          <label>
            Access Token
            <textarea
              value={form.accessToken}
              onChange={(event) => onChange("accessToken", event.target.value)}
              placeholder="EA..."
              rows={3}
              required
            />
          </label>

          <label>
            Expira em (opcional)
            <input
              value={form.tokenExpiresAt}
              onChange={(event) =>
                onChange("tokenExpiresAt", event.target.value)
              }
              placeholder="2026-12-31T23:59:59Z"
            />
          </label>

          <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
            <button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Salvando..." : "Salvar conta"}
            </button>
            <button type="button" onClick={onMetaLogin}>
              Logar Meta
            </button>
            <button type="button" onClick={onBootstrapFromEnv}>
              Importar do env
            </button>
          </div>
        </form>

        {message ? (
          <p style={{ color: "#0b7a38", marginTop: 12 }}>{message}</p>
        ) : null}
        {error ? (
          <p className="error-text" style={{ marginTop: 12 }}>
            {error}
          </p>
        ) : null}
      </article>

      <article className="panel-card full-width">
        <h2>Contas cadastradas</h2>
        {isLoading ? <p>Carregando contas...</p> : null}

        {!isLoading ? (
          <div
            className="table-wrap"
            role="region"
            aria-label="contas cadastradas"
          >
            <table>
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Instagram ID</th>
                  <th>Page ID</th>
                  <th>Status</th>
                  <th>Token expira</th>
                  <th>Acoes</th>
                </tr>
              </thead>
              <tbody>
                {accounts.map((account) => (
                  <tr key={account.id}>
                    <td>{account.nome}</td>
                    <td>{account.instagramId}</td>
                    <td>{account.pageId ?? "-"}</td>
                    <td>{account.ativo ? "Ativa" : "Inativa"}</td>
                    <td>{account.tokenExpiresAt ?? "-"}</td>
                    <td>
                      <button
                        type="button"
                        onClick={() => onToggleActive(account)}
                      >
                        {account.ativo ? "Desativar" : "Ativar"}
                      </button>
                    </td>
                  </tr>
                ))}
                {accounts.length === 0 ? (
                  <tr>
                    <td colSpan={6}>Nenhuma conta cadastrada.</td>
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
