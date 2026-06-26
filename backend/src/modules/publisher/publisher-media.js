const { MEDIA_PUBLIC_BASE_URL } = require("../../config/env");
const { PublisherError } = require("./publisher.errors");

function normalizeBaseUrl(value) {
  return String(value ?? "").trim().replace(/\/+$/, "");
}

function requireText(value, fieldName, publishType) {
  const normalized = String(value ?? "").trim();

  if (!normalized) {
    throw new PublisherError(
      `Campo obrigatorio para publicar ${publishType}: ${fieldName}.`,
      {
        code: "PUBLISH_INPUT_INVALID",
        publishType,
        status: 400,
      },
    );
  }

  return normalized;
}

function resolveMediaKind(item) {
  return String(item?.mediaKind ?? item?.media_kind ?? "").trim().toLowerCase();
}

function resolveStoredFilename(item) {
  return String(
    item?.storedFilename ?? item?.stored_filename ?? "",
  ).trim();
}

function resolveMediaUrl(item, post = {}) {
  const explicitUrl = item?.publicUrl ?? item?.url ?? item?.mediaPublicUrl;

  if (explicitUrl) {
    return String(explicitUrl).trim();
  }

  const storedFilename = resolveStoredFilename(item);
  const baseUrl = normalizeBaseUrl(
    item?.mediaPublicBaseUrl ??
      post?.mediaPublicBaseUrl ??
      MEDIA_PUBLIC_BASE_URL,
  );

  if (!baseUrl || !storedFilename) {
    return null;
  }

  return `${baseUrl}/pending/${encodeURIComponent(storedFilename)}`;
}

function normalizeMediaItems(post, publishType) {
  if (!Array.isArray(post?.mediaItems)) {
    throw new PublisherError(
      `Campo obrigatorio para publicar ${publishType}: mediaItems.`,
      {
        code: "PUBLISH_INPUT_INVALID",
        publishType,
        status: 400,
      },
    );
  }

  return [...post.mediaItems]
    .sort(
      (a, b) =>
        Number(a.sortOrder ?? a.sort_order ?? 0) -
        Number(b.sortOrder ?? b.sort_order ?? 0),
    )
    .map((item, index) => {
      const mediaKind = resolveMediaKind(item);
      const publicUrl = resolveMediaUrl(item, post);

      if (!["image", "video"].includes(mediaKind)) {
        throw new PublisherError(
          `mediaKind invalido no item ${index + 1}: ${mediaKind || "(vazio)"}.`,
          {
            code: "PUBLISH_INPUT_INVALID",
            publishType,
            status: 400,
          },
        );
      }

      return {
        ...item,
        mediaKind,
        publicUrl: requireText(
          publicUrl,
          `mediaItems[${index}].publicUrl`,
          publishType,
        ),
        sortOrder: index,
      };
    });
}

function resolvePublisherCredentials(post, publishType) {
  return {
    instagramUserId: requireText(
      post?.igAccountId ?? post?.instagramId,
      "igAccountId",
      publishType,
    ),
    accessToken: requireText(
      post?.metaToken ?? post?.accessToken,
      "metaToken",
      publishType,
    ),
  };
}

module.exports = {
  normalizeBaseUrl,
  requireText,
  resolveMediaKind,
  resolveStoredFilename,
  resolveMediaUrl,
  normalizeMediaItems,
  resolvePublisherCredentials,
};
