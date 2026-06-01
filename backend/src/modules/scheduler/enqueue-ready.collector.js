const {
  AUTO_ENQUEUE_READY_ENABLED,
  AUTO_ENQUEUE_READY_INTERVAL_MS,
} = require("../../config/env");
const { enqueueReadyPosts } = require("./enqueue-ready.service");

let timer = null;
let running = false;

function log(...args) {
  console.log(`[ENQUEUE COLLECTOR ${new Date().toISOString()}]`, ...args);
}

async function runEnqueueReadyTick() {
  if (running) {
    log("Execucao anterior ainda em andamento. Tick ignorado.");
    return;
  }

  running = true;

  try {
    const result = await enqueueReadyPosts("scheduler.enqueue-ready.collector");
    log("Tick concluido", {
      totalReady: result.totalReady,
      queuedCount: result.queuedCount,
      skippedCount: result.skippedCount,
    });
  } catch (error) {
    log("Falha no tick:", error.message);
  } finally {
    running = false;
  }
}

function startEnqueueReadyCollector() {
  if (!AUTO_ENQUEUE_READY_ENABLED) {
    log("Desativado por configuracao.");
    return;
  }

  if (timer) {
    return;
  }

  log(`Iniciado. Intervalo: ${AUTO_ENQUEUE_READY_INTERVAL_MS}ms`);

  runEnqueueReadyTick().catch(() => null);

  timer = setInterval(() => {
    runEnqueueReadyTick().catch(() => null);
  }, AUTO_ENQUEUE_READY_INTERVAL_MS);
}

module.exports = {
  startEnqueueReadyCollector,
};
