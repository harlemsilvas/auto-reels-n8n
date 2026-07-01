const express = require("express");
const { ADMIN_AUTH_ENABLED } = require("../../config/env");
const {
  requireAdminSession,
  requirePasswordChanged,
  requireRole,
} = require("./admin-auth.middleware");

const {
  redirectToMetaLogin,
  handleMetaCallback,
} = require("./meta-oauth.controller");

const router = express.Router();
const adminOnly = ADMIN_AUTH_ENABLED
  ? [requireAdminSession, requirePasswordChanged, requireRole("admin")]
  : [];

/**
 * ======================================
 * LOGIN
 * ======================================
 */

router.get("/login", ...adminOnly, redirectToMetaLogin);

/**
 * ======================================
 * CALLBACK
 * ======================================
 */

router.get("/callback", ...adminOnly, handleMetaCallback);

module.exports = router;
