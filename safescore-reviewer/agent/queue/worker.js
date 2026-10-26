/**
 * worker.js — Loop que procesa jobs de la cola.
 *
 * Diseño:
 *   - setInterval con poll cada SAFESCORE_WORKER_POLL_MS (default 2000)
 *   - Procesa 1 job a la vez (concurrencia = 1, simple y suficiente para MVP)
 *   - Si un job tarda más que el intervalo, no overlap (el siguiente tick
 *     no arranca hasta que termine el actual)
 *   - Cada 60s: corre releaseStuck() para detectar workers muertos
 *   - Graceful shutdown: deja el job actual terminar antes de cerrar
 *
 * NO es daemon separado. Vive en el mismo proceso Node del backend.
 * Si en el futuro escalamos a worker independiente, este archivo se
 * puede arrancar desde un script `node safescore-reviewer/agent/queue/worker-standalone.js`.
 */

const os = require('os');
const queue = require('./agentQueue');
const dispatcher = require('./dispatcher');
const logger = require('../utils/logger');

const POLL_MS = parseInt(process.env.SAFESCORE_WORKER_POLL_MS || '2000', 10);
const RELEASE_STUCK_EVERY_MS = 60_000;

const WORKER_ID = `${os.hostname()}-pid${process.pid}`;

let pollHandle = null;
let releaseHandle = null;
let isProcessing = false;
let isShuttingDown = false;

/**
 * Procesa un solo tick: intenta tomar un job, si encuentra lo ejecuta.
 */
async function tick() {
  if (isProcessing || isShuttingDown) return;
  isProcessing = true;

  try {
    const job = await queue.dequeue(WORKER_ID);
    if (!job) return;   // nada pendiente

    logger.info(`▶️  Processing: ${job.task}`, { id: job._id.toString(), attempt: job.attempts });

    try {
      const { result, metrics } = await dispatcher.dispatch(job);
      await queue.markDone(job._id, result, metrics);
    } catch (err) {
      // Errores tipo 'skill_not_implemented:X' no son retryable
      const msg = err.message || String(err);
      const isUnimplemented = msg.startsWith('skill_not_implemented:');
      await queue.markFailed(job._id, err, { retryable: !isUnimplemented });
    }
  } catch (outerErr) {
    // Errores tomando el job (BD down, etc.) — solo log
    logger.error('worker.tick — error tomando job', outerErr);
  } finally {
    isProcessing = false;
  }
}

/**
 * Arranca el worker. Idempotente.
 */
function start() {
  if (pollHandle) return;   // ya corriendo
  logger.success(`👷 Worker started — ID=${WORKER_ID}, poll=${POLL_MS}ms`);
  pollHandle = setInterval(tick, POLL_MS);
  releaseHandle = setInterval(async () => {
    try { await queue.releaseStuck(); } catch (err) { logger.error('releaseStuck error', err); }
  }, RELEASE_STUCK_EVERY_MS);

  // Graceful shutdown
  const onSignal = (sig) => {
    if (isShuttingDown) return;
    isShuttingDown = true;
    logger.info(`Worker received ${sig}, shutting down gracefully...`);
    stop();
  };
  process.on('SIGINT', onSignal);
  process.on('SIGTERM', onSignal);
}

/**
 * Detiene el worker. No interrumpe el job en curso (espera el tick actual).
 */
function stop() {
  if (pollHandle) { clearInterval(pollHandle); pollHandle = null; }
  if (releaseHandle) { clearInterval(releaseHandle); releaseHandle = null; }
  logger.info('👷 Worker stopped');
}

module.exports = { start, stop, tick, WORKER_ID };
