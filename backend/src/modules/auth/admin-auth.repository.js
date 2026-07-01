const { query } = require("../../lib/db");

async function findUserByUsername(username) {
  const result = await query(
    `
      SELECT
        id::text AS id,
        username,
        email,
        display_name AS "displayName",
        password_hash AS "passwordHash",
        role,
        active,
        force_password_change AS "forcePasswordChange",
        failed_login_attempts AS "failedLoginAttempts",
        locked_until AS "lockedUntil",
        last_login_at AS "lastLoginAt"
      FROM socialbot_users
      WHERE LOWER(username) = LOWER($1)
        AND deleted_at IS NULL
      LIMIT 1
    `,
    [username],
  );

  return result.rows[0] ?? null;
}

async function findUserById(userId) {
  const result = await query(
    `
      SELECT
        id::text AS id,
        username,
        email,
        display_name AS "displayName",
        password_hash AS "passwordHash",
        role,
        active,
        force_password_change AS "forcePasswordChange"
      FROM socialbot_users
      WHERE id = $1::uuid
        AND deleted_at IS NULL
      LIMIT 1
    `,
    [userId],
  );

  return result.rows[0] ?? null;
}

async function registerLoginFailure(userId, maxAttempts, lockMinutes) {
  await query(
    `
      UPDATE socialbot_users
      SET
        failed_login_attempts = failed_login_attempts + 1,
        locked_until = CASE
          WHEN failed_login_attempts + 1 >= $2
          THEN NOW() + make_interval(mins => $3)
          ELSE locked_until
        END
      WHERE id = $1::uuid
    `,
    [userId, maxAttempts, lockMinutes],
  );
}

async function registerLoginSuccess(userId) {
  await query(
    `
      UPDATE socialbot_users
      SET
        failed_login_attempts = 0,
        locked_until = NULL,
        last_login_at = NOW()
      WHERE id = $1::uuid
    `,
    [userId],
  );
}

async function createSession(input) {
  const result = await query(
    `
      INSERT INTO socialbot_sessions (
        user_id,
        token_hash,
        csrf_token_hash,
        expires_at,
        ip_address,
        user_agent
      )
      VALUES ($1::uuid, $2, $3, $4::timestamptz, $5::inet, $6)
      RETURNING id::text AS id, expires_at AS "expiresAt"
    `,
    [
      input.userId,
      input.tokenHash,
      input.csrfTokenHash,
      input.expiresAt,
      input.ipAddress || null,
      input.userAgent || null,
    ],
  );

  return result.rows[0];
}

async function findActiveSession(tokenHash) {
  const result = await query(
    `
      SELECT
        s.id::text AS "sessionId",
        s.user_id::text AS "userId",
        s.csrf_token_hash AS "csrfTokenHash",
        s.expires_at AS "expiresAt",
        u.username,
        u.email,
        u.display_name AS "displayName",
        u.role,
        u.force_password_change AS "forcePasswordChange"
      FROM socialbot_sessions s
      JOIN socialbot_users u ON u.id = s.user_id
      WHERE s.token_hash = $1
        AND s.revoked_at IS NULL
        AND s.expires_at > NOW()
        AND u.active = TRUE
        AND u.deleted_at IS NULL
      LIMIT 1
    `,
    [tokenHash],
  );

  return result.rows[0] ?? null;
}

async function touchSession(sessionId) {
  await query(
    `
      UPDATE socialbot_sessions
      SET last_seen_at = NOW()
      WHERE id = $1::uuid
        AND last_seen_at < NOW() - INTERVAL '5 minutes'
    `,
    [sessionId],
  );
}

async function updateSessionCsrf(sessionId, csrfTokenHash) {
  await query(
    `
      UPDATE socialbot_sessions
      SET csrf_token_hash = $2,
          last_seen_at = NOW()
      WHERE id = $1::uuid
        AND revoked_at IS NULL
        AND expires_at > NOW()
    `,
    [sessionId, csrfTokenHash],
  );
}

async function revokeSession(sessionId) {
  await query(
    `
      UPDATE socialbot_sessions
      SET revoked_at = COALESCE(revoked_at, NOW())
      WHERE id = $1::uuid
    `,
    [sessionId],
  );
}

async function updatePassword(userId, passwordHash, forcePasswordChange) {
  const result = await query(
    `
      UPDATE socialbot_users
      SET
        password_hash = $2,
        force_password_change = $3,
        password_changed_at = NOW(),
        failed_login_attempts = 0,
        locked_until = NULL
      WHERE id = $1::uuid
        AND deleted_at IS NULL
      RETURNING id::text AS id
    `,
    [userId, passwordHash, forcePasswordChange],
  );

  return result.rowCount > 0;
}

async function revokeUserSessions(userId) {
  await query(
    `
      UPDATE socialbot_sessions
      SET revoked_at = COALESCE(revoked_at, NOW())
      WHERE user_id = $1::uuid
        AND revoked_at IS NULL
    `,
    [userId],
  );
}

async function insertAuditLog(input) {
  await query(
    `
      INSERT INTO socialbot_audit_log (
        user_id,
        workspace_id,
        action,
        entity_type,
        entity_id,
        details,
        ip_address,
        user_agent
      )
      VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6::jsonb, $7::inet, $8)
    `,
    [
      input.userId || null,
      input.workspaceId || null,
      input.action,
      input.entityType || null,
      input.entityId || null,
      JSON.stringify(input.details ?? {}),
      input.ipAddress || null,
      input.userAgent || null,
    ],
  );
}

module.exports = {
  createSession,
  findActiveSession,
  findUserById,
  findUserByUsername,
  insertAuditLog,
  registerLoginFailure,
  registerLoginSuccess,
  revokeSession,
  revokeUserSessions,
  touchSession,
  updatePassword,
  updateSessionCsrf,
};
