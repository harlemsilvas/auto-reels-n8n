const realtimeGateway = require("./realtime.gateway");

/**
 * ======================================
 * SSE INBOX STREAM
 * ======================================
 */

function inboxStream(req, res) {
  realtimeGateway.registerClient(res);

  /**
   * ======================================
   * SSE HEADERS
   * ======================================
   */

  res.setHeader("Content-Type", "text/event-stream");

  res.setHeader("Cache-Control", "no-cache");

  res.setHeader("Connection", "keep-alive");

  res.flushHeaders();

  /**
   * ======================================
   * CONNECT EVENT
   * ======================================
   */

  res.write(
    `event: connected\n` +
      `data: ${JSON.stringify({
        success: true,
      })}\n\n`,
  );

  /**
   * ======================================
   * KEEP ALIVE
   * ======================================
   */

  const interval = setInterval(() => {
    res.write(`: ping\n\n`);
  }, 30000);

  /**
   * ======================================
   * CLEANUP
   * ======================================
   */

  req.on("close", () => {
    clearInterval(interval);

    realtimeGateway.removeClient(res);
  });
}

module.exports = {
  inboxStream,
};
