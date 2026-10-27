/**
 * ModerationAlert.js — Alertas de moderación que el agente genera para el admin.
 *
 * Collection: 'moderation_alerts'
 *
 * Cada vez que el agente detecta una reseña toxic o borderline, crea un documento
 * acá con TODO el contexto necesario para que el dashboard admin lo muestre y el
 * admin pueda decidir qué hacer.
 *
 * Incluye:
 *   - El comentario completo (excerpt)
 *   - La decisión del LLM (categoría, score, razón)
 *   - Una recomendación específica generada por el agente (acción sugerida + prioridad)
 *   - El historial del reviewer (strikes acumulados)
 *   - Estado de atención por parte del admin
 *
 * El dashboard admin debería tener una página /admin/moderation-alerts que
 * liste esto, permita marcarlas como atendidas, e idealmente acción directa
 * (suspender al reviewer, ocultar la reseña, descartar la alerta, etc.).
 */

const mongoose = require('mongoose');

const moderationAlertSchema = new mongoose.Schema({
  // ── Tipo y severidad ─────────────────────────────────────────────────
  type: {
    type: String,
    enum: ['review_toxic', 'review_borderline', 'user_flagged', 'mass_pattern'],
    required: true,
    index: true,
  },
  severity: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    required: true,
    index: true,
  },

  // ── De dónde viene la alerta ─────────────────────────────────────────
  source_collection: {
    type: String,
    enum: ['reviews', 'reviews_v2', 'users', 'agent_jobs'],
    required: true,
  },
  source_id: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    index: true,
  },

  // ── Partes involucradas ─────────────────────────────────────────────
  reviewer_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  reviewee_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },

  // ── Contexto del comentario (snapshot para que el admin no busque) ─────
  comment_excerpt: { type: String, maxlength: 500 },
  rating: { type: Number, min: 1, max: 5 },

  // ── Decisión del agente (del LLM) ────────────────────────────────────
  decision: {
    category: { type: String, enum: ['safe', 'borderline', 'toxic'], required: true },
    toxicity_score: { type: Number, min: 0, max: 1, required: true },
    reason: { type: String, maxlength: 500 },
    flags: [{ type: String }],
    llm_provider: String,
    llm_model: String,
    llm_tokens: Number,
  },

  // ── Recomendación del agente (qué debería hacer el admin) ────────────
  recommendation: {
    priority: { type: String, enum: ['low', 'medium', 'high', 'critical'], required: true },
    action: { type: String, required: true },          // acción concreta sugerida
    rationale: { type: String },                       // por qué se sugiere esa acción
    suggested_steps: [{ type: String }],               // pasos sugeridos al admin
  },

  // ── Contexto del reviewer (historial) ────────────────────────────────
  reviewer_strikes: { type: Number, default: 0 },     // cantidad de toxic acumulados
  reviewer_flagged: { type: Boolean, default: false }, // si el user ya quedó flagged

  // ── Atención por parte del admin ─────────────────────────────────────
  status: {
    type: String,
    enum: ['pending', 'investigating', 'actioned', 'dismissed'],
    default: 'pending',
    index: true,
  },
  admin_notes: { type: String, default: null },
  resolved_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  resolved_at: { type: Date, default: null },
  resolution: { type: String, default: null },        // qué se hizo finalmente
}, {
  timestamps: true,
  collection: 'moderation_alerts',
});

// Índices útiles para el dashboard
moderationAlertSchema.index({ status: 1, severity: -1, createdAt: -1 });   // listado por prioridad
moderationAlertSchema.index({ reviewer_id: 1, createdAt: -1 });            // historial por usuario
moderationAlertSchema.index({ createdAt: -1 });                            // listado cronológico

const ModerationAlert = mongoose.models.ModerationAlert || mongoose.model('ModerationAlert', moderationAlertSchema);

module.exports = ModerationAlert;
