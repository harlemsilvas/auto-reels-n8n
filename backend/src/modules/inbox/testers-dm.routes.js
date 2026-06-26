const express = require("express");

const service = require("./testers-dm.service");

const router = express.Router();

router.get("/conversations", async (_req, res, next) => {
  try {
    const result = await service.listTesterConversations();
    return res.json(result);
  } catch (error) {
    next(error);
  }
});

router.post("/send", async (req, res, next) => {
  try {
    const result = await service.sendDmToTester({
      conversationId: req.body?.conversationId,
      message: req.body?.message,
    });

    return res.status(201).json(result);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
