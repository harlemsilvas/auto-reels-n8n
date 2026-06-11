type ReelIdentity = {
  postId: string;
  videoFilename?: string | null;
  caption?: string | null;
};

function titleFromFilename(filename: string) {
  return filename
    .replace(/\.[^.]+$/, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function getReelTitle(item: ReelIdentity) {
  const captionTitle = item.caption
    ?.split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean);

  if (captionTitle) {
    return captionTitle.length > 80
      ? `${captionTitle.slice(0, 77).trim()}...`
      : captionTitle;
  }

  if (item.videoFilename) {
    return titleFromFilename(item.videoFilename);
  }

  return item.postId.slice(0, 8);
}
