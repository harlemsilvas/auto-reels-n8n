const { PublisherError, UnsupportedPublishTypeError } = require("./publisher.errors");
const { createMetaContentClient } = require("./meta-content.client");
const {
  normalizeMediaItems,
  resolvePublisherCredentials,
} = require("./publisher-media");

const STORY_TYPES = new Set(["story_image", "story_video"]);

async function publishStory(post, dependencies = {}) {
  const publishType = post?.publishType ?? post?.publish_type;

  if (!STORY_TYPES.has(publishType)) {
    throw new UnsupportedPublishTypeError(publishType);
  }

  const client = dependencies.client ?? createMetaContentClient();
  const { instagramUserId, accessToken } = resolvePublisherCredentials(
    post,
    publishType,
  );
  const mediaItems = normalizeMediaItems(post, publishType);

  if (mediaItems.length !== 1) {
    throw new PublisherError(`${publishType} exige exatamente um item.`, {
      code: "PUBLISH_INPUT_INVALID",
      publishType,
      status: 400,
    });
  }

  const item = mediaItems[0];
  const expectedKind =
    publishType === "story_image" ? "image" : "video";

  if (item.mediaKind !== expectedKind) {
    throw new PublisherError(
      `${publishType} exige midia do tipo ${expectedKind}.`,
      {
        code: "PUBLISH_INPUT_INVALID",
        publishType,
        status: 400,
      },
    );
  }

  const container = await client.createStoryContainer({
    instagramUserId,
    accessToken,
    mediaKind: item.mediaKind,
    mediaUrl: item.publicUrl,
  });

  if (item.mediaKind === "video") {
    await client.waitForContainer({
      containerId: container.containerId,
      accessToken,
    });
  }

  const published = await client.publishContainer({
    instagramUserId,
    accessToken,
    creationId: container.containerId,
  });

  return {
    publishType,
    metaContainerId: container.containerId,
    metaMediaId: published.mediaId,
    raw: {
      container: container.raw,
      published: published.raw,
    },
  };
}

module.exports = {
  publishStory,
};
