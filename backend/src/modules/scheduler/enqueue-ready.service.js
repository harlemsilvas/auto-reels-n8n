const {
  getReadyPosts,
  markQueued,
  addEvent,
} = require("../posts/posts.service");
const { enqueuePublishJob } = require("./scheduler.queue");

function log(...args) {
  console.log(`[SCHEDULER ${new Date().toISOString()}]`, ...args);
}

async function enqueueReadyPosts(source = "scheduler.enqueue-ready") {
  log("Buscando posts prontos para fila");

  const ready = await getReadyPosts();

  log(`Posts prontos encontrados: ${ready.total}`);

  const results = await Promise.all(
    ready.items.map(async (item) => {
      log("Enfileirando post:", item.id);

      const enqueueResult = await enqueuePublishJob({
        id: item.id,
        workspaceId: item.workspaceId,
        publishType: item.publishType,
      });

      if (enqueueResult.queued) {
        await markQueued(item.id);

        await addEvent(item.workspaceId, item.id, "queued", {
          source,
          jobId: enqueueResult.jobId,
        });

        log("Post enfileirado:", item.id);
      } else {
        await addEvent(item.workspaceId, item.id, "queue_skipped", {
          source,
          reason: enqueueResult.reason,
          jobId: enqueueResult.jobId,
        });

        log("Post ignorado:", item.id, enqueueResult.reason);
      }

      return {
        postId: item.id,
        ...enqueueResult,
      };
    }),
  );

  const queuedCount = results.filter((item) => item.queued).length;
  const skippedCount = results.length - queuedCount;

  return {
    totalReady: ready.total,
    queuedCount,
    skippedCount,
    jobs: results,
  };
}

module.exports = {
  enqueueReadyPosts,
};
