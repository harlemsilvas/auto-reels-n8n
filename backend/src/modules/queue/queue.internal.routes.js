const express = require("express");
const { getQueueStats } = require("../scheduler/scheduler.queue");

const router = express.Router();

router.get("/stats", async (_req, res, next) => {
  try {
    const stats = await getQueueStats();

    res.json(stats);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
