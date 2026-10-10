const { query } = require("../../lib/db");
const instagramSendService = require("../instagram/instagram-send.service");
const instagramApiClient = require("../instagram/instagram-api.client");

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
        COALESCE(latest.message_text, c.last_message_text) AS "lastMessageText",
        COALESCE(latest.created_at, c.last_message_at) AS "lastMessageAt",
        COALESCE(c.unread_count, 0)::int AS "unreadCount",
        a.access_token AS "_accessToken"
      FROM instagram_conversations c
      LEFT JOIN instagram_accounts a
        ON a.id = c.account_id AND a.deleted_at IS NULL AND a.ativo = TRUE
      LEFT JOIN LATERAL (
        SELECT m.message_text, m.created_at
        FROM instagram_messages m
        WHERE m.conversation_id = c.id
          AND NULLIF(BTRIM(m.message_text), '') IS NOT NULL
        ORDER BY m.created_at DESC, m.id DESC
        LIMIT 1
      ) latest ON TRUE
      WHERE c.deleted_at IS NULL
        AND c.testers_hidden_at IS NULL
      ORDER BY COALESCE(latest.created_at, c.last_message_at) DESC NULLS LAST,
        c.updated_at DESC
    `,
  );

  const items = [];

  // Limita consultas externas e nunca inclui o token na resposta da API.
  for (let offset = 0; offset < result.rows.length; offset += 5) {
    const batch = await Promise.all(result.rows.slice(offset, offset + 5).map(async (row) => {
      const { _accessToken, ...conversation } = row;

      if (!_accessToken || !/^\d+$/.test(conversation.instagramUserId) ||
          (conversation.instagramName && conversation.instagramUsername)) {
        return conversation;
      }

      try {
        const profile = await instagramApiClient.getUserProfile({
          accessToken: _accessToken,
          instagramUserId: conversation.instagramUserId,
        });
        conversation.instagramName ||= profile.name;
        conversation.instagramUsername ||= profile.username;
      } catch {
        // Perfil indisponivel nao pode impedir listagem ou resposta a uma DM.
      }

      return conversation;
    }));
    items.push(...batch);
  }

  return { total: items.length, items };
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

async function hideTesterConversation(conversationId) {
  if (typeof conversationId !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(conversationId)) {
    throw createHttpError(400, "Invalid conversationId.");
  }

  const result = await query(
    `UPDATE instagram_conversations
     SET testers_hidden_at = COALESCE(testers_hidden_at, NOW())
     WHERE id = $1::uuid AND deleted_at IS NULL
     RETURNING id::text AS id`,
    [conversationId],
  );
  if (!result.rowCount) {
    throw createHttpError(404, "Conversation not found.");
  }
  return { ok: true, id: result.rows[0].id };
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
  hideTesterConversation,
};
