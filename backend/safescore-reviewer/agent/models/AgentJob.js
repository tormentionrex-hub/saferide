/**
 * AgentJob.js — Modelo Mongoose para la cola persistente del agente.
 *
 * Cada documento es un job a ejecutar por el worker. La cola usa
 * findOneAndUpdate atómico para garantizar que un job solo lo procese
 * una instancia del worker (importante si en el futuro escalamos a varias).
 *
 * NO usa Redis ni Bull — vive en la misma BD que el resto del backend.
 *
 * Collection: 'agent_jobs' (separada para no contaminar el dominio del backend)
 */

const mongoose = require('mongoose');

const VALID_TASKS = [
  'moderate-comment',
  'detect-retaliation',
  'recompute-reputation',
  'publish-blind-reviews',
  'antifraud-nightly',
  'infer-tags',
  'analyze-appeal',
  'award-badges',
  'digest-monthly',
  'draft-complaint-reply',
];

const agentJobSchema = new mongoose.Schema({
  task: {
    type: String,
    enum: VALID_TASKS,
    required: true,
    index: true,
  },
  payload: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
  status: {
    type: String,
    enum: ['pending', 'running', 'done', 'failed', 'cancelled'],
    default: 'pending',
    index: true,
  },
  priority: {
    type: Number,
    default: 0,        // 0 = normal, mayor = más prioridad
    min: 0,
    max: 10,
  },
  scheduled_for: {
    type: Date,
    default: Date.now,
    index: true,
  },
  attempts: {
    type: Number,
    default: 0,
    min: 0,
  },
  max_attempts: {
    type: Number,
    default: 3,
    min: 1,
  },
  worker_id: {
    type: String,
    default: null,        // se setea al tomar el job
  },
  locked_at: {
    type: Date,
    default: null,        // se setea al tomar; sirve para detectar jobs huérfanos
  },
  started_at: { type: Date, default: null },
  finished_at: { type: Date, default: null },
  duration_ms: { type: Number, default: null },

  // Resultado del job (output de la skill)
  result: { type: mongoose.Schema.Types.Mixed, default: null },

  // Si falló
  error: {
    message: String,
    stack:   String,
    code:    String,
  },

  // Métricas de LLM (cuando aplica)
  llm_provider_used: { type: String, default: null },  // 'groq' | 'gemini' | 'cerebras'
  llm_model_used:    { type: String, default: null },
  llm_tokens_used:   { type: Number, default: 0 },

  // Tags libres para clasificar (debug, prod, etc.)
  tags: [{ type: String }],
}, {
  timestamps: true,   // crea createdAt + updatedAt automáticamente
  collection: 'agent_jobs',
});

// Índice compuesto: el worker busca por status + scheduled_for, ordena por priority desc
agentJobSchema.index({ status: 1, scheduled_for: 1, priority: -1, createdAt: 1 });

// Índice para detección de jobs huérfanos (running con locked_at viejo)
agentJobSchema.index({ status: 1, locked_at: 1 });

// Índice para limpieza histórica (TTL parcial — borra done > 30 días)
agentJobSchema.index(
  { finished_at: 1 },
  {
    expireAfterSeconds: 30 * 24 * 3600,  // 30 días
    partialFilterExpression: { status: 'done' },
  }
);

// Evitar re-registrar el modelo en hot reload de nodemon
const AgentJob = mongoose.models.AgentJob || mongoose.model('AgentJob', agentJobSchema);

module.exports = AgentJob;
module.exports.VALID_TASKS = VALID_TASKS;
