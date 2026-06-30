const { Worker } = require("bullmq");
const {
  N8N_PUBLISH_WEBHOOK,
  PUBLISH_QUEUE_NAME,
  MULTI_PUBLISH_ENABLED,
} = require("../../config/env");

const {
  getPostForPublishing,
  markProcessing,
  markPublished,
  markError,
  addEvent,
} = require("../posts/posts.service");
const { publishPost } = require("../publisher/publisher.service");

const { getRedisConnection } = require("./scheduler.queue");

async function notifyN8n(jobData) {
  if (!N8N_PUBLISH_WEBHOOK) {
    throw new Error("N8N_PUBLISH_WEBHOOK nao configurado.");
  }

  console.log(
    "[N8N PAYLOAD]",
    JSON.stringify(
      {
        ...jobData,
        metaToken: jobData.metaToken ? "***hidden***" : null,
        accessToken: jobData.accessToken ? "***hidden***" : undefined,
      },
      null,
      2,
    ),
  );

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

    console.log("N8N RESPONSE");
    console.dir(payload, { depth: null });
  } catch (_error) {
    throw new Error("Webhook n8n retornou 2xx, mas corpo JSON invalido.");
  }

  if (payload?.ok === false || payload?.status === "error") {
    const message =
      String(payload?.message ?? payload?.errorMessage ?? "").trim() ||
      "Webhook n8n sinalizou falha na publicacao.";

    throw new Error(message);
  }

  if (payload?.hasError === true) {
    const message =
      String(payload?.errorMessage ?? payload?.message ?? "").trim() ||
      "Webhook n8n retornou hasError=true.";

    throw new Error(message);
  }

  const publishId =
    String(payload?.publishId ?? payload?.mediaId ?? "").trim() || null;

  const metaContainerId =
    String(payload?.creationId ?? payload?.containerId ?? "").trim() || null;

  if (!publishId) {
    const error = new Error(
      `Webhook n8n retornou 2xx sem publishId: ${JSON.stringify(payload)}`,
    );

    const status = String(payload?.status ?? "").trim().toLowerCase();
    const looksPublished =
      payload?.ok === true || status === "published" || status === "success";

    if (looksPublished) {
      error.code = "N8N_PUBLISHED_WITHOUT_PUBLISH_ID";
      error.noRetry = true;
      error.metaContainerId = metaContainerId;
    }

    throw error;
  }

  if (metaContainerId && publishId === metaContainerId) {
    console.warn(
      "[N8N WARN] publishId igual ao creationId. Verifique o fluxo n8n/meta:",
      {
        publishId,
        metaContainerId,
      },
    );
  }

  return {
    publishId,
    metaContainerId,
    raw: payload,
  };
}

async function publishByType(post, dependencies = {}) {
  const publishType = post.publishType ?? post.publish_type ?? "reel";

  if (publishType === "reel") {
    const n8nPublisher = dependencies.notifyN8n ?? notifyN8n;
    const result = await n8nPublisher(post);

    return {
      publishType: "reel",
      metaMediaId: result.publishId,
      metaContainerId: result.metaContainerId,
      publishOptions: {},
      raw: result.raw,
    };
  }

  const multiPublishEnabled =
    dependencies.multiPublishEnabled ?? MULTI_PUBLISH_ENABLED;

  if (!multiPublishEnabled) {
    const error = new Error(
      "Publicacao multi-tipo desabilitada. Configure MULTI_PUBLISH_ENABLED=true.",
    );
    error.code = "MULTI_PUBLISH_DISABLED";
    throw error;
  }

  const strategyPublisher = dependencies.publishPost ?? publishPost;
  return strategyPublisher(post, dependencies.publisherDependencies ?? {});
}

async function processPublishJob(job, dependencies = {}) {
  console.log("[JOB DATA]");
  console.dir(job.data, { depth: null });

  const postId = String(job.data.id);
  let workspaceId = String(job.data.workspaceId ?? "").trim() || null;
  const recordEvent = dependencies.addEvent ?? addEvent;
  const setProcessing = dependencies.markProcessing ?? markProcessing;
  const setPublished = dependencies.markPublished ?? markPublished;
  const setError = dependencies.markError ?? markError;

  try {
    const loadPost =
      dependencies.getPostForPublishing ?? getPostForPublishing;
    const post = await loadPost(postId);

    if (!post) {
      throw new Error("Post nao encontrado para publicacao.");
    }

    workspaceId = String(post.workspaceId ?? workspaceId ?? "").trim() || null;

    if (post.status === "canceled") {
      throw new Error("Post cancelado nao pode ser publicado.");
    }

    if (post.status === "published") {
      return {
        postId,
        status: "published",
        skipped: true,
      };
    }

    await recordEvent(workspaceId, postId, "processing_started", {
      source: "worker",
      jobId: String(job.id),
      attempt: job.attemptsMade + 1,
      publishType: post.publishType,
    }).catch(() => null);

    await setProcessing(postId);

    const publishResult = await publishByType(post, dependencies);

    console.log("PUBLISH RESULT:");
    console.log(JSON.stringify(publishResult, null, 2));

    await recordEvent(workspaceId, postId, "publisher_completed", {
      source: "worker",
      jobId: String(job.id),
      publishType: publishResult.publishType,
      publishId: publishResult.metaMediaId,
      creationId: publishResult.metaContainerId,
    }).catch(() => null);

    const result = await setPublished(postId, {
      metaMediaId: publishResult.metaMediaId,
      metaContainerId: publishResult.metaContainerId,
      publishOptions: publishResult.publishOptions,
    });

    if (result && result.found === false) {
      throw new Error("Post nao encontrado ao marcar published.");
    }

    await recordEvent(workspaceId, postId, "published", {
      source: "worker",
      jobId: String(job.id),
      status: "published",
      publishType: publishResult.publishType,
      publishId: publishResult.metaMediaId,
      creationId: publishResult.metaContainerId,
    }).catch(() => null);

    return {
      postId,
      status: "published",
    };
  } catch (error) {
    if (error.noRetry && typeof job.discard === "function") {
      job.discard();
    }

    await setError(postId, error.message, job.attemptsMade).catch(() => null);

    await recordEvent(workspaceId, postId, "publish_error", {
      source: "worker",
      jobId: String(job.id),
      message: error.message,
      code: error.code || null,
      httpStatus: error.status || null,
      operation: error.operation || null,
      metaCode: error.metaCode || null,
      metaSubcode: error.metaSubcode || null,
      transportCode: error.transportCode || null,
      noRetry: !!error.noRetry,
      creationId: error.metaContainerId || null,
      attempt: job.attemptsMade + 1,
      maxAttempts: job.opts.attempts,
    }).catch(() => null);

    if (!error.noRetry && job.attemptsMade + 1 < (job.opts.attempts || 1)) {
      await recordEvent(workspaceId, postId, "retry_scheduled", {
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
  notifyN8n,
  publishByType,
  processPublishJob,
  startPublishWorker,
};
