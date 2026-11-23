// Escapa texto para insertarlo dentro del `html` (o `title`) de Swal.fire,
// que se interpretan como HTML. Sin esto, un nombre de usuario como
// `<img src=x onerror=...>` se ejecuta en la sesión del administrador.
const MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => MAP[c]);

export default escapeHtml;
