/**
 * agentAdminController.js — Endpoints admin para inspeccionar y operar el agente.
 *
 * Todos los endpoints requieren verifyToken + authorize('admin') desde la ruta.
 *
 * Endpoints:
 *   GET    /api/v1/admin/agent-jobs          — lista paginada con filtros
 *   GET    /api/v1/admin/agent-jobs/stats    — métricas de uso y cuotas
 *   GET    /api/v1/admin/agent-jobs/:id      — detalle de un job
 *   POST   /api/v1/admin/agent-jobs/:id/retry — reencolar un job failed
 *   POST   /api/v1/admin/agent-jobs/enqueue  — encolar manualmente (dev)
 *   DELETE /api/v1/admin/agent-jobs/:id      — cancelar un job pending
 */

const AgentJob = require('../models/AgentJob');
const queue = require('../queue/agentQueue');
const quotaTracker = require('../llm/quotaTracker');

/**
 * GET /admin/agent-jobs?status=pending|running|done|failed&task=moderate-comment&limit=50&page=1
 */
exports.listJobs = async (req, res, next) => {
  try {
    const { status, task, limit = 50, page = 1 } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (task)   filter.task = task;

    const lim = Math.min(parseInt(limit, 10) || 50, 200);
    const skip = (Math.max(parseInt(page, 10) || 1, 1) - 1) * lim;

    const [items, total] = await Promise.all([
      AgentJob.find(filter)
        .sort({ createdAt: -1 })
        .limit(lim)
        .skip(skip)
        .lean(),
      AgentJob.countDocuments(filter),
    ]);

    return res.json({
      success: true,
      data: items,
      pagination: { total, page: parseInt(page, 10) || 1, limit: lim, pages: Math.ceil(total / lim) },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /admin/agent-jobs/stats
 */
exports.stats = async (req, res, next) => {
  try {
    const [jobStats, quotas] = await Promise.all([
      queue.stats(),
      Promise.resolve(quotaTracker.snapshot()),
    ]);
    return res.json({
      success: true,
      data: {
        jobs: jobStats,
        quotas,
        agent_enabled: process.env.SAFESCORE_ENABLED === 'true',
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /admin/agent-jobs/:id
 */
exports.getJob = async (req, res, next) => {
  try {
    const job = await AgentJob.findById(req.params.id).lean();
    if (!job) return res.status(404).json({ success: false, message: 'Job no encontrado' });
    return res.json({ success: true, data: job });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /admin/agent-jobs/:id/retry
 */
exports.retryJob = async (req, res, next) => {
  try {
    const job = await AgentJob.findById(req.params.id);
    if (!job) return res.status(404).json({ success: false, message: 'Job no encontrado' });
    if (job.status === 'running' || job.status === 'pending') {
      return res.status(400).json({ success: false, message: 'Job ya está pending o running' });
    }

    // Reset y volver a pending
    job.status = 'pending';
    job.scheduled_for = new Date();
    job.worker_id = null;
    job.locked_at = null;
    job.started_at = null;
    job.finished_at = null;
    job.duration_ms = null;
    job.error = undefined;
    // attempts NO se resetea — vemos si después de N intentos el job sigue fallando
    await job.save();

    return res.json({ success: true, message: 'Job reencolado', data: { id: job._id, attempts: job.attempts } });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /admin/agent-jobs/enqueue  — body: { task, payload, priority? }
 * Útil para testing manual desde el admin.
 */
exports.manualEnqueue = async (req, res, next) => {
  try {
    const { task, payload = {}, priority = 0 } = req.body || {};
    if (!task) return res.status(400).json({ success: false, message: 'task requerido' });
    if (!AgentJob.VALID_TASKS.includes(task)) {
      return res.status(400).json({ success: false, message: `task inválido. Válidos: ${AgentJob.VALID_TASKS.join(', ')}` });
    }
    const job = await queue.enqueue(task, payload, { priority, tags: ['manual'] });
    return res.status(201).json({ success: true, data: job });
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /admin/agent-jobs/:id  — cancela un job pending
 */
exports.cancelJob = async (req, res, next) => {
  try {
    const job = await AgentJob.findById(req.params.id);
    if (!job) return res.status(404).json({ success: false, message: 'Job no encontrado' });
    if (job.status !== 'pending') {
      return res.status(400).json({ success: false, message: `Solo jobs pending se pueden cancelar (estado actual: ${job.status})` });
    }
    job.status = 'cancelled';
    job.finished_at = new Date();
    await job.save();
    return res.json({ success: true, message: 'Job cancelado' });
  } catch (err) {
    next(err);
  }
};
