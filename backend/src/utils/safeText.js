// Campos de identidad (nombre, usuario, teléfono, empresa, marca, modelo,
// color...): no admiten '<', '>' ni caracteres de control. El panel y la app
// escapan al mostrar, pero un nombre como <img src=x onerror=...> no tiene
// ningún uso legítimo y viaja a correos, notificaciones push y exportaciones
// donde no siempre se escapa. Se aplica en dos capas: la validación de cada
// ruta y un validador en el modelo (por si otra ruta escribe el campo).
//
// Los textos libres (comentario de reseña, origen y destino de la reserva,
// mensajes) NO pasan por aquí: se guardan tal cual con tope de largo.
const UNSAFE_TEXT = /[<>\u0000-\u001F\u007F]/;

const isSafeText = (v) => typeof v === 'string' && !UNSAFE_TEXT.test(v);

const SAFE_TEXT_MESSAGE = 'No se permiten los caracteres < > ni caracteres de control';

// Validador para esquemas de Mongoose. Solo revisa el campo cuando se crea o
// se modifica: un dato viejo no impide guardar el documento por otro motivo
// (por ejemplo, el login actualiza el refresh token con save()).
const safeTextValidator = (field) => ({
  validator: function (v) {
    if (v === null || v === undefined) return true;
    if (this && typeof this.isModified === 'function' && !this.isNew && !this.isModified(field)) return true;
    return isSafeText(v);
  },
  message: SAFE_TEXT_MESSAGE,
});

// Para buscar texto con $regex: lo que manda el usuario se escapa y se busca
// literal. Sin esto, "a.*" o "(a+)+$" llegaban como expresión regular a Mongo
// (resultados de más y riesgo de ReDoS).
const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

module.exports = { UNSAFE_TEXT, isSafeText, SAFE_TEXT_MESSAGE, safeTextValidator, escapeRegex };
