const express = require("express");
const multer = require("multer");
const service = require("./inbox-images.service");
const router = express.Router();
let uploadsInFlight = 0;
const upload = multer({ storage: multer.memoryStorage(), limits: {
  fileSize: service.MAX_IMAGE_BYTES, files: 1, fields: 0, parts: 2,
} }).single("image");

router.post("/:conversationId/images", (req, res, next) => {
  if (uploadsInFlight >= 2) return res.status(429).json({ message: "Uploads ocupados. Tente novamente em instantes." });
  uploadsInFlight++;
  let released = false;
  const release = () => { if (!released) { released = true; uploadsInFlight--; } };
  res.once("finish", release);
  res.once("close", release);
  upload(req, res, (error) => {
    if (error) {
      error.status = error.code === "LIMIT_FILE_SIZE" ? 413 : 400;
      error.message = error.code === "LIMIT_FILE_SIZE" ? "A imagem deve ter ate 8 MB." : "Envie somente uma imagem no campo image.";
      return next(error);
    }
    service.sendConversationImage(req.params.conversationId, req.file)
      .then((message) => res.status(201).json(message))
      .catch((failure) => {
        if (failure.deliveryMayHaveSucceeded) return res.status(502).json({
          code: "MESSAGE_DELIVERY_UNCERTAIN", message: "A imagem pode ter sido entregue. Confira o Instagram antes de reenviar.",
        });
        next(failure);
      });
  });
});

function serveImage(resolve) {
  return async (req, res, next) => {
    try {
      const file = await resolve(req);
      res.set({ "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" });
      res.sendFile(file, { dotfiles: "deny" }, (error) => {
        if (error) next(error.status === 404 || error.code === "ENOENT"
          ? Object.assign(new Error("Imagem indisponivel."), { status: 404 }) : error);
      });
    } catch (error) { next(error); }
  };
}

module.exports = {
  imageSendRoutes: router,
  serveDeliveryImage: serveImage((req) => service.resolveDelivery(req.params.token)),
  serveConversationImage: serveImage((req) => service.resolveConversationImage(req.params.conversationId, req.params.messageId)),
};
