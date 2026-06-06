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
} = require("./posts.service");

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
    const { limit, postId, eventType } = req.query;

    const data = await getPostEvents({
      limit,
      postId,
      eventType,
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

module.exports = router;
