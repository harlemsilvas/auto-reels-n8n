const { createHmac, timingSafeEqual } = require("node:crypto");
const express = require("express");
const { META_APP_SECRET } = require("../../config/env");

// Mount before the application's JSON parser: signatures cover original bytes.
const rawWebhookBody = express.raw({ type: "application/json", inflate: false });

function verifySignature(req, res, next) {
  if (!META_APP_SECRET) return res.sendStatus(503);
  const signature = req.get("x-hub-signature-256");
  if (!Buffer.isBuffer(req.body) || typeof signature !== "string" ||
      !/^sha256=[a-fA-F0-9]{64}$/.test(signature)) return res.sendStatus(403);
  const expected = createHmac("sha256", META_APP_SECRET).update(req.body).digest();
  const supplied = Buffer.from(signature.slice(7), "hex");
  if (!timingSafeEqual(expected, supplied)) return res.sendStatus(403);
  try {
    req.body = JSON.parse(req.body.toString("utf8"));
  } catch {
    return res.sendStatus(400);
  }
  next();
}

function webhookBodyError(error, _req, res, _next) {
  // Do not pass parser errors (which can include the body) to global logging.
  res.sendStatus(error?.status === 413 ? 413 : 400);
}

module.exports = { rawWebhookBody, verifySignature, webhookBodyError };
