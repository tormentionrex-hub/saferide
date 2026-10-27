/**
 * safescoreService — lectura de reseñas clasificadas por el agente SafeScore.
 *
 * El flujo SafeScore v2 (wizard por dimensiones, apelaciones, snapshot de
 * reputación) se pospuso: el backend no expone /reviews/v2 y la app envía
 * reseñas por POST /reviews/direct-submit. Los stubs de v2 se retiraron para
 * no dejar pantallas ni llamadas que fallan; su diseño queda documentado en
 * docs/BACKEND_FIXES_PENDING.md (bloques 4 a 8).
 */

import api from './api';

/**
 * Obtiene las reviews recibidas por un usuario, con clasificación IA del
 * agente SafeScore (Satisfecho / Regular / Tóxica / Pendiente).
 *
 * El backend detecta automáticamente si el caller es el dueño del perfil
 * (vía el token JWT) y decide si incluir o no el comentario completo:
 *   - Si caller === userId → el dueño VE su propio comment
 *   - Si caller !== userId → otros NO ven el comment (privacidad)
 *
 * @param {string} userId — el ObjectId del usuario cuyas reviews queremos
 * @param {{ limit?: number, page?: number }} opts
 * @returns {Promise<{
 *   is_own: boolean,
 *   data: Array<{
 *     _id, ride_id, rating, date,
 *     comment: string | null,
 *     moderation: { category, color, score, decided_at, reason: string | null },
 *     source: 'v2' | 'legacy'
 *   }>,
 *   stats: { total, satisfecho, regular, toxica, pendiente, avg_rating },
 *   pagination: { page, limit, total, pages }
 * }>}
 */
export async function getUserReviews(userId, { limit = 20, page = 1 } = {}) {
  if (!userId) throw new Error('getUserReviews: userId requerido');
  const idStr = typeof userId === 'object' ? userId?._id?.toString() : String(userId);
  const { data } = await api.get(`/safescore/reviews/user/${idStr}`, {
    params: { limit, page },
  });
  return data;
}

export default {
  getUserReviews,
};
