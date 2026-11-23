// Validación de nombres de persona, igual en registro y en edición de perfil.
// Acepta letras de cualquier alfabeto (con tildes, ñ, ü…), espacios, apóstrofo
// (O'Neil, D’Angelo), guion, punto y paréntesis (las cuentas de prueba usan
// el prefijo «(QA)»). Rechaza < > y caracteres de control, que
// el backend también rechaza (utils/safeText.js), y los mismos largos: 4–100.
export const NAME_MIN = 4;
export const NAME_MAX = 100;
const NAME_RE = /^[\p{L}\p{M} '’.()-]+$/u;
const HAS_LETTER = /\p{L}/u;

export const validatePersonName = (value) => {
    const name = String(value ?? '').trim();
    if (!name) return 'El nombre es requerido.';
    if (name.length < NAME_MIN) return `El nombre debe tener al menos ${NAME_MIN} caracteres.`;
    if (name.length > NAME_MAX) return `El nombre no puede superar ${NAME_MAX} caracteres.`;
    if (!NAME_RE.test(name) || !HAS_LETTER.test(name)) return "El nombre solo puede contener letras, espacios, apóstrofo ('), guion, punto o paréntesis.";
    return null;
};

export default validatePersonName;
