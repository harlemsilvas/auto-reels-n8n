const {
  ADMIN_AUTH_COOKIE_NAME,
  ADMIN_AUTH_ENABLED,
} = require("../../config/env");
const { authenticateToken, validateCsrf } = require("./admin-auth.service");
const { hasPermission } = require("./permissions.service");

function readCookie(req, name) {
  const header = String(req.headers.cookie ?? "");

  for (const item of header.split(";")) {
    const [rawName, ...rawValue] = item.trim().split("=");

    if (rawName === name) {
      return decodeURIComponent(rawValue.join("="));
    }
  }

  return null;
}

async function requireAdminSession(req, res, next) {
  try {
    const token = readCookie(req, ADMIN_AUTH_COOKIE_NAME);
    const session = await authenticateToken(token);

    if (!session) {
      return res.status(401).json({ message: "Sessão inválida ou expirada." });
    }

    req.auth = session;
    return next();
  } catch (error) {
    return next(error);
  }
}

function requireCsrf(req, res, next) {
  const csrfToken = req.get("x-csrf-token");

  if (!validateCsrf(req.auth, csrfToken)) {
    return res.status(403).json({ message: "Token CSRF inválido." });
  }

  return next();
}

function requirePasswordChanged(req, res, next) {
  if (req.auth?.forcePasswordChange) {
    return res.status(403).json({
      code: "PASSWORD_CHANGE_REQUIRED",
      message: "Troca de senha obrigatória.",
    });
  }

  return next();
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.auth || !roles.includes(req.auth.role)) {
      return res.status(403).json({ message: "Permissão insuficiente." });
    }

    return next();
  };
}

function requirePermission(permission) {
  return (req, res, next) => {
    if (!ADMIN_AUTH_ENABLED) {
      return next();
    }

    if (!req.auth || !hasPermission(req.auth.role, permission)) {
      return res.status(403).json({
        code: "PERMISSION_DENIED",
        message: "Permissão insuficiente.",
        permission,
      });
    }

    return next();
  };
}

module.exports = {
  readCookie,
  requireAdminSession,
  requireCsrf,
  requirePasswordChanged,
  requirePermission,
  requireRole,
};
