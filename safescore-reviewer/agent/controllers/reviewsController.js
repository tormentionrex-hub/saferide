/**
 * reviewsController.js — Endpoint del agente para que el móvil consulte
 *                       reviews de un usuario con su clasificación IA.
 *
 * Endpoint:
 *   GET /api/v1/safescore/reviews/user/:userId
 *
 * Comportamiento:
 *   - Lee via collection nativa (garantiza traer el campo `ai_moderation`
 *     que el modelo Mongoose del backend del equipo ignora por strict mode)
 *   - El `comment` siempre se muestra (sea propio o de otros): si el sistema
 *     ya clasificó la reseña, el comentario es la evidencia que sustenta la
 *     decisión y ocultarlo sería redundante (la clasificación lo describe).
 *   - El `reason` del LLM (debug interno del agente, no del reviewer) SÍ se
 *     mantiene privado: solo lo ve el dueño del perfil.
 *   - Traduce la decisión interna ('safe'/'borderline'/'toxic') a categorías
 *     humanas en español ('Satisfecho'/'Regular'/'Tóxica')
 *   - Reviews sin moderación todavía → categoría 'Pendiente'
 *   - Devuelve también stats agregadas (cuántas de cada tipo)
 */

const mongoose = require('mongoose');

// Mapa de decisiones internas → categorías humanas
const CATEGORY_MAP = {
  safe: 'Satisfecho',
  borderline: 'Regular',
  toxic: 'Tóxica',
};

const CATEGORY_COLORS = {
  Satisfecho: '#16a34a',   // verde
  Regular:    '#eab308',   // amarillo
  Tóxica:     '#dc2626',   // rojo
  Pendiente:  '#94a3b8',   // gris
};

/**
 * Normaliza una review legacy o v2 al shape común para el cliente.
 *
 * @param {object}  rawReview  - el documento crudo de Mongo
 * @param {boolean} isOwner    - si el caller es el dueño del perfil consultado.
 *                               Solo afecta a `reason` (debug interno del agente),
 *                               NO afecta a `comment` que siempre se devuelve.
 */
function normalizeReview(rawReview, isOwner) {
  const isV2 = !!rawReview.overall && !rawReview.rating;

  // Detectar moderación: v2 usa `moderation`, legacy usa `ai_moderation`
  const mod = isV2 ? rawReview.moderation : rawReview.ai_moderation;
  const decision = mod?.decision || mod?.category;

  let category;
  if (!decision || decision === 'pending') {
    category = 'Pendiente';
  } else {
    category = CATEGORY_MAP[decision] || 'Pendiente';
  }

  return {
    _id: rawReview._id,
    ride_id: rawReview.ride_id,
    rating: rawReview.rating || rawReview.overall,
    date: rawReview.date || rawReview.createdAt,
    // Comentario siempre visible: la clasificación necesita su evidencia
    comment: rawReview.comment || null,
    moderation: {
      category,                                                    // 'Satisfecho' | 'Regular' | 'Tóxica' | 'Pendiente'
      color: CATEGORY_COLORS[category],
      score: mod?.toxicity_score ?? null,
      decided_at: mod?.decided_at || null,
      // Razón del LLM (interna del agente) — solo visible al dueño del perfil
      reason: isOwner ? (mod?.reason || null) : null,
    },
    source: isV2 ? 'v2' : 'legacy',
  };
}

/**
 * Calcula stats agregadas de un array de reviews normalizadas.
 */
function computeStats(reviews) {
  const stats = {
    total: reviews.length,
    satisfecho: 0,
    regular: 0,
    toxica: 0,
    pendiente: 0,
    avg_rating: 0,
  };

  if (reviews.length === 0) return stats;

  let sumRating = 0;
  for (const r of reviews) {
    const cat = r.moderation.category;
    if (cat === 'Satisfecho') stats.satisfecho++;
    else if (cat === 'Regular') stats.regular++;
    else if (cat === 'Tóxica') stats.toxica++;
    else stats.pendiente++;
    sumRating += r.rating || 0;
  }

  stats.avg_rating = Math.round((sumRating / reviews.length) * 100) / 100;
  return stats;
}

/**
 * GET /api/v1/safescore/reviews/user/:userId
 */
exports.getUserReviews = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 50);
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ success: false, message: 'userId inválido' });
    }

    const targetUserId = new mongoose.Types.ObjectId(userId);
    const callerId = req.user?._id;
    const isOwn = callerId && callerId.toString() === userId;

    const db = mongoose.connection.db;

    // Leer reviews legacy via collection nativa (asegura traer ai_moderation)
    const legacyReviews = await db.collection('reviews')
      .find({ reviewee_id: targetUserId })
      .sort({ date: -1, createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .toArray();

    // Leer reviews v2 published (si las hay)
    const v2Reviews = await db.collection('reviews_v2')
      .find({ reviewee_id: targetUserId, status: 'published' })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .toArray();

    // Normalizar todas y ordenarlas por fecha
    const all = [
      ...legacyReviews.map(r => normalizeReview(r, isOwn)),
      ...v2Reviews.map(r => normalizeReview(r, isOwn)),
    ].sort((a, b) => new Date(b.date) - new Date(a.date));

    // Stats agregadas sobre TODO (no solo la página)
    const [legacyAll, v2All] = await Promise.all([
      db.collection('reviews')
        .find({ reviewee_id: targetUserId })
        .project({ rating: 1, ai_moderation: 1, overall: 1, moderation: 1 })
        .toArray(),
      db.collection('reviews_v2')
        .find({ reviewee_id: targetUserId, status: 'published' })
        .project({ rating: 1, overall: 1, ai_moderation: 1, moderation: 1 })
        .toArray(),
    ]);
    const statsAll = [
      ...legacyAll.map(r => normalizeReview(r, false)),
      ...v2All.map(r => normalizeReview(r, false)),
    ];
    const stats = computeStats(statsAll);

    return res.json({
      success: true,
      is_own: isOwn,
      data: all,
      stats,
      pagination: {
        page,
        limit,
        total: stats.total,
        pages: Math.ceil(stats.total / limit),
      },
    });
  } catch (err) {
    next(err);
  }
};
