const fs = require("fs/promises");
const path = require("path");

const { getExpiredMedia, markMediaDeleted } = require("./media.repository");

async function deleteMedia(post) {
  const filePath = path.join(post.source_path, post.video_filename);

  try {
    await fs.access(filePath);

    await fs.unlink(filePath);

    await markMediaDeleted(post.id);

    return {
      deleted: true,
      filePath,
    };
  } catch (error) {
    return {
      deleted: false,
      filePath,
      error: error.message,
    };
  }
}

async function cleanPublishedMedia(days = 3) {
  const items = await getExpiredMedia(days);

  const results = [];

  for (const item of items) {
    const result = await deleteMedia(item);
    results.push(result);
  }

  return results;
}

module.exports = {
  cleanPublishedMedia,
  deleteMedia,
};
