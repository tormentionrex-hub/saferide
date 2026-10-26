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
