const realtimeGateway = require("./realtime.gateway");

/**
 * ======================================
 * NEW MESSAGE EVENT
 * ======================================
 */

function emitNewMessage(message) {
  realtimeGateway.broadcast("new-message", message);
}

/**
 * ======================================
 * CONVERSATION UPDATED
 * ======================================
 */

function emitConversationUpdated(conversation) {
  realtimeGateway.broadcast("conversation_updated", conversation);
}

/**
 * ======================================
 * USER TYPING
 * ======================================
 */

function emitTyping(data) {
  realtimeGateway.broadcast("typing", data);
}

/**
 * ======================================
 * USER ONLINE
 * ======================================
 */

function emitOnline(data) {
  realtimeGateway.broadcast("online", data);
}

module.exports = {
  emitNewMessage,
  emitConversationUpdated,
  emitTyping,
  emitOnline,
};
