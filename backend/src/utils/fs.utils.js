const fs = require("node:fs/promises");
const path = require("node:path");

async function ensureDirectory(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}

async function ensureDirectories(dirPaths) {
  await Promise.all(dirPaths.map((dirPath) => ensureDirectory(dirPath)));
}

function isVideoFile(fileName) {
  return path.extname(fileName).toLowerCase() === ".mp4";
}

function isCaptionFile(fileName) {
  return path.extname(fileName).toLowerCase() === ".txt";
}

function fileBaseName(fileName) {
  return path.parse(fileName).name;
}

function sanitizeBaseName(value) {
  return value
    .normalize("NFKD")
    .replace(/[^\w.-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();
}

module.exports = {
  ensureDirectory,
  ensureDirectories,
  isVideoFile,
  isCaptionFile,
  fileBaseName,
  sanitizeBaseName,
};
