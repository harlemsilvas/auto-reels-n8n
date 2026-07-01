const express = require("express");
const {
  ADMIN_AUTH_COOKIE_NAME,
  ADMIN_AUTH_COOKIE_SECURE,
  ADMIN_AUTH_ENABLED,
  ADMIN_AUTH_SESSION_TTL_HOURS,
} = require("../../config/env");
const {
  requireAdminSession,
  requireCsrf,
} = require("./admin-auth.middleware");
const {
  changePassword,
  login,
  logout,
  publicUser,
  rotateCsrf,
} = require("./admin-auth.service");

const router = express.Router();

function cookieOptions() {
  return {
    httpOnly: true,
    secure: ADMIN_AUTH_COOKIE_SECURE,
    sameSite: "lax",
    path: "/",
    maxAge: ADMIN_AUTH_SESSION_TTL_HOURS * 60 * 60 * 1000,
  };
}

router.get("/status", (_req, res) => {
  res.json({ enabled: ADMIN_AUTH_ENABLED });
});

router.post("/login", async (req, res, next) => {
  try {
    if (!ADMIN_AUTH_ENABLED) {
      return res.status(503).json({
        message: "Autenticação administrativa ainda não está ativa.",
      });
    }

    const result = await login(req.body?.username, req.body?.password, req);

    res.cookie(ADMIN_AUTH_COOKIE_NAME, result.token, cookieOptions());
    return res.json({
      user: result.user,
      csrfToken: result.csrfToken,
      expiresAt: result.expiresAt,
    });
  } catch (error) {
    return next(error);
  }
});

router.get("/me", requireAdminSession, (req, res) => {
  res.json({ user: publicUser(req.auth) });
});

router.get("/csrf", requireAdminSession, async (req, res, next) => {
  try {
    const csrfToken = await rotateCsrf(req.auth);
    return res.json({ csrfToken });
  } catch (error) {
    return next(error);
  }
});

router.post(
  "/change-password",
  requireAdminSession,
  requireCsrf,
  async (req, res, next) => {
    try {
      await changePassword(
        req.auth,
        req.body?.currentPassword,
        req.body?.newPassword,
        req,
      );
      res.clearCookie(ADMIN_AUTH_COOKIE_NAME, cookieOptions());
      return res.status(204).end();
    } catch (error) {
      return next(error);
    }
  },
);

router.post(
  "/logout",
  requireAdminSession,
  requireCsrf,
  async (req, res, next) => {
    try {
      await logout(req.auth, req);
      res.clearCookie(ADMIN_AUTH_COOKIE_NAME, cookieOptions());
      return res.status(204).end();
    } catch (error) {
      return next(error);
    }
  },
);

module.exports = router;
