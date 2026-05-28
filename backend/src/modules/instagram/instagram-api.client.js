const axios = require("axios");

const { META_GRAPH_API_VERSION } = require("../../config/env");

const GRAPH_BASE_URL = `https://graph.facebook.com/${META_GRAPH_API_VERSION}`;

function log(...args) {
  console.log(`[INSTAGRAM API ${new Date().toISOString()}]`, ...args);
}

/**
 * ======================================
 * SEND API REQUEST
 * ======================================
 */

async function sendApiRequest({ accessToken, payload }) {
  try {
    const url = `${GRAPH_BASE_URL}/me/messages`;

    log("SEND API REQUEST");

    log({
      url,
      payload,
    });

    const response = await axios.post(url, payload, {
      params: {
        access_token: accessToken,
      },
    });

    log("SUCCESS RESPONSE");

    return response.data;
  } catch (error) {
    console.error(
      "[INSTAGRAM API ERROR]",
      error?.response?.data || error.message,
    );

    throw error;
  }
}

/**
 * ======================================
 * SEND TEXT MESSAGE
 * ======================================
 */

async function sendTextMessage({ accessToken, recipientId, messageText }) {
  return sendApiRequest({
    accessToken,

    payload: {
      recipient: {
        id: recipientId,
      },

      messaging_type: "RESPONSE",

      message: {
        text: messageText,
      },
    },
  });
}

/**
 * ======================================
 * SEND QUICK REPLIES
 * ======================================
 */

async function sendQuickReplies({
  accessToken,
  recipientId,
  messageText,
  replies = [],
}) {
  return sendApiRequest({
    accessToken,

    payload: {
      recipient: {
        id: recipientId,
      },

      messaging_type: "RESPONSE",

      message: {
        text: messageText,

        quick_replies: replies.map((item) => ({
          content_type: "text",
          title: item.title,
          payload: item.payload,
        })),
      },
    },
  });
}

/**
 * ======================================
 * SEND IMAGE
 * ======================================
 */

async function sendImageMessage({ accessToken, recipientId, imageUrl }) {
  return sendApiRequest({
    accessToken,

    payload: {
      recipient: {
        id: recipientId,
      },

      messaging_type: "RESPONSE",

      message: {
        attachment: {
          type: "image",

          payload: {
            url: imageUrl,
            is_reusable: true,
          },
        },
      },
    },
  });
}

/**
 * ======================================
 * SEND TYPING INDICATOR
 * ======================================
 */

async function sendTypingIndicator({ accessToken, recipientId }) {
  return sendApiRequest({
    accessToken,

    payload: {
      recipient: {
        id: recipientId,
      },

      sender_action: "typing_on",
    },
  });
}

/**
 * ======================================
 * MARK MESSAGE AS SEEN
 * ======================================
 */

async function markSeen({ accessToken, recipientId }) {
  return sendApiRequest({
    accessToken,

    payload: {
      recipient: {
        id: recipientId,
      },

      sender_action: "mark_seen",
    },
  });
}

module.exports = {
  sendTextMessage,
  sendQuickReplies,
  sendImageMessage,
  sendTypingIndicator,
  markSeen,
};
