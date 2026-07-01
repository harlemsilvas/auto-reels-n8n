const {
  buildOAuthUrl,
  consumeOAuthState,
  createOAuthState,
  processOAuthCallback,
  buildSuccessRedirect,
  buildErrorRedirect,
} = require("./meta-oauth.service");
const { ADMIN_AUTH_ENABLED } = require("../../config/env");
const authRepository = require("./admin-auth.repository");

/**
 * ======================================
 * REDIRECT USER TO META LOGIN
 * ======================================
 */

async function redirectToMetaLogin(req, res, next) {
  try {
    console.log("======================================");
    console.log("[META LOGIN START]");
    console.log("IP:", req.ip);

    const state = ADMIN_AUTH_ENABLED
      ? await createOAuthState(req.auth, req.ip)
      : null;
    const oauthUrl = buildOAuthUrl(state);

    console.log("======================================");

    return res.redirect(oauthUrl);
  } catch (error) {
    next(error);
  }
}

/**
 * ======================================
 * META CALLBACK
 * ======================================
 */

async function handleMetaCallback(req, res, next) {
  try {
    console.log("======================================");
    console.log("[META CALLBACK]");

    const { code, error, error_reason, state } = req.query;

    if (
      ADMIN_AUTH_ENABLED &&
      !(await consumeOAuthState(state, req.auth))
    ) {
      return res.redirect(buildErrorRedirect("invalid_oauth_state"));
    }

    /**
     * User canceled login
     */

    if (error) {
      console.error("[META CALLBACK ERROR]");
      console.error(error);
      console.error(error_reason);

      return res.redirect(buildErrorRedirect(error_reason || error));
    }

    /**
     * Missing code
     */

    if (!code) {
      return res.redirect(buildErrorRedirect("missing_oauth_code"));
    }

    /**
     * Process OAuth
     */

    const result = await processOAuthCallback(code);

    if (ADMIN_AUTH_ENABLED) {
      await authRepository.insertAuditLog({
        userId: req.auth.userId,
        action: "accounts.meta_connected",
        entityType: "instagram_account",
        entityId: result?.account?.id ?? null,
        details: {
          instagramId: result?.instagramAccount?.id ?? null,
        },
        ipAddress: req.ip || null,
        userAgent:
          String(req.get("user-agent") ?? "").slice(0, 1000) || null,
      });
    }

    console.log("[META CALLBACK SUCCESS]");
    console.log({
      instagramId: result?.instagramAccount?.id,

      username: result?.instagramAccount?.username,
    });

    console.log("======================================");

    /**
     * Redirect frontend
     */

    return res.redirect(buildSuccessRedirect());
  } catch (error) {
    console.error("======================================");
    console.error("[META CALLBACK FATAL]");
    console.error(error?.response?.data || error);
    console.error("======================================");

    return res.redirect(
      buildErrorRedirect(
        error?.response?.data?.error?.message ||
          error?.message ||
          "oauth_callback_error",
      ),
    );
  }
}

module.exports = {
  redirectToMetaLogin,
  handleMetaCallback,
};
