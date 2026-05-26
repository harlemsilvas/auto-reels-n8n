const { query } = require("../../lib/db");

const apiClient = require("./instagram-api.client");

function log(...args) {
  console.log(`[INSTAGRAM SEND ${new Date().toISOString()}]`, ...args);
}

/**
 * ======================================
 * FIND ACCOUNT
 * ======================================
 */

async function findAccount(accountId) {
  const result = await query(
    `
      SELECT
        id::text AS id,
        instagram_id AS "instagramId",
        access_token AS "accessToken",
        nome
      FROM instagram_accounts
      WHERE id = $1::uuid
        AND deleted_at IS NULL
      LIMIT 1
    `,
    [accountId],
  );

  return result.rowCount > 0 ? result.rows[0] : null;
}

/**
 * ======================================
 * SEND TEXT MESSAGE
 * ======================================
 */

async function sendTextMessage({ accountId, recipientId, messageText }) {
  log("SEND TEXT MESSAGE");

  const account = await findAccount(accountId);

  if (!account) {
    throw new Error("Instagram account not found.");
  }

  if (!account.accessToken) {
    throw new Error("Instagram access token not found.");
  }

  const response = await apiClient.sendInstagramMessage({
    accessToken: account.accessToken,
    recipientId,
    messageText,
  });

  log("MESSAGE SENT");

  return response;
}

module.exports = {
  sendTextMessage,
};
