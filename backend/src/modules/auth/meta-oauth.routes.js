const express = require("express");

const {
  redirectToMetaLogin,
  handleMetaCallback,
} = require("./meta-oauth.controller");

const router = express.Router();

/**
 * ======================================
 * LOGIN
 * ======================================
 */

router.get("/login", redirectToMetaLogin);

/**
 * ======================================
 * CALLBACK
 * ======================================
 */

router.get("/callback", handleMetaCallback);

module.exports = router;
