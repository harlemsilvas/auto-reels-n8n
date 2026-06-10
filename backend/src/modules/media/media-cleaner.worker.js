const cron = require("node-cron");

const { cleanPublishedMedia } = require("./media-cleaner.service");

function startMediaCleanerWorker() {
  console.log("[MEDIA CLEANER] Worker iniciado");

  cron.schedule("0 3 * * *", async () => {
    console.log("[MEDIA CLEANER] Executando limpeza automática");

    try {
      const result = await cleanPublishedMedia(3);

      console.log(`[MEDIA CLEANER] ${result.length} arquivos processados`);
    } catch (error) {
      console.error("[MEDIA CLEANER]", error.message);
    }
  });
}

module.exports = {
  startMediaCleanerWorker,
};
