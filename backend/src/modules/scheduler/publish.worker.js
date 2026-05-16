const { Worker } = require("bullmq");
const { N8N_PUBLISH_WEBHOOK, PUBLISH_QUEUE_NAME } = require("../../config/env");
const {
  markProcessing,
  markPublished,
  markError,
  addEvent,
} = require("../posts/posts.service");
const { getRedisConnection } = require("./scheduler.queue");

async function notifyN8n(jobData) {
  if (!N8N_PUBLISH_WEBHOOK) {
    throw new Error("N8N_PUBLISH_WEBHOOK nao configurado.");
  }

  const response = await fetch(N8N_PUBLISH_WEBHOOK, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(jobData),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Falha no webhook n8n (${response.status}): ${body}`);
  }

  let payload = null;

  try {
    payload = await response.json();
  } catch (_error) {
    throw new Error("Webhook n8n retornou 2xx, mas corpo JSON invalido.");
  }

  const publishId = String(payload?.publishId ?? "").trim() || null;
  const metaContainerId = String(payload?.creationId ?? "").trim() || null;

  if (!publishId) {
    throw new Error(
      `Webhook n8n retornou 2xx sem publishId: ${JSON.stringify(payload)}`,
    );
  }

  return {
    publishId,
    metaContainerId,
    raw: payload,
  };
}

async function processPublishJob(job) {
  const postId = String(job.data.id);

  try {
    await addEvent(postId, "processing_started", {
      source: "worker",
      jobId: String(job.id),
      attempt: job.attemptsMade + 1,
    }).catch(() => null);

    await markProcessing(postId);
    const n8nResult = await notifyN8n(job.data);
    await addEvent(postId, "webhook_sent", {
      source: "worker",
      jobId: String(job.id),
      publishId: n8nResult.publishId,
    }).catch(() => null);

    const result = await markPublished(postId, {
      metaMediaId: n8nResult.publishId,
      metaContainerId: n8nResult.metaContainerId,
    });
    if (result && result.found === false) {
      throw new Error("Post nao encontrado ao marcar published.");
    }

    await addEvent(postId, "published", {
      source: "worker",
      jobId: String(job.id),
      status: "published",
      publishId: n8nResult.publishId,
    }).catch(() => null);

    return {
      postId,
      status: "published",
    };
  } catch (error) {
    await markError(postId, error.message).catch(() => null);
    await addEvent(postId, "publish_error", {
      source: "worker",
      jobId: String(job.id),
      message: error.message,
      attempt: job.attemptsMade + 1,
      maxAttempts: job.opts.attempts,
    }).catch(() => null);

    if (job.attemptsMade + 1 < (job.opts.attempts || 1)) {
      await addEvent(postId, "retry_scheduled", {
        source: "worker",
        jobId: String(job.id),
        nextAttempt: job.attemptsMade + 2,
      }).catch(() => null);
    }

    throw error;
  }
}

function startPublishWorker() {
  const worker = new Worker(PUBLISH_QUEUE_NAME, processPublishJob, {
    connection: getRedisConnection(),
    concurrency: 2,
  });

  worker.on("completed", (job) => {
    console.log(`[worker] job ${job.id} concluido`);
  });

  worker.on("failed", (job, error) => {
    console.error(`[worker] job ${job?.id} falhou:`, error.message);
  });

  return worker;
}

module.exports = {
  startPublishWorker,
};
