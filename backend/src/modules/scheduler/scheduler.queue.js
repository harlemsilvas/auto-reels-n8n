const { Queue } = require("bullmq");
const IORedis = require("ioredis");
const {
  REDIS_HOST,
  REDIS_PORT,
  REDIS_PASSWORD,
  PUBLISH_QUEUE_NAME,
} = require("../../config/env");

let connection;
let publishQueue;

function getRedisConnection() {
  if (!connection) {
    console.log("REDIS CONFIG", {
      host: REDIS_HOST,
      port: REDIS_PORT,
      password: !!REDIS_PASSWORD,
    });

    connection = new IORedis({
      host: REDIS_HOST,
      port: REDIS_PORT,
      password: REDIS_PASSWORD || undefined,
      maxRetriesPerRequest: null,
    });
  }

  return connection;
}

function getPublishQueue() {
  if (!publishQueue) {
    publishQueue = new Queue(PUBLISH_QUEUE_NAME, {
      connection: getRedisConnection(),
      defaultJobOptions: {
        attempts: 5,
        backoff: {
          type: "exponential",
          delay: 60_000,
        },
        removeOnComplete: 200,
        removeOnFail: 500,
      },
    });
  }

  return publishQueue;
}

async function enqueuePublishJob(postPayload) {
  const queue = getPublishQueue();
  const jobId = String(postPayload.id);

  const existingJob = await queue.getJob(jobId);
  if (existingJob) {
    const state = await existingJob.getState();

    console.log("[QUEUE EXISTING JOB]", {
      jobId,
      state,
    });

    if (state === "completed" || state === "failed") {
      await existingJob.remove();
    } else {
      return {
        queued: false,
        reason: "already_exists",
        state,
        jobId,
      };
    }
  }

  const job = await queue.add("publish-post", postPayload, { jobId });

  return {
    queued: true,
    jobId: job.id,
  };
}

async function getQueueStats() {
  const queue = getPublishQueue();
  const counts = await queue.getJobCounts(
    "waiting",
    "active",
    "completed",
    "failed",
    "delayed",
    "paused",
  );

  return counts;
}

let maintenanceTimer = null;

async function removeOrphanJobs(queue) {
  const jobs = await queue.getJobs(["completed", "failed"], 0, -1, true);

  for (const job of jobs) {
    await job.remove();
  }

  return jobs.length;
}

/**
 * Limpeza diária: remove jobs completed com mais de 24h e
 * jobs failed com mais de 7 dias.
 */
async function runQueueMaintenance() {
  const queue = getPublishQueue();

  await queue.clean(24 * 60 * 60 * 1000, 1000, "completed");
  await queue.clean(7 * 24 * 60 * 60 * 1000, 1000, "failed");
  const removedOrphans = await removeOrphanJobs(queue);

  console.log("[QueueMaintenance] Limpeza de jobs antigos concluída.", {
    removedOrphans,
  });
}

function startDailyMaintenance() {
  if (maintenanceTimer) {
    return;
  }

  const INTERVAL_MS = 24 * 60 * 60 * 1000;

  console.log(
    `[QueueMaintenance] Manutenção diária iniciada. Intervalo: ${INTERVAL_MS}ms`,
  );

  // executa uma vez ao iniciar, depois a cada 24h
  runQueueMaintenance().catch((err) => {
    console.error("[QueueMaintenance] Falha na limpeza inicial:", err.message);
  });

  maintenanceTimer = setInterval(() => {
    runQueueMaintenance().catch((err) => {
      console.error("[QueueMaintenance] Falha na limpeza diária:", err.message);
    });
  }, INTERVAL_MS);
}

module.exports = {
  getRedisConnection,
  getPublishQueue,
  enqueuePublishJob,
  getQueueStats,
  startDailyMaintenance,
};
