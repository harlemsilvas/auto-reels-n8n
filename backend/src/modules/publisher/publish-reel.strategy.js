const {
  PublishStrategyNotImplementedError,
} = require("./publisher.errors");

async function publishReel(_post) {
  // O Reel continua no worker/n8n atual. A migracao para esta estrategia
  // pertence as Fases 5 e 9.
  throw new PublishStrategyNotImplementedError("reel");
}

module.exports = {
  publishReel,
};
