const path = require("node:path");
require("dotenv").config({ quiet: true });

const API_PORT = Number(process.env.API_PORT ?? 3101);
const MEDIA_ROOT = process.env.MEDIA_ROOT ?? "/home/socialbot/media/reels";

const MEDIA_PENDING_DIR =
  process.env.MEDIA_PENDING_DIR ?? path.join(MEDIA_ROOT, "pending");
const MEDIA_PUBLISHED_DIR =
  process.env.MEDIA_PUBLISHED_DIR ?? path.join(MEDIA_ROOT, "published");
const MEDIA_ERROR_DIR =
  process.env.MEDIA_ERROR_DIR ?? path.join(MEDIA_ROOT, "error");

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

module.exports = {
  API_PORT,
  MEDIA_ROOT,
  MEDIA_PENDING_DIR,
  MEDIA_PUBLISHED_DIR,
  MEDIA_ERROR_DIR,
  getAllowedOrigins,
};
