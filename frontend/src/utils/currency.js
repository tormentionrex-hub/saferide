// Formato único de montos en colones para toda la app. Se hace a mano, sin
// Intl, porque Hermes formatea distinto según el dispositivo y el locale y las
// pantallas mostraban "₡5 000", "₡5,022" y "₡5022" para el mismo tipo de dato.
export const formatCRC = (value) => {
    const n = Math.round(Number(value) || 0);
    const sign = n < 0 ? '-' : '';
    const digits = String(Math.abs(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return `${sign}₡${digits}`;
};
