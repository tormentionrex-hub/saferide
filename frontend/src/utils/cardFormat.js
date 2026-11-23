// Formato del formulario de tarjeta del checkout. Funciones puras para poder
// probarlas sin montar la pantalla.

export const onlyDigits = (v) => String(v || '').replace(/\D/g, '');

// "4111111111111111" -> "4111 1111 1111 1111" (máximo 19 dígitos).
export const formatNumber = (v) => onlyDigits(v).slice(0, 19).replace(/(\d{4})(?=\d)/g, '$1 ');

// "1230" -> "12/30".
export const formatExpiry = (v) => {
    const d = onlyDigits(v).slice(0, 4);
    return d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d;
};

export const detectBrand = (number) => {
    const d = onlyDigits(number);
    if (/^4/.test(d)) return 'visa';
    if (/^(5[1-5]|2[2-7])/.test(d)) return 'mastercard';
    if (/^3[47]/.test(d)) return 'amex';
    return null;
};

// --- Validación en pantalla (los datos no se envían a ningún servidor) ---

// Algoritmo de Luhn: detecta números de tarjeta mal escritos.
export const luhnValid = (number) => {
    const d = onlyDigits(number);
    if (d.length < 12 || d.length > 19) return false;
    let sum = 0;
    for (let i = 0; i < d.length; i++) {
        let n = Number(d[d.length - 1 - i]);
        if (i % 2 === 1) { n *= 2; if (n > 9) n -= 9; }
        sum += n;
    }
    return sum % 10 === 0;
};

// Devuelve un mensaje por campo, o null si el campo es válido.
// now es inyectable para poder probar la caducidad.
export const validateCard = ({ number, name, expiry, cvc }, now = new Date()) => {
    const errors = {};
    if (!onlyDigits(number)) errors.number = 'Ingresa el número de la tarjeta.';
    else if (!luhnValid(number)) errors.number = 'El número de tarjeta no es válido.';

    const cleanName = String(name || '').trim();
    if (!cleanName) errors.name = 'Ingresa el nombre del titular.';
    else if (!/^[\p{L}][\p{L} '.-]*$/u.test(cleanName)) errors.name = 'Usa solo letras, espacios, apóstrofo o guion.';

    const m = /^(\d{2})\/(\d{2})$/.exec(String(expiry || ''));
    if (!m) errors.expiry = 'Usa el formato MM/AA.';
    else {
        const month = Number(m[1]); const year = 2000 + Number(m[2]);
        if (month < 1 || month > 12) errors.expiry = 'El mes debe estar entre 01 y 12.';
        else if (year < now.getFullYear() || (year === now.getFullYear() && month < now.getMonth() + 1)) errors.expiry = 'La tarjeta está vencida.';
    }

    const brand = detectBrand(number);
    const cvcLen = brand === 'amex' ? 4 : 3;
    if (onlyDigits(cvc).length !== cvcLen) errors.cvc = `El CVC debe tener ${cvcLen} dígitos.`;
    return errors;
};
