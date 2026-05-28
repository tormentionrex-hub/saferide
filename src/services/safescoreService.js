/**
 * safescoreService — cliente del sistema de reputación SafeScore.
 *
 * ESTADO: STUB. El backend aún NO expone /reviews/v2 ni /reputation/*.
 *
 * Las firmas y los payloads ya están definidos para que el día que el equipo
 * backend libere los endpoints (ver docs/BACKEND_FIXES_PENDING.md, Bloque 5),
 * la conexión se reduzca a descomentar las llamadas `api.post(...)` y borrar
 * los `throw NOT_IMPLEMENTED`.
 *
 * MIENTRAS TANTO:
 *  - submitSafeScoreReview() lanza un error explícito con código 'NOT_IMPLEMENTED'
 *    para que la UI lo capture y muestre el mensaje correspondiente al usuario.
 *  - No hay datos fake / mocks: el usuario eligió esperar al backend real para
 *    no propagar inconsistencias por la app.
 */

import api from './api';

export const SAFESCORE_NOT_IMPLEMENTED = 'SAFESCORE_NOT_IMPLEMENTED';

/**
 * Construye el payload canónico de una reseña SafeScore.
 * Esta función SÍ es útil hoy: la usamos en la pantalla para tener un único
 * lugar donde se define la forma del request.
 *
 * @param {{
 *   rideId: string,
 *   revieweeId: string,
 *   reviewerRole: 'driver'|'passenger',
 *   overall: number,                              // 1-5
 *   ratings: {                                    // 1-5 cada una (parcial OK)
 *     safety?: number, punctuality?: number, cleanliness?: number,
 *     communication?: number, conduction?: number, manners?: number
 *   },
 *   positiveTags: string[],                       // códigos
 *   negativeTags: string[],                       // códigos
 *   comment?: string|null,
 *   location?: { lat: number, lng: number }|null,
 * }} input
 * @returns {object} payload listo para enviar a POST /reviews/v2
 */
export function buildSafeScorePayload(input) {
  return {
    ride_id: typeof input.rideId === 'object' ? input.rideId?._id?.toString() : String(input.rideId || ''),
    reviewee_id: typeof input.revieweeId === 'object' ? input.revieweeId?._id?.toString() : String(input.revieweeId || ''),
    reviewer_role: input.reviewerRole,
    overall: input.overall,
    ratings: input.ratings || {},
    positive_tags: input.positiveTags || [],
    negative_tags: input.negativeTags || [],
    comment: input.comment ? input.comment.trim() : null,
    location: input.location || null,
    client_version: 'safescore-v1',
  };
}

/**
 * Envía una reseña SafeScore al backend.
 *
 * TODO: implementar cuando el backend exponga POST /api/v1/reviews/v2
 *       (ver docs/BACKEND_FIXES_PENDING.md, sección 5.1).
 *
 * @param {object} input — el mismo formato que buildSafeScorePayload
 * @returns {Promise<{ id: string, status: string, visibility_at: string }>}
 * @throws  Error con .code === SAFESCORE_NOT_IMPLEMENTED mientras no haya backend
 */
export async function submitSafeScoreReview(/* input */) {
  // const payload = buildSafeScorePayload(input);
  // const { data } = await api.post('/reviews/v2', payload);
  // return data;

  const err = new Error(
    'El sistema SafeScore aún no está conectado al backend. ' +
    'Tu reseña se guardará cuando el equipo libere los endpoints /reviews/v2.'
  );
  err.code = SAFESCORE_NOT_IMPLEMENTED;
  throw err;
}

/**
 * Obtiene las reseñas pendientes por escribir del usuario actual.
 * TODO: GET /reviews/v2/pending-mine
 */
export async function getPendingReviews() {
  const err = new Error('GET /reviews/v2/pending-mine no implementado en backend');
  err.code = SAFESCORE_NOT_IMPLEMENTED;
  throw err;
}

/**
 * Obtiene el reputationSnapshot completo de un usuario.
 * TODO: GET /reviews/v2/user/:id/snapshot
 *
 * @param {string} userId
 */
export async function getReputationSnapshot(/* userId */) {
  const err = new Error('GET /reviews/v2/user/:id/snapshot no implementado en backend');
  err.code = SAFESCORE_NOT_IMPLEMENTED;
  throw err;
}

/**
 * Apela una reseña recibida considerada injusta.
 * TODO: POST /reviews/v2/:id/appeal
 *
 * @param {string} reviewId
 * @param {{ reason: 'not_applicable'|'false'|'offensive'|'retaliation', description: string }} body
 */
export async function appealReview(/* reviewId, body */) {
  const err = new Error('POST /reviews/v2/:id/appeal no implementado en backend');
  err.code = SAFESCORE_NOT_IMPLEMENTED;
  throw err;
}

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
  buildSafeScorePayload,
  submitSafeScoreReview,
  getPendingReviews,
  getReputationSnapshot,
  appealReview,
  getUserReviews,
  SAFESCORE_NOT_IMPLEMENTED,
};
