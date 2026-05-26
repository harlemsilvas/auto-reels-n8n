const {
  buildOAuthUrl,
  processOAuthCallback,
  buildSuccessRedirect,
  buildErrorRedirect,
} = require("./meta-oauth.service");

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

    const oauthUrl = buildOAuthUrl();

    console.log("[META OAUTH URL]");
    console.log(oauthUrl);

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

    const { code, error, error_reason } = req.query;

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
