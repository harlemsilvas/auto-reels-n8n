const express = require("express");

const { listPublishedMedia, markMediaDeleted } = require("./media.repository");

const fs = require("fs/promises");
const path = require("path");

const router = express.Router();

router.get("/", async (req, res, next) => {
  try {
    const items = await listPublishedMedia();

    res.json(items);
  } catch (error) {
    next(error);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    const items = await listPublishedMedia(1000);

    const media = items.find((item) => item.id === req.params.id);

    if (!media) {
      return res.status(404).json({
        message: "Mídia não encontrada",
      });
    }

    const filePath = path.join(media.source_path, media.video_filename);

    await fs.unlink(filePath);

    await markMediaDeleted(media.id);

    res.json({
      success: true,
      filePath,
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
