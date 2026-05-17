const { POSTS_DATA_SOURCE } = require("../../config/env");
const fileProvider = require("./providers/file-posts.provider");
const dbProvider = require("./providers/db-posts.provider");

function getProvider() {
  if (POSTS_DATA_SOURCE === "db") {
    return dbProvider;
  }

  return fileProvider;
}

async function createFromUpload(input) {
  return getProvider().createPostFromUpload(input);
}

async function getReadyPosts() {
  return getProvider().listReadyPosts();
}

async function getPosts(filters = {}) {
  return getProvider().listPosts(filters);
}

async function getPostEvents(filters = {}) {
  return getProvider().listPostEvents(filters);
}

async function markProcessing(id) {
  return getProvider().markPostProcessing(id);
}

async function markQueued(id) {
  return getProvider().markPostQueued(id);
}

async function markPublished(id, payload = {}) {
  return getProvider().markPostPublished(id, payload);
}

async function markError(id, errorMessage) {
  return getProvider().markPostError(id, errorMessage);
}

async function cancelSchedule(id) {
  return getProvider().cancelPostSchedule(id);
}

async function addEvent(postId, eventType, details = {}) {
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
