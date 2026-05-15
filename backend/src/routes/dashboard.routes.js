const express = require("express");
const { getDashboardSummary } = require("../services/media.service");

const router = express.Router();

router.get("/summary", async (_req, res, next) => {
  try {
    const summary = await getDashboardSummary();
    res.json(summary);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
