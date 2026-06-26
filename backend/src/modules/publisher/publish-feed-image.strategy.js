const { createMetaContentClient } = require("./meta-content.client");
const {
  requireText,
  resolveMediaUrl,
  resolvePublisherCredentials,
} = require("./publisher-media");

function resolveImageUrl(post) {
  const mediaItem = Array.isArray(post?.mediaItems)
    ? post.mediaItems.find(
        (item) => (item.mediaKind ?? item.media_kind) === "image",
      )
    : null;

  const explicitUrl =
    post?.imageUrl ??
    post?.mediaPublicUrl ??
    mediaItem?.publicUrl ??
    mediaItem?.url;

  if (explicitUrl) {
    return String(explicitUrl).trim();
  }

  return resolveMediaUrl(
    mediaItem ?? {
      storedFilename: post?.storedFilename ?? post?.stored_filename,
    },
    post,
  );
}

async function publishFeedImage(post, dependencies = {}) {
  const client = dependencies.client ?? createMetaContentClient();
  const { instagramUserId, accessToken } = resolvePublisherCredentials(
    post,
    "feed_image",
  );
  const imageUrl = requireText(
    resolveImageUrl(post),
    "imageUrl",
    "feed_image",
  );
  const caption = String(post?.caption ?? post?.captionText ?? "").trim();

  const container = await client.createImageContainer({
    instagramUserId,
    accessToken,
    imageUrl,
    caption,
  });

  const published = await client.publishContainer({
    instagramUserId,
    accessToken,
    creationId: container.containerId,
  });

  return {
    publishType: "feed_image",
    metaContainerId: container.containerId,
    metaMediaId: published.mediaId,
    imageUrl,
    raw: {
      container: container.raw,
      published: published.raw,
    },
  };
}

module.exports = {
  resolveImageUrl,
  publishFeedImage,
};
