const clients = new Set();

/**
 * ======================================
 * REGISTER CLIENT
 * ======================================
 */

function registerClient(client) {
  clients.add(client);

  console.log(`[REALTIME] Client connected (${clients.size})`);
}

/**
 * ======================================
 * REMOVE CLIENT
 * ======================================
 */

function removeClient(client) {
  clients.delete(client);

  console.log(`[REALTIME] Client disconnected (${clients.size})`);
}

/**
 * ======================================
 * BROADCAST EVENT
 * ======================================
 */

function broadcast(event, payload = {}) {
  const data = `event: ${event}\n` + `data: ${JSON.stringify(payload)}\n\n`;

  for (const client of clients) {
    client.write(data);
  }
}

module.exports = {
  registerClient,
  removeClient,
  broadcast,
};
