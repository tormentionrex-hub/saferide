/**
 * skill.js — Implementación de T3 recompute-reputation.
 *
 * Lee reseñas published del usuario, aplica Bayesian + decay,
 * actualiza User.reputationSnapshot.
 *
 * Sin LLM, sin red — solo Mongo + matemática.
 */

const ReviewV2 = require('../../agent/models/ReviewV2');
const { validateInput } = require('./schema');

// ── Constantes del modelo Bayesian ──────────────────────────────────────
const PRIOR_MEAN = 4.0;
const PRIOR_WEIGHT = 10;
const HALF_LIFE_DAYS = 180;
const DIMENSIONS = ['safety', 'punctuality', 'cleanliness', 'communication', 'conduction', 'manners'];

/**
 * Pure: Bayesian average sin decay (usado por dimensiones).
 */
function bayesianAverage(values, prior = PRIOR_MEAN, weight = PRIOR_WEIGHT) {
  if (!values.length) return prior;
  const sum = values.reduce((a, b) => a + b, 0);
  return (prior * weight + sum) / (weight + values.length);
}

/**
 * Pure: peso por edad (exponential decay).
 */
function decayWeight(date, halfLifeDays = HALF_LIFE_DAYS) {
  const ageDays = (Date.now() - new Date(date).getTime()) / 86_400_000;
  if (ageDays <= 0) return 1;
  return Math.pow(0.5, ageDays / halfLifeDays);
}

/**
 * Pure: weighted bayesian (usado por overall con decay).
 */
function weightedBayesian(weighted, prior = PRIOR_MEAN, priorWeight = PRIOR_WEIGHT) {
  const sumW = weighted.reduce((a, x) => a + x.w, 0);
  const sumWX = weighted.reduce((a, x) => a + x.w * x.value, 0);
  return (prior * priorWeight + sumWX) / (priorWeight + sumW);
}

/**
 * Pure: nivel del usuario según samples + overall.
 */
function levelFromStats(overall, samples) {
  if (samples < 5)   return 'rookie';
  if (samples < 50)  return 'driver';
  if (samples < 200) return overall >= 4.5 ? 'pro' : 'driver';
  return overall >= 4.7 ? 'champion' : 'pro';
}

/**
 * Recompute para un solo usuario. Devuelve el snapshot resultante.
 */
async function recomputeOne(userId, db) {
  const User = db.model('User');

  const reviews = await ReviewV2.find({
    reviewee_id: userId,
    status: 'published',
    weight: { $gt: 0 },
  }).select('overall ratings createdAt weight').lean();

  if (reviews.length === 0) {
    // Sin reseñas: snapshot vacío pero válido
    await User.updateOne(
      { _id: userId },
      {
        $set: {
          'reputationSnapshot.overall': { value: null, samples: 0, lastUpdate: new Date() },
          'reputationSnapshot.dimensions': {},
          'reputationSnapshot.level': 'rookie',
        },
      }
    );
    return { userId: String(userId), overall: null, samples: 0, level: 'rookie' };
  }

  // Overall con decay temporal
  const overallWeighted = reviews.map(r => ({
    value: r.overall,
    w: decayWeight(r.createdAt) * (r.weight ?? 1),
  }));
  const overall = weightedBayesian(overallWeighted);

  // Dimensiones (sin decay, más simple — decay hace sentido en overall)
  const dims = {};
  for (const d of DIMENSIONS) {
    const vals = reviews
      .map(r => r.ratings?.[d])
      .filter(v => v != null && v >= 1 && v <= 5);
    dims[d] = vals.length > 0
      ? { value: Math.round(bayesianAverage(vals) * 100) / 100, samples: vals.length }
      : { value: null, samples: 0 };
  }

  const overallRounded = Math.round(overall * 100) / 100;
  const samples = reviews.length;
  const level = levelFromStats(overallRounded, samples);

  // Update atómico — incluye mirror a User.rating para back-compat con frontend viejo
  await User.updateOne(
    { _id: userId },
    {
      $set: {
        'reputationSnapshot.overall': { value: overallRounded, samples, lastUpdate: new Date() },
        'reputationSnapshot.dimensions': dims,
        'reputationSnapshot.level': level,
        rating: overallRounded,   // mirror
      },
    }
  );

  return {
    userId: String(userId),
    overall: overallRounded,
    samples,
    level,
  };
}

/**
 * Entrada estándar del agent runtime.
 */
module.exports = {
  name: 'recompute-reputation',

  // Sin LLM
  llmRequirements: {
    preferredProvider: 'none',
    fallback: [],
  },

  async execute({ input, db, logger }) {
    const v = validateInput(input);
    if (!v.ok) {
      logger.warn('recompute-reputation: input inválido, intentando igual', { error: v.error });
    }

    const userIds = (input && input.userIds) || [];
    if (!Array.isArray(userIds) || userIds.length === 0) {
      return { recomputed: 0, snapshots: [] };
    }

    const snapshots = [];
    for (const uid of userIds) {
      try {
        const snap = await recomputeOne(uid, db);
        snapshots.push(snap);
      } catch (err) {
        // No bloquea el batch: log y continúa
        logger.error(`recompute-reputation: fallo para user ${uid}`, err);
      }
    }

    return {
      recomputed: snapshots.length,
      snapshots,
    };
  },

  // Exports puros para tests
  _internals: {
    bayesianAverage,
    decayWeight,
    weightedBayesian,
    levelFromStats,
    recomputeOne,
  },
};
