const {
  POSTS_DATA_SOURCE,
  INSIGHTS_JOB_ENABLED,
  INSIGHTS_INTERVAL_MS,
} = require("../../config/env");
const { collectInsightsBatch } = require("./metrics.service");

let timer;

function startInsightsCollector() {
  if (POSTS_DATA_SOURCE !== "db") {
    console.log("[metrics] collector desabilitado: POSTS_DATA_SOURCE != db");
    return null;
  }

  if (!INSIGHTS_JOB_ENABLED) {
    console.log("[metrics] collector desabilitado por config");
    return null;
  }

  const run = async () => {
    try {
      const result = await collectInsightsBatch();
      console.log(
        `[metrics] coleta concluida: ${result.collected} coletados, ${result.skipped} ignorados`,
      );
    } catch (error) {
      console.error("[metrics] falha na coleta periodica:", error.message);
    }
  };

  run().catch(() => null);
  timer = setInterval(run, INSIGHTS_INTERVAL_MS);
  timer.unref();

  console.log(
    `[metrics] collector iniciado com intervalo de ${INSIGHTS_INTERVAL_MS}ms`,
  );

  return timer;
}

function stopInsightsCollector() {
  if (timer) {
    clearInterval(timer);
    timer = undefined;
  }
}

module.exports = {
  startInsightsCollector,
  stopInsightsCollector,
};
