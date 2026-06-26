// file-posts.provider.js
const {
  MEDIA_PUBLIC_BASE_URL,
  META_GRAPH_API_VERSION,
  META_FALLBACK_TOKEN,
} = require("../../../config/env");

const {
  listPendingMedia,
  readCaptionForBaseName,
  movePendingItemToPublished,
  movePendingItemToError,
} = require("../../../services/media.service");

async function createPostFromUpload(input) {
  return {
    found: true,
    payload: {
      id: input.baseName,
      status: "pending",
    },
  };
}

async function createPostFromMediaUpload() {
  const error = new Error("Upload multi-midia requer POSTS_DATA_SOURCE=db.");
  error.status = 501;
  throw error;
}

async function listReadyPosts() {
  const pending = await listPendingMedia();

  const items = await Promise.all(
    pending.items.map(async (item) => ({
      id: item.id,

      status: "pending",

      videoFile: item.videoFile,

      caption: await readCaptionForBaseName(item.baseName),

      createdAt: item.createdAt,
      updatedAt: item.createdAt,

      scheduledAt: null,
      publishedAt: null,

      retryCount: 0,

      igAccountId: null,

      metaToken: META_FALLBACK_TOKEN,

      metaGraphVersion: META_GRAPH_API_VERSION,

      mediaPublicBaseUrl: MEDIA_PUBLIC_BASE_URL,
    })),
  );

  return {
    items,
    total: items.length,
  };
}

async function getPostForPublishing(id) {
  const ready = await listReadyPosts();
  return ready.items.find((item) => item.id === id) ?? null;
}

async function listPosts() {
  const ready = await listReadyPosts();

  return {
    items: ready.items.map((item) => ({
      id: item.id,
      status: "pending",
      caption: item.captionText,
      errorMessage: null,
      scheduledAt: null,
      publishedAt: null,
      createdAt: item.createdAt,
      updatedAt: item.createdAt,
      retryCount: 0,
      metaMediaId: null,
      accountId: null,
      videoFile: item.videoFile,
    })),
    total: ready.total,
  };
}

async function listPostEvents() {
  return {
    items: [],
    total: 0,
  };
}

async function markPostProcessing(id) {
  return {
    found: true,
    payload: {
      id,
      status: "processing",
      message: "Status recebido para processamento.",
    },
  };
}

async function markPostQueued(id) {
  return {
    found: true,
    payload: {
      id,
      status: "queued",
    },
  };
}

async function markPostPublished(id, _payload = {}) {
  const moveResult = await movePendingItemToPublished(id);

  if (!moveResult.movedVideo) {
    return {
      found: false,
      payload: { message: "Video pendente nao encontrado." },
    };
  }

  return {
    found: true,
    payload: {
      id,
      status: "published",
      movedVideo: moveResult.movedVideo,
      movedCaption: moveResult.movedCaption,
    },
  };
}

async function markPostError(id, errorMessage) {
  const moveResult = await movePendingItemToError(id);

  if (!moveResult.movedVideo) {
    return {
      found: false,
      payload: { message: "Video pendente nao encontrado." },
    };
  }

  return {
    found: true,
    payload: {
      id,
      status: "error",
      errorMessage,
      movedVideo: moveResult.movedVideo,
      movedCaption: moveResult.movedCaption,
    },
  };
}

async function cancelPostSchedule(id) {
  return {
    found: true,
    payload: {
      id,
      status: "canceled",
    },
  };
}

async function addPostEvent(_workspaceId, _postId, _eventType, _details = {}) {
  return true;
}

module.exports = {
  createPostFromUpload,
  createPostFromMediaUpload,
  listReadyPosts,
  getPostForPublishing,
  listPosts,
  listPostEvents,
  markPostProcessing,
  markPostQueued,
  markPostPublished,
  markPostError,
  cancelPostSchedule,
  addPostEvent,
};
