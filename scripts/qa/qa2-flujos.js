const path = require('path');
// QA 2: flujos de negocio completos por API (base de prueba).
// Uso: BE=<ruta backend> node qa2-flujos.js
const BE = process.env.BE || path.resolve(__dirname, '..', '..');
require(BE + '/node_modules/dotenv').config({ path: BE + '/.env', quiet: true });
const { DateTime } = require(BE + '/node_modules/luxon');
const mongoose = require(BE + '/node_modules/mongoose');

const base = 'http://localhost:8080/api/v1';
const tag = Date.now().toString(36);
const PW = 'Qa!Prueba1';
const results = [];
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function call(method, p, token, body) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  const r = await fetch(base + p, { method, headers: h, body: body !== undefined ? JSON.stringify(body) : undefined });
  const text = await r.text(); let json = null; try { json = JSON.parse(text); } catch {}
  return { status: r.status, body: json, text };
}
function check(name, got, expected, extra = '') {
  const ok = Array.isArray(expected) ? expected.includes(got) : got === expected;
  results.push({ name, expected: Array.isArray(expected) ? expected.join('/') : expected, got, ok, extra });
}
async function register(type, suffix) {
  const email = `qa2.${type}.${suffix}.${tag}@intel.com`;
  const r = await call('POST', '/auth/register', null, { name: `QA2 ${type} ${suffix}`, username: `qa2_${type}_${suffix}_${tag}`, email, phone: '88881111', password: PW, company: 'Intel', work_schedule: '8-5', type });
  if (r.status !== 201) throw new Error('register: ' + r.text.slice(0, 200));
  return { id: r.body.data.user._id || r.body.data.user.id, token: r.body.data.accessToken, refresh: r.body.data.refreshToken, email, name: `QA2 ${type} ${suffix}` };
}
const notifTypes = async (token) => ((await call('GET', '/notifications?limit=100', token)).body?.data || []).map(n => n.type);

(async () => {
  await mongoose.connect('mongodb://127.0.0.1:27017/SafeRide-Prueba');
  const db = mongoose.connection.db;
  const oid = (x) => new mongoose.Types.ObjectId(x);
  const now = DateTime.now().setZone('America/Costa_Rica');
  const today = now.toFormat('yyyy-MM-dd');
  const inH = (h) => now.plus({ hours: h }).toFormat('HH:mm');
  const rideBody = (seats, h = 2) => ({ origin: { name: 'San José centro', coordinates: { lat: 9.9325, lng: -84.0796 } }, destination: { name: 'Intel Belén', coordinates: { lat: 9.978, lng: -84.19 } }, fecha: today, hora: inH(h), available_seats: seats, distance_km: 15, duration_minutes: 30 });

  // ---------- 0. verificación por correo (dev: código maestro) ----------
  let r = await call('POST', '/auth/send-verification-code', null, { email: `qa2.verif.${tag}@intel.com` });
  check('0.1 enviar código', r.status, 200);
  r = await call('POST', '/auth/verify-code', null, { email: `qa2.verif.${tag}@intel.com`, code: '000000' });
  check('0.2 verificar código maestro (dev)', r.status, 200);
  const realCode = await db.collection('verificationcodes').findOne({ email: `qa2.verif.${tag}@intel.com` });
  r = await call('POST', '/auth/verify-code', null, { email: `qa2.verif.${tag}@intel.com`, code: realCode?.code || '111111' });
  check('0.3 verificar código real', r.status, 200, 'código en BD: ' + !!realCode);
  r = await call('POST', '/auth/verify-code', null, { email: `qa2.verif.${tag}@intel.com`, code: realCode?.code || '111111' });
  check('0.4 reutilizar el mismo código', r.status, [400, 401, 410], 'status ' + r.status);

  // ---------- 1. actores ----------
  const D = await register('conductor', 'd');
  const P1 = await register('pasajero', 'p1');
  const P2 = await register('pasajero', 'p2');
  const P3 = await register('pasajero', 'p3');
  const X = await register('pasajero', 'x');
  r = await call('POST', '/vehicles', D.token, { brand: 'Toyota', model: 'Corolla', license_plate: ('Q2' + tag).slice(0, 6).toUpperCase().replace(/[^A-Z0-9]/g, '0'), color: 'Gris', year: 2021, capacity: 4 });
  check('1.1 vehículo', r.status, 201);
  r = await call('GET', `/vehicles/driver/${D.id}`, P1.token);
  check('1.2 pasajero ve el vehículo del conductor', r.status, 200);

  // ---------- 2. publicar, reservar, confirmar ----------
  r = await call('POST', '/rides', D.token, rideBody(3));
  check('2.1 publicar viaje', r.status, 201);
  const ride = r.body.data._id;
  r = await call('GET', `/rides?origin=9.93,-84.08&destination=9.97,-84.19&date=${today}`, P1.token);
  check('2.2 el pasajero encuentra el viaje al buscar', (r.body?.data || []).some(x => x._id === ride), true);
  const b1 = (await call('POST', '/bookings', P1.token, { ride_id: ride, seats_booked: 1, offered_amount: 2000, payment_method: 'cash' })).body.data;
  const b2 = (await call('POST', '/bookings', P2.token, { ride_id: ride, seats_booked: 1, offered_amount: 2000, payment_method: 'sinpe' })).body.data;
  const b3 = (await call('POST', '/bookings', P3.token, { ride_id: ride, seats_booked: 1, offered_amount: 2000 })).body.data;
  check('2.3 tres solicitudes creadas', [b1, b2, b3].every(b => b?.status === 'pending'), true);
  check('2.4 conductor notificado de solicitudes', (await notifTypes(D.token)).filter(t => t === 'booking_pending').length, 3);
  r = await call('GET', `/bookings/ride/${ride}`, D.token);
  check('2.5 conductor ve las 3 solicitudes', (r.body?.data || []).length, 3);
  r = await call('PATCH', `/bookings/${b1._id}/status`, D.token, { status: 'confirmed' });
  check('2.6 confirmar P1', r.status, 200);
  r = await call('PATCH', `/bookings/${b2._id}/status`, D.token, { status: 'confirmed' });
  check('2.7 confirmar P2', r.status, 200);
  r = await call('PATCH', `/bookings/${b3._id}/status`, D.token, { status: 'deny' });
  check('2.8 rechazar P3', r.status, 200);
  check('2.9 asientos 3 -> 1', (await db.collection('rides').findOne({ _id: oid(ride) })).available_seats, 1);
  check('2.10 P1 notificado de confirmación', (await notifTypes(P1.token)).includes('booking_confirmed'), true);
  check('2.11 P3 notificado del rechazo', (await notifTypes(P3.token)).includes('booking_denied'), true);
  r = await call('POST', '/bookings', P3.token, { ride_id: ride, seats_booked: 1 });
  check('2.12 P3 vuelve a solicitar tras rechazo', r.status, [200, 201], 'status ' + r.status);
  const b3b = r.body?.data?._id || b3._id;

  // ---------- 3. iniciar viaje ----------
  r = await call('PATCH', `/rides/${ride}/start`, D.token);
  check('3.1 iniciar viaje', r.status, 200);
  check('3.2 estado in progress', (await db.collection('rides').findOne({ _id: oid(ride) })).status, 'in progress');
  r = await call('PATCH', `/rides/${ride}/start`, D.token);
  check('3.3 iniciar dos veces', r.status, 400);
  check('3.4 pasajeros notificados del inicio', (await notifTypes(P1.token)).includes('ride_started') && (await notifTypes(P2.token)).includes('ride_started'), true);
  const pend = await db.collection('bookings').findOne({ _id: oid(b3b) });
  check('3.5 solicitud pendiente al iniciar queda resuelta', pend.status, ['deny', 'cancelled', 'canceled'], 'estado real: ' + pend.status);
  r = await call('POST', '/location/update', D.token, { lat: 9.94, lng: -84.1, inTrip: true });
  check('3.6 conductor envía GPS', r.status, 200);
  r = await call('GET', `/location/${ride}/driver`, P1.token);
  check('3.7 P1 lee la ubicación', r.status, 200, JSON.stringify(r.body?.location || {}));
  r = await call('GET', `/location/${ride}/driver`, X.token);
  check('3.8 ajeno no lee la ubicación', r.status, 403);
  r = await call('DELETE', `/bookings/${b2._id}`, P2.token);
  check('3.9 pasajero se baja del viaje en curso sin pagar', r.status, [400, 403], 'status ' + r.status);
  const b2mid = await db.collection('bookings').findOne({ _id: oid(b2._id) });
  check('3.10 reserva de P2 sigue confirmada en curso', b2mid.status, 'confirmed', 'payment=' + b2mid.payment_status);
  r = await call('POST', '/rides', D.token, rideBody(2, 3));
  check('3.11 publicar otro viaje con uno en curso -> 409 ACTIVE_RIDE', r.status, 409, 'status ' + r.status + ' (' + (r.body?.message || '') + ')');
  r = await call('DELETE', `/bookings/${b2._id}?if_status=pending`, P2.token);
  check('3.11b cancelar con if_status=pending una reserva ya confirmada -> 409 STATUS_CHANGED', r.body?.code || r.status, 'STATUS_CHANGED', 'status ' + r.status);
  const ride2 = r.body?.data?._id;

  // ---------- 4. finalizar y pagos ----------
  r = await call('PATCH', `/rides/${ride}/complete`, D.token);
  check('4.1 finalizar viaje', r.status, 200);
  check('4.2 estado awaiting_payment_verification', (await db.collection('rides').findOne({ _id: oid(ride) })).status, 'awaiting_payment_verification');
  r = await call('PATCH', `/rides/${ride}/complete`, D.token);
  check('4.3 finalizar dos veces (idempotente)', r.status, 200);
  r = await call('PATCH', `/bookings/${b1._id}/payment`, D.token, { payment_status: 'paid' });
  check('4.4 marcar P1 pagado', r.status, 200);
  r = await call('PATCH', `/bookings/${b2._id}/payment`, D.token, { payment_status: 'pending' });
  check('4.5 marcar P2 no pagó', r.status, 200);
  r = await call('PATCH', `/bookings/${b1._id}/payment`, D.token, { payment_status: 'pending' });
  check('4.6 revertir un pago confirmado', r.status, 400);
  r = await call('PATCH', `/rides/${ride}/finalize-payment-verification`, D.token);
  check('4.7 cerrar verificación de pagos', r.status, 200);
  const rideDone = await db.collection('rides').findOne({ _id: oid(ride) });
  check('4.8 viaje completado', rideDone.status, 'completed');
  const b1d = await db.collection('bookings').findOne({ _id: oid(b1._id) });
  check('4.9 reserva completada con distancia y revisión', `${b1d.status}/${b1d.distance_km > 0}/${!!b1d.payment_reviewed_at}`, 'completed/true/true');
  r = await call('PATCH', `/rides/${ride}/finalize-payment-verification`, D.token);
  check('4.10 cerrar dos veces (idempotente)', r.status, 200);
  check('4.11 notificación de viaje finalizado', (await notifTypes(P1.token)).includes('ride_completed'), true);
  r = await call('GET', '/bookings/driver/me?rideStatus=completed', D.token);
  check('4.12 reservas del conductor (completadas)', (r.body?.data || []).filter(b => b.status === 'completed').length, 2);
  r = await call('GET', `/bookings/passenger/${P2.id}`, P2.token);
  check('4.13 P2 ve su cobro pendiente', (r.body?.data || []).some(b => b._id === b2._id && b.payment_status === 'pending' && b.status === 'completed'), true);
  r = await call('POST', '/bookings', P2.token, { ride_id: ride2, seats_booked: 1 });
  check('4.14 P2 con cobro pendiente intenta reservar otro viaje', r.status, [201, 400, 403], 'status ' + r.status + ' (la app lo bloquea en cliente)');

  // ---------- 5. reseñas y calificaciones ----------
  r = await call('POST', '/reviews/direct-submit', P1.token, { ride_id: ride, reviewee_id: D.id, rating: 4, comment: 'Buen viaje' });
  check('5.1 P1 reseña al conductor', r.status, 201, r.text.slice(0, 100));
  r = await call('POST', '/reviews/direct-submit', P1.token, { ride_id: ride, reviewee_id: D.id, rating: 1 });
  check('5.2 reseña repetida', r.status, 409);
  r = await call('POST', '/reviews/direct-submit', D.token, { ride_id: ride, reviewee_id: P1.id, rating: 5 });
  check('5.3 conductor reseña a P1', r.status, 201);
  r = await call('POST', '/reviews/direct-submit', P2.token, { ride_id: ride, reviewee_id: D.id, rating: 2, comment: 'x'.repeat(600) });
  check('5.4 comentario de 600 caracteres', r.status, 400);
  r = await call('POST', '/reviews/direct-submit', P2.token, { ride_id: ride, reviewee_id: D.id, rating: 2 });
  check('5.5 P2 reseña al conductor', r.status, 201);
  const dDoc = await db.collection('users').findOne({ _id: oid(D.id) });
  check('5.6 calificación del conductor = promedio (4+2)/2', dDoc.rating, 3);
  r = await call('GET', `/reviews/user/${D.id}`, P3.token);
  check('5.7 reseñas públicas del conductor', (r.body?.data || []).length, 2);
  r = await call('GET', `/users/${D.id}`, P3.token);
  check('5.8 ficha pública del conductor con rating', r.body?.data?.rating, 3);
  r = await call('POST', '/reviews/direct-submit', P3.token, { ride_id: ride, reviewee_id: D.id, rating: 5 });
  check('5.9 P3 (rechazado) no puede reseñar', r.status, [400, 403]);

  // ---------- 6. métricas ----------
  await sleep(1500);
  r = await call('GET', `/metrics/user/${D.id}?role=conductor`, D.token);
  check('6.1 métricas del conductor', r.status, 200, JSON.stringify(r.body?.data || {}).slice(0, 160));
  r = await call('GET', `/metrics/user/${P1.id}?role=pasajero`, P1.token);
  check('6.2 métricas del pasajero', r.status, 200, JSON.stringify(r.body?.data || {}).slice(0, 160));
  r = await call('GET', '/metrics/leaderboard', null);
  check('6.3 leaderboard público', r.status, 200);
  r = await call('GET', `/users/${D.id}/stats`, D.token);
  check('6.4 stats del conductor', r.status, 200, JSON.stringify(r.body?.data || {}).slice(0, 160));

  // ---------- 7. cancelaciones ----------
  const rC = (await call('POST', '/rides', D.token, rideBody(2, 4))).body?.data;
  const bc1 = (await call('POST', '/bookings', P1.token, { ride_id: rC._id, seats_booked: 1, offered_amount: 1000 })).body.data;
  const bc2 = (await call('POST', '/bookings', P3.token, { ride_id: rC._id, seats_booked: 1, offered_amount: 1000 })).body.data;
  await call('PATCH', `/bookings/${bc1._id}/status`, D.token, { status: 'confirmed' });
  await call('PATCH', `/bookings/${bc2._id}/status`, D.token, { status: 'confirmed' });
  check('7.1 asientos 2 -> 0', (await db.collection('rides').findOne({ _id: oid(rC._id) })).available_seats, 0);
  r = await call('PATCH', `/bookings/${bc1._id}/canceled`, P1.token);
  check('7.2 P1 cancela reserva confirmada', r.status, 200);
  check('7.3 asiento devuelto', (await db.collection('rides').findOne({ _id: oid(rC._id) })).available_seats, 1);
  check('7.4 conductor notificado de la cancelación', (await notifTypes(D.token)).includes('booking_cancelled'), true);
  r = await call('PATCH', `/bookings/${bc2._id}/status`, P3.token, { status: 'cancelled', apply_penalty: true });
  check('7.5 P3 cancela con penalización', r.status, 200, r.text.slice(0, 120));
  const bc2d = await db.collection('bookings').findOne({ _id: oid(bc2._id) });
  check('7.6 cobro reducido a la mitad', bc2d.charged_amount, 500, 'offered=' + bc2d.offered_amount + ' charged=' + bc2d.charged_amount + ' payment=' + bc2d.payment_status);
  r = await call('PATCH', `/bookings/${bc2._id}/status`, P3.token, { status: 'cancelled', apply_penalty: true });
  check('7.7 penalización dos veces', r.status, [400, 403, 409], 'status ' + r.status);
  const dTrustBefore = (await db.collection('users').findOne({ _id: oid(D.id) })).trustScore;
  r = await call('PATCH', `/rides/${rC._id}/cancel`, D.token);
  check('7.8 conductor cancela el viaje', r.status, 200);
  const dTrustAfter = (await db.collection('users').findOne({ _id: oid(D.id) })).trustScore;
  check('7.9 TrustScore del conductor al cancelar programado', `${dTrustBefore}->${dTrustAfter}`, [`${dTrustBefore}->${dTrustBefore}`, `${dTrustBefore}->${dTrustBefore - 1}`], 'regla: solo penaliza en curso');
  r = await call('PATCH', `/rides/${rC._id}/cancel`, D.token);
  check('7.10 cancelar viaje cancelado', r.status, 400);
  r = await call('PATCH', `/rides/${rC._id}/start`, D.token);
  check('7.11 iniciar viaje cancelado', r.status, 400);

  // ---------- 8. viaje sin pasajeros y cancelación en curso ----------
  const rE = (await call('POST', '/rides', D.token, rideBody(2, 5))).body?.data;
  await call('PATCH', `/rides/${rE._id}/start`, D.token);
  r = await call('PATCH', `/rides/${rE._id}/complete`, D.token);
  await call('PATCH', `/rides/${rE._id}/finalize-payment-verification`, D.token);
  check('8.1 viaje sin pasajeros termina cancelado', (await db.collection('rides').findOne({ _id: oid(rE._id) })).status, 'cancelled');
  const rF = (await call('POST', '/rides', D.token, rideBody(2, 6))).body?.data;
  const bf = (await call('POST', '/bookings', P1.token, { ride_id: rF._id, seats_booked: 1, offered_amount: 1000 })).body.data;
  await call('PATCH', `/bookings/${bf._id}/status`, D.token, { status: 'confirmed' });
  await call('PATCH', `/rides/${rF._id}/start`, D.token);
  const t0 = (await db.collection('users').findOne({ _id: oid(D.id) })).trustScore;
  r = await call('PATCH', `/rides/${rF._id}/cancel`, D.token);
  const t1 = (await db.collection('users').findOne({ _id: oid(D.id) })).trustScore;
  check('8.2 conductor cancela viaje EN CURSO: TrustScore baja', `${t0}->${t1}`, `${t0}->${t0 - 1}`);
  check('8.3 pasajero notificado y reserva cancelada', (await db.collection('bookings').findOne({ _id: oid(bf._id) })).status, ['cancelled', 'canceled']);
  check('8.4 el conductor ya no puede enviar GPS', (await call('POST', '/location/update', D.token, { lat: 9.9, lng: -84.1, inTrip: true })).status, 403);

  // ---------- 9. notificaciones ----------
  r = await call('GET', '/notifications', P1.token);
  const n = r.body?.data?.[0];
  check('9.1 listar notificaciones', r.status, 200, (r.body?.data || []).length + ' notificaciones');
  r = await call('PATCH', `/notifications/${n._id}/read`, P1.token);
  check('9.2 marcar leída', r.status, 200);
  r = await call('PATCH', `/notifications/${n._id}/read`, P2.token);
  check('9.3 marcar leída una ajena', r.status, [403, 404]);
  r = await call('DELETE', `/notifications/${n._id}`, P2.token);
  check('9.4 borrar una ajena', r.status, [403, 404]);
  r = await call('PATCH', '/notifications/read-all', P1.token);
  check('9.5 marcar todas', r.status, 200);
  r = await call('GET', '/notifications', P1.token);
  check('9.6 ninguna sin leer', (r.body?.data || []).every(x => x.status === 'read'), true);
  r = await call('DELETE', `/notifications/${n._id}`, P1.token);
  check('9.7 borrar la propia', r.status, 200);

  // ---------- 10. sesión y contraseña ----------
  r = await call('PUT', '/auth/password', P1.token, { currentPassword: PW, newPassword: 'Nueva!Pass2' });
  check('10.1 cambiar contraseña', r.status, 200);
  r = await call('POST', '/auth/login', null, { email: P1.email, password: PW });
  check('10.2 contraseña vieja ya no entra', r.status, 401);
  r = await call('POST', '/auth/login', null, { email: P1.email, password: 'Nueva!Pass2' });
  check('10.3 contraseña nueva entra', r.status, 200);
  r = await call('POST', '/auth/refresh', null, { refreshToken: P1.refresh });
  check('10.4 refresh viejo tras cambiar contraseña', r.status, [200, 401], 'status ' + r.status + ' (sesiones previas siguen válidas)');
  r = await call('PATCH', '/auth/notification-preferences', P2.token, { optIn: false });
  check('10.5 apagar push', r.status, 200);
  r = await call('POST', '/auth/push-token', P2.token, { pushToken: 'ExponentPushToken[qa]' });
  check('10.6 registrar push token', r.status, 200);
  r = await call('GET', '/auth/me', P2.token);
  check('10.7 /me refleja optIn=false', r.body?.data?.user?.optIn ?? r.body?.data?.optIn, false, JSON.stringify(r.body?.data || {}).slice(0, 120));

  // ---------- 11. listados grandes (paginación) ----------
  const created = [];
  for (let i = 0; i < 12; i++) {
    const body = rideBody(1, 7);
    // Hora absoluta hacia atrás desde 23:54 para no cruzar medianoche si el script corre tarde (sigue necesitando correr antes de ~17:30).
    body.hora = now.set({ hour: 23, minute: 54 }).minus({ minutes: i * 6 }).toFormat('HH:mm');
    const cr = await call('POST', '/rides', D.token, body);
    created.push(cr.status + (cr.status !== 201 ? ':' + (cr.body?.message || cr.body?.errors?.[0]?.message || '') : ''));
  }
  check('11.0 creación de 12 viajes', created.filter(x => x === '201').length, 12, created.filter(x => x !== '201').join(' | ').slice(0, 200));
  const clash = rideBody(1, 7); clash.hora = now.set({ hour: 23, minute: 52 }).toFormat('HH:mm');
  const cl = await call('POST', '/rides', D.token, clash);
  check('11.0b viaje a 2 minutos de otro: conflicto de horario con 409', cl.status, 409, cl.body?.message || '');
  r = await call('GET', `/rides/driver/${D.id}`, D.token);
  check('11.1 /rides/driver sin limit devuelve 10 (la app manda limit=500)', (r.body?.data || []).length, 10);
  r = await call('GET', `/rides/driver/${D.id}?limit=500`, D.token);
  check('11.2 con limit=500 devuelve todos', (r.body?.data || []).length >= 15, true, (r.body?.data || []).length + ' viajes');
  r = await call('GET', `/rides/driver/${D.id}?status=scheduled&limit=500`, D.token);
  check('11.3 filtro por estado', (r.body?.data || []).every(x => x.status === 'scheduled'), true);

  // ---------- 12. eliminar cuenta con reserva/viaje abiertos ----------
  r = await call('DELETE', '/users/me', D.token, { password: PW });
  check('12.1 conductor con viajes programados no puede eliminar cuenta', r.status, 409);
  r = await call('DELETE', '/users/me', P2.token, { password: PW });
  check('12.2 pasajero con cobro pendiente no puede eliminar cuenta', r.status, 409);

  // ---------- limpieza ----------
  const emails = [D, P1, P2, P3, X].map(u => u.email);
  const users = await db.collection('users').find({ email: { $in: emails } }).toArray();
  const ids = users.map(u => u._id);
  const rides = await db.collection('rides').find({ driver_id: { $in: ids } }).toArray();
  await db.collection('bookings').deleteMany({ $or: [{ passenger_id: { $in: ids } }, { ride_id: { $in: rides.map(x => x._id) } }] });
  await db.collection('rides').deleteMany({ driver_id: { $in: ids } });
  await db.collection('vehicles').deleteMany({ driver_id: { $in: ids } });
  await db.collection('reviews').deleteMany({ $or: [{ reviewer_id: { $in: ids } }, { reviewee_id: { $in: ids } }] });
  await db.collection('notifications').deleteMany({ user_id: { $in: ids } });
  await db.collection('metrics').deleteMany({ user_id: { $in: ids } });
  await db.collection('trusthistories').deleteMany({ user_id: { $in: ids } });
  await db.collection('verificationcodes').deleteMany({ email: `qa2.verif.${tag}@intel.com` });
  await db.collection('users').deleteMany({ _id: { $in: ids } });

  const fails = results.filter(x => !x.ok);
  console.log(`\n${results.length} casos, ${results.length - fails.length} OK, ${fails.length} FALLOS\n`);
  for (const x of results) console.log(`${x.ok ? 'OK  ' : 'FAIL'} ${x.name} -> esperado ${x.expected}, obtenido ${x.got}${x.extra ? '  [' + x.extra + ']' : ''}`);
  await mongoose.disconnect();
})().catch(e => { console.error('ERROR', e); process.exit(1); });
