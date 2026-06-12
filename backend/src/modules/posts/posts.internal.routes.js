// posts.internal.routes.js

const express = require("express");
const {
  getReadyPosts,
  getPosts,
  getPostEvents,
  markProcessing,
  markPublished,
  markError,
  cancelSchedule,
  addEvent,
} = require("./posts.service");
const { enqueuePublishJob } = require("../scheduler/scheduler.queue");

const router = express.Router();

router.get("/ready", async (_req, res, next) => {
  try {
    const data = await getReadyPosts();
    res.json(data);
  } catch (error) {
    next(error);
  }
});

router.get("/", async (req, res, next) => {
  try {
    const { limit, status, postId } = req.query;

    const data = await getPosts({
      limit,
      status,
      postId,
    });

    res.json(data);
  } catch (error) {
    next(error);
  }
});

router.get("/events", async (req, res, next) => {
  try {
    const { limit, offset, postId, eventType, groupByPost } = req.query;

    const data = await getPostEvents({
      limit,
      offset,
      postId,
      eventType,
      groupByPost: groupByPost === "true",
    });

    res.json(data);
  } catch (error) {
    next(error);
  }
});

router.post("/:id/mark-processing", async (req, res, next) => {
  try {
    const result = await markProcessing(req.params.id);

    if (!result.found) {
      return res.status(404).json(result.payload);
    }

    res.json(result.payload);
  } catch (error) {
    next(error);
  }
});

router.post("/:id/mark-published", async (req, res, next) => {
  try {
    const metaMediaId = String(req.body?.metaMediaId ?? "").trim() || null;

    const metaContainerId =
      String(req.body?.metaContainerId ?? "").trim() || null;

    const result = await markPublished(req.params.id, {
      metaMediaId,
      metaContainerId,
    });

    if (!result.found) {
      return res.status(404).json(result.payload);
    }

    res.json(result.payload);
  } catch (error) {
    next(error);
  }
});

router.post("/:id/mark-error", async (req, res, next) => {
  try {
    const errorMessage = String(req.body?.errorMessage ?? "").trim() || null;

    const result = await markError(req.params.id, errorMessage);

    if (!result.found) {
      return res.status(404).json(result.payload);
    }

    res.json(result.payload);
  } catch (error) {
    next(error);
  }
});

router.post("/:id/cancel", async (req, res, next) => {
  try {
    const result = await cancelSchedule(req.params.id);

    if (!result.found) {
      return res.status(404).json(result.payload);
    }

    /**
     * Evento removido temporariamente.
     * Após implementarmos getPostById()
     * podemos restaurar:
     *
     * await addEvent(
     *   workspaceId,
     *   postId,
     *   "canceled",
     *   { source: "posts.internal.cancel" }
     * );
     */

    res.json(result.payload);
  } catch (error) {
    next(error);
  }
});

router.post("/:id/publish-now", async (req, res, next) => {
  try {
    const { id } = req.params;

    const postsData = await getPosts({ postId: id, limit: 1 });
    const post = postsData.items[0];

    if (!post) {
      return res.status(404).json({ message: "Post não encontrado" });
    }

    if (post.status === "published") {
      return res.status(409).json({ message: "Post já publicado" });
    }

    const enqueueResult = await enqueuePublishJob(post);

    await addEvent(post.workspaceId, post.id, "manual_publish", {
      source: "user",
      queued: enqueueResult.queued,
      reason: enqueueResult.reason ?? null,
    });

    return res.json({ success: true, ...enqueueResult });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
