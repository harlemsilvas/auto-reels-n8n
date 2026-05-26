const axios = require("axios");

const { META_GRAPH_API_VERSION } = require("../../config/env");

const GRAPH_BASE_URL = `https://graph.facebook.com/${META_GRAPH_API_VERSION}`;

function log(...args) {
  console.log(`[INSTAGRAM API ${new Date().toISOString()}]`, ...args);
}

/**
 * ======================================
 * SEND INSTAGRAM MESSAGE
 * ======================================
 */

async function sendInstagramMessage({ accessToken, recipientId, messageText }) {
  try {
    log("SEND INSTAGRAM MESSAGE");

    const url = `${GRAPH_BASE_URL}/me/messages`;

    const payload = {
      recipient: {
        id: recipientId,
      },

      messaging_type: "RESPONSE",

      message: {
        text: messageText,
      },
    };

    log("REQUEST:", {
      url,
      recipientId,
      messageText,
    });

    const response = await axios.post(url, payload, {
      params: {
        access_token: accessToken,
      },
    });

    log("SUCCESS RESPONSE:", response.data);

    return response.data;
  } catch (error) {
    console.error(
      "[INSTAGRAM SEND ERROR]",
      error?.response?.data || error.message,
    );

    throw error;
  }
}

module.exports = {
  sendInstagramMessage,
};
