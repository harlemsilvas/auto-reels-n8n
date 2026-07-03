const {
  addEvent,
  markQueued,
} = require("../posts/posts.service");
const { enqueuePublishJob } = require("../scheduler/scheduler.queue");

async function enqueueImmediatePost(
  post,
  actorUserId = null,
  dependencies = {},
) {
  const enqueue = dependencies.enqueuePublishJob ?? enqueuePublishJob;
  const setQueued = dependencies.markQueued ?? markQueued;
  const recordEvent = dependencies.addEvent ?? addEvent;

  let result;

  try {
    result = await enqueue({
      id: post.id,
      workspaceId: post.workspaceId,
      publishType: post.publishType,
    });
  } catch (error) {
    await recordEvent(
      post.workspaceId,
      post.id,
      "queue_failed",
      {
        source: "media.upload.immediate",
        message: error?.message ?? "Falha ao enfileirar post imediato.",
      },
      actorUserId,
    ).catch(() => null);

    return {
      queued: false,
      reason: "queue_error",
      message: error?.message ?? "Falha ao enfileirar post imediato.",
    };
  }

  if (result.queued) {
    try {
      await setQueued(post.id);
    } catch (error) {
      await recordEvent(
        post.workspaceId,
        post.id,
        "queue_status_sync_failed",
        {
          source: "media.upload.immediate",
          jobId: result.jobId,
          message: error?.message ?? "Falha ao sincronizar status queued.",
        },
        actorUserId,
      ).catch(() => null);

      return {
        ...result,
        statusSync: false,
        message: error?.message ?? "Falha ao sincronizar status queued.",
      };
    }

    await recordEvent(
      post.workspaceId,
      post.id,
      "queued",
      {
        source: "media.upload.immediate",
        jobId: result.jobId,
      },
      actorUserId,
    ).catch(() => null);

    return result;
  }

  await recordEvent(
    post.workspaceId,
    post.id,
    "queue_skipped",
    {
      source: "media.upload.immediate",
      reason: result.reason ?? null,
      jobId: result.jobId ?? null,
    },
    actorUserId,
  ).catch(() => null);

  return result;
}

module.exports = {
  enqueueImmediatePost,
};
