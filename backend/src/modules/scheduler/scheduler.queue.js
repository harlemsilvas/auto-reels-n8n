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
    return {
      queued: false,
      reason: "already_exists",
      jobId,
    };
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

module.exports = {
  getRedisConnection,
  getPublishQueue,
  enqueuePublishJob,
  getQueueStats,
};
