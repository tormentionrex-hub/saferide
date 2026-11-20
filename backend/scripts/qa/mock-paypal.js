// Mock local de la API de PayPal para las pruebas de captura de qa1 (bloque H1).
// Uso: node scripts/qa/mock-paypal.js  (escucha en 127.0.0.1:8099) y el backend
// de prueba arrancado con PAYPAL_API_BASE=http://127.0.0.1:8099. Luego
// QA_PAYPAL_MOCK=1 en qa1 activa los casos que lo necesitan.
//
// La respuesta de /v2/checkout/orders/<ID>/capture depende del prefijo del ID;
// el resto del ID es el _id de la reserva en mayúsculas (así el mock sabe qué
// reference_id devolver):
//   GOOD   -> COMPLETED, reserva correcta, monto alto (cubre cualquier viaje)
//   CHEAP  -> COMPLETED, reserva correcta, 0.01 USD
//   NOREF  -> COMPLETED sin purchase_units (como la respuesta de un reembolso)
//   OTHER  -> COMPLETED con el reference_id de otra reserva
//   WRONG  -> COMPLETED pero de otra orden (id distinto)
//   CRC    -> COMPLETED, monto en colones y no en USD
//   PEND   -> orden COMPLETED pero la captura en PENDING (fondos sin acreditar)
// Cualquier ruta que no sea la de captura se registra en MOCK_HITS (para ver
// si el backend llegó a llamar otra operación).
const http = require('http');
const hits = [];
http.createServer((req, res) => {
  hits.push(req.method + ' ' + req.url);
  res.setHeader('Content-Type', 'application/json');
  if (req.url === '/__hits') return res.end(JSON.stringify(hits));
  if (req.url.startsWith('/v1/oauth2/token')) return res.end(JSON.stringify({ access_token: 'mock' }));
  const m = req.url.match(/^\/v2\/checkout\/orders\/([A-Z]+?)([0-9A-F]{24})\/capture$/);
  if (!m) return res.end(JSON.stringify({ id: 'X', status: 'COMPLETED' }));
  const [, kind, hex] = m;
  const orderId = kind + hex;
  const ref = hex.toLowerCase();
  const unit = (refId, value, currency = 'USD') => ([{
    reference_id: refId,
    payments: { captures: [{ id: 'CAP' + hex, status: 'COMPLETED', amount: { currency_code: currency, value } }] },
  }]);
  const body = {
    GOOD: { id: orderId, status: 'COMPLETED', purchase_units: unit(ref, '1000.00') },
    CHEAP: { id: orderId, status: 'COMPLETED', purchase_units: unit(ref, '0.01') },
    NOREF: { id: orderId, status: 'COMPLETED' },
    OTHER: { id: orderId, status: 'COMPLETED', purchase_units: unit('000000000000000000000000', '1000.00') },
    WRONG: { id: 'OTRAORDEN123', status: 'COMPLETED', purchase_units: unit(ref, '1000.00') },
    CRC: { id: orderId, status: 'COMPLETED', purchase_units: unit(ref, '5000.00', 'CRC') },
    PEND: { id: orderId, status: 'COMPLETED', purchase_units: unit(ref, '1000.00').map((u) => ({ ...u, payments: { captures: [{ ...u.payments.captures[0], status: 'PENDING' }] } })) },
  }[kind] || { status: 'DECLINED' };
  res.end(JSON.stringify(body));
}).listen(8099, '127.0.0.1', () => console.log('mock PayPal en 127.0.0.1:8099'));
