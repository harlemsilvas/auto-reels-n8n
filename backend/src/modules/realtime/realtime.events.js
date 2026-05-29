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

function emitNewMessage(message) {
  console.log("[REALTIME EVENTS] emitNewMessage", message?.conversationId);

  realtimeGateway.broadcast("new-message", message);
}

module.exports = {
  emitNewMessage,
  emitConversationUpdated,
  emitTyping,
  emitOnline,
  emitNewMessage,
};
