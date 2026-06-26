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

async function createFromMediaUpload(input) {
  log("Criando post multi-midia", {
    publishType: input.publishType,
    files: input.files?.length ?? 0,
  });

  const provider = getProvider();

  if (typeof provider.createPostFromMediaUpload !== "function") {
    const error = new Error(
      "Upload multi-midia requer POSTS_DATA_SOURCE=db.",
    );
    error.status = 501;
    throw error;
  }

  return provider.createPostFromMediaUpload(input);
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
      filename: item.videoFile || item.videoFilename,
    });
  });

  return {
    total: items.length,
    items,
  };
}

async function getPostForPublishing(id) {
  log("Carregando post para publicacao:", id);

  const provider = getProvider();

  if (typeof provider.getPostForPublishing !== "function") {
    throw new Error("Provider nao suporta carregamento para publicacao.");
  }

  return provider.getPostForPublishing(id);
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

async function markError(id, errorMessage, currentRetryCount = 0) {
  log("Mark error:", id);

  return getProvider().markPostError(id, errorMessage, currentRetryCount);
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

async function addEvent(workspaceId, postId, eventType, details = {}) {
  log("Add event:", {
    workspaceId,
    postId,
    eventType,
  });

  return getProvider().addPostEvent(workspaceId, postId, eventType, details);
}

module.exports = {
  createFromUpload,
  createFromMediaUpload,
  getReadyPosts,
  getPostForPublishing,
  getPosts,
  getPostEvents,
  markProcessing,
  markQueued,
  markPublished,
  markError,
  cancelSchedule,
  addEvent,
};
