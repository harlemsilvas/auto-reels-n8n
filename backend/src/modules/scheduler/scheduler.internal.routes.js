// scheduler.internal.routes.js
const express = require("express");

const {
  getReadyPosts,
  markQueued,
  addEvent,
} = require("../posts/posts.service");

const { enqueuePublishJob, getQueueStats } = require("./scheduler.queue");

const {
  listSlots,
  createSlot,
  updateSlot,
  deleteSlot,
} = require("./scheduler-slots.service");

const router = express.Router();

function log(...args) {
  console.log(`[SCHEDULER ${new Date().toISOString()}]`, ...args);
}

/**
 * ======================================
 * Queue Stats
 * ======================================
 */

router.get("/stats", async (_req, res, next) => {
  try {
    const stats = await getQueueStats();

    res.json(stats);
  } catch (error) {
    next(error);
  }
});

/**
 * ======================================
 * Scheduler Slots
 * ======================================
 */

router.get("/slots", async (req, res, next) => {
  try {
    const onlyEnabled = String(req.query?.onlyEnabled ?? "false") === "true";

    const data = await listSlots({ onlyEnabled });

    res.json(data);
  } catch (error) {
    next(error);
  }
});

router.post("/slots", async (req, res, next) => {
  try {
    const slot = await createSlot(req.body ?? {});

    res.status(201).json(slot);
  } catch (error) {
    next(error);
  }
});

router.patch("/slots/:id", async (req, res, next) => {
  try {
    const slot = await updateSlot(req.params.id, req.body ?? {});

    res.json(slot);
  } catch (error) {
    next(error);
  }
});

router.delete("/slots/:id", async (req, res, next) => {
  try {
    const result = await deleteSlot(req.params.id);

    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * ======================================
 * Enqueue ALL Ready Posts
 * ======================================
 */

router.post("/enqueue-ready", async (_req, res, next) => {
  try {
    log("Buscando posts prontos para fila");

    const ready = await getReadyPosts();

    log(`Posts prontos encontrados: ${ready.total}`);

    const results = await Promise.all(
      ready.items.map(async (item) => {
        log("Enfileirando post:", item.id);

        const enqueueResult = await enqueuePublishJob(item);

        if (enqueueResult.queued) {
          await markQueued(item.id);

          await addEvent(item.id, "queued", {
            source: "scheduler.enqueue-ready",
            jobId: enqueueResult.jobId,
          });

          log("Post enfileirado:", item.id);
        } else {
          await addEvent(item.id, "queue_skipped", {
            source: "scheduler.enqueue-ready",
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

    res.json({
      totalReady: ready.total,
      queuedCount,
      skippedCount,
      jobs: results,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * ======================================
 * Enqueue Single Post
 * ======================================
 */

router.post("/enqueue/:id", async (req, res, next) => {
  try {
    const { id } = req.params;

    log("Solicitacao enqueue:", id);

    const ready = await getReadyPosts();

    log(`Ready total: ${ready.total}`);

    ready.items.forEach((item) => {
      log("READY ITEM", {
        id: item.id,
        status: item.status,
        scheduled_at: item.scheduled_at,
      });
    });

    const post = ready.items.find((item) => item.id === id);

    if (!post) {
      log("Post nao encontrado nos READY:", id);

      return res.status(404).json({
        message: "Post nao esta pronto para fila.",
        requestedId: id,
        readyIds: ready.items.map((i) => i.id),
      });
    }

    log("Post encontrado:", post.id);

    const result = await enqueuePublishJob(post);

    log("Resultado enqueue:", result);

    if (result.queued) {
      await markQueued(post.id);

      await addEvent(post.id, "queued", {
        source: "scheduler.enqueue",
        jobId: result.jobId,
      });

      log("Post marcado como queued:", post.id);
    } else {
      await addEvent(post.id, "queue_skipped", {
        source: "scheduler.enqueue",
        reason: result.reason,
        jobId: result.jobId,
      });

      log("Post ignorado:", post.id);
    }

    res.json({
      postId: post.id,
      ...result,
    });
  } catch (error) {
    log("ERRO enqueue:", error);

    next(error);
  }
});

module.exports = router;
