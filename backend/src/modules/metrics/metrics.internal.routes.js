const express = require("express");
const {
  getOperationalOverview,
  collectInsightsBatch,
  getMetricsHistory,
} = require("./metrics.service");

const router = express.Router();

router.get("/overview", async (_req, res, next) => {
  try {
    const data = await getOperationalOverview();
    res.json(data);
  } catch (error) {
    next(error);
  }
});

router.post("/collect", async (req, res, next) => {
  try {
    const { postId, accountId, limit } = req.body ?? {};
    const data = await collectInsightsBatch({ postId, accountId, limit });
    res.json(data);
  } catch (error) {
    next(error);
  }
});

router.get("/history", async (req, res, next) => {
  try {
    const { postId, accountId, limit } = req.query;
    const data = await getMetricsHistory({ postId, accountId, limit });
    res.json(data);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
