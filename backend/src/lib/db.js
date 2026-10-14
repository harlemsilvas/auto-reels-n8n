const { Pool } = require("pg");
const { AsyncLocalStorage } = require("node:async_hooks");
const scopedClient = new AsyncLocalStorage();
const {
  DB_CONNECTION_STRING,
  DB_HOST,
  DB_PORT,
  DB_NAME,
  DB_USER,
  DB_PASSWORD,
  DB_SSL,
} = require("../config/env");

let pool;

function createPool() {
  if (DB_CONNECTION_STRING) {
    return new Pool({
      connectionString: DB_CONNECTION_STRING,
      ssl: DB_SSL ? { rejectUnauthorized: false } : false,
    });
  }

  return new Pool({
    host: DB_HOST,
    port: DB_PORT,
    database: DB_NAME,
    user: DB_USER,
    password: DB_PASSWORD,
    ssl: DB_SSL ? { rejectUnauthorized: false } : false,
  });
}

function getPool() {
  if (!pool) {
    pool = createPool();
  }

  const client = scopedClient.getStore();
  if (!client) return pool;
  // Repository transactions reuse the send lease; release never returns it early.
  const facade = { query: (...args) => client.query(...args), release() {} };
  return { options: pool.options, query: facade.query, connect: async () => facade };
}

function runWithClient(client, callback) { return scopedClient.run(client, callback); }

async function query(text, params = []) {
  return getPool().query(text, params);
}

module.exports = {
  getPool,
  query,
  runWithClient,
};
