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

async function listReadyPosts() {
  const pending = await listPendingMedia();

  const items = await Promise.all(
    pending.items.map(async (item) => ({
      id: item.id,
      videoFile: item.videoFile,
      captionText: await readCaptionForBaseName(item.baseName),
      createdAt: item.createdAt,
      status: "pending",
      igAccountId: null,
      metaToken: null,
      metaGraphVersion: "v25.0",
      mediaPublicBaseUrl: undefined,
    })),
  );

  return {
    items,
    total: items.length,
  };
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

async function addPostEvent(_postId, _eventType, _details = {}) {
  return true;
}

module.exports = {
  createPostFromUpload,
  listReadyPosts,
  listPosts,
  listPostEvents,
  markPostProcessing,
  markPostQueued,
  markPostPublished,
  markPostError,
  cancelPostSchedule,
  addPostEvent,
};
