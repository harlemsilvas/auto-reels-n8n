const app = require("./app");
const {
  API_PORT,
  MEDIA_PENDING_DIR,
  MEDIA_PUBLISHED_DIR,
  MEDIA_ERROR_DIR,
} = require("./config/env");
const { ensureDirectories } = require("./utils/fs.utils");
const {
  startInsightsCollector,
} = require("./modules/metrics/insights.collector");

async function bootstrap() {
  await ensureDirectories([
    MEDIA_PENDING_DIR,
    MEDIA_PUBLISHED_DIR,
    MEDIA_ERROR_DIR,
  ]);

  app.listen(API_PORT, () => {
    console.log(`SocialBot backend rodando na porta ${API_PORT}`);
    console.log(`Pending: ${MEDIA_PENDING_DIR}`);
    startInsightsCollector();
  });
}

bootstrap().catch((error) => {
  console.error("Falha ao iniciar backend:", error);
  process.exit(1);
});
