/**
 * agentQueue.js — API de la cola persistente sobre MongoDB.
 *
 * Reemplaza a Bull/Redis. Aprovecha la conexión Mongo del backend.
 *
 * API mínima:
 *   - enqueue(task, payload, opts)
 *   - dequeue(workerId)   ← atomic findOneAndUpdate
 *   - markDone(jobId, result, metrics)
 *   - markFailed(jobId, error, retryable)
 *   - releaseStuck()      ← detecta jobs running > N min y los reencola
 *   - stats()             ← contadores por status
 */

const AgentJob = require('../models/AgentJob');
const logger = require('../utils/logger');

const STUCK_THRESHOLD_MS = 5 * 60 * 1000;   // 5 minutos sin terminar = job huérfano

/**
 * Encola un job.
 *
 * @param {string} task    — uno de AgentJob.VALID_TASKS
 * @param {object} payload — datos del job
 * @param {object} opts
 * @param {number} opts.priority      — 0-10, default 0
 * @param {Date}   opts.scheduledFor  — cuándo ejecutar, default ahora
 * @param {number} opts.maxAttempts   — default 3
 * @param {string[]} opts.tags        — etiquetas para debug
 * @returns {Promise<object>} el documento creado
 */
async function enqueue(task, payload = {}, opts = {}) {
  const job = await AgentJob.create({
    task,
    payload,
    status: 'pending',
    priority: opts.priority ?? 0,
    scheduled_for: opts.scheduledFor || new Date(),
    max_attempts: opts.maxAttempts || 3,
    tags: opts.tags || [],
  });

  logger.info(`📥 Job enqueued: ${task}`, {
    id: job._id.toString(),
    priority: job.priority,
  });

  return job;
}

/**
 * Toma el siguiente job pendiente (atómico). Si no hay nada → null.
 *
 * Patrón: findOneAndUpdate con sort. La primera instancia del worker
 * que llame esto se queda con el job; las demás reciben null.
 *
 * @param {string} workerId — identificador del worker (PID, hostname, etc.)
 * @returns {Promise<object|null>}
 */
async function dequeue(workerId) {
  const now = new Date();

  const job = await AgentJob.findOneAndUpdate(
    {
      status: 'pending',
      scheduled_for: { $lte: now },
    },
    {
      $set: {
        status: 'running',
        worker_id: workerId,
        locked_at: now,
        started_at: now,
      },
      $inc: { attempts: 1 },
    },
    {
      sort: { priority: -1, scheduled_for: 1, createdAt: 1 },   // priority desc, FIFO
      new: true,                                                // devolver doc actualizado
    }
  );

  return job;
}

/**
 * Marca un job como done con su resultado.
 */
async function markDone(jobId, result, metrics = {}) {
  const finished = new Date();
  const job = await AgentJob.findById(jobId);
  if (!job) return null;

  const duration = job.started_at ? finished - job.started_at : null;

  job.status = 'done';
  job.result = result;
  job.finished_at = finished;
  job.duration_ms = duration;
  if (metrics.llm_provider_used) job.llm_provider_used = metrics.llm_provider_used;
  if (metrics.llm_model_used)    job.llm_model_used    = metrics.llm_model_used;
  if (metrics.llm_tokens_used)   job.llm_tokens_used   = metrics.llm_tokens_used;
  await job.save();

  logger.info(`✅ Job done: ${job.task}`, {
    id: jobId.toString(),
    duration_ms: duration,
    tokens: metrics.llm_tokens_used || 0,
  });

  return job;
}

/**
 * Marca un job como failed. Si quedan attempts y retryable=true,
 * lo reencola con backoff exponencial (10s, 60s, 5min).
 */
async function markFailed(jobId, error, { retryable = true } = {}) {
  const job = await AgentJob.findById(jobId);
  if (!job) return null;

  job.error = {
    message: (error?.message || String(error)).slice(0, 1000),
    stack:   (error?.stack || '').slice(0, 2000),
    code:    error?.code || null,
  };
  job.finished_at = new Date();
  job.duration_ms = job.started_at ? job.finished_at - job.started_at : null;

  if (retryable && job.attempts < job.max_attempts) {
    // Backoff exponencial
    const backoffMs = Math.min(10_000 * Math.pow(6, job.attempts - 1), 5 * 60_000);
    job.status = 'pending';
    job.scheduled_for = new Date(Date.now() + backoffMs);
    job.worker_id = null;
    job.locked_at = null;
    job.started_at = null;
    await job.save();

    logger.warn(`🔁 Job retry ${job.attempts}/${job.max_attempts}: ${job.task}`, {
      id: jobId.toString(),
      backoff_ms: backoffMs,
      error: job.error.message.slice(0, 100),
    });
  } else {
    job.status = 'failed';
    await job.save();

    logger.error(`❌ Job failed (no más retries): ${job.task}`, {
      id: jobId.toString(),
      attempts: job.attempts,
      error: job.error.message.slice(0, 100),
    });
  }

  return job;
}

/**
 * Detecta jobs en status='running' cuyo locked_at > 5 min atrás.
 * Probablemente el worker que los tomó murió. Los devuelve a 'pending'
 * para que otro worker (o el mismo después de reiniciar) los retome.
 */
async function releaseStuck() {
  const cutoff = new Date(Date.now() - STUCK_THRESHOLD_MS);
  const result = await AgentJob.updateMany(
    { status: 'running', locked_at: { $lt: cutoff } },
    { $set: { status: 'pending', worker_id: null, locked_at: null } }
  );
  if (result.modifiedCount > 0) {
    logger.warn(`🔓 Released ${result.modifiedCount} stuck jobs (locked > ${STUCK_THRESHOLD_MS / 60000}min)`);
  }
  return result.modifiedCount;
}

/**
 * Stats agregadas. Útil para el endpoint admin.
 */
async function stats() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [counts, today_counts] = await Promise.all([
    AgentJob.aggregate([
      { $group: { _id: '$status', n: { $sum: 1 } } },
    ]),
    AgentJob.aggregate([
      { $match: { createdAt: { $gte: today } } },
      { $group: { _id: '$status', n: { $sum: 1 } } },
    ]),
  ]);

  const toObj = (arr) => Object.fromEntries(arr.map(r => [r._id, r.n]));
  return {
    all_time: toObj(counts),
    today: toObj(today_counts),
  };
}

module.exports = {
  enqueue,
  dequeue,
  markDone,
  markFailed,
  releaseStuck,
  stats,
};
