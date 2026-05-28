/**
 * reviewHeuristics.js — PARCHE TEMPORAL FRONTEND para reclasificar reseñas
 *                       que el agente clasificó mal con el prompt viejo.
 *
 * Por qué existe:
 *   El prompt viejo del agente entrenaba al LLM a clasificar quejas del
 *   servicio (sin insultos) como "Satisfecho", lo cual está mal: una queja
 *   legítima sobre olor/tardanza/limpieza NO es satisfacción, es una
 *   experiencia negativa.
 *
 *   El prompt fue corregido (safescore-reviewer/skills/moderate-comment/
 *   prompt.md) pero las reseñas YA moderadas siguen con la clasificación
 *   vieja en BD. Re-moderarlas con LLM requiere reiniciar backend +
 *   correr el script remoderate-reviews.js --apply.
 *
 *   Mientras tanto, este parche detecta palabras clave en el comentario
 *   y override el badge visual SOLO en el frontend, para que el usuario
 *   vea la clasificación correcta inmediatamente.
 *
 * Cómo funciona:
 *   - Si el backend ya dice "Tóxica" → respeta (el agente la detectó bien)
 *   - Si el backend dice "Pendiente" → respeta (aún no se moderó)
 *   - Si el backend dice "Satisfecho" o "Regular":
 *       - Si el comentario tiene insultos → upgrade a "Tóxica"
 *       - Si el comentario tiene quejas sin insultos → upgrade a "Regular"
 *       - Sino → respeta el badge del backend
 *
 * Cuándo eliminar este parche:
 *   Después de que se re-modere TODA la BD con el prompt nuevo, este
 *   archivo puede borrarse y los componentes pueden volver a confiar 100%
 *   en el backend.
 */

// ── Palabras que indican INSULTO DIRECTO → toxic ────────────────────────
const INSULT_WORDS = [
  // Insultos comunes
  'imbécil', 'imbecil', 'idiota', 'estúpido', 'estupido', 'tonto', 'tarado',
  'pendejo', 'pendeja', 'mierda', 'cabrón', 'cabron', 'maldito', 'maldita',
  'puta', 'puto', 'carajo', 'joder',
  // Animal usado como insulto
  'animal', 'bestia', 'salvaje',
  // Deseos de daño
  'ojalá lo despidan', 'ojala lo despidan', 'ojalá lo echen', 'que se muera',
  'que se vaya', 'que lo despidan', 'malparido',
  // Otros costa-ricanismos fuertes
  'jueputa', 'hpta', 'verga',
];

// ── Palabras que indican QUEJA SIN INSULTO → borderline ─────────────────
const NEGATIVE_KEYWORDS = [
  // Olor
  'olor feo', 'olía', 'olia', 'olor', 'apesta', 'apestoso', 'hediondo', 'feo',
  'oler', 'pestilencia',
  // Limpieza
  'sucio', 'sucia', 'cochino', 'mugriento', 'asqueroso',
  // Conducción
  'rápido', 'rapido', 'muy veloz', 'imprudente', 'peligroso', 'peligrosa',
  'brusco', 'brusca', 'mal manejo', 'maneja mal', 'no respetó', 'no respeto',
  'casi nos chocamos', 'casi nos mata', 'asusté', 'asuste', 'me asustó', 'me asusto',
  'inseguro', 'insegura', 'me sentí mal', 'me senti mal',
  // Puntualidad
  'tarde', 'llegó tarde', 'llego tarde', 'tardó mucho', 'tardo mucho', 'no llegó',
  'no llego', 'demoró', 'demoro', 'esperé mucho', 'espere mucho',
  // Comportamiento
  'maleducado', 'maleducada', 'grosero', 'grosera', 'descortés', 'descortes',
  'enojado', 'enojada', 'molesto', 'molesta', 'irrespetuoso', 'antipático',
  'antipatico', 'fastidioso', 'desagradable',
  // Servicio en general
  'mala experiencia', 'no me gustó', 'no me gusto', 'no volvería', 'no volveria',
  'no lo recomiendo', 'pésimo', 'pesimo', 'terrible', 'horrible',
  'incómodo', 'incomodo', 'incómoda', 'incomoda',
  // Habla mucho / molesto
  'habla mucho', 'hablador', 'fastidia', 'fastidió', 'fastidio',
];

// ── Palabras que indican comentario POSITIVO real → safe ───────────────
// (no las usamos para upgrade, solo para confirmar que es safe legítimo)
const POSITIVE_KEYWORDS = [
  'excelente', 'genial', 'increíble', 'increible', 'recomendado', 'recomiendo',
  'amable', 'puntual', 'limpio', 'agradable', 'cómodo', 'comodo', 'cómoda',
  'buena experiencia', 'todo bien', 'todo perfecto', 'buen viaje',
  'súper', 'super', 'gracias',
];

/**
 * Normaliza texto: lowercase + sin tildes para matching más flexible.
 */
function normalize(text) {
  if (!text) return '';
  return text
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

/**
 * ¿El comentario contiene alguna de las palabras de la lista?
 */
function containsAny(comment, wordList) {
  if (!comment) return false;
  const normalized = normalize(comment);
  return wordList.some(w => normalized.includes(normalize(w)));
}

/**
 * Reclasifica una categoría dada según el contenido del comentario.
 *
 * @param {string} backendCategory - "Satisfecho" | "Regular" | "Tóxica" | "Pendiente"
 * @param {string} comment - el texto de la reseña
 * @returns {{ category: string, color: string, overridden: boolean }}
 *
 * Si overridden=true, indica que el frontend cambió la categoría del backend.
 */
function reclassify(backendCategory, comment) {
  const cat = backendCategory || 'Pendiente';
  const noComment = !comment || !comment.trim();

  // Si está pendiente o sin comentario, respetamos el backend
  if (cat === 'Pendiente' || noComment) {
    return { category: cat, color: colorFor(cat), overridden: false };
  }

  // Si el backend dice 'Tóxica', respetamos (ya está bien clasificada)
  if (cat === 'Tóxica') {
    return { category: cat, color: colorFor(cat), overridden: false };
  }

  // El backend dice 'Satisfecho' o 'Regular'. Analizamos el comentario:
  const hasInsult = containsAny(comment, INSULT_WORDS);
  if (hasInsult) {
    return { category: 'Tóxica', color: colorFor('Tóxica'), overridden: true };
  }

  const hasNegative = containsAny(comment, NEGATIVE_KEYWORDS);
  if (hasNegative) {
    // Solo upgrade si era 'Satisfecho' (no si ya era 'Regular')
    if (cat === 'Satisfecho') {
      return { category: 'Regular', color: colorFor('Regular'), overridden: true };
    }
  }

  // Default: respetar lo que dice el backend
  return { category: cat, color: colorFor(cat), overridden: false };
}

function colorFor(category) {
  switch (category) {
    case 'Satisfecho': return '#16a34a';
    case 'Regular':    return '#eab308';
    case 'Tóxica':     return '#dc2626';
    default:           return '#94a3b8';
  }
}

module.exports = {
  reclassify,
  // Exports para tests
  _internals: {
    normalize,
    containsAny,
    colorFor,
    INSULT_WORDS,
    NEGATIVE_KEYWORDS,
    POSITIVE_KEYWORDS,
  },
};
