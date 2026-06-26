const path = require("node:path");

const PUBLISH_TYPES = new Set([
  "reel",
  "feed_image",
  "feed_carousel",
  "story_image",
  "story_video",
]);

const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png"]);
const VIDEO_EXTENSIONS = new Set([".mp4"]);
const ALLOWED_EXTENSIONS = new Set([
  ...IMAGE_EXTENSIONS,
  ...VIDEO_EXTENSIONS,
]);

function createValidationError(message) {
  const error = new Error(message);
  error.status = 400;
  return error;
}

function classifyMediaFile(file) {
  const extension = path.extname(file.originalname).toLowerCase();
  const mimeType = String(file.mimetype ?? "").toLowerCase();

  if (
    IMAGE_EXTENSIONS.has(extension) &&
    ["image/jpeg", "image/png"].includes(mimeType)
  ) {
    return "image";
  }

  if (VIDEO_EXTENSIONS.has(extension) && mimeType === "video/mp4") {
    return "video";
  }

  throw createValidationError(
    `Arquivo nao suportado: ${file.originalname}. Use JPG, JPEG, PNG ou MP4.`,
  );
}

function validateCount(files, expected, publishType) {
  if (files.length !== expected) {
    throw createValidationError(
      `${publishType} exige exatamente ${expected} arquivo(s).`,
    );
  }
}

function validatePostUploadInput({ publishType, files }) {
  if (!PUBLISH_TYPES.has(publishType)) {
    throw createValidationError("publishType invalido.");
  }

  if (!Array.isArray(files) || files.length === 0) {
    throw createValidationError("Nenhum arquivo enviado em files[].");
  }

  const mediaKinds = files.map(classifyMediaFile);

  switch (publishType) {
    case "reel":
      validateCount(files, 1, publishType);
      if (mediaKinds[0] !== "video") {
        throw createValidationError("reel aceita apenas um arquivo MP4.");
      }
      break;

    case "feed_image":
      validateCount(files, 1, publishType);
      if (mediaKinds[0] !== "image") {
        throw createValidationError(
          "feed_image aceita apenas uma imagem JPG, JPEG ou PNG.",
        );
      }
      break;

    case "feed_carousel":
      if (files.length < 2 || files.length > 10) {
        throw createValidationError(
          "feed_carousel exige de 2 a 10 imagens ou videos.",
        );
      }
      break;

    case "story_image":
      validateCount(files, 1, publishType);
      if (mediaKinds[0] !== "image") {
        throw createValidationError(
          "story_image aceita apenas uma imagem JPG, JPEG ou PNG.",
        );
      }
      break;

    case "story_video":
      validateCount(files, 1, publishType);
      if (mediaKinds[0] !== "video") {
        throw createValidationError("story_video aceita apenas um MP4.");
      }
      break;

    default:
      throw createValidationError("publishType invalido.");
  }

  return mediaKinds;
}

module.exports = {
  ALLOWED_EXTENSIONS,
  classifyMediaFile,
  validatePostUploadInput,
};
