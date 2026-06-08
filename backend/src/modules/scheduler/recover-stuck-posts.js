const { query } = require("../../lib/db");

/**
 * Recoloca no ciclo de retry qualquer post que ficou com status = 'processing'
 * por mais de 10 minutos — situação que ocorre quando o processo cai no meio
 * de uma publicação (reinício do PM2, crash do Node, etc.).
 */
async function recoverStuckPosts() {
  const result = await query(`
    UPDATE posts
       SET status             = 'retrying',
           next_retry_at      = NOW(),
           updated_at         = NOW()
     WHERE status             = 'processing'
       AND processing_started_at < NOW() - INTERVAL '10 minutes'
  `);

  const recovered = result.rowCount ?? 0;

  if (recovered > 0) {
    console.warn(
      `[recoverStuckPosts] ${recovered} post(s) órfão(s) revertido(s) para 'retrying'.`,
    );
  } else {
    console.log("[recoverStuckPosts] Nenhum post órfão encontrado.");
  }
}

let recoveryTimer = null;

/**
 * Inicia verificação periódica a cada 5 minutos.
 * Garante que posts presos sejam recuperados mesmo sem reinício do servidor.
 */
function startRecoveryCollector() {
  if (recoveryTimer) {
    return;
  }

  const INTERVAL_MS = 5 * 60 * 1000;

  console.log(
    `[recoverStuckPosts] Coletor periódico iniciado. Intervalo: ${INTERVAL_MS}ms`,
  );

  recoveryTimer = setInterval(() => {
    recoverStuckPosts().catch((err) => {
      console.error(
        "[recoverStuckPosts] Falha no ciclo periódico:",
        err.message,
      );
    });
  }, INTERVAL_MS);
}

module.exports = { recoverStuckPosts, startRecoveryCollector };
