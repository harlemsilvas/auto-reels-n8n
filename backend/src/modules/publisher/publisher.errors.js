class PublisherError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = "PublisherError";
    this.code = options.code ?? "PUBLISHER_ERROR";
    this.publishType = options.publishType ?? null;
    this.status = options.status ?? 500;
  }
}

class UnsupportedPublishTypeError extends PublisherError {
  constructor(publishType) {
    super(`Tipo de publicacao nao suportado: ${publishType || "(vazio)"}`, {
      code: "UNSUPPORTED_PUBLISH_TYPE",
      publishType: publishType || null,
      status: 400,
    });
    this.name = "UnsupportedPublishTypeError";
  }
}

class PublishStrategyNotImplementedError extends PublisherError {
  constructor(publishType) {
    super(`Estrategia de publicacao ainda nao implementada: ${publishType}`, {
      code: "PUBLISH_STRATEGY_NOT_IMPLEMENTED",
      publishType,
      status: 501,
    });
    this.name = "PublishStrategyNotImplementedError";
  }
}

module.exports = {
  PublisherError,
  UnsupportedPublishTypeError,
  PublishStrategyNotImplementedError,
};
