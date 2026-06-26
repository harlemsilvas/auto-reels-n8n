const path = require("node:path");

/**
 * ======================================
 * LOAD .ENV
 * ======================================
 */

require("dotenv").config();

require("dotenv").config({
  path: path.resolve(__dirname, "../../../.env"),
  override: false,
});

/**
 * ======================================
 * META
 * ======================================
 */

const META_APP_ID = process.env.META_APP_ID ?? "";
const META_APP_SECRET = process.env.META_APP_SECRET ?? "";
const META_REDIRECT_URI = process.env.META_REDIRECT_URI ?? "";
const FRONTEND_URL = process.env.FRONTEND_URL ?? "";

const META_VERIFY_TOKEN =
  process.env.META_VERIFY_TOKEN ?? "socialbot_verify_token";

const META_WEBHOOK_VERIFY_TOKEN = process.env.META_WEBHOOK_VERIFY_TOKEN ?? "";

const META_GRAPH_API_VERSION = process.env.META_GRAPH_API_VERSION ?? "v23.0";

const META_FALLBACK_TOKEN = process.env.META_FALLBACK_TOKEN ?? "";

/**
 * ======================================
 * API
 * ======================================
 */

const API_PORT = Number(process.env.API_PORT ?? 3101);

/**
 * ======================================
 * MEDIA
 * ======================================
 */

const MEDIA_ROOT = process.env.MEDIA_ROOT ?? "/home/socialbot/media/reels";

const MEDIA_PENDING_DIR =
  process.env.MEDIA_PENDING_DIR ?? path.join(MEDIA_ROOT, "pending");

const MEDIA_PUBLISHED_DIR =
  process.env.MEDIA_PUBLISHED_DIR ?? path.join(MEDIA_ROOT, "published");

const MEDIA_ERROR_DIR =
  process.env.MEDIA_ERROR_DIR ?? path.join(MEDIA_ROOT, "error");

const MEDIA_PUBLIC_BASE_URL = process.env.MEDIA_PUBLIC_BASE_URL ?? "";

/**
 * ======================================
 * CORS
 * ======================================
 */

const CORS_ALLOWED_ORIGINS =
  process.env.CORS_ALLOWED_ORIGINS ?? "http://localhost:5181";

function getAllowedOrigins() {
  if (CORS_ALLOWED_ORIGINS.trim() === "*") {
    return "*";
  }

  return CORS_ALLOWED_ORIGINS.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

/**
 * ======================================
 * POSTS
 * ======================================
 */

const POSTS_DATA_SOURCE = process.env.POSTS_DATA_SOURCE ?? "file";

/**
 * ======================================
 * DATABASE
 * ======================================
 */

const DB_CONNECTION_STRING = process.env.DATABASE_URL ?? "";

const DB_HOST = process.env.DB_HOST ?? process.env.POSTGRES_HOST ?? "localhost";

const DB_PORT = Number(
  process.env.DB_PORT ?? process.env.POSTGRES_PORT ?? 55432,
);

const DB_NAME = process.env.DB_NAME ?? process.env.POSTGRES_DB ?? "n8n";

const DB_USER = process.env.DB_USER ?? process.env.POSTGRES_USER ?? "n8n";

const DB_PASSWORD =
  process.env.DB_PASSWORD ?? process.env.POSTGRES_PASSWORD ?? "n8n";

const DB_SSL = String(process.env.DB_SSL ?? "false").toLowerCase() === "true";

/**
 * ======================================
 * REDIS
 * ======================================
 */

const REDIS_HOST = process.env.REDIS_HOST ?? "localhost";

const REDIS_PORT = Number(process.env.REDIS_PORT ?? 56379);

const REDIS_PASSWORD = process.env.REDIS_PASSWORD ?? "";

/**
 * ======================================
 * QUEUE
 * ======================================
 */

const PUBLISH_QUEUE_NAME =
  process.env.PUBLISH_QUEUE_NAME ?? "socialbot_publish";

const N8N_PUBLISH_WEBHOOK = process.env.N8N_PUBLISH_WEBHOOK ?? "";

const MULTI_PUBLISH_ENABLED =
  String(process.env.MULTI_PUBLISH_ENABLED ?? "false").toLowerCase() ===
  "true";

const AUTO_ENQUEUE_READY_ENABLED =
  String(process.env.AUTO_ENQUEUE_READY_ENABLED ?? "true").toLowerCase() ===
  "true";

const AUTO_ENQUEUE_READY_INTERVAL_MS = Number(
  process.env.AUTO_ENQUEUE_READY_INTERVAL_MS ?? 900000,
);

/**
 * ======================================
 * INSIGHTS
 * ======================================
 */

const INSIGHTS_JOB_ENABLED =
  String(process.env.INSIGHTS_JOB_ENABLED ?? "false").toLowerCase() === "true";

const INSIGHTS_INTERVAL_MS = Number(process.env.INSIGHTS_INTERVAL_MS ?? 300000);

const INSIGHTS_BATCH_SIZE = Number(process.env.INSIGHTS_BATCH_SIZE ?? 50);

/**
 * ======================================
 * EXPORTS
 * ======================================
 */

module.exports = {
  API_PORT,

  MEDIA_ROOT,
  MEDIA_PENDING_DIR,
  MEDIA_PUBLISHED_DIR,
  MEDIA_ERROR_DIR,
  MEDIA_PUBLIC_BASE_URL,

  getAllowedOrigins,

  POSTS_DATA_SOURCE,

  DB_CONNECTION_STRING,
  DB_HOST,
  DB_PORT,
  DB_NAME,
  DB_USER,
  DB_PASSWORD,
  DB_SSL,

  REDIS_HOST,
  REDIS_PORT,
  REDIS_PASSWORD,

  PUBLISH_QUEUE_NAME,
  N8N_PUBLISH_WEBHOOK,
  MULTI_PUBLISH_ENABLED,
  AUTO_ENQUEUE_READY_ENABLED,
  AUTO_ENQUEUE_READY_INTERVAL_MS,

  INSIGHTS_JOB_ENABLED,
  INSIGHTS_INTERVAL_MS,
  INSIGHTS_BATCH_SIZE,

  META_APP_ID,
  META_APP_SECRET,
  META_REDIRECT_URI,
  META_VERIFY_TOKEN,
  META_WEBHOOK_VERIFY_TOKEN,
  META_GRAPH_API_VERSION,
  META_FALLBACK_TOKEN,

  FRONTEND_URL,
};
