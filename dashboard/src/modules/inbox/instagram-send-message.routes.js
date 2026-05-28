const express = require("express");

const { sendMessage } = require("./instagram-send-message.controller");

const router = express.Router();

router.post("/", sendMessage);

module.exports = router;
