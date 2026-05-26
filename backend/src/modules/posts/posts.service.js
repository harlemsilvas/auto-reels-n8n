// posts.service.js
const { POSTS_DATA_SOURCE } = require("../../config/env");

const fileProvider = require("./providers/file-posts.provider");
const dbProvider = require("./providers/db-posts.provider");

function getProvider() {
  if (POSTS_DATA_SOURCE === "db") {
    return dbProvider;
  }

  return fileProvider;
}

function log(...args) {
  console.log(`[POSTS ${new Date().toISOString()}]`, ...args);
}

/**
 * ======================================
 * Upload
 * ======================================
 */

async function createFromUpload(input) {
  log("Criando post upload");

  return getProvider().createPostFromUpload(input);
}

/**
 * ======================================
 * Ready Posts
 * ======================================
 */

async function getReadyPosts() {
  log("Buscando posts prontos");

  const provider = getProvider();

  log("Provider ativo:", POSTS_DATA_SOURCE);

  const result = await provider.listReadyPosts();

  const items = result?.items ?? [];

  log("Total READY:", items.length);

  items.forEach((item) => {
    log("READY ITEM", {
      id: item.id,
      status: item.status,
      scheduled_at: item.scheduledAt,
      published_at: item.publishedAt,
      filename: item.videoFilename,
    });
  });

  return {
    total: items.length,
    items,
  };
}

/**
 * ======================================
 * Posts
 * ======================================
 */

async function getPosts(filters = {}) {
  return getProvider().listPosts(filters);
}

async function getPostEvents(filters = {}) {
  return getProvider().listPostEvents(filters);
}

/**
 * ======================================
 * Status Updates
 * ======================================
 */

async function markProcessing(id) {
  log("Mark processing:", id);

  return getProvider().markPostProcessing(id);
}

async function markQueued(id) {
  log("Mark queued:", id);

  return getProvider().markPostQueued(id);
}

async function markPublished(id, payload = {}) {
  log("Mark published:", id);

  return getProvider().markPostPublished(id, payload);
}

async function markError(id, errorMessage) {
  log("Mark error:", id);

  return getProvider().markPostError(id, errorMessage);
}

async function cancelSchedule(id) {
  log("Cancel schedule:", id);

  return getProvider().cancelPostSchedule(id);
}

/**
 * ======================================
 * Events
 * ======================================
 */

async function addEvent(postId, eventType, details = {}) {
  log("Add event:", {
    postId,
    eventType,
  });

  return getProvider().addPostEvent(postId, eventType, details);
}

module.exports = {
  createFromUpload,
  getReadyPosts,
  getPosts,
  getPostEvents,
  markProcessing,
  markQueued,
  markPublished,
  markError,
  cancelSchedule,
  addEvent,
};
