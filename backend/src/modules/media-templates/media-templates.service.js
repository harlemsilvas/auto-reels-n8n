const { getPool, query } = require("../../lib/db");
const authRepository = require("../auth/admin-auth.repository");

const TEMPLATE_STATUSES = new Set(["draft", "active", "archived"]);
const TEMPLATE_ITEM_KINDS = new Set(["image", "video"]);
const TEMPLATE_ITEM_ROLES = new Set([
  "hero",
  "carousel_item",
  "story",
  "reel",
  "cover",
  "reference",
]);
const PUBLISH_TYPES = new Set([
  "reel",
  "feed_image",
  "feed_carousel",
  "story_image",
  "story_video",
]);
const TEXT_VARIANT_STATUSES = new Set(["generated", "approved", "rejected"]);

function normalizeText(value) {
  const text = String(value ?? "").trim();
  return text.length ? text : null;
}

function normalizeTag(value) {
  const tag = normalizeText(value)?.toLowerCase() ?? "";

  if (
    !/^[a-z0-9][a-z0-9-]{1,119}$/.test(tag) ||
    tag.includes("--")
  ) {
    const error = new Error(
      "TAG inválida. Use 2 a 120 caracteres: letras minúsculas, números e hífen, sem hífen duplo.",
    );
    error.status = 400;
    throw error;
  }

  return tag;
}

function normalizeStatus(value, fallback = "draft") {
  const status = normalizeText(value)?.toLowerCase() ?? fallback;

  if (!TEMPLATE_STATUSES.has(status)) {
    const error = new Error("Status do modelo inválido.");
    error.status = 400;
    throw error;
  }

  return status;
}

function normalizePublishType(value) {
  const publishType = normalizeText(value)?.toLowerCase();

  if (!PUBLISH_TYPES.has(publishType)) {
    const error = new Error("Tipo de publicação inválido para a variação.");
    error.status = 400;
    throw error;
  }

  return publishType;
}

function normalizeTextVariantStatus(value, fallback = "generated") {
  const status = normalizeText(value)?.toLowerCase() ?? fallback;

  if (!TEXT_VARIANT_STATUSES.has(status)) {
    const error = new Error("Status da variação de texto inválido.");
    error.status = 400;
    throw error;
  }

  return status;
}

function normalizeStringArray(value, fieldName) {
  if (value == null || value === "") {
    return [];
  }

  if (Array.isArray(value)) {
    return value
      .map((item) => normalizeText(item))
      .filter(Boolean);
  }

  if (typeof value === "string") {
    return value
      .split(/[\n,]/)
      .map((item) => normalizeText(item))
      .filter(Boolean);
  }

  const error = new Error(`${fieldName} deve ser uma lista de textos.`);
  error.status = 400;
  throw error;
}

function normalizeLimit(value, fallback = 50, max = 100) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return Math.min(parsed, max);
}

function normalizeOffset(value) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0;
  }
  return parsed;
}

function normalizeOptionalInteger(value, fieldName, { min = null } = {}) {
  if (value == null || value === "") {
    return null;
  }

  const parsed = Number.parseInt(value, 10);
  if (
    !Number.isFinite(parsed) ||
    (min !== null && parsed < min)
  ) {
    const error = new Error(`${fieldName} inválido.`);
    error.status = 400;
    throw error;
  }

  return parsed;
}

function normalizeOptionalDate(value, fieldName) {
  if (value == null || value === "") {
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    const error = new Error(`${fieldName} inválido.`);
    error.status = 400;
    throw error;
  }

  return date;
}

function firstText(values) {
  return values.map((value) => normalizeText(value)).find(Boolean) ?? null;
}

function uniqueStrings(values) {
  return [...new Set(values.map((value) => normalizeText(value)).filter(Boolean))];
}

function formatHashtag(value) {
  const text = normalizeText(value);
  if (!text) return null;
  return text.startsWith("#") ? text : `#${text.replace(/^#+/, "")}`;
}

function buildLocalAiTextDraft(template, input = {}) {
  const publishType = normalizePublishType(
    input.publishType ?? input.publish_type ?? "feed_image",
  );
  const tone = normalizeText(input.tone) ?? "comercial direto";
  const objective =
    normalizeText(input.objective) ??
    "gerar interesse e incentivar contato para compra";
  const productName = firstText([
    template.productName,
    template.name,
    template.tag,
  ]);
  const brand = normalizeText(template.brand);
  const targetAudience = normalizeText(template.targetAudience);
  const baseDescription = normalizeText(template.baseDescription);
  const allowedClaims = (template.allowedClaims ?? []).slice(0, 5);
  const forbiddenClaims = template.forbiddenClaims ?? [];
  const hashtags = uniqueStrings(
    (template.baseHashtags ?? [])
      .map(formatHashtag)
      .filter(Boolean)
      .slice(0, 12),
  );
  const cta =
    normalizeText(input.cta) ??
    normalizeText(template.defaultCta) ??
    "Chame no direct e consulte a aplicação correta para sua moto.";
  const title =
    normalizeText(input.title) ??
    `${productName}${brand ? ` | ${brand}` : ""}`;

  const lines = [
    `🏍️ ${title}`,
    "",
    baseDescription ??
      `Modelo de campanha para ${productName}, pronto para revisão antes da publicação.`,
  ];

  if (targetAudience) {
    lines.push("", `Para: ${targetAudience}.`);
  }

  if (allowedClaims.length) {
    lines.push("", "Destaques:");
    allowedClaims.forEach((claim) => {
      lines.push(`✅ ${claim}`);
    });
  }

  lines.push("", cta);

  if (hashtags.length) {
    lines.push("", hashtags.join(" "));
  }

  const caption = lines.join("\n");
  const promptSent = [
    "Gerador local de teste para variação de texto.",
    `TAG: ${template.tag}`,
    `Tipo: ${publishType}`,
    `Tom: ${tone}`,
    `Objetivo: ${objective}`,
    targetAudience ? `Público-alvo: ${targetAudience}` : null,
    allowedClaims.length
      ? `Claims permitidos: ${allowedClaims.join("; ")}`
      : null,
    forbiddenClaims.length
      ? `Claims proibidos: ${forbiddenClaims.join("; ")}`
      : null,
    "Não publicar automaticamente. Revisão e aprovação humana obrigatórias.",
  ]
    .filter(Boolean)
    .join("\n");

  const aiResponse = JSON.stringify(
    {
      mode: "local-test",
      generatedAt: new Date().toISOString(),
      title,
      caption,
      hashtags,
      cta,
      guardrails: {
        forbiddenClaims,
        requiresHumanApproval: true,
      },
    },
    null,
    2,
  );

  return {
    publishType,
    tone,
    objective,
    title,
    caption,
    hashtags,
    cta,
    promptSent,
    aiResponse,
    status: "generated",
  };
}

function readInput(input, camelKey, fallback, snakeKey = null) {
  if (Object.prototype.hasOwnProperty.call(input, camelKey)) {
    return input[camelKey];
  }

  if (
    snakeKey &&
    Object.prototype.hasOwnProperty.call(input, snakeKey)
  ) {
    return input[snakeKey];
  }

  return fallback;
}

function metadata(req) {
  return {
    ipAddress: req.ip || null,
    userAgent: String(req.get("user-agent") ?? "").slice(0, 1000) || null,
  };
}

function mapTemplate(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    workspaceId: row.workspaceId,
    tag: row.tag,
    name: row.name,
    category: row.category,
    status: row.status,
    brand: row.brand,
    productName: row.productName,
    baseDescription: row.baseDescription,
    targetAudience: row.targetAudience,
    allowedClaims: row.allowedClaims ?? [],
    forbiddenClaims: row.forbiddenClaims ?? [],
    defaultCta: row.defaultCta,
    baseHashtags: row.baseHashtags ?? [],
    notes: row.notes,
    mediaItemsCount: Number(row.mediaItemsCount ?? 0),
    textVariantsCount: Number(row.textVariantsCount ?? 0),
    createdByUserId: row.createdByUserId,
    createdByDisplayName: row.createdByDisplayName,
    approvedByUserId: row.approvedByUserId,
    approvedByDisplayName: row.approvedByDisplayName,
    approvedAt: row.approvedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    archivedAt: row.archivedAt,
  };
}

function mapTextVariant(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    templateId: row.templateId,
    workspaceId: row.workspaceId,
    publishType: row.publishType,
    tone: row.tone,
    objective: row.objective,
    title: row.title,
    caption: row.caption,
    hashtags: row.hashtags ?? [],
    cta: row.cta,
    promptSent: row.promptSent,
    aiResponse: row.aiResponse,
    status: row.status,
    createdByUserId: row.createdByUserId,
    createdByDisplayName: row.createdByDisplayName,
    approvedByUserId: row.approvedByUserId,
    approvedByDisplayName: row.approvedByDisplayName,
    approvedAt: row.approvedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function templateSelectSql() {
  return `
    SELECT
      mt.id::text AS id,
      mt.workspace_id::text AS "workspaceId",
      mt.tag,
      mt.name,
      mt.category,
      mt.status,
      mt.brand,
      mt.product_name AS "productName",
      mt.base_description AS "baseDescription",
      mt.target_audience AS "targetAudience",
      mt.allowed_claims AS "allowedClaims",
      mt.forbidden_claims AS "forbiddenClaims",
      mt.default_cta AS "defaultCta",
      mt.base_hashtags AS "baseHashtags",
      mt.notes,
      mt.created_by_user_id::text AS "createdByUserId",
      creator.display_name AS "createdByDisplayName",
      mt.approved_by_user_id::text AS "approvedByUserId",
      approver.display_name AS "approvedByDisplayName",
      mt.approved_at AS "approvedAt",
      mt.created_at AS "createdAt",
      mt.updated_at AS "updatedAt",
      mt.archived_at AS "archivedAt",
      COALESCE(item_counts.total, 0)::int AS "mediaItemsCount",
      COALESCE(variant_counts.total, 0)::int AS "textVariantsCount"
    FROM media_templates mt
    LEFT JOIN socialbot_users creator
      ON creator.id = mt.created_by_user_id
    LEFT JOIN socialbot_users approver
      ON approver.id = mt.approved_by_user_id
    LEFT JOIN LATERAL (
      SELECT COUNT(*) AS total
      FROM media_template_items mti
      WHERE mti.template_id = mt.id
        AND mti.deleted_at IS NULL
    ) item_counts ON true
    LEFT JOIN LATERAL (
      SELECT COUNT(*) AS total
      FROM media_template_text_variants mttv
      WHERE mttv.template_id = mt.id
    ) variant_counts ON true
  `;
}

async function getDefaultWorkspaceId() {
  const result = await query(`
    SELECT id::text AS id
    FROM workspaces
    WHERE deleted_at IS NULL
    ORDER BY ativo DESC, created_at ASC
    LIMIT 1
  `);

  if (!result.rowCount) {
    const error = new Error("Nenhum workspace cadastrado.");
    error.status = 409;
    throw error;
  }

  return result.rows[0].id;
}

async function resolveWorkspaceId(inputWorkspaceId) {
  return normalizeText(inputWorkspaceId) ?? (await getDefaultWorkspaceId());
}

async function assertWorkspaceExists(workspaceId) {
  const result = await query(
    `
      SELECT id
      FROM workspaces
      WHERE id = $1::uuid
        AND deleted_at IS NULL
      LIMIT 1
    `,
    [workspaceId],
  );

  if (!result.rowCount) {
    const error = new Error("Workspace não encontrado.");
    error.status = 404;
    throw error;
  }
}

async function findDefaultActiveAccount(workspaceId, executeQuery = query) {
  const result = await executeQuery(
    `
      SELECT
        id::text AS id,
        workspace_id::text AS "workspaceId"
      FROM instagram_accounts
      WHERE deleted_at IS NULL
        AND ativo = TRUE
        AND workspace_id = $1::uuid
      ORDER BY created_at ASC
      LIMIT 1
    `,
    [workspaceId],
  );

  return result.rows[0] ?? null;
}

function mapUniqueViolation(error) {
  if (error?.code === "23505") {
    const conflict = new Error("Já existe um modelo ativo com esta TAG.");
    conflict.status = 409;
    return conflict;
  }

  if (error?.code === "22P02") {
    const invalid = new Error("Identificador inválido.");
    invalid.status = 400;
    return invalid;
  }

  return error;
}

async function listTemplates(filters = {}) {
  const limit = normalizeLimit(filters.limit);
  const offset = normalizeOffset(filters.offset);
  const status = normalizeText(filters.status)?.toLowerCase() ?? null;
  const workspaceId = normalizeText(filters.workspaceId);
  const q = normalizeText(filters.q);
  const includeArchived = filters.includeArchived === true || filters.includeArchived === "true";

  if (status && status !== "all" && !TEMPLATE_STATUSES.has(status)) {
    const error = new Error("Status do modelo inválido.");
    error.status = 400;
    throw error;
  }

  const where = [];
  const params = [];

  if (!includeArchived) {
    where.push("mt.archived_at IS NULL");
  }

  if (workspaceId) {
    params.push(workspaceId);
    where.push(`mt.workspace_id = $${params.length}::uuid`);
  }

  if (status && status !== "all") {
    params.push(status);
    where.push(`mt.status = $${params.length}`);
  }

  if (q) {
    params.push(`%${q}%`);
    where.push(`(
      mt.tag ILIKE $${params.length}
      OR mt.name ILIKE $${params.length}
      OR mt.product_name ILIKE $${params.length}
      OR mt.brand ILIKE $${params.length}
    )`);
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  params.push(limit, offset);
  const result = await query(
    `
      ${templateSelectSql()}
      ${whereSql}
      ORDER BY mt.updated_at DESC, mt.created_at DESC
      LIMIT $${params.length - 1}
      OFFSET $${params.length}
    `,
    params,
  );

  const countResult = await query(
    `
      SELECT COUNT(*)::int AS total
      FROM media_templates mt
      ${whereSql}
    `,
    params.slice(0, -2),
  );

  return {
    items: result.rows.map(mapTemplate),
    total: countResult.rows[0]?.total ?? 0,
    limit,
    offset,
  };
}

async function getTemplate(templateId, options = {}) {
  const result = await query(
    `
      ${templateSelectSql()}
      WHERE mt.id = $1::uuid
      LIMIT 1
    `,
    [templateId],
  );

  const template = mapTemplate(result.rows[0]);
  if (!template) {
    const error = new Error("Modelo não encontrado.");
    error.status = 404;
    throw error;
  }

  if (!options.includeDetails) {
    return template;
  }

  const [items, variants] = await Promise.all([
    listTemplateItems(template.id),
    listTextVariants(template.id),
  ]);

  return {
    ...template,
    mediaItems: items,
    textVariants: variants,
  };
}

async function getTemplateByTag(tag, workspaceId) {
  const normalizedTag = normalizeTag(tag);
  const resolvedWorkspaceId = normalizeText(workspaceId);
  const params = [normalizedTag];
  const where = ["mt.tag = $1", "mt.archived_at IS NULL"];

  if (resolvedWorkspaceId) {
    params.push(resolvedWorkspaceId);
    where.push(`mt.workspace_id = $${params.length}::uuid`);
  }

  const result = await query(
    `
      ${templateSelectSql()}
      WHERE ${where.join(" AND ")}
      ORDER BY mt.updated_at DESC
      LIMIT 1
    `,
    params,
  );

  const template = mapTemplate(result.rows[0]);
  if (!template) {
    const error = new Error("Modelo não encontrado para esta TAG.");
    error.status = 404;
    throw error;
  }

  return getTemplate(template.id, { includeDetails: true });
}

async function createTemplate(input, actor, req) {
  const workspaceId = await resolveWorkspaceId(input.workspaceId);
  await assertWorkspaceExists(workspaceId);

  const tag = normalizeTag(input.tag);
  const name = normalizeText(input.name);
  const category = normalizeText(input.category) ?? "campaign";
  const status = normalizeStatus(input.status ?? "draft");
  const brand = normalizeText(input.brand);
  const productName = normalizeText(input.productName);
  const baseDescription = normalizeText(input.baseDescription);
  const targetAudience = normalizeText(input.targetAudience);
  const allowedClaims = normalizeStringArray(input.allowedClaims, "allowedClaims");
  const forbiddenClaims = normalizeStringArray(input.forbiddenClaims, "forbiddenClaims");
  const defaultCta = normalizeText(input.defaultCta);
  const baseHashtags = normalizeStringArray(input.baseHashtags, "baseHashtags");
  const notes = normalizeText(input.notes);

  if (!name) {
    const error = new Error("Nome do modelo é obrigatório.");
    error.status = 400;
    throw error;
  }

  try {
    const result = await query(
      `
        INSERT INTO media_templates (
          workspace_id,
          tag,
          name,
          category,
          status,
          brand,
          product_name,
          base_description,
          target_audience,
          allowed_claims,
          forbidden_claims,
          default_cta,
          base_hashtags,
          notes,
          created_by_user_id,
          approved_by_user_id,
          approved_at
        )
        VALUES (
          $1::uuid, $2, $3, $4, $5, $6, $7, $8, $9,
          $10::jsonb, $11::jsonb, $12, $13::jsonb, $14,
          $15::uuid,
          CASE WHEN $5 = 'active' THEN $15::uuid ELSE NULL END,
          CASE WHEN $5 = 'active' THEN NOW() ELSE NULL END
        )
        RETURNING id::text AS id
      `,
      [
        workspaceId,
        tag,
        name,
        category,
        status,
        brand,
        productName,
        baseDescription,
        targetAudience,
        JSON.stringify(allowedClaims),
        JSON.stringify(forbiddenClaims),
        defaultCta,
        JSON.stringify(baseHashtags),
        notes,
        actor?.userId ?? null,
      ],
    );

    const template = await getTemplate(result.rows[0].id);

    await authRepository.insertAuditLog({
      userId: actor?.userId ?? null,
      workspaceId,
      action: "media_templates.created",
      entityType: "media_template",
      entityId: template.id,
      details: { tag: template.tag, status: template.status },
      ...metadata(req),
    });

    return template;
  } catch (error) {
    throw mapUniqueViolation(error);
  }
}

async function updateTemplate(templateId, input, actor, req) {
  const existing = await getTemplate(templateId);

  const tag = normalizeTag(readInput(input, "tag", existing.tag));
  const name = normalizeText(readInput(input, "name", existing.name));
  const category =
    normalizeText(readInput(input, "category", existing.category)) ??
    "campaign";
  const status = normalizeStatus(
    readInput(input, "status", existing.status),
    existing.status,
  );
  const brand = normalizeText(readInput(input, "brand", existing.brand));
  const productName = normalizeText(
    readInput(input, "productName", existing.productName, "product_name"),
  );
  const baseDescription = normalizeText(
    readInput(input, "baseDescription", existing.baseDescription, "base_description"),
  );
  const targetAudience = normalizeText(
    readInput(input, "targetAudience", existing.targetAudience, "target_audience"),
  );
  const allowedClaims = normalizeStringArray(
    readInput(input, "allowedClaims", existing.allowedClaims, "allowed_claims"),
    "allowedClaims",
  );
  const forbiddenClaims = normalizeStringArray(
    readInput(input, "forbiddenClaims", existing.forbiddenClaims, "forbidden_claims"),
    "forbiddenClaims",
  );
  const defaultCta = normalizeText(
    readInput(input, "defaultCta", existing.defaultCta, "default_cta"),
  );
  const baseHashtags = normalizeStringArray(
    readInput(input, "baseHashtags", existing.baseHashtags, "base_hashtags"),
    "baseHashtags",
  );
  const notes = normalizeText(readInput(input, "notes", existing.notes));

  if (!name) {
    const error = new Error("Nome do modelo é obrigatório.");
    error.status = 400;
    throw error;
  }

  try {
    await query(
      `
        UPDATE media_templates
        SET tag = $2,
            name = $3,
            category = $4,
            status = $5,
            brand = $6,
            product_name = $7,
            base_description = $8,
            target_audience = $9,
            allowed_claims = $10::jsonb,
            forbidden_claims = $11::jsonb,
            default_cta = $12,
            base_hashtags = $13::jsonb,
            notes = $14,
            approved_by_user_id = CASE
              WHEN $5 = 'active' AND approved_by_user_id IS NULL
                THEN $15::uuid
              WHEN $5 <> 'active'
                THEN NULL
              ELSE approved_by_user_id
            END,
            approved_at = CASE
              WHEN $5 = 'active' AND approved_at IS NULL
                THEN NOW()
              WHEN $5 <> 'active'
                THEN NULL
              ELSE approved_at
            END,
            archived_at = CASE
              WHEN $5 = 'archived' AND archived_at IS NULL
                THEN NOW()
              WHEN $5 <> 'archived'
                THEN NULL
              ELSE archived_at
            END
        WHERE id = $1::uuid
      `,
      [
        templateId,
        tag,
        name,
        category,
        status,
        brand,
        productName,
        baseDescription,
        targetAudience,
        JSON.stringify(allowedClaims),
        JSON.stringify(forbiddenClaims),
        defaultCta,
        JSON.stringify(baseHashtags),
        notes,
        actor?.userId ?? null,
      ],
    );

    const template = await getTemplate(templateId);

    await authRepository.insertAuditLog({
      userId: actor?.userId ?? null,
      workspaceId: template.workspaceId,
      action: "media_templates.updated",
      entityType: "media_template",
      entityId: template.id,
      details: { tag: template.tag, status: template.status },
      ...metadata(req),
    });

    return template;
  } catch (error) {
    throw mapUniqueViolation(error);
  }
}

async function archiveTemplate(templateId, actor, req) {
  const result = await query(
    `
      UPDATE media_templates
      SET status = 'archived',
          archived_at = COALESCE(archived_at, NOW())
      WHERE id = $1::uuid
      RETURNING
        id::text AS id,
        workspace_id::text AS "workspaceId",
        tag
    `,
    [templateId],
  );

  if (!result.rowCount) {
    const error = new Error("Modelo não encontrado.");
    error.status = 404;
    throw error;
  }

  await authRepository.insertAuditLog({
    userId: actor?.userId ?? null,
    workspaceId: result.rows[0].workspaceId,
    action: "media_templates.archived",
    entityType: "media_template",
    entityId: result.rows[0].id,
    details: { tag: result.rows[0].tag },
    ...metadata(req),
  });

  return getTemplate(templateId);
}

async function listTemplateItems(templateId) {
  const result = await query(
    `
      SELECT
        id::text AS id,
        template_id::text AS "templateId",
        workspace_id::text AS "workspaceId",
        sort_order AS "sortOrder",
        media_kind AS "mediaKind",
        role,
        stored_filename AS "storedFilename",
        original_filename AS "originalFilename",
        storage_path AS "storagePath",
        mime_type AS "mimeType",
        file_size AS "fileSize",
        width,
        height,
        duration_seconds AS "durationSeconds",
        notes,
        created_at AS "createdAt",
        deleted_at AS "deletedAt"
      FROM media_template_items
      WHERE template_id = $1::uuid
        AND deleted_at IS NULL
      ORDER BY sort_order ASC, created_at ASC
    `,
    [templateId],
  );

  return result.rows;
}

async function addTemplateItem(templateId, input, actor, req) {
  const template = await getTemplate(templateId);
  const mediaKind = normalizeText(input.mediaKind ?? input.media_kind);
  const role = normalizeText(input.role) ?? "carousel_item";
  const storedFilename = normalizeText(input.storedFilename ?? input.stored_filename);
  const originalFilename = normalizeText(input.originalFilename ?? input.original_filename);
  const storagePath = normalizeText(input.storagePath ?? input.storage_path);
  const mimeType = normalizeText(input.mimeType ?? input.mime_type);
  const sortOrder = Number.parseInt(input.sortOrder ?? input.sort_order ?? 0, 10);
  const fileSize = normalizeOptionalInteger(
    input.fileSize ?? input.file_size,
    "fileSize",
    { min: 0 },
  );
  const width = normalizeOptionalInteger(input.width, "width", { min: 1 });
  const height = normalizeOptionalInteger(input.height, "height", { min: 1 });
  const durationSeconds = normalizeOptionalInteger(
    input.durationSeconds ?? input.duration_seconds,
    "durationSeconds",
    { min: 0 },
  );
  const notes = normalizeText(input.notes);

  if (!TEMPLATE_ITEM_KINDS.has(mediaKind)) {
    const error = new Error("Tipo de mídia inválido para o modelo.");
    error.status = 400;
    throw error;
  }

  if (!TEMPLATE_ITEM_ROLES.has(role)) {
    const error = new Error("Papel da mídia inválido para o modelo.");
    error.status = 400;
    throw error;
  }

  if (!storedFilename || !storagePath) {
    const error = new Error("storedFilename e storagePath são obrigatórios.");
    error.status = 400;
    throw error;
  }

  if (!Number.isFinite(sortOrder) || sortOrder < 0) {
    const error = new Error("sortOrder deve ser maior ou igual a zero.");
    error.status = 400;
    throw error;
  }

  try {
    const result = await query(
      `
        INSERT INTO media_template_items (
          template_id,
          workspace_id,
          sort_order,
          media_kind,
          role,
          stored_filename,
          original_filename,
          storage_path,
          mime_type,
          file_size,
          width,
          height,
          duration_seconds,
          notes
        )
        VALUES (
          $1::uuid, $2::uuid, $3, $4, $5, $6, $7, $8, $9,
          $10::bigint, $11::integer, $12::integer, $13::integer, $14
        )
        RETURNING id::text AS id
      `,
      [
        templateId,
        template.workspaceId,
        sortOrder,
        mediaKind,
        role,
        storedFilename,
        originalFilename,
        storagePath,
        mimeType,
        fileSize,
        width,
        height,
        durationSeconds,
        notes,
      ],
    );

    await authRepository.insertAuditLog({
      userId: actor?.userId ?? null,
      workspaceId: template.workspaceId,
      action: "media_templates.item_added",
      entityType: "media_template",
      entityId: template.id,
      details: {
        itemId: result.rows[0].id,
        mediaKind,
        role,
        sortOrder,
      },
      ...metadata(req),
    });

    return (await listTemplateItems(templateId)).find(
      (item) => item.id === result.rows[0].id,
    );
  } catch (error) {
    throw mapUniqueViolation(error);
  }
}

async function removeTemplateItem(templateId, itemId, actor, req) {
  const template = await getTemplate(templateId);
  const result = await query(
    `
      UPDATE media_template_items
      SET deleted_at = COALESCE(deleted_at, NOW())
      WHERE id = $1::uuid
        AND template_id = $2::uuid
        AND deleted_at IS NULL
      RETURNING id::text AS id
    `,
    [itemId, templateId],
  );

  if (!result.rowCount) {
    const error = new Error("Mídia do modelo não encontrada.");
    error.status = 404;
    throw error;
  }

  await authRepository.insertAuditLog({
    userId: actor?.userId ?? null,
    workspaceId: template.workspaceId,
    action: "media_templates.item_removed",
    entityType: "media_template",
    entityId: template.id,
    details: { itemId },
    ...metadata(req),
  });

  return { removed: true, itemId };
}

async function listTextVariants(templateId) {
  const result = await query(
    `
      SELECT
        mttv.id::text AS id,
        mttv.template_id::text AS "templateId",
        mttv.workspace_id::text AS "workspaceId",
        mttv.publish_type AS "publishType",
        mttv.tone,
        mttv.objective,
        mttv.title,
        mttv.caption,
        mttv.hashtags,
        mttv.cta,
        mttv.prompt_sent AS "promptSent",
        mttv.ai_response AS "aiResponse",
        mttv.status,
        mttv.created_by_user_id::text AS "createdByUserId",
        creator.display_name AS "createdByDisplayName",
        mttv.approved_by_user_id::text AS "approvedByUserId",
        approver.display_name AS "approvedByDisplayName",
        mttv.approved_at AS "approvedAt",
        mttv.created_at AS "createdAt",
        mttv.updated_at AS "updatedAt"
      FROM media_template_text_variants
      mttv
      LEFT JOIN socialbot_users creator
        ON creator.id = mttv.created_by_user_id
      LEFT JOIN socialbot_users approver
        ON approver.id = mttv.approved_by_user_id
      WHERE mttv.template_id = $1::uuid
      ORDER BY mttv.updated_at DESC, mttv.created_at DESC
    `,
    [templateId],
  );

  return result.rows.map(mapTextVariant);
}

async function getTextVariant(templateId, variantId) {
  const result = await query(
    `
      SELECT
        mttv.id::text AS id,
        mttv.template_id::text AS "templateId",
        mttv.workspace_id::text AS "workspaceId",
        mttv.publish_type AS "publishType",
        mttv.tone,
        mttv.objective,
        mttv.title,
        mttv.caption,
        mttv.hashtags,
        mttv.cta,
        mttv.prompt_sent AS "promptSent",
        mttv.ai_response AS "aiResponse",
        mttv.status,
        mttv.created_by_user_id::text AS "createdByUserId",
        creator.display_name AS "createdByDisplayName",
        mttv.approved_by_user_id::text AS "approvedByUserId",
        approver.display_name AS "approvedByDisplayName",
        mttv.approved_at AS "approvedAt",
        mttv.created_at AS "createdAt",
        mttv.updated_at AS "updatedAt"
      FROM media_template_text_variants mttv
      LEFT JOIN socialbot_users creator
        ON creator.id = mttv.created_by_user_id
      LEFT JOIN socialbot_users approver
        ON approver.id = mttv.approved_by_user_id
      WHERE mttv.template_id = $1::uuid
        AND mttv.id = $2::uuid
      LIMIT 1
    `,
    [templateId, variantId],
  );

  const variant = mapTextVariant(result.rows[0]);
  if (!variant) {
    const error = new Error("Variação de texto não encontrada.");
    error.status = 404;
    throw error;
  }

  return variant;
}

async function createTextVariant(templateId, input, actor, req) {
  const template = await getTemplate(templateId);
  const publishType = normalizePublishType(input.publishType ?? input.publish_type);
  const tone = normalizeText(input.tone);
  const objective = normalizeText(input.objective);
  const title = normalizeText(input.title);
  const caption = normalizeText(input.caption);
  const hashtags = normalizeStringArray(input.hashtags, "hashtags");
  const cta = normalizeText(input.cta);
  const promptSent = normalizeText(input.promptSent ?? input.prompt_sent);
  const aiResponse = normalizeText(input.aiResponse ?? input.ai_response);
  const status = normalizeTextVariantStatus(input.status ?? "generated");

  if (!caption) {
    const error = new Error("Legenda da variação é obrigatória.");
    error.status = 400;
    throw error;
  }

  const result = await query(
    `
      INSERT INTO media_template_text_variants (
        template_id,
        workspace_id,
        publish_type,
        tone,
        objective,
        title,
        caption,
        hashtags,
        cta,
        prompt_sent,
        ai_response,
        status,
        created_by_user_id,
        approved_by_user_id,
        approved_at
      )
      VALUES (
        $1::uuid, $2::uuid, $3, $4, $5, $6, $7, $8::jsonb,
        $9, $10, $11, $12, $13::uuid,
        CASE WHEN $12 = 'approved' THEN $13::uuid ELSE NULL END,
        CASE WHEN $12 = 'approved' THEN NOW() ELSE NULL END
      )
      RETURNING id::text AS id
    `,
    [
      templateId,
      template.workspaceId,
      publishType,
      tone,
      objective,
      title,
      caption,
      JSON.stringify(hashtags),
      cta,
      promptSent,
      aiResponse,
      status,
      actor?.userId ?? null,
    ],
  );

  await authRepository.insertAuditLog({
    userId: actor?.userId ?? null,
    workspaceId: template.workspaceId,
    action: "media_templates.text_variant_created",
    entityType: "media_template",
    entityId: template.id,
    details: {
      variantId: result.rows[0].id,
      publishType,
      status,
    },
    ...metadata(req),
  });

  return getTextVariant(templateId, result.rows[0].id);
}

async function generateTextVariantDraft(templateId, input, actor, req) {
  const template = await getTemplate(templateId);
  const draft = buildLocalAiTextDraft(template, input);
  const variant = await createTextVariant(templateId, draft, actor, req);

  await authRepository.insertAuditLog({
    userId: actor?.userId ?? null,
    workspaceId: template.workspaceId,
    action: "media_templates.text_variant_generated_local",
    entityType: "media_template",
    entityId: template.id,
    details: {
      variantId: variant.id,
      publishType: variant.publishType,
      mode: "local-test",
    },
    ...metadata(req),
  });

  return variant;
}

async function updateTextVariant(templateId, variantId, input, actor, req) {
  const template = await getTemplate(templateId);
  const existing = await getTextVariant(templateId, variantId);
  const publishType = normalizePublishType(
    readInput(input, "publishType", existing.publishType, "publish_type"),
  );
  const tone = normalizeText(readInput(input, "tone", existing.tone));
  const objective = normalizeText(readInput(input, "objective", existing.objective));
  const title = normalizeText(readInput(input, "title", existing.title));
  const caption = normalizeText(readInput(input, "caption", existing.caption));
  const hashtags = normalizeStringArray(
    readInput(input, "hashtags", existing.hashtags),
    "hashtags",
  );
  const cta = normalizeText(readInput(input, "cta", existing.cta));
  const promptSent = normalizeText(
    readInput(input, "promptSent", existing.promptSent, "prompt_sent"),
  );
  const aiResponse = normalizeText(
    readInput(input, "aiResponse", existing.aiResponse, "ai_response"),
  );
  const status = normalizeTextVariantStatus(
    readInput(input, "status", existing.status),
    existing.status,
  );

  if (!caption) {
    const error = new Error("Legenda da variação é obrigatória.");
    error.status = 400;
    throw error;
  }

  await query(
    `
      UPDATE media_template_text_variants
      SET publish_type = $3,
          tone = $4,
          objective = $5,
          title = $6,
          caption = $7,
          hashtags = $8::jsonb,
          cta = $9,
          prompt_sent = $10,
          ai_response = $11,
          status = $12,
          approved_by_user_id = CASE
            WHEN $12 = 'approved' AND approved_by_user_id IS NULL
              THEN $13::uuid
            WHEN $12 <> 'approved'
              THEN NULL
            ELSE approved_by_user_id
          END,
          approved_at = CASE
            WHEN $12 = 'approved' AND approved_at IS NULL
              THEN NOW()
            WHEN $12 <> 'approved'
              THEN NULL
            ELSE approved_at
          END
      WHERE template_id = $1::uuid
        AND id = $2::uuid
    `,
    [
      templateId,
      variantId,
      publishType,
      tone,
      objective,
      title,
      caption,
      JSON.stringify(hashtags),
      cta,
      promptSent,
      aiResponse,
      status,
      actor?.userId ?? null,
    ],
  );

  await authRepository.insertAuditLog({
    userId: actor?.userId ?? null,
    workspaceId: template.workspaceId,
    action: "media_templates.text_variant_updated",
    entityType: "media_template",
    entityId: template.id,
    details: {
      variantId,
      publishType,
      status,
    },
    ...metadata(req),
  });

  return getTextVariant(templateId, variantId);
}

async function approveTextVariant(templateId, variantId, actor, req) {
  return updateTextVariant(
    templateId,
    variantId,
    { status: "approved" },
    actor,
    req,
  );
}

async function rejectTextVariant(templateId, variantId, actor, req) {
  return updateTextVariant(
    templateId,
    variantId,
    { status: "rejected" },
    actor,
    req,
  );
}

function mediaTypeForPublishType(publishType) {
  if (publishType === "feed_carousel") return "carousel";
  if (publishType === "feed_image" || publishType === "story_image") {
    return "image";
  }
  return "video";
}

function assertTemplateMediaCompatible(publishType, mediaItems) {
  const activeItems = mediaItems.filter((item) => !item.deletedAt);

  if (!activeItems.length) {
    const error = new Error("Modelo não possui mídias cadastradas.");
    error.status = 409;
    throw error;
  }

  if (publishType === "feed_carousel") {
    if (activeItems.length < 2) {
      const error = new Error(
        "Carrossel por TAG exige pelo menos duas mídias no modelo.",
      );
      error.status = 409;
      throw error;
    }

    if (activeItems.some((item) => item.mediaKind !== "image")) {
      const error = new Error(
        "Carrossel por TAG aceita apenas imagens nesta etapa.",
      );
      error.status = 409;
      throw error;
    }

    return activeItems;
  }

  const expectedKind =
    publishType === "feed_image" || publishType === "story_image"
      ? "image"
      : "video";
  const primary = activeItems[0];

  if (primary.mediaKind !== expectedKind) {
    const error = new Error(
      `Modelo incompatível: ${publishType} exige mídia ${expectedKind}.`,
    );
    error.status = 409;
    throw error;
  }

  return [primary];
}

function selectTextVariant(template, input) {
  const variants = template.textVariants ?? [];
  const requestedVariantId = normalizeText(input.textVariantId);
  const requestedPublishType = input.publishType
    ? normalizePublishType(input.publishType)
    : null;

  let variant = null;

  if (requestedVariantId) {
    variant = variants.find((item) => item.id === requestedVariantId);
    if (!variant) {
      const error = new Error("Variação de texto não pertence ao modelo.");
      error.status = 404;
      throw error;
    }
  } else if (requestedPublishType) {
    variant = variants.find(
      (item) =>
        item.status === "approved" &&
        item.publishType === requestedPublishType,
    );
  } else {
    variant = variants.find((item) => item.status === "approved");
  }

  if (!variant) {
    const error = new Error(
      "Modelo não possui variação de texto aprovada para criar postagem.",
    );
    error.status = 409;
    throw error;
  }

  if (variant.status !== "approved") {
    const error = new Error("A variação de texto precisa estar aprovada.");
    error.status = 409;
    throw error;
  }

  if (requestedPublishType && variant.publishType !== requestedPublishType) {
    const error = new Error(
      "publishType solicitado não corresponde à variação selecionada.",
    );
    error.status = 409;
    throw error;
  }

  return variant;
}

async function createPostFromTemplateTag(tag, input, actor, req) {
  const workspaceId = normalizeText(input.workspaceId);
  const template = await getTemplateByTag(tag, workspaceId);

  if (template.status !== "active") {
    const error = new Error("Modelo precisa estar ativo para criar postagem.");
    error.status = 409;
    throw error;
  }

  const variant = selectTextVariant(template, input);
  const publishType = variant.publishType;
  const mediaItems = assertTemplateMediaCompatible(
    publishType,
    template.mediaItems ?? [],
  );
  const scheduleAt = normalizeOptionalDate(
    input.scheduledAt ?? input.scheduleAt,
    "scheduledAt",
  );
  const hasFutureSchedule =
    scheduleAt && scheduleAt.getTime() > Date.now();
  const initialStatus = hasFutureSchedule ? "scheduled" : "pending";
  const title =
    normalizeText(input.title) ??
    variant.title ??
    template.name;
  const caption = variant.caption;
  const primaryMedia = mediaItems[0];
  const client = await getPool().connect();

  try {
    await client.query("BEGIN");
    const executeQuery = client.query.bind(client);
    const account = input.accountId
      ? { id: normalizeText(input.accountId), workspaceId: template.workspaceId }
      : await findDefaultActiveAccount(template.workspaceId, executeQuery);

    if (!account?.id) {
      const error = new Error(
        "Nenhuma conta ativa cadastrada para vincular o post.",
      );
      error.status = 400;
      throw error;
    }

    const postResult = await executeQuery(
      `
        INSERT INTO posts (
          workspace_id,
          account_id,
          upload_id,
          title,
          caption,
          source_path,
          video_filename,
          media_size,
          publish_type,
          media_type,
          scheduled_at,
          status,
          created_by_user_id,
          media_template_id,
          media_template_text_variant_id,
          created_at,
          updated_at
        )
        VALUES (
          $1::uuid,
          $2::uuid,
          NULL,
          $3,
          $4,
          $5,
          $6,
          $7::bigint,
          $8,
          $9,
          $10::timestamptz,
          $11,
          $12::uuid,
          $13::uuid,
          $14::uuid,
          NOW(),
          NOW()
        )
        RETURNING
          id::text AS id,
          workspace_id::text AS "workspaceId",
          title,
          status::text AS status,
          publish_type AS "publishType",
          media_type AS "mediaType",
          scheduled_at AS "scheduledAt",
          media_template_id::text AS "mediaTemplateId",
          media_template_text_variant_id::text AS "mediaTemplateTextVariantId"
      `,
      [
        template.workspaceId,
        account.id,
        title,
        caption,
        primaryMedia.storagePath,
        publishType === "reel" ? primaryMedia.storedFilename : null,
        publishType === "reel" ? (primaryMedia.fileSize ?? null) : null,
        publishType,
        mediaTypeForPublishType(publishType),
        hasFutureSchedule ? scheduleAt.toISOString() : null,
        initialStatus,
        actor?.userId ?? null,
        template.id,
        variant.id,
      ],
    );

    const post = postResult.rows[0];

    for (const [index, item] of mediaItems.entries()) {
      await executeQuery(
        `
          INSERT INTO post_media_items (
            post_id,
            workspace_id,
            sort_order,
            media_kind,
            stored_filename,
            original_filename,
            storage_path,
            mime_type,
            file_size,
            width,
            height,
            duration_seconds,
            is_carousel_item,
            created_at
          )
          VALUES (
            $1::uuid,
            $2::uuid,
            $3,
            $4,
            $5,
            $6,
            $7,
            $8,
            $9::bigint,
            $10::integer,
            $11::integer,
            $12::integer,
            $13,
            NOW()
          )
        `,
        [
          post.id,
          template.workspaceId,
          index,
          item.mediaKind,
          item.storedFilename,
          item.originalFilename,
          item.storagePath,
          item.mimeType,
          item.fileSize ?? null,
          item.width ?? null,
          item.height ?? null,
          item.durationSeconds ?? null,
          publishType === "feed_carousel",
        ],
      );
    }

    await executeQuery(
      `
        INSERT INTO post_events (
          workspace_id,
          post_id,
          actor_user_id,
          event_type,
          details
        )
        VALUES ($1::uuid, $2::uuid, $3::uuid, 'created', $4::jsonb)
      `,
      [
        template.workspaceId,
        post.id,
        actor?.userId ?? null,
        JSON.stringify({
          source: "media-template.tag",
          tag: template.tag,
          templateId: template.id,
          textVariantId: variant.id,
          publishType,
          mediaItems: mediaItems.length,
        }),
      ],
    );

    await client.query("COMMIT");

    await authRepository.insertAuditLog({
      userId: actor?.userId ?? null,
      workspaceId: template.workspaceId,
      action: "media_templates.post_created",
      entityType: "post",
      entityId: post.id,
      details: {
        tag: template.tag,
        templateId: template.id,
        textVariantId: variant.id,
        publishType,
      },
      ...metadata(req),
    });

    return {
      ...post,
      tag: template.tag,
      mediaItemsCount: mediaItems.length,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  addTemplateItem,
  archiveTemplate,
  approveTextVariant,
  createTemplate,
  createPostFromTemplateTag,
  createTextVariant,
  generateTextVariantDraft,
  getTemplate,
  getTemplateByTag,
  listTemplates,
  removeTemplateItem,
  rejectTextVariant,
  updateTextVariant,
  updateTemplate,
};
