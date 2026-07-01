const axios = require("axios");
const { createHash, randomBytes } = require("node:crypto");

const {
  META_APP_ID,
  META_APP_SECRET,
  META_REDIRECT_URI,
  META_GRAPH_API_VERSION,
  FRONTEND_URL,
} = require("../../config/env");

const { upsertAccount } = require("../accounts/accounts.service");
const { query } = require("../../lib/db");

const GRAPH_BASE_URL = `https://graph.facebook.com/${META_GRAPH_API_VERSION}`;

function log(...args) {
  console.log(`[META OAUTH ${new Date().toISOString()}]`, ...args);
}

/**
 * ======================================
 * BUILD META OAUTH URL
 * ======================================
 */

function buildOAuthUrl(state) {
  const scopes = [
    "instagram_basic",
    "instagram_content_publish",
    "instagram_manage_messages",
    "pages_show_list",
    "pages_manage_metadata",
    "pages_messaging",
    "pages_read_engagement",
    "business_management",
  ];

  const params = new URLSearchParams({
    client_id: META_APP_ID,
    redirect_uri: META_REDIRECT_URI,
    response_type: "code",
    scope: scopes.join(","),
  });

  if (state) {
    params.set("state", state);
  }

  return `https://www.facebook.com/${META_GRAPH_API_VERSION}/dialog/oauth?${params.toString()}`;
}

function hashOAuthState(state) {
  return createHash("sha256").update(String(state)).digest();
}

async function createOAuthState(session, ipAddress) {
  const state = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

  await query(
    `
      DELETE FROM socialbot_oauth_states
      WHERE session_id = $1::uuid
        AND (consumed_at IS NOT NULL OR expires_at <= NOW())
    `,
    [session.sessionId],
  );

  await query(
    `
      INSERT INTO socialbot_oauth_states (
        session_id, user_id, provider, state_hash, expires_at, ip_address
      )
      VALUES ($1::uuid, $2::uuid, 'meta', $3, $4::timestamptz, $5::inet)
    `,
    [
      session.sessionId,
      session.userId,
      hashOAuthState(state),
      expiresAt,
      ipAddress || null,
    ],
  );

  return state;
}

async function consumeOAuthState(state, session) {
  if (!state) return false;

  const result = await query(
    `
      UPDATE socialbot_oauth_states
      SET consumed_at = NOW()
      WHERE state_hash = $1
        AND session_id = $2::uuid
        AND user_id = $3::uuid
        AND provider = 'meta'
        AND consumed_at IS NULL
        AND expires_at > NOW()
      RETURNING id
    `,
    [hashOAuthState(state), session.sessionId, session.userId],
  );

  return result.rowCount === 1;
}

/**
 * ======================================
 * EXCHANGE CODE FOR ACCESS TOKEN
 * ======================================
 */

async function exchangeCodeForToken(code) {
  log("Exchanging OAuth code for token");

  const response = await axios.get(`${GRAPH_BASE_URL}/oauth/access_token`, {
    params: {
      client_id: META_APP_ID,
      client_secret: META_APP_SECRET,
      redirect_uri: META_REDIRECT_URI,
      code,
    },
  });

  return response.data;
}

/**
 * ======================================
 * GET LONG LIVED TOKEN
 * ======================================
 */

async function exchangeForLongLivedToken(shortToken) {
  log("Generating long-lived token");

  const response = await axios.get(`${GRAPH_BASE_URL}/oauth/access_token`, {
    params: {
      grant_type: "fb_exchange_token",
      client_id: META_APP_ID,
      client_secret: META_APP_SECRET,
      fb_exchange_token: shortToken,
    },
  });

  return response.data;
}

/**
 * ======================================
 * GET FACEBOOK USER
 * ======================================
 */

async function getFacebookUser(accessToken) {
  log("Fetching Facebook user");

  const response = await axios.get(`${GRAPH_BASE_URL}/me`, {
    params: {
      fields: "id,name",
      access_token: accessToken,
    },
  });

  return response.data;
}

/**
 * ======================================
 * GET FACEBOOK PAGES
 * ======================================
 */

async function getFacebookPages(accessToken) {
  log("Fetching Facebook pages");

  const response = await axios.get(`${GRAPH_BASE_URL}/me/accounts`, {
    params: {
      fields: "id,name,access_token,instagram_business_account",
      access_token: accessToken,
    },
  });

  return response.data?.data ?? [];
}

/**
 * ======================================
 * GET INSTAGRAM ACCOUNT
 * ======================================
 */

async function getInstagramAccount(igUserId, pageAccessToken) {
  log("Fetching Instagram account:", igUserId);

  const response = await axios.get(`${GRAPH_BASE_URL}/${igUserId}`, {
    params: {
      fields:
        "id,username,profile_picture_url,name,followers_count,follows_count,media_count",
      access_token: pageAccessToken,
    },
  });

  return response.data;
}

/**
 * ======================================
 * SAVE ACCOUNT
 * ======================================
 */

async function persistInstagramAccount({
  facebookUser,
  page,
  instagramAccount,
  token,
  expiresIn,
}) {
  log("Persisting Instagram account");

  const expiresAt = expiresIn ? new Date(Date.now() + expiresIn * 1000) : null;

  return upsertAccount({
    nome: instagramAccount?.name || instagramAccount?.username || page?.name,

    instagramId: instagramAccount?.id,

    pageId: page?.id,

    accessToken: token,

    tokenExpiresAt: expiresAt ? expiresAt.toISOString() : null,

    ativo: true,

    facebookUserId: facebookUser?.id,

    username: instagramAccount?.username,

    profilePictureUrl: instagramAccount?.profile_picture_url,

    accountType: "instagram_business",
  });
}

/**
 * ======================================
 * PROCESS OAUTH CALLBACK
 * ======================================
 */

async function processOAuthCallback(code) {
  try {
    log("======================================");
    log("START OAUTH CALLBACK");

    /**
     * STEP 1
     * Exchange code -> short token
     */

    const shortTokenData = await exchangeCodeForToken(code);

    const shortToken = shortTokenData.access_token;

    if (!shortToken) {
      throw new Error("Falha ao obter access token.");
    }

    /**
     * STEP 2
     * Long-lived token
     */

    const longLivedData = await exchangeForLongLivedToken(shortToken);

    const accessToken = longLivedData.access_token;

    // Meta nem sempre retorna expires_in no long-lived token.
    // Fallback: 60 dias em segundos (comportamento padrao da Meta).
    const SIXTY_DAYS_SECONDS = 60 * 24 * 60 * 60;
    const expiresIn = longLivedData.expires_in ?? SIXTY_DAYS_SECONDS;

    /**
     * STEP 3
     * Facebook user
     */

    const facebookUser = await getFacebookUser(accessToken);

    /**
     * STEP 4
     * Pages
     */

    const pages = await getFacebookPages(accessToken);

    if (!pages.length) {
      throw new Error("Nenhuma pagina Facebook encontrada.");
    }

    /**
     * STEP 5
     * Find page with IG account
     */

    const validPage = pages.find((page) => page.instagram_business_account?.id);

    if (!validPage) {
      throw new Error("Nenhuma conta Instagram Business conectada.");
    }

    const igUserId = validPage.instagram_business_account.id;

    /**
     * STEP 6
     * Instagram data
     */

    const instagramAccount = await getInstagramAccount(
      igUserId,
      validPage.access_token,
    );

    /**
     * STEP 7
     * Persist account
     */

    const savedAccount = await persistInstagramAccount({
      facebookUser,
      page: validPage,
      instagramAccount,
      token: validPage.access_token,
      expiresIn,
    });
    log("ACCOUNT SAVED:", {
      instagramId: instagramAccount?.id,
      username: instagramAccount?.username,
    });

    log("END OAUTH CALLBACK");
    log("======================================");

    return {
      success: true,
      account: savedAccount,
      facebookUser,
      instagramAccount,
    };
  } catch (error) {
    console.error("[META OAUTH ERROR]", error?.response?.data || error.message);

    throw error;
  }
}

/**
 * ======================================
 * FRONTEND SUCCESS REDIRECT
 * ======================================
 */

function buildSuccessRedirect() {
  return `${FRONTEND_URL}/contas?connected=true`;
}

/**
 * ======================================
 * FRONTEND ERROR REDIRECT
 * ======================================
 */

function buildErrorRedirect(message) {
  const encoded = encodeURIComponent(message || "oauth_error");

  return `${FRONTEND_URL}/contas?error=${encoded}`;
}

module.exports = {
  buildOAuthUrl,
  consumeOAuthState,
  createOAuthState,
  exchangeCodeForToken,
  exchangeForLongLivedToken,
  getFacebookUser,
  getFacebookPages,
  getInstagramAccount,
  persistInstagramAccount,
  processOAuthCallback,
  buildSuccessRedirect,
  buildErrorRedirect,
};
