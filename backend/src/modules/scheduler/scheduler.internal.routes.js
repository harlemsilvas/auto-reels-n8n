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

router.get("/stats", async (_req, res, next) => {
  try {
    const stats = await getQueueStats();
    res.json(stats);
  } catch (error) {
    next(error);
  }
});

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

router.post("/enqueue-ready", async (_req, res, next) => {
  try {
    const ready = await getReadyPosts();

    const results = await Promise.all(
      ready.items.map(async (item) => {
        const enqueueResult = await enqueuePublishJob(item);

        if (enqueueResult.queued) {
          await markQueued(item.id).catch(() => null);
          await addEvent(item.id, "queued", {
            source: "scheduler.enqueue-ready",
            jobId: enqueueResult.jobId,
          }).catch(() => null);
        } else {
          await addEvent(item.id, "queue_skipped", {
            source: "scheduler.enqueue-ready",
            reason: enqueueResult.reason,
            jobId: enqueueResult.jobId,
          }).catch(() => null);
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

router.post("/enqueue/:id", async (req, res, next) => {
  try {
    const { id } = req.params;
    const ready = await getReadyPosts();
    const post = ready.items.find((item) => item.id === id);

    if (!post) {
      res.status(404).json({ message: "Post nao esta pronto para fila." });
      return;
    }

    const result = await enqueuePublishJob(post);

    if (result.queued) {
      await markQueued(post.id).catch(() => null);
      await addEvent(post.id, "queued", {
        source: "scheduler.enqueue",
        jobId: result.jobId,
      }).catch(() => null);
    } else {
      await addEvent(post.id, "queue_skipped", {
        source: "scheduler.enqueue",
        reason: result.reason,
        jobId: result.jobId,
      }).catch(() => null);
    }

    res.json({ postId: post.id, ...result });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
