const { User, TrustHistory } = require('../models');

const MAX_TRUST = 4;
const MIN_TRUST = 0;

/**
 * Resultado uniforme para los tres métodos del servicio.
 * @typedef {Object} TrustChangeResult
 * @property {Object|null} user      - Usuario actualizado (sin campos sensibles) o null si no se encontró.
 * @property {boolean} changed       - true si trustScore cambió realmente; false en no-ops.
 * @property {number} previousScore  - Valor antes del cambio (o el valor actual si fue no-op).
 * @property {number} newScore       - Valor después del cambio.
 */

/**
 * Decremento atómico. Resta 1 a trustScore, lo clampea en 0 y recalcula isActive
 * en la misma operación de Mongo. Si el usuario es admin o ya estaba en 0, es no-op.
 *
 * @param {string} userId
 * @param {Object} opts
 * @param {string} opts.reason     - uno de los enum de TrustHistory
 * @param {string} opts.actorId    - quién dispara el cambio (en auto-decremento, mismo userId)
 * @param {string} [opts.bookingId]
 * @param {string} [opts.rideId]
 * @returns {Promise<TrustChangeResult>}
 */
async function decrementTrust(userId, { reason, actorId, bookingId = null, rideId = null }) {
    // Snapshot previo para detectar cambio real y registrar TrustHistory.
    const before = await User.findById(userId).select('trustScore isActive type');
    if (!before) {
        return { user: null, changed: false, previousScore: 0, newScore: 0 };
    }

    // Admins son inmunes al decremento (regla de negocio: siempre 4).
    if (before.type === 'admin') {
        return {
            user: before,
            changed: false,
            previousScore: before.trustScore,
            newScore: before.trustScore,
        };
    }

    // Si ya está en 0, no hay nada que decrementar. Devuelve no-op consistente.
    if (before.trustScore <= MIN_TRUST) {
        return {
            user: before,
            changed: false,
            previousScore: before.trustScore,
            newScore: before.trustScore,
        };
    }

    // Update atómico con pipeline: trustScore -1 (clampeado) e isActive derivado
    // en el mismo round-trip. Evita race conditions entre dos decrementos concurrentes.
    const updated = await User.findOneAndUpdate(
        { _id: userId, trustScore: { $gt: MIN_TRUST }, type: { $ne: 'admin' } },
        [
            {
                $set: {
                    trustScore: {
                        $max: [MIN_TRUST, { $subtract: ['$trustScore', 1] }],
                    },
                },
            },
            {
                $set: {
                    isActive: { $gt: ['$trustScore', MIN_TRUST] },
                },
            },
        ],
        { new: true, select: '-password -refreshToken' }
    );

    // Si el filter no matcheó (race condition: otro decremento llegó primero
    // y ya está en 0), devolvemos el estado actual sin escribir history.
    if (!updated) {
        const fresh = await User.findById(userId).select('-password -refreshToken');
        return {
            user: fresh,
            changed: false,
            previousScore: fresh?.trustScore ?? 0,
            newScore: fresh?.trustScore ?? 0,
        };
    }

    await TrustHistory.create({
        user_id: userId,
        previous_score: before.trustScore,
        new_score: updated.trustScore,
        delta: updated.trustScore - before.trustScore,
        reason,
        actor_id: actorId,
        booking_id: bookingId,
        ride_id: rideId,
    });

    return {
        user: updated,
        changed: true,
        previousScore: before.trustScore,
        newScore: updated.trustScore,
    };
}

/**
 * Incremento atómico (+1). Cap en MAX_TRUST. Reactiva la cuenta (isActive=true)
 * porque cualquier trustScore > 0 implica activa.
 *
 * @param {string} userId
 * @param {Object} opts
 * @param {string} opts.actorId  - admin que dispara el cambio
 * @returns {Promise<TrustChangeResult>}
 */
async function incrementTrust(userId, { actorId }) {
    const before = await User.findById(userId).select('trustScore isActive type');
    if (!before) {
        return { user: null, changed: false, previousScore: 0, newScore: 0 };
    }

    if (before.trustScore >= MAX_TRUST) {
        return {
            user: before,
            changed: false,
            previousScore: before.trustScore,
            newScore: before.trustScore,
        };
    }

    const updated = await User.findOneAndUpdate(
        { _id: userId, trustScore: { $lt: MAX_TRUST } },
        [
            {
                $set: {
                    trustScore: {
                        $min: [MAX_TRUST, { $add: ['$trustScore', 1] }],
                    },
                    isActive: true,
                },
            },
        ],
        { new: true, select: '-password -refreshToken' }
    );

    if (!updated) {
        const fresh = await User.findById(userId).select('-password -refreshToken');
        return {
            user: fresh,
            changed: false,
            previousScore: fresh?.trustScore ?? 0,
            newScore: fresh?.trustScore ?? 0,
        };
    }

    await TrustHistory.create({
        user_id: userId,
        previous_score: before.trustScore,
        new_score: updated.trustScore,
        delta: updated.trustScore - before.trustScore,
        reason: 'admin_increment',
        actor_id: actorId,
    });

    return {
        user: updated,
        changed: true,
        previousScore: before.trustScore,
        newScore: updated.trustScore,
    };
}

/**
 * Reset a MAX_TRUST. Idempotente: si ya está en 4 NO escribe TrustHistory.
 *
 * @param {string} userId
 * @param {Object} opts
 * @param {string} opts.actorId  - admin que dispara el cambio
 * @returns {Promise<TrustChangeResult>}
 */
async function resetTrust(userId, { actorId }) {
    const before = await User.findById(userId).select('trustScore isActive type');
    if (!before) {
        return { user: null, changed: false, previousScore: 0, newScore: 0 };
    }

    if (before.trustScore === MAX_TRUST && before.isActive === true) {
        return {
            user: before,
            changed: false,
            previousScore: before.trustScore,
            newScore: before.trustScore,
        };
    }

    const updated = await User.findByIdAndUpdate(
        userId,
        { $set: { trustScore: MAX_TRUST, isActive: true } },
        { new: true, select: '-password -refreshToken' }
    );

    await TrustHistory.create({
        user_id: userId,
        previous_score: before.trustScore,
        new_score: MAX_TRUST,
        delta: MAX_TRUST - before.trustScore,
        reason: 'admin_reset',
        actor_id: actorId,
    });

    return {
        user: updated,
        changed: true,
        previousScore: before.trustScore,
        newScore: MAX_TRUST,
    };
}

module.exports = {
    decrementTrust,
    incrementTrust,
    resetTrust,
    MAX_TRUST,
    MIN_TRUST,
};
