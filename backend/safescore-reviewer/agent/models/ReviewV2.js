/**
 * ReviewV2.js — Modelo de reseñas SafeScore (multidimensional, doble ciego).
 *
 * NO reemplaza al modelo `Review` legacy del equipo — vive en paralelo en
 * la collection 'reviews_v2'. Cuando el frontend móvil cambie a SafeScoreReview,
 * empezará a poblar esta collection.
 *
 * Diferencias con Review legacy:
 *   - Multidimensional (overall + 6 ratings por aspecto)
 *   - Doble ciego (pending_blind hasta visibility_at)
 *   - Tags estructurados (positive/negative)
 *   - Moderation built-in
 *   - Weight + anomaly_flags para anti-fraude
 *
 * Diseñado en alineación con el plan SafeScore (FASE 5 del análisis senior).
 */

const mongoose = require('mongoose');

const reviewV2Schema = new mongoose.Schema({
  ride_id:        { type: mongoose.Schema.Types.ObjectId, ref: 'Ride', required: true, index: true },
  reviewer_id:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  reviewee_id:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  reviewer_role:  { type: String, enum: ['driver', 'passenger'], required: true },

  // Calificación global (1-5)
  overall: { type: Number, min: 1, max: 5, required: true },

  // Dimensiones específicas (todas opcionales — el wizard del móvil
  // puede saltarlas, el modelo no obliga a calificar todas).
  ratings: {
    safety:        { type: Number, min: 1, max: 5 },
    punctuality:   { type: Number, min: 1, max: 5 },
    cleanliness:   { type: Number, min: 1, max: 5 },
    communication: { type: Number, min: 1, max: 5 },
    conduction:    { type: Number, min: 1, max: 5 },   // solo aplica a drivers
    manners:       { type: Number, min: 1, max: 5 },   // solo aplica a passengers
  },

  // Tags estructurados (códigos del catálogo en el cliente)
  positive_tags: [{ type: String }],
  negative_tags: [{ type: String }],

  // Comentario libre (solo se pide si hay tags negativos en el wizard)
  comment: { type: String, maxlength: 500, default: null },

  // Verificación geo (S4 del plan)
  geo_verified: { type: Boolean, default: false },
  reviewer_location_at_submit: {
    lat: { type: Number },
    lng: { type: Number },
  },

  // Doble ciego (S2 del plan)
  status: {
    type: String,
    enum: ['pending_blind', 'published', 'suppressed', 'disputed', 'moderation_queue'],
    default: 'pending_blind',
    index: true,
  },
  visibility_at: { type: Date, index: true },   // cuándo se publica si no hay counter-review

  // Weight efectivo (anti-fraude reduce a 0 las flagged)
  weight: { type: Number, default: 1.0, min: 0, max: 1 },
  anomaly_flags: [{ type: String }],

  // Moderación
  moderation: {
    toxicity_score: Number,                                          // 0-1
    decision:       { type: String, enum: ['safe', 'borderline', 'toxic', 'pending', 'auto_approved'], default: 'pending' },
    decided_at:     Date,
    auto:           { type: Boolean, default: false },                // true si la decidió el agente sin humano
    reason:         String,                                           // explicación corta del agente
    moderator_id:   { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    flags:          [String],                                         // ['insult', 'threat', ...]
  },

  // Apelación
  appealed: {
    is_appealed: { type: Boolean, default: false },
    by:          { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reason:      { type: String, enum: ['not_applicable', 'false', 'offensive', 'retaliation'] },
    description: String,
    resolution:  { type: String, enum: ['upheld', 'removed', 'edited'] },
    resolved_at: Date,
    resolver_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },

  // Trazabilidad cliente
  client_version: { type: String, default: 'safescore-v1' },
}, {
  timestamps: true,
  collection: 'reviews_v2',
});

// Único: una persona solo califica al mismo reviewee 1 vez por ride
reviewV2Schema.index(
  { ride_id: 1, reviewer_id: 1, reviewee_id: 1 },
  { unique: true }
);

// Búsquedas habituales: ¿qué reseñas published tiene X usuario?
reviewV2Schema.index({ reviewee_id: 1, status: 1, visibility_at: -1 });

// Velocity check (para anti-fraude): cuántas reseñas hizo X en última hora
reviewV2Schema.index({ reviewer_id: 1, createdAt: -1 });

// Worker de publish-blind: busca reseñas pending_blind con visibility_at <= now
reviewV2Schema.index({ status: 1, visibility_at: 1 });

const ReviewV2 = mongoose.models.ReviewV2 || mongoose.model('ReviewV2', reviewV2Schema);

module.exports = ReviewV2;
