const { startPublishWorker } = require("./modules/scheduler/publish.worker");
const {
  startMediaCleanerWorker,
} = require("./modules/media/media-cleaner.worker");

function bootstrapWorker() {
  startPublishWorker();

  startMediaCleanerWorker();

  console.log("SocialBot worker de publicacao iniciado.");
}

bootstrapWorker();
