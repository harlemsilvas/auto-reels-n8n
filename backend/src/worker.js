const { startPublishWorker } = require("./modules/scheduler/publish.worker");

function bootstrapWorker() {
  startPublishWorker();
  console.log("SocialBot worker de publicacao iniciado.");
}

bootstrapWorker();
