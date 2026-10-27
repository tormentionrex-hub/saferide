/**
 * skill.js — T4 publish-blind-reviews
 *
 * Publica las reseñas que terminaron su ventana de doble ciego (24h)
 * y encola el recompute de reputación de cada reviewee.
 */

const ReviewV2 = require('../../agent/models/ReviewV2');
const queue = require('../../agent/queue/agentQueue');

module.exports = {
  name: 'publish-blind-reviews',

  llmRequirements: {
    preferredProvider: 'none',
    fallback: [],
  },

  async execute({ logger }) {
    const now = new Date();

    // Buscar candidatas
    const ready = await ReviewV2.find({
      status: 'pending_blind',
      visibility_at: { $lte: now },
    }).select('_id reviewee_id reviewer_id').lean();

    if (ready.length === 0) {
      logger.debug('publish-blind-reviews: nada para publicar');
      return { published: 0, recomputeEnqueued: 0 };
    }

    // Update atómico de todas a published
    const ids = ready.map(r => r._id);
    const updateResult = await ReviewV2.updateMany(
      { _id: { $in: ids }, status: 'pending_blind' },  // doble check: por si otro worker fue más rápido
      { $set: { status: 'published' } }
    );

    const publishedCount = updateResult.modifiedCount;

    // Dedupe reviewee_ids — un mismo user puede tener varias reviews publicadas en este batch
    const uniqueRevieweeIds = [...new Set(ready.map(r => String(r.reviewee_id)))];

    // Encolar recompute en UN solo job para todos (la skill T3 acepta array)
    let recomputeEnqueued = 0;
    if (uniqueRevieweeIds.length > 0) {
      try {
        await queue.enqueue('recompute-reputation', { userIds: uniqueRevieweeIds }, {
          priority: 3,
          tags: ['from-publish-blind'],
        });
        recomputeEnqueued = uniqueRevieweeIds.length;
      } catch (err) {
        logger.error('publish-blind-reviews: no se pudo encolar recompute', err);
      }
    }

    logger.success(`✅ publish-blind-reviews — publicadas ${publishedCount}, recompute encolado para ${uniqueRevieweeIds.length} usuarios`);

    return {
      published: publishedCount,
      recomputeEnqueued,
      revieweeIds: uniqueRevieweeIds,
    };
  },
};
