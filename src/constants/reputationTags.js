/**
 * Catálogo local de tags de reputación para SafeScore.
 *
 * NOTA: Este catálogo es la fuente de verdad mientras el backend no exponga
 * GET /reputation/tag-catalog. Cuando el backend esté listo, este archivo se
 * convertirá en fallback y los tags se cargarán dinámicamente.
 *
 * Estructura de cada tag:
 *   code       (string)  identificador único, snake_case en inglés (estable en BD)
 *   label      (string)  texto visible al usuario, español
 *   emoji      (string)  ícono visual
 *   role       'driver' | 'passenger'    a quién se le aplica el tag
 *   dimension  (string)  dimensión SafeScore a la que pertenece
 *   category   'positive' | 'negative'
 */

export const DIMENSIONS = {
  driver: [
    {
      key: 'safety',
      label: 'Seguridad',
      description: '¿Sentiste seguridad durante el trayecto?',
      emoji: '🛡️',
    },
    {
      key: 'conduction',
      label: 'Manejo',
      description: '¿Qué tan suave fue su forma de conducir?',
      emoji: '🚗',
    },
    {
      key: 'communication',
      label: 'Comunicación',
      description: '¿Fue claro y respetuoso al comunicarse?',
      emoji: '💬',
    },
  ],
  passenger: [
    {
      key: 'punctuality',
      label: 'Puntualidad',
      description: '¿Llegó al punto de encuentro a tiempo?',
      emoji: '⏰',
    },
    {
      key: 'cleanliness',
      label: 'Limpieza',
      description: '¿Cuidó la limpieza durante el viaje?',
      emoji: '🧼',
    },
    {
      key: 'manners',
      label: 'Trato',
      description: '¿Cómo fue su comportamiento a bordo?',
      emoji: '🤝',
    },
  ],
};

// ── Tags para calificar a un CONDUCTOR (los selecciona el pasajero) ─────────
const DRIVER_TAGS_POSITIVE = [
  { code: 'smooth_driving',    label: 'Manejo suave',         emoji: '🌊', dimension: 'conduction' },
  { code: 'safe_driver',       label: 'Conduce seguro',       emoji: '🛡️', dimension: 'safety' },
  { code: 'clean_car',         label: 'Auto limpio',          emoji: '✨', dimension: 'safety' },
  { code: 'knows_route',       label: 'Conoce la ruta',       emoji: '🧭', dimension: 'conduction' },
  { code: 'pleasant_music',    label: 'Música agradable',     emoji: '🎵', dimension: 'communication' },
  { code: 'friendly_driver',   label: 'Trato amable',         emoji: '😊', dimension: 'communication' },
  { code: 'good_conversation', label: 'Buena conversación',   emoji: '💬', dimension: 'communication' },
  { code: 'on_time_driver',    label: 'Llegó puntual',        emoji: '⏰', dimension: 'safety' },
];

const DRIVER_TAGS_NEGATIVE = [
  { code: 'aggressive_driving', label: 'Manejo brusco',         emoji: '⚠️', dimension: 'conduction' },
  { code: 'used_phone',         label: 'Usó celular al manejar', emoji: '📵', dimension: 'safety' },
  { code: 'long_route',         label: 'Tomó ruta larga',       emoji: '🗺️', dimension: 'conduction' },
  { code: 'dirty_car',          label: 'Auto sucio',            emoji: '🚮', dimension: 'safety' },
  { code: 'bad_smell',          label: 'Olor en el auto',       emoji: '🤢', dimension: 'safety' },
  { code: 'rude_driver',        label: 'Trato descortés',       emoji: '😠', dimension: 'communication' },
  { code: 'loud_music',         label: 'Música muy alta',       emoji: '🔊', dimension: 'communication' },
  { code: 'speeding',           label: 'Iba con exceso de velocidad', emoji: '💨', dimension: 'safety' },
];

// ── Tags para calificar a un PASAJERO (los selecciona el conductor) ─────────
const PASSENGER_TAGS_POSITIVE = [
  { code: 'on_time',            label: 'Puntual',              emoji: '⏰', dimension: 'punctuality' },
  { code: 'polite',             label: 'Amable',               emoji: '😊', dimension: 'manners' },
  { code: 'clean_passenger',    label: 'Cuidó el auto',        emoji: '✨', dimension: 'cleanliness' },
  { code: 'easy_pickup',        label: 'Pickup fácil',         emoji: '📍', dimension: 'punctuality' },
  { code: 'good_company',       label: 'Buena compañía',       emoji: '💛', dimension: 'manners' },
  { code: 'quiet_passenger',    label: 'Tranquilo',            emoji: '🤫', dimension: 'manners' },
  { code: 'clear_communication',label: 'Comunicación clara',   emoji: '💬', dimension: 'manners' },
  { code: 'respectful',         label: 'Respetuoso',           emoji: '🙏', dimension: 'manners' },
];

const PASSENGER_TAGS_NEGATIVE = [
  { code: 'late',                label: 'Llegó tarde',           emoji: '⌛', dimension: 'punctuality' },
  { code: 'no_show',             label: 'No se presentó',        emoji: '👻', dimension: 'punctuality' },
  { code: 'brought_food',        label: 'Trajo comida/bebida',   emoji: '🍔', dimension: 'cleanliness' },
  { code: 'loud_call',           label: 'Habló por teléfono fuerte', emoji: '📞', dimension: 'manners' },
  { code: 'left_trash',          label: 'Dejó basura',           emoji: '🚮', dimension: 'cleanliness' },
  { code: 'rude_passenger',      label: 'Trato descortés',       emoji: '😠', dimension: 'manners' },
  { code: 'wrong_address',       label: 'Dirección incorrecta',  emoji: '❓', dimension: 'punctuality' },
  { code: 'extra_passengers',    label: 'Subió más personas',    emoji: '👥', dimension: 'manners' },
];

/**
 * Devuelve el catálogo apropiado según el rol del usuario calificado.
 *
 * @param {'driver'|'passenger'} revieweeRole — rol del usuario que recibe la calificación
 * @returns {{ positive: Tag[], negative: Tag[] }}
 */
export function getTagsForReviewee(revieweeRole) {
  if (revieweeRole === 'driver') {
    return {
      positive: DRIVER_TAGS_POSITIVE,
      negative: DRIVER_TAGS_NEGATIVE,
    };
  }
  return {
    positive: PASSENGER_TAGS_POSITIVE,
    negative: PASSENGER_TAGS_NEGATIVE,
  };
}

/**
 * Devuelve las 3 dimensiones aplicables al rol del usuario calificado.
 *
 * @param {'driver'|'passenger'} revieweeRole
 * @returns {Array<{ key: string, label: string, description: string, emoji: string }>}
 */
export function getDimensionsForReviewee(revieweeRole) {
  return DIMENSIONS[revieweeRole] || DIMENSIONS.driver;
}

/**
 * Etiquetas humanas para el overall 1–5.
 */
export const OVERALL_LABELS = ['', 'Muy malo', 'Malo', 'Regular', 'Bueno', 'Excelente'];

export default {
  getTagsForReviewee,
  getDimensionsForReviewee,
  DIMENSIONS,
  OVERALL_LABELS,
};
