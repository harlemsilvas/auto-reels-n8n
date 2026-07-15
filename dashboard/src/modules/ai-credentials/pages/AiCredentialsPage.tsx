import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useAuth } from "../../auth/context/AuthContext";
import {
  aiCredentialsService,
  type AiCredential,
  type AiCredentialStatus,
  type AiCredentialsOptions,
  type AiProvider,
  type AiTask,
} from "../services/aiCredentials.service";

const INITIAL_FORM = {
  provider: "gemini" as AiProvider,
  label: "",
  task: "media_templates_text" as AiTask,
  model: "gemini-flash-lite-latest",
  apiKey: "",
  priority: "100",
  dailyLimit: "",
  minuteLimit: "",
};

const EMPTY_OPTIONS: AiCredentialsOptions = {
  providers: [{ value: "gemini", label: "Google Gemini" }],
  tasks: [],
  models: { gemini: [] },
};

function formatDate(value?: string | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    active: "Ativa",
    limited: "Limitada",
    expired: "Expirada",
    disabled: "Desativada",
  };
  return labels[status] ?? status;
}

function taskLabel(task: string, options: AiCredentialsOptions) {
  return options.tasks.find((item) => item.value === task)?.label ?? task;
}

function modelLabel(model: string, options: AiCredentialsOptions, provider = "gemini") {
  return options.models[provider]?.find((item) => item.value === model)?.label ?? model;
}

function toOptionalNumber(value: string) {
  const text = value.trim();
  return text ? Number(text) : null;
}

export function AiCredentialsPage() {
  const { can } = useAuth();
  const canManage = can("ai_credentials.manage");
  const [credentials, setCredentials] = useState<AiCredential[]>([]);
  const [options, setOptions] = useState<AiCredentialsOptions>(EMPTY_OPTIONS);
  const [form, setForm] = useState(INITIAL_FORM);
  const [editing, setEditing] = useState<Record<string, Partial<AiCredential>>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const models = useMemo(
    () => options.models[form.provider] ?? [],
    [form.provider, options.models],
  );

  async function load() {
    const result = await aiCredentialsService.list();
    setCredentials(result.items);
    setOptions({
      providers: result.providers,
      tasks: result.tasks,
      models: result.models,
    });

    const firstModel = result.models[form.provider]?.[0]?.value;
    if (firstModel && !result.models[form.provider]?.some((item) => item.value === form.model)) {
      setForm((current) => ({ ...current, model: firstModel }));
    }
  }

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    setError(null);

    aiCredentialsService
      .list()
      .then((result) => {
        if (!active) return;
        setCredentials(result.items);
        setOptions({
          providers: result.providers,
          tasks: result.tasks,
          models: result.models,
        });
        const firstModel = result.models.gemini?.[0]?.value;
        if (firstModel) {
          setForm((current) => ({ ...current, model: firstModel }));
        }
      })
      .catch((loadError) => {
        if (active) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Não foi possível carregar as credenciais.",
          );
        }
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setIsSaving(true);

    try {
      await aiCredentialsService.create({
        provider: form.provider,
        label: form.label,
        task: form.task,
        model: form.model,
        apiKey: form.apiKey,
        priority: Number(form.priority || 100),
        dailyLimit: toOptionalNumber(form.dailyLimit),
        minuteLimit: toOptionalNumber(form.minuteLimit),
      });
      setForm({ ...INITIAL_FORM, model: form.model });
      setMessage("Credencial salva com segurança. A chave completa não será exibida novamente.");
      await load();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Erro ao salvar credencial.");
    } finally {
      setIsSaving(false);
    }
  }

  function updateLocal(id: string, patch: Partial<AiCredential>) {
    setEditing((current) => ({
      ...current,
      [id]: { ...(current[id] ?? {}), ...patch },
    }));
  }

  async function save(item: AiCredential) {
    setError(null);
    setMessage(null);
    const patch = editing[item.id] ?? {};

    try {
      await aiCredentialsService.update(item.id, {
        label: patch.label ?? item.label,
        task: (patch.task ?? item.task) as AiTask,
        model: patch.model ?? item.model,
        status: (patch.status ?? item.status) as AiCredentialStatus,
        priority: patch.priority ?? item.priority,
        dailyLimit: patch.dailyLimit ?? item.dailyLimit,
        minuteLimit: patch.minuteLimit ?? item.minuteLimit,
      });
      setEditing((current) => {
        const next = { ...current };
        delete next[item.id];
        return next;
      });
      setMessage("Credencial atualizada.");
      await load();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Erro ao atualizar credencial.");
    }
  }

  async function disable(item: AiCredential) {
    setError(null);
    setMessage(null);

    try {
      await aiCredentialsService.disable(item.id);
      setMessage("Credencial desativada. Ela não será selecionada na rotação.");
      await load();
    } catch (disableError) {
      setError(disableError instanceof Error ? disableError.message : "Erro ao desativar credencial.");
    }
  }

  return (
    <section className="panel-stack">
      <article className="hero-block">
        <div>
          <p className="eyebrow">Configurações de IA</p>
          <h1>Credenciais Gemini</h1>
          <p className="hero-copy">
            Cadastre chaves por tarefa e modelo. O sistema guarda apenas a chave criptografada no banco e mostra somente um final mascarado para conferência.
          </p>
        </div>
        <div className="hero-chip-list">
          <span className="chip chip-ok">Chave mascarada</span>
          <span className="chip">AES-256-GCM</span>
          <span className="chip">Rotação por prioridade</span>
          <span className="chip">Sem publicar automaticamente</span>
        </div>
      </article>

      <article className="panel-card workflow-card workflow-card--details">
        <div className="workflow-heading">
          <span>1</span>
          <div>
            <h2>Adicionar chave</h2>
            <p>Use esta área para testes controlados. Não cole chaves em documentos, commits ou mensagens de chat.</p>
          </div>
        </div>

        {!canManage ? (
          <p className="error-text">Seu usuário pode visualizar, mas não gerenciar credenciais de IA.</p>
        ) : null}

        <form className="upload-form" onSubmit={create}>
          <label>
            Nome da chave
            <input
              value={form.label}
              onChange={(event) => setForm({ ...form, label: event.target.value })}
              placeholder="Gemini principal - textos"
              disabled={!canManage || isSaving}
              required
            />
          </label>
          <label>
            Provedor
            <select
              value={form.provider}
              onChange={(event) => setForm({ ...form, provider: event.target.value as AiProvider })}
              disabled={!canManage || isSaving}
            >
              {options.providers.map((provider) => (
                <option key={provider.value} value={provider.value}>{provider.label}</option>
              ))}
            </select>
          </label>
          <label>
            Tarefa
            <select
              value={form.task}
              onChange={(event) => setForm({ ...form, task: event.target.value as AiTask })}
              disabled={!canManage || isSaving}
            >
              {options.tasks.map((task) => (
                <option key={task.value} value={task.value}>{task.label}</option>
              ))}
            </select>
          </label>
          <label>
            Modelo
            <select
              value={form.model}
              onChange={(event) => setForm({ ...form, model: event.target.value })}
              disabled={!canManage || isSaving}
            >
              {models.map((model) => (
                <option key={model.value} value={model.value}>
                  {model.label}{model.recommended ? " (recomendado)" : ""}
                </option>
              ))}
            </select>
          </label>
          <label>
            Chave API
            <input
              type="password"
              autoComplete="new-password"
              value={form.apiKey}
              onChange={(event) => setForm({ ...form, apiKey: event.target.value })}
              placeholder="Cole a chave aqui"
              disabled={!canManage || isSaving}
              required
            />
          </label>
          <label>
            Prioridade
            <input
              type="number"
              min="0"
              value={form.priority}
              onChange={(event) => setForm({ ...form, priority: event.target.value })}
              disabled={!canManage || isSaving}
            />
          </label>
          <label>
            Limite diário opcional
            <input
              type="number"
              min="1"
              value={form.dailyLimit}
              onChange={(event) => setForm({ ...form, dailyLimit: event.target.value })}
              disabled={!canManage || isSaving}
            />
          </label>
          <label>
            Limite/min opcional
            <input
              type="number"
              min="1"
              value={form.minuteLimit}
              onChange={(event) => setForm({ ...form, minuteLimit: event.target.value })}
              disabled={!canManage || isSaving}
            />
          </label>
          <button type="submit" disabled={!canManage || isSaving}>
            {isSaving ? "Salvando..." : "Salvar credencial"}
          </button>
        </form>
      </article>

      <article className="panel-card workflow-card workflow-card--media">
        <div className="workflow-heading">
          <span>2</span>
          <div>
            <h2>Chaves cadastradas</h2>
            <p>Quando integrarmos o gerador real, a seleção usará status ativa e menor prioridade primeiro.</p>
          </div>
        </div>

        {error ? <p className="error-text">{error}</p> : null}
        {message ? <p className="upload-success-text">{message}</p> : null}
        {isLoading ? <p>Carregando credenciais...</p> : null}

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Nome</th>
                <th>Tarefa</th>
                <th>Modelo</th>
                <th>Chave</th>
                <th>Status</th>
                <th>Prioridade</th>
                <th>Último uso/erro</th>
                <th>Ação</th>
              </tr>
            </thead>
            <tbody>
              {credentials.map((item) => {
                const draft = editing[item.id] ?? {};
                const provider = draft.provider ?? item.provider;
                return (
                  <tr key={item.id}>
                    <td>
                      <input
                        value={draft.label ?? item.label}
                        onChange={(event) => updateLocal(item.id, { label: event.target.value })}
                        disabled={!canManage}
                      />
                    </td>
                    <td>
                      <select
                        value={draft.task ?? item.task}
                        onChange={(event) => updateLocal(item.id, { task: event.target.value as AiTask })}
                        disabled={!canManage}
                      >
                        {options.tasks.map((task) => (
                          <option key={task.value} value={task.value}>{task.label}</option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <select
                        value={draft.model ?? item.model}
                        onChange={(event) => updateLocal(item.id, { model: event.target.value })}
                        disabled={!canManage}
                      >
                        {(options.models[provider] ?? []).map((model) => (
                          <option key={model.value} value={model.value}>{model.label}</option>
                        ))}
                      </select>
                      <span className="history-inline-note">{modelLabel(item.model, options, item.provider)}</span>
                    </td>
                    <td>{item.apiKeyHint ?? "••••"}</td>
                    <td>
                      <select
                        value={draft.status ?? item.status}
                        onChange={(event) => updateLocal(item.id, { status: event.target.value as AiCredentialStatus })}
                        disabled={!canManage}
                      >
                        <option value="active">Ativa</option>
                        <option value="limited">Limitada</option>
                        <option value="expired">Expirada</option>
                        <option value="disabled">Desativada</option>
                      </select>
                      <span className="history-inline-note">{statusLabel(item.status)}</span>
                    </td>
                    <td>
                      <input
                        type="number"
                        min="0"
                        value={draft.priority ?? item.priority}
                        onChange={(event) => updateLocal(item.id, { priority: Number(event.target.value) })}
                        disabled={!canManage}
                      />
                    </td>
                    <td>
                      <div className="history-post-cell">
                        <span>Uso: {formatDate(item.lastUsedAt)}</span>
                        <span>Erro: {item.lastErrorMessage || item.lastErrorCode || "-"}</span>
                      </div>
                    </td>
                    <td>
                      <div className="workflow-next-actions">
                        <button type="button" onClick={() => save(item)} disabled={!canManage}>
                          Salvar
                        </button>
                        <button type="button" onClick={() => disable(item)} disabled={!canManage || item.status === "disabled"}>
                          Desativar
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!credentials.length && !isLoading ? (
                <tr>
                  <td colSpan={8}>Nenhuma credencial cadastrada ainda.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </article>

      <article className="panel-card workflow-card workflow-card--post">
        <div className="workflow-heading">
          <span>3</span>
          <div>
            <h2>Como a rotação vai funcionar</h2>
            <p>A integração real ainda será plugada no gerador de textos dos modelos.</p>
          </div>
        </div>
        <ul className="simple-list">
          <li>O sistema busca chaves ativas da tarefa solicitada.</li>
          <li>A menor prioridade é tentada primeiro; use 0, 10, 20 para ordenar.</li>
          <li>Quando uma chave for marcada como limitada, expirada ou desativada, ela sai da seleção automática.</li>
          <li>A chave completa nunca aparece na lista, nem nas respostas da API.</li>
        </ul>
        <p className="history-inline-note">
          Tarefa padrão atual: {taskLabel("media_templates_text", options)}.
        </p>
      </article>
    </section>
  );
}
