const { query } = require("../../lib/db");

function normalizeText(value) {
  const text = String(value ?? "").trim();
  return text.length > 0 ? text : null;
}

async function getOrCreateWorkspaceId(preferredName = "Workspace Padrao") {
  const existing = await query(
    `
      SELECT id::text AS id
      FROM workspaces
      WHERE deleted_at IS NULL
      ORDER BY created_at ASC
      LIMIT 1
    `,
  );

  if (existing.rowCount > 0) {
    return existing.rows[0].id;
  }

  const created = await query(
    `
      INSERT INTO workspaces (nome, ativo)
      VALUES ($1, true)
      RETURNING id::text AS id
    `,
    [preferredName],
  );

  return created.rows[0].id;
}

async function listAccounts() {
  const result = await query(
    `
      SELECT
        ia.id::text AS id,
        ia.workspace_id::text AS "workspaceId",
        ia.nome,
        ia.instagram_id AS "instagramId",
        ia.page_id AS "pageId",
        ia.ativo,
        ia.token_expires_at AS "tokenExpiresAt",
        ia.created_at AS "createdAt",
        ia.updated_at AS "updatedAt"
      FROM instagram_accounts ia
      WHERE ia.deleted_at IS NULL
      ORDER BY ia.created_at DESC
    `,
  );

  return {
    items: result.rows,
    total: result.rows.length,
  };
}

async function upsertAccount(input) {
  const instagramId = normalizeText(input.instagramId);
  const accessToken = normalizeText(input.accessToken);

  if (!instagramId) {
    const error = new Error("instagramId e obrigatorio.");
    error.status = 400;
    throw error;
  }

  if (!accessToken) {
    const error = new Error("accessToken e obrigatorio.");
    error.status = 400;
    throw error;
  }

  const workspaceId =
    normalizeText(input.workspaceId) ?? (await getOrCreateWorkspaceId());
  const nome =
    normalizeText(input.nome) ??
    normalizeText(input.accountName) ??
    `Conta ${instagramId.slice(-6)}`;
  const pageId = normalizeText(input.pageId);
  const ativo =
    typeof input.ativo === "boolean"
      ? input.ativo
      : String(input.ativo ?? "true").toLowerCase() === "true";
  const tokenExpiresAt = normalizeText(input.tokenExpiresAt);
  console.log("UPSERT ACCOUNT");
  console.log({
    tokenExpiresAt,
  });

  const result = await query(
    `
      INSERT INTO instagram_accounts (
        workspace_id,
        nome,
        instagram_id,
        page_id,
        access_token,
        token_expires_at,
        ativo,
        deleted_at
      )
      VALUES ($1::uuid, $2, $3, $4, $5, $6::timestamptz, $7, NULL)
      ON CONFLICT (instagram_id)
      DO UPDATE SET
        workspace_id = EXCLUDED.workspace_id,
        nome = EXCLUDED.nome,
        page_id = EXCLUDED.page_id,
        access_token = EXCLUDED.access_token,
        token_expires_at = EXCLUDED.token_expires_at,
        ativo = EXCLUDED.ativo,
        deleted_at = NULL,
        updated_at = NOW()
      RETURNING
        id::text AS id,
        workspace_id::text AS "workspaceId",
        nome,
        instagram_id AS "instagramId",
        page_id AS "pageId",
        ativo,
        token_expires_at AS "tokenExpiresAt",
        created_at AS "createdAt",
        updated_at AS "updatedAt"
    `,
    [
      workspaceId,
      nome,
      instagramId,
      pageId,
      accessToken,
      tokenExpiresAt,
      ativo,
    ],
  );

  return result.rows[0];
}

async function updateAccountToken(accountId, payload) {
  const accessToken = normalizeText(payload.accessToken);
  if (!accessToken) {
    const error = new Error("accessToken e obrigatorio.");
    error.status = 400;
    throw error;
  }

  const tokenExpiresAt = normalizeText(payload.tokenExpiresAt);

  const result = await query(
    `
      UPDATE instagram_accounts
      SET
        access_token = $2,
        token_expires_at = $3::timestamptz,
        updated_at = NOW()
      WHERE id = $1::uuid
        AND deleted_at IS NULL
      RETURNING
        id::text AS id,
        workspace_id::text AS "workspaceId",
        nome,
        instagram_id AS "instagramId",
        page_id AS "pageId",
        ativo,
        token_expires_at AS "tokenExpiresAt",
        created_at AS "createdAt",
        updated_at AS "updatedAt"
    `,
    [accountId, accessToken, tokenExpiresAt],
  );

  if (result.rowCount === 0) {
    const error = new Error("Conta nao encontrada.");
    error.status = 404;
    throw error;
  }

  return result.rows[0];
}

async function setAccountActive(accountId, ativo) {
  const result = await query(
    `
      UPDATE instagram_accounts
      SET
        ativo = $2,
        updated_at = NOW()
      WHERE id = $1::uuid
        AND deleted_at IS NULL
      RETURNING
        id::text AS id,
        workspace_id::text AS "workspaceId",
        nome,
        instagram_id AS "instagramId",
        page_id AS "pageId",
        ativo,
        token_expires_at AS "tokenExpiresAt",
        created_at AS "createdAt",
        updated_at AS "updatedAt"
    `,
    [accountId, Boolean(ativo)],
  );

  if (result.rowCount === 0) {
    const error = new Error("Conta nao encontrada.");
    error.status = 404;
    throw error;
  }

  return result.rows[0];
}

module.exports = {
  listAccounts,
  upsertAccount,
  updateAccountToken,
  setAccountActive,
};
