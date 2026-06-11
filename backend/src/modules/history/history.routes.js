const express = require("express");
const {
  getPostDetail,
  getPostMetricsTimeline,
} = require("../metrics/metrics.service");

const router = express.Router();

router.get("/post/:id", async (req, res, next) => {
  try {
    const data = await getPostDetail(req.params.id);

    res.json(data);
  } catch (error) {
    next(error);
  }
});

router.get("/post/:id/timeline", async (req, res, next) => {
  try {
    const data = await getPostMetricsTimeline(req.params.id, {
      days: req.query.days,
    });

    res.json(data);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
