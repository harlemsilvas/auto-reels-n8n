const { publishReel } = require("./publish-reel.strategy");
const {
  publishFeedImage,
} = require("./publish-feed-image.strategy");
const { publishCarousel } = require("./publish-carousel.strategy");
const { publishStory } = require("./publish-story.strategy");
const {
  UnsupportedPublishTypeError,
} = require("./publisher.errors");

const PUBLISH_STRATEGIES = Object.freeze({
  reel: publishReel,
  feed_image: publishFeedImage,
  feed_carousel: publishCarousel,
  story_image: publishStory,
  story_video: publishStory,
});

function resolvePublishType(post) {
  if (!post || typeof post !== "object") {
    return null;
  }

  const rawPublishType = post.publishType ?? post.publish_type ?? "reel";
  return String(rawPublishType).trim().toLowerCase() || null;
}

function getPublishStrategy(publishType) {
  const strategy = PUBLISH_STRATEGIES[publishType];

  if (!strategy) {
    throw new UnsupportedPublishTypeError(publishType);
  }

  return strategy;
}

async function publishPost(post, dependencies = {}) {
  const publishType = resolvePublishType(post);
  const strategy = getPublishStrategy(publishType);

  return strategy({
    ...post,
    publishType,
  }, dependencies);
}

module.exports = {
  PUBLISH_STRATEGIES,
  resolvePublishType,
  getPublishStrategy,
  publishPost,
};
