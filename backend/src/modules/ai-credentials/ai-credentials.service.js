const { query } = require("../../lib/db");
const {
  buildSecretHint,
  decryptSecret,
  encryptSecret,
} = require("./ai-credentials.crypto");

const AI_PROVIDERS = Object.freeze([
  { value: "gemini", label: "Google Gemini" },
]);

const AI_TASKS = Object.freeze([
  {
    value: "media_templates_text",
    label: "Modelos de mídia / textos",
    description: "Gerar variações de texto para modelos por TAG.",
  },
  {
    value: "inbox_reply",
    label: "Inbox / respostas",
    description: "Uso futuro para sugestões ou respostas assistidas no Inbox.",
  },
  {
    value: "content_review",
    label: "Revisão de conteúdo",
    description: "Uso futuro para revisar claims, linguagem e segurança.",
  },
  {
    value: "general_test",
    label: "Teste geral",
    description: "Credencial de teste sem vincular a uma automação final.",
  },
]);

const GEMINI_MODELS = Object.freeze([
  { value: "gemini-flash-lite-latest", label: "Gemini Flash Lite latest", recommended: true },
  { value: "gemini-flash-latest", label: "Gemini Flash latest" },
  { value: "gemini-pro-latest", label: "Gemini Pro latest" },
  { value: "gemini-2.0-flash", label: "Gemini 2.0 Flash" },
  { value: "gemini-3-flash-preview", label: "Gemini 3 Flash Preview" },
  { value: "gemini-3-pro-preview", label: "Gemini 3 Pro Preview" },
  { value: "gemini-3.1-flash-lite-preview", label: "Gemini 3.1 Flash-Lite Preview" },
  { value: "gemini-3.1-pro-preview", label: "Gemini 3.1 Pro Preview" },
  { value: "gemini-2.5-flash", label: "Gemini 2.5 Flash" },
  { value: "gemini-2.5-flash-lite", label: "Gemini 2.5 Flash-Lite" },
  { value: "gemini-2.5-pro", label: "Gemini 2.5 Pro" },
  { value: "gemini-2.0-flash-lite", label: "Gemini 2.0 Flash-Lite" },
]);

const PROVIDER_VALUES = new Set(AI_PROVIDERS.map((item) => item.value));
const TASK_VALUES = new Set(AI_TASKS.map((item) => item.value));
const STATUS_VALUES = new Set(["active", "limited", "expired", "disabled"]);

function normalizeText(value) {
  const text = String(value ?? "").trim();
  return text.length ? text : null;
}

function normalizeProvider(value) {
  const provider = normalizeText(value)?.toLowerCase() ?? "gemini";
  if (!PROVIDER_VALUES.has(provider)) {
    const error = new Error("Provedor de IA inválido.");
    error.status = 400;
    throw error;
  }
  return provider;
}

function normalizeTask(value) {
  const task = normalizeText(value)?.toLowerCase() ?? "media_templates_text";
  if (!TASK_VALUES.has(task)) {
    const error = new Error("Tarefa de IA inválida.");
    error.status = 400;
    throw error;
  }
  return task;
}

function normalizeModel(value) {
  const model = normalizeText(value);
  if (!model || model.length > 120) {
    const error = new Error("Modelo de IA inválido.");
    error.status = 400;
    throw error;
  }
  return model;
}

function normalizeStatus(value, fallback = "active") {
  const status = normalizeText(value)?.toLowerCase() ?? fallback;
  if (!STATUS_VALUES.has(status)) {
    const error = new Error("Status da credencial inválido.");
    error.status = 400;
    throw error;
  }
  return status;
}

function normalizePriority(value) {
  if (value == null || value === "") return 100;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    const error = new Error("Prioridade inválida.");
    error.status = 400;
    throw error;
  }
  return parsed;
}

function normalizeOptionalLimit(value, fieldName) {
  if (value == null || value === "") return null;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    const error = new Error(`${fieldName} inválido.`);
    error.status = 400;
    throw error;
  }
  return parsed;
}

function requireLabel(value) {
  const label = normalizeText(value);
  if (!label || label.length > 120) {
    const error = new Error("Informe um nome para identificar esta chave.");
    error.status = 400;
    throw error;
  }
  return label;
}

async function getDefaultWorkspaceId() {
  const result = await query(
    `SELECT id::text AS id FROM workspaces ORDER BY created_at ASC LIMIT 1`,
  );

  if (!result.rows[0]?.id) {
    const error = new Error("Nenhum workspace encontrado para salvar credenciais de IA.");
    error.status = 400;
    throw error;
  }

  return result.rows[0].id;
}

async function resolveWorkspaceId(inputWorkspaceId) {
  return normalizeText(inputWorkspaceId) ?? (await getDefaultWorkspaceId());
}

function mapCredential(row) {
  if (!row) return null;

  return {
    id: row.id,
    workspaceId: row.workspaceId,
    provider: row.provider,
    label: row.label,
    task: row.task,
    model: row.model,
    apiKeyHint: row.apiKeyHint,
    status: row.status,
    priority: Number(row.priority ?? 100),
    dailyLimit: row.dailyLimit == null ? null : Number(row.dailyLimit),
    minuteLimit: row.minuteLimit == null ? null : Number(row.minuteLimit),
    lastUsedAt: row.lastUsedAt,
    lastErrorAt: row.lastErrorAt,
    lastErrorCode: row.lastErrorCode,
    lastErrorMessage: row.lastErrorMessage,
    createdByUserId: row.createdByUserId,
    createdByDisplayName: row.createdByDisplayName,
    updatedByUserId: row.updatedByUserId,
    updatedByDisplayName: row.updatedByDisplayName,
    disabledAt: row.disabledAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function credentialSelectSql() {
  return `
    SELECT
      c.id::text AS "id",
      c.workspace_id::text AS "workspaceId",
      c.provider,
      c.label,
      c.task,
      c.model,
      c.api_key_hint AS "apiKeyHint",
      c.status,
      c.priority,
      c.daily_limit AS "dailyLimit",
      c.minute_limit AS "minuteLimit",
      c.last_used_at AS "lastUsedAt",
      c.last_error_at AS "lastErrorAt",
      c.last_error_code AS "lastErrorCode",
      c.last_error_message AS "lastErrorMessage",
      c.created_by_user_id::text AS "createdByUserId",
      creator.display_name AS "createdByDisplayName",
      c.updated_by_user_id::text AS "updatedByUserId",
      updater.display_name AS "updatedByDisplayName",
      c.disabled_at AS "disabledAt",
      c.created_at AS "createdAt",
      c.updated_at AS "updatedAt"
    FROM ai_provider_credentials c
    LEFT JOIN socialbot_users creator ON creator.id = c.created_by_user_id
    LEFT JOIN socialbot_users updater ON updater.id = c.updated_by_user_id
  `;
}

function getModelOptions(provider = "gemini") {
  return provider === "gemini" ? GEMINI_MODELS : [];
}

async function listCredentials(filters = {}) {
  const clauses = [];
  const params = [];

  if (filters.workspaceId) {
    params.push(normalizeText(filters.workspaceId));
    clauses.push(`c.workspace_id = $${params.length}`);
  }

  if (filters.provider) {
    params.push(normalizeProvider(filters.provider));
    clauses.push(`c.provider = $${params.length}`);
  }

  if (filters.task) {
    params.push(normalizeTask(filters.task));
    clauses.push(`c.task = $${params.length}`);
  }

  if (filters.status && filters.status !== "all") {
    params.push(normalizeStatus(filters.status));
    clauses.push(`c.status = $${params.length}`);
  }

  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const result = await query(
    `${credentialSelectSql()}
     ${where}
     ORDER BY c.status = 'active' DESC, c.priority ASC, c.updated_at DESC`,
    params,
  );

  return {
    items: result.rows.map(mapCredential),
    providers: AI_PROVIDERS,
    tasks: AI_TASKS,
    models: { gemini: GEMINI_MODELS },
  };
}

async function getCredential(id) {
  const result = await query(
    `${credentialSelectSql()} WHERE c.id = $1 LIMIT 1`,
    [id],
  );
  const credential = mapCredential(result.rows[0]);

  if (!credential) {
    const error = new Error("Credencial de IA não encontrada.");
    error.status = 404;
    throw error;
  }

  return credential;
}

async function createCredential(input = {}, actor = null) {
  const workspaceId = await resolveWorkspaceId(input.workspaceId);
  const provider = normalizeProvider(input.provider);
  const label = requireLabel(input.label);
  const task = normalizeTask(input.task);
  const model = normalizeModel(input.model || getModelOptions(provider)[0]?.value);
  const apiKey = normalizeText(input.apiKey);

  if (!apiKey) {
    const error = new Error("Informe a chave de API do provedor.");
    error.status = 400;
    throw error;
  }

  const result = await query(
    `
      INSERT INTO ai_provider_credentials (
        workspace_id, provider, label, task, model,
        encrypted_api_key, api_key_hint, status, priority,
        daily_limit, minute_limit, created_by_user_id, updated_by_user_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $12)
      RETURNING id::text AS id
    `,
    [
      workspaceId,
      provider,
      label,
      task,
      model,
      encryptSecret(apiKey),
      buildSecretHint(apiKey),
      normalizeStatus(input.status, "active"),
      normalizePriority(input.priority),
      normalizeOptionalLimit(input.dailyLimit, "Limite diário"),
      normalizeOptionalLimit(input.minuteLimit, "Limite por minuto"),
      actor?.userId ?? null,
    ],
  );

  return getCredential(result.rows[0].id);
}

async function updateCredential(id, input = {}, actor = null) {
  const current = await getCredential(id);
  const provider = normalizeProvider(input.provider ?? current.provider);
  const fields = [];
  const params = [];

  function setField(sqlName, value) {
    params.push(value);
    fields.push(`${sqlName} = $${params.length}`);
  }

  if (Object.prototype.hasOwnProperty.call(input, "label")) {
    setField("label", requireLabel(input.label));
  }
  if (Object.prototype.hasOwnProperty.call(input, "task")) {
    setField("task", normalizeTask(input.task));
  }
  if (Object.prototype.hasOwnProperty.call(input, "model")) {
    setField("model", normalizeModel(input.model));
  }
  if (Object.prototype.hasOwnProperty.call(input, "status")) {
    const status = normalizeStatus(input.status, current.status);
    setField("status", status);
    setField("disabled_at", status === "disabled" ? new Date() : null);
  }
  if (Object.prototype.hasOwnProperty.call(input, "priority")) {
    setField("priority", normalizePriority(input.priority));
  }
  if (Object.prototype.hasOwnProperty.call(input, "dailyLimit")) {
    setField("daily_limit", normalizeOptionalLimit(input.dailyLimit, "Limite diário"));
  }
  if (Object.prototype.hasOwnProperty.call(input, "minuteLimit")) {
    setField("minute_limit", normalizeOptionalLimit(input.minuteLimit, "Limite por minuto"));
  }
  if (Object.prototype.hasOwnProperty.call(input, "apiKey")) {
    const apiKey = normalizeText(input.apiKey);
    if (apiKey) {
      setField("encrypted_api_key", encryptSecret(apiKey));
      setField("api_key_hint", buildSecretHint(apiKey));
    }
  }

  if (!fields.length) return current;

  setField("provider", provider);
  setField("updated_by_user_id", actor?.userId ?? null);
  params.push(id);

  await query(
    `UPDATE ai_provider_credentials SET ${fields.join(", ")} WHERE id = $${params.length}`,
    params,
  );

  return getCredential(id);
}

async function disableCredential(id, actor = null) {
  return updateCredential(
    id,
    { status: "disabled" },
    actor,
  );
}

async function recordCredentialUsage(
  credentialId,
  {
    eventType,
    success = false,
    errorCode = null,
    errorMessage = null,
    details = {},
    markStatus = null,
  } = {},
) {
  const credential = await query(
    `
      SELECT
        id::text AS id,
        workspace_id::text AS "workspaceId",
        provider,
        task,
        model
      FROM ai_provider_credentials
      WHERE id = $1::uuid
      LIMIT 1
    `,
    [credentialId],
  );
  const row = credential.rows[0];

  if (!row) return;

  await query(
    `
      INSERT INTO ai_provider_usage_events (
        credential_id, workspace_id, provider, task, model,
        event_type, success, error_code, error_message, details
      ) VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6, $7, $8, $9, $10::jsonb)
    `,
    [
      row.id,
      row.workspaceId,
      row.provider,
      row.task,
      row.model,
      eventType,
      Boolean(success),
      normalizeText(errorCode),
      normalizeText(errorMessage)?.slice(0, 1000) ?? null,
      JSON.stringify(details ?? {}),
    ],
  );

  if (success) {
    await query(
      `
        UPDATE ai_provider_credentials
        SET last_used_at = NOW(),
            last_error_at = NULL,
            last_error_code = NULL,
            last_error_message = NULL
        WHERE id = $1::uuid
      `,
      [row.id],
    );
    return;
  }

  if (errorCode || errorMessage || markStatus) {
    const updates = [
      "last_error_at = NOW()",
      "last_error_code = $2",
      "last_error_message = $3",
    ];
    const params = [
      row.id,
      normalizeText(errorCode),
      normalizeText(errorMessage)?.slice(0, 1000) ?? null,
    ];

    if (markStatus) {
      params.push(normalizeStatus(markStatus));
      updates.push(`status = $${params.length}`);
      if (markStatus === "disabled") {
        updates.push("disabled_at = NOW()");
      }
    }

    await query(
      `UPDATE ai_provider_credentials SET ${updates.join(", ")} WHERE id = $1::uuid`,
      params,
    );
  }
}

async function selectCredential({ workspaceId, provider = "gemini", task = "media_templates_text", excludeIds = [] } = {}) {
  const resolvedWorkspaceId = await resolveWorkspaceId(workspaceId);
  const excluded = Array.isArray(excludeIds)
    ? excludeIds.map((item) => normalizeText(item)).filter(Boolean)
    : [];
  const params = [resolvedWorkspaceId, normalizeProvider(provider), normalizeTask(task)];
  const excludeClause = excluded.length
    ? `AND id <> ALL($${params.length + 1}::uuid[])`
    : "";
  if (excluded.length) params.push(excluded);

  const result = await query(
    `
      SELECT
        id::text AS id,
        encrypted_api_key AS "encryptedApiKey",
        model
      FROM ai_provider_credentials
      WHERE workspace_id = $1
        AND provider = $2
        AND task = $3
        AND status = 'active'
        AND disabled_at IS NULL
        ${excludeClause}
      ORDER BY priority ASC, last_error_at NULLS FIRST, updated_at ASC
      LIMIT 1
    `,
    params,
  );

  const row = result.rows[0];
  if (!row) return null;

  return {
    id: row.id,
    model: row.model,
    apiKey: decryptSecret(row.encryptedApiKey),
  };
}

module.exports = {
  AI_PROVIDERS,
  AI_TASKS,
  GEMINI_MODELS,
  createCredential,
  disableCredential,
  getCredential,
  listCredentials,
  recordCredentialUsage,
  selectCredential,
  updateCredential,
};
