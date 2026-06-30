const axios = require("axios");

const { META_GRAPH_API_VERSION } = require("../../config/env");
const { PublisherError } = require("./publisher.errors");

function normalizeGraphError(error, operation) {
  const responseData = error?.response?.data;
  const responseStatus = Number(error?.response?.status ?? 500);
  const graphError = responseData?.error;
  const message =
    graphError?.message ||
    responseData?.message ||
    error?.message ||
    `Falha na Meta Graph API durante ${operation}.`;

  const normalizedError = new PublisherError(message, {
    code: "META_GRAPH_API_ERROR",
    status: responseStatus,
  });

  normalizedError.operation = operation;
  normalizedError.metaCode = graphError?.code ?? null;
  normalizedError.metaSubcode = graphError?.error_subcode ?? null;
  normalizedError.transportCode = error?.code ?? null;
  normalizedError.details = responseData ?? null;

  return normalizedError;
}

function createMetaContentClient(options = {}) {
  const httpClient = options.httpClient ?? axios;
  const graphApiVersion =
    options.graphApiVersion ?? META_GRAPH_API_VERSION;
  const graphBaseUrl =
    options.graphBaseUrl ?? `https://graph.facebook.com/${graphApiVersion}`;

  async function postForm(pathname, params, operation) {
    const body = new URLSearchParams();

    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") {
        body.set(key, String(value));
      }
    });

    try {
      const response = await httpClient.post(
        `${graphBaseUrl}/${pathname}`,
        body,
        {
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
        },
      );

      return response.data;
    } catch (error) {
      throw normalizeGraphError(error, operation);
    }
  }

  async function getJson(pathname, params, operation) {
    try {
      const response = await httpClient.get(`${graphBaseUrl}/${pathname}`, {
        params,
      });

      return response.data;
    } catch (error) {
      throw normalizeGraphError(error, operation);
    }
  }

  function requireContainerId(payload) {
    const containerId = String(payload?.id ?? "").trim();

    if (!containerId) {
      throw new PublisherError(
        "Meta criou o container sem retornar um id.",
        {
          code: "META_CONTAINER_ID_MISSING",
          status: 502,
        },
      );
    }

    return containerId;
  }

  async function createImageContainer({
    instagramUserId,
    accessToken,
    imageUrl,
    caption,
  }) {
    const payload = await postForm(
      `${instagramUserId}/media`,
      {
        image_url: imageUrl,
        caption,
        access_token: accessToken,
      },
      "create_image_container",
    );

    const containerId = requireContainerId(payload);

    return {
      containerId,
      raw: payload,
    };
  }

  async function createCarouselItem({
    instagramUserId,
    accessToken,
    mediaKind,
    mediaUrl,
  }) {
    const payload = await postForm(
      `${instagramUserId}/media`,
      {
        image_url: mediaKind === "image" ? mediaUrl : null,
        video_url: mediaKind === "video" ? mediaUrl : null,
        is_carousel_item: true,
        access_token: accessToken,
      },
      "create_carousel_item",
    );

    return {
      containerId: requireContainerId(payload),
      raw: payload,
    };
  }

  async function createCarouselContainer({
    instagramUserId,
    accessToken,
    childContainerIds,
    caption,
  }) {
    const payload = await postForm(
      `${instagramUserId}/media`,
      {
        media_type: "CAROUSEL",
        children: childContainerIds.join(","),
        caption,
        access_token: accessToken,
      },
      "create_carousel_container",
    );

    return {
      containerId: requireContainerId(payload),
      raw: payload,
    };
  }

  async function createStoryContainer({
    instagramUserId,
    accessToken,
    mediaKind,
    mediaUrl,
  }) {
    const payload = await postForm(
      `${instagramUserId}/media`,
      {
        media_type: "STORIES",
        image_url: mediaKind === "image" ? mediaUrl : null,
        video_url: mediaKind === "video" ? mediaUrl : null,
        access_token: accessToken,
      },
      "create_story_container",
    );

    return {
      containerId: requireContainerId(payload),
      raw: payload,
    };
  }

  async function getContainerStatus({ containerId, accessToken }) {
    const payload = await getJson(
      containerId,
      {
        fields: "status_code,status",
        access_token: accessToken,
      },
      "get_container_status",
    );

    return {
      statusCode: String(payload?.status_code ?? "").trim().toUpperCase(),
      status: String(payload?.status ?? "").trim(),
      raw: payload,
    };
  }

  async function waitForContainer({
    containerId,
    accessToken,
    timeoutMs = 5 * 60_000,
    intervalMs = 5_000,
    sleep = (delay) => new Promise((resolve) => setTimeout(resolve, delay)),
  }) {
    const startedAt = Date.now();

    while (true) {
      const status = await getContainerStatus({
        containerId,
        accessToken,
      });

      if (status.statusCode === "FINISHED") {
        return status;
      }

      if (["ERROR", "EXPIRED"].includes(status.statusCode)) {
        throw new PublisherError(
          `Container ${containerId} terminou com ${status.statusCode}.`,
          {
            code: "META_CONTAINER_PROCESSING_FAILED",
            status: 502,
          },
        );
      }

      if (Date.now() - startedAt >= timeoutMs) {
        throw new PublisherError(
          `Timeout aguardando processamento do container ${containerId}.`,
          {
            code: "META_CONTAINER_TIMEOUT",
            status: 504,
          },
        );
      }

      await sleep(intervalMs);
    }
  }

  async function publishContainer({
    instagramUserId,
    accessToken,
    creationId,
  }) {
    const payload = await postForm(
      `${instagramUserId}/media_publish`,
      {
        creation_id: creationId,
        access_token: accessToken,
      },
      "publish_container",
    );

    const mediaId = String(payload?.id ?? "").trim();

    if (!mediaId) {
      throw new PublisherError(
        "Meta publicou o container sem retornar um media id.",
        {
          code: "META_MEDIA_ID_MISSING",
          status: 502,
        },
      );
    }

    return {
      mediaId,
      raw: payload,
    };
  }

  return {
    createImageContainer,
    createCarouselItem,
    createCarouselContainer,
    createStoryContainer,
    getContainerStatus,
    waitForContainer,
    publishContainer,
  };
}

module.exports = {
  createMetaContentClient,
  normalizeGraphError,
};
