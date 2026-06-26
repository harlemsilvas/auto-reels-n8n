const { PublisherError } = require("./publisher.errors");
const { createMetaContentClient } = require("./meta-content.client");
const {
  normalizeMediaItems,
  resolvePublisherCredentials,
} = require("./publisher-media");

async function publishCarousel(post, dependencies = {}) {
  const publishType = "feed_carousel";
  const client = dependencies.client ?? createMetaContentClient();
  const { instagramUserId, accessToken } = resolvePublisherCredentials(
    post,
    publishType,
  );
  const mediaItems = normalizeMediaItems(post, publishType);

  if (mediaItems.length < 2 || mediaItems.length > 10) {
    throw new PublisherError(
      "feed_carousel exige de 2 a 10 itens de midia.",
      {
        code: "PUBLISH_INPUT_INVALID",
        publishType,
        status: 400,
      },
    );
  }

  const childContainers = [];

  for (const item of mediaItems) {
    const child = await client.createCarouselItem({
      instagramUserId,
      accessToken,
      mediaKind: item.mediaKind,
      mediaUrl: item.publicUrl,
    });

    if (item.mediaKind === "video") {
      await client.waitForContainer({
        containerId: child.containerId,
        accessToken,
      });
    }

    childContainers.push({
      containerId: child.containerId,
      mediaKind: item.mediaKind,
      sortOrder: item.sortOrder,
      raw: child.raw,
    });
  }

  const parent = await client.createCarouselContainer({
    instagramUserId,
    accessToken,
    childContainerIds: childContainers.map((item) => item.containerId),
    caption: String(post?.caption ?? post?.captionText ?? "").trim(),
  });

  await client.waitForContainer({
    containerId: parent.containerId,
    accessToken,
  });

  const published = await client.publishContainer({
    instagramUserId,
    accessToken,
    creationId: parent.containerId,
  });

  return {
    publishType,
    metaContainerId: parent.containerId,
    metaMediaId: published.mediaId,
    publishOptions: {
      carouselChildren: childContainers.map((item) => item.containerId),
      parentContainerId: parent.containerId,
    },
    raw: {
      children: childContainers,
      parent: parent.raw,
      published: published.raw,
    },
  };
}

module.exports = {
  publishCarousel,
};
