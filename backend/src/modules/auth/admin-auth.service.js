const { createHash, randomBytes, timingSafeEqual } = require("node:crypto");
const {
  ADMIN_AUTH_LOCK_MINUTES,
  ADMIN_AUTH_MAX_FAILED_ATTEMPTS,
  ADMIN_AUTH_SESSION_TTL_HOURS,
} = require("../../config/env");
const repository = require("./admin-auth.repository");
const { hashPassword, verifyPassword } = require("./password.service");

function normalizeUsername(value) {
  return String(value ?? "").trim().toLowerCase();
}

function hashToken(token) {
  return createHash("sha256").update(String(token)).digest();
}

function publicUser(sessionOrUser) {
  return {
    id: sessionOrUser.userId ?? sessionOrUser.id,
    username: sessionOrUser.username,
    email: sessionOrUser.email ?? null,
    displayName: sessionOrUser.displayName,
    role: sessionOrUser.role,
    forcePasswordChange: !!sessionOrUser.forcePasswordChange,
  };
}

function requestMetadata(req) {
  return {
    ipAddress: req.ip || null,
    userAgent: String(req.get("user-agent") ?? "").slice(0, 1000) || null,
  };
}

async function login(usernameInput, password, req) {
  const username = normalizeUsername(usernameInput);
  const genericError = new Error("Credenciais inválidas.");
  genericError.status = 401;

  if (!username || !password) {
    throw genericError;
  }

  const user = await repository.findUserByUsername(username);
  const passwordMatches = await verifyPassword(password, user?.passwordHash);

  if (!user || !passwordMatches || !user.active) {
    if (user?.id) {
      await repository.registerLoginFailure(
        user.id,
        ADMIN_AUTH_MAX_FAILED_ATTEMPTS,
        ADMIN_AUTH_LOCK_MINUTES,
      );
    }
    throw genericError;
  }

  if (user.lockedUntil && new Date(user.lockedUntil).getTime() > Date.now()) {
    const error = new Error("Acesso temporariamente bloqueado.");
    error.status = 423;
    throw error;
  }

  const token = randomBytes(32).toString("base64url");
  const csrfToken = randomBytes(32).toString("base64url");
  const expiresAt = new Date(
    Date.now() + ADMIN_AUTH_SESSION_TTL_HOURS * 60 * 60 * 1000,
  );
  const metadata = requestMetadata(req);

  const session = await repository.createSession({
    userId: user.id,
    tokenHash: hashToken(token),
    csrfTokenHash: hashToken(csrfToken),
    expiresAt,
    ...metadata,
  });

  await repository.registerLoginSuccess(user.id);
  await repository.insertAuditLog({
    userId: user.id,
    action: "auth.login",
    entityType: "session",
    entityId: session.id,
    ...metadata,
  });

  return {
    token,
    csrfToken,
    expiresAt: session.expiresAt,
    user: publicUser(user),
  };
}

async function authenticateToken(token) {
  if (!token) {
    return null;
  }

  const session = await repository.findActiveSession(hashToken(token));

  if (session) {
    await repository.touchSession(session.sessionId).catch(() => null);
  }

  return session;
}

async function rotateCsrf(session) {
  const csrfToken = randomBytes(32).toString("base64url");
  await repository.updateSessionCsrf(
    session.sessionId,
    hashToken(csrfToken),
  );
  return csrfToken;
}

function validateCsrf(session, csrfToken) {
  if (!session?.csrfTokenHash || !csrfToken) {
    return false;
  }

  const received = hashToken(csrfToken);
  const expected = Buffer.from(session.csrfTokenHash);

  return (
    received.length === expected.length && timingSafeEqual(received, expected)
  );
}

async function logout(session, req) {
  if (!session) {
    return;
  }

  await repository.revokeSession(session.sessionId);
  await repository.insertAuditLog({
    userId: session.userId,
    action: "auth.logout",
    entityType: "session",
    entityId: session.sessionId,
    ...requestMetadata(req),
  });
}

async function changePassword(session, currentPassword, newPassword, req) {
  const user = await repository.findUserById(session.userId);

  if (!user || !(await verifyPassword(currentPassword, user.passwordHash))) {
    const error = new Error("Senha atual inválida.");
    error.status = 401;
    throw error;
  }

  if (String(currentPassword) === String(newPassword)) {
    const error = new Error("A nova senha deve ser diferente da senha atual.");
    error.status = 400;
    throw error;
  }

  const passwordHash = await hashPassword(newPassword);
  await repository.updatePassword(user.id, passwordHash, false);
  await repository.revokeUserSessions(user.id);
  await repository.insertAuditLog({
    userId: user.id,
    action: "auth.password_changed",
    entityType: "user",
    entityId: user.id,
    ...requestMetadata(req),
  });
}

module.exports = {
  authenticateToken,
  changePassword,
  login,
  logout,
  publicUser,
  rotateCsrf,
  validateCsrf,
};
