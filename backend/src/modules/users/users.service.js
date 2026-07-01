const { query } = require("../../lib/db");
const authRepository = require("../auth/admin-auth.repository");
const { hashPassword } = require("../auth/password.service");

const ALLOWED_ROLES = new Set(["admin", "operator"]);

function normalizeText(value) {
  return String(value ?? "").trim();
}

function normalizeRole(value) {
  const role = normalizeText(value).toLowerCase();
  if (!ALLOWED_ROLES.has(role)) {
    const error = new Error("Papel de usuário inválido.");
    error.status = 400;
    throw error;
  }
  return role;
}

function metadata(req) {
  return {
    ipAddress: req.ip || null,
    userAgent: String(req.get("user-agent") ?? "").slice(0, 1000) || null,
  };
}

function mapUniqueViolation(error) {
  if (error?.code === "23505") {
    const conflict = new Error("Usuário ou e-mail já cadastrado.");
    conflict.status = 409;
    return conflict;
  }
  return error;
}

async function listUsers() {
  const result = await query(`
    SELECT
      id::text AS id,
      username,
      email,
      display_name AS "displayName",
      role,
      active,
      force_password_change AS "forcePasswordChange",
      failed_login_attempts AS "failedLoginAttempts",
      locked_until AS "lockedUntil",
      last_login_at AS "lastLoginAt",
      created_at AS "createdAt",
      updated_at AS "updatedAt"
    FROM socialbot_users
    WHERE deleted_at IS NULL
    ORDER BY active DESC, display_name, username
  `);

  return { items: result.rows, total: result.rowCount };
}

async function createUser(input, actor, req) {
  const username = normalizeText(input.username).toLowerCase();
  const displayName = normalizeText(input.displayName);
  const email = normalizeText(input.email) || null;
  const role = normalizeRole(input.role ?? "operator");

  if (!/^[a-z0-9._-]{3,64}$/.test(username)) {
    const error = new Error(
      "Usuário deve ter de 3 a 64 caracteres: letras, números, ponto, hífen ou sublinhado.",
    );
    error.status = 400;
    throw error;
  }

  if (!displayName) {
    const error = new Error("Nome de exibição é obrigatório.");
    error.status = 400;
    throw error;
  }

  const passwordHash = await hashPassword(input.password);

  try {
    const result = await query(
      `
        INSERT INTO socialbot_users (
          username, email, display_name, password_hash, role,
          active, force_password_change
        )
        VALUES ($1, $2, $3, $4, $5, TRUE, TRUE)
        RETURNING
          id::text AS id, username, email,
          display_name AS "displayName", role, active,
          force_password_change AS "forcePasswordChange",
          created_at AS "createdAt"
      `,
      [username, email, displayName, passwordHash, role],
    );
    const user = result.rows[0];

    await authRepository.insertAuditLog({
      userId: actor.userId,
      action: "users.created",
      entityType: "user",
      entityId: user.id,
      details: { username: user.username, role: user.role },
      ...metadata(req),
    });

    return user;
  } catch (error) {
    throw mapUniqueViolation(error);
  }
}

async function updateUser(userId, input, actor, req) {
  const displayName = normalizeText(input.displayName);
  const email = normalizeText(input.email) || null;
  const role = normalizeRole(input.role);
  const active = input.active === true;

  if (!displayName) {
    const error = new Error("Nome de exibição é obrigatório.");
    error.status = 400;
    throw error;
  }

  if (userId === actor.userId && (!active || role !== "admin")) {
    const error = new Error(
      "O administrador atual não pode desativar ou remover o próprio papel.",
    );
    error.status = 409;
    throw error;
  }

  try {
    const result = await query(
      `
        UPDATE socialbot_users
        SET email = $2,
            display_name = $3,
            role = $4,
            active = $5
        WHERE id = $1::uuid
          AND deleted_at IS NULL
        RETURNING
          id::text AS id, username, email,
          display_name AS "displayName", role, active,
          force_password_change AS "forcePasswordChange",
          updated_at AS "updatedAt"
      `,
      [userId, email, displayName, role, active],
    );

    if (!result.rowCount) {
      const error = new Error("Usuário não encontrado.");
      error.status = 404;
      throw error;
    }

    if (!active) {
      await authRepository.revokeUserSessions(userId);
    }

    const user = result.rows[0];
    await authRepository.insertAuditLog({
      userId: actor.userId,
      action: "users.updated",
      entityType: "user",
      entityId: user.id,
      details: { role: user.role, active: user.active },
      ...metadata(req),
    });

    return user;
  } catch (error) {
    throw mapUniqueViolation(error);
  }
}

async function resetUserPassword(userId, password, actor, req) {
  if (userId === actor.userId) {
    const error = new Error("Use a troca de senha pessoal para o usuário atual.");
    error.status = 409;
    throw error;
  }

  const passwordHash = await hashPassword(password);
  const updated = await authRepository.updatePassword(userId, passwordHash, true);

  if (!updated) {
    const error = new Error("Usuário não encontrado.");
    error.status = 404;
    throw error;
  }

  await authRepository.revokeUserSessions(userId);
  await authRepository.insertAuditLog({
    userId: actor.userId,
    action: "users.password_reset",
    entityType: "user",
    entityId: userId,
    ...metadata(req),
  });
}

module.exports = {
  createUser,
  listUsers,
  resetUserPassword,
  updateUser,
};
