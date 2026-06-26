const { query } = require("../../lib/db");
const instagramSendService = require("../instagram/instagram-send.service");

function createHttpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

async function listTesterConversations() {
  const result = await query(
    `
      SELECT
        c.id::text AS id,
        c.account_id::text AS "accountId",
        c.instagram_user_id AS "instagramUserId",
        c.instagram_username AS "instagramUsername",
        c.instagram_name AS "instagramName",
        c.last_message_text AS "lastMessageText",
        c.last_message_at AS "lastMessageAt",
        COALESCE(c.unread_count, 0)::int AS "unreadCount"
      FROM instagram_conversations c
      WHERE c.deleted_at IS NULL
      ORDER BY c.updated_at DESC
    `,
  );

  return {
    total: result.rows.length,
    items: result.rows,
  };
}

async function findConversationById(conversationId) {
  const result = await query(
    `
      SELECT
        c.id::text AS id,
        c.account_id::text AS "accountId",
        c.instagram_user_id AS "instagramUserId",
        c.instagram_username AS "instagramUsername",
        c.instagram_name AS "instagramName"
      FROM instagram_conversations c
      WHERE c.id = $1::uuid
        AND c.deleted_at IS NULL
      LIMIT 1
    `,
    [conversationId],
  );

  return result.rowCount > 0 ? result.rows[0] : null;
}

async function findInstagramAccount(accountId) {
  const result = await query(
    `
      SELECT
        id::text AS id,
        nome,
        instagram_id AS "instagramId",
        access_token AS "accessToken"
      FROM instagram_accounts
      WHERE id = $1::uuid
        AND deleted_at IS NULL
      LIMIT 1
    `,
    [accountId],
  );

  return result.rowCount > 0 ? result.rows[0] : null;
}

async function sendDmToTester({ conversationId, message }) {
  const normalizedMessage = String(message ?? "").trim();

  if (!conversationId) {
    throw createHttpError(400, "conversationId is required.");
  }

  if (!normalizedMessage) {
    throw createHttpError(400, "message is required.");
  }

  const conversation = await findConversationById(conversationId);

  if (!conversation) {
    throw createHttpError(404, "Conversation not found.");
  }

  if (!conversation.accountId) {
    throw createHttpError(400, "Conversation does not have a linked account.");
  }

  if (!conversation.instagramUserId) {
    throw createHttpError(
      400,
      "Conversation does not have an instagram_user_id recorded yet.",
    );
  }

  const account = await findInstagramAccount(conversation.accountId);

  if (!account) {
    throw createHttpError(404, "Instagram account not found.");
  }

  if (!account.accessToken) {
    throw createHttpError(400, "Instagram access token not found.");
  }

  const sentMessage = await instagramSendService.sendTextMessage({
    accountId: account.id,
    recipientId: conversation.instagramUserId,
    messageText: normalizedMessage,
  });

  return {
    ok: true,
    conversation,
    account: {
      id: account.id,
      nome: account.nome,
      instagramId: account.instagramId,
    },
    message: sentMessage,
  };
}

module.exports = {
  listTesterConversations,
  sendDmToTester,
};
