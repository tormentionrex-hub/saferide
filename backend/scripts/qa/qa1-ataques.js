// QA 1: ataques y robustez del backend de SafeRide (contra la base de prueba).
// Uso: BE=<ruta backend> node qa1-ataques.js
const path = require('path');
const BE = process.env.BE || path.resolve(__dirname, '..', '..');
require(BE + '/node_modules/dotenv').config({ path: BE + '/.env', quiet: true });
const jwt = require(BE + '/node_modules/jsonwebtoken');
const { DateTime } = require(BE + '/node_modules/luxon');
const mongoose = require(BE + '/node_modules/mongoose');

const base = 'http://localhost:8080/api/v1';
const tag = Date.now().toString(36);
const PW = 'Qa!Prueba1';
const results = [];

async function raw(method, p, { token, body, headers = {}, rawBody } = {}) {
  const h = { ...headers };
  if (token) h.Authorization = 'Bearer ' + token;
  let payload;
  if (rawBody !== undefined) { payload = rawBody; h['Content-Type'] = h['Content-Type'] || 'application/json'; }
  else if (body !== undefined) { payload = JSON.stringify(body); h['Content-Type'] = 'application/json'; }
  const r = await fetch(base + p, { method, headers: h, body: payload });
  const text = await r.text();
  let json = null; try { json = JSON.parse(text); } catch {}
  return { status: r.status, body: json, text, headers: r.headers };
}
const call = (method, p, token, body) => raw(method, p, { token, body });

function check(name, got, expected, extra = '') {
  const ok = Array.isArray(expected) ? expected.includes(got) : got === expected;
  results.push({ name, expected: Array.isArray(expected) ? expected.join('/') : expected, got, ok, extra });
}

async function register(type, suffix) {
  const email = `qa.${type}.${suffix}.${tag}@intel.com`;
  const r = await call('POST', '/auth/register', null, {
    name: `QA ${type} ${suffix}`, username: `qa_${type}_${suffix}_${tag}`, email, phone: '88880000',
    password: PW, company: 'Intel', work_schedule: '8-5', type,
  });
  if (r.status !== 201) throw new Error('register ' + type + ' ' + suffix + ': ' + r.status + ' ' + r.text.slice(0, 200));
  return { id: r.body.data.user._id || r.body.data.user.id, token: r.body.data.accessToken, refresh: r.body.data.refreshToken, email };
}

(async () => {
  await mongoose.connect('mongodb://127.0.0.1:27017/SafeRide-Prueba');
  const db = mongoose.connection.db;

  // ---------- actores ----------
  const pA = await register('pasajero', 'a');
  const pB = await register('pasajero', 'b');
  const dA = await register('conductor', 'a');
  const dB = await register('conductor', 'b');
  const adminLogin = await call('POST', '/auth/login', null, { email: 'naomy.admin@saferide.cr', password: 'SafeRide2024!' });
  const admin = { token: adminLogin.body?.data?.accessToken };
  check('setup: admin login', adminLogin.status, 200);

  // vehículos
  const vA = await call('POST', '/vehicles', dA.token, { brand: 'Toyota', model: 'Yaris', license_plate: 'QAA' + tag.slice(-3).toUpperCase().replace(/[^A-Z0-9]/g, '0'), color: 'Rojo', year: 2020, capacity: 4 });
  check('setup: vehículo conductor A', vA.status, 201, vA.text.slice(0, 120));
  const vehicleA = vA.body?.data?._id;
  const vB = await call('POST', '/vehicles', dB.token, { brand: 'Honda', model: 'Civic', license_plate: 'QAB' + tag.slice(-3).toUpperCase().replace(/[^A-Z0-9]/g, '0'), color: 'Azul', year: 2019, capacity: 4 });
  const vehicleB = vB.body?.data?._id;

  const now = DateTime.now().setZone('America/Costa_Rica');
  const today = now.toFormat('yyyy-MM-dd');
  const inHours = (h) => now.plus({ hours: h }).toFormat('HH:mm');
  const rideBody = (seats, hora) => ({
    origin: { name: 'San José centro', coordinates: { lat: 9.9325, lng: -84.0796 } },
    destination: { name: 'Intel Belén', coordinates: { lat: 9.9780, lng: -84.1900 } },
    fecha: today, hora: hora || inHours(2), available_seats: seats, distance_km: 15, duration_minutes: 30,
  });
  const rA = await call('POST', '/rides', dA.token, rideBody(3));
  check('setup: viaje conductor A', rA.status, 201, rA.text.slice(0, 160));
  const rideA = rA.body?.data?._id;

  // ---------- A. inyección y entrada malformada ----------
  let r;
  r = await call('POST', '/auth/login', null, { email: { $gt: '' }, password: { $gt: '' } });
  check('A1 login con operadores NoSQL', r.status, [400, 401]);
  r = await call('POST', '/auth/login', null, { email: ['a@b.com'], password: 'x' });
  check('A2 login con email como array', r.status, [400, 401]);
  r = await raw('POST', '/auth/login', { rawBody: '{"email": "x@y.com", ' });
  check('A3 JSON malformado', r.status, 400);
  r = await raw('POST', '/auth/login', { rawBody: 'x'.repeat(11 * 1024 * 1024) });
  check('A4 cuerpo de 11 MB', r.status, 413);
  r = await call('GET', '/rides?status[$ne]=x', pA.token);
  check('A5 operador NoSQL en query de viajes', r.status, [200, 400]);
  r = await call('GET', '/rides?limit=-5&page=0', pA.token);
  check('A6 limit negativo y page 0', r.status, [200, 400]);
  r = await call('GET', '/rides?limit=abc', pA.token);
  check('A7 limit no numérico', r.status, [200, 400]);
  r = await call('GET', '/rides?origin=abc', pA.token);
  check('A8 origin sin formato lat,lng', r.status, [200, 400]);
  r = await call('GET', '/users/notanid', pA.token);
  check('A9 ObjectId inválido', r.status, 400);
  r = await call('GET', '/bookings/000000000000000000000000', pA.token);
  check('A10 ObjectId inexistente', r.status, 404);
  r = await call('POST', '/auth/register', null, { name: 'Ab', username: 'ab', email: 'bad', phone: '123', password: '123', company: '' });
  check('A11 registro con todo inválido', r.status, 400);
  r = await call('POST', '/auth/register', null, { name: 'QA Mass', username: 'qa_mass_' + tag, email: `qa.mass.${tag}@intel.com`, phone: '88880001', password: PW, company: 'Intel', type: 'pasajero', trustScore: 0, isActive: false, rating: 1 });
  const massUser = await db.collection('users').findOne({ email: `qa.mass.${tag}@intel.com` });
  check('A12 registro ignora trustScore/isActive/rating', `${massUser?.trustScore}/${massUser?.isActive}/${massUser?.rating}`, '4/true/5');
  r = await call('POST', '/auth/register', null, { name: 'QA Gmail', username: 'qa_gmail_' + tag, email: `qa.gmail.${tag}@gmail.com`, phone: '88880002', password: PW, company: 'Intel' });
  check('A13 registro con correo personal (gmail)', r.status, [400, 403], 'la app lo bloquea; backend: ' + r.status);
  r = await call('POST', '/auth/register', null, { name: 'QA Dup', username: 'qa_dup_' + tag, email: pA.email, phone: '88880003', password: PW, company: 'Intel' });
  check('A14 registro con correo repetido', r.status, [400, 409]);
  r = await call('POST', '/auth/register', null, { name: 'QA Comp', username: 'qa_comp_' + tag, email: `qa.comp.${tag}@intel.com`, phone: '88880004', password: PW, company: 'Empresa Falsa' });
  check('A15 registro con empresa fuera de la lista', r.status, 400);

  // ---------- B. tokens ----------
  r = await call('GET', '/auth/me', null);
  check('B1 sin token', r.status, 401);
  r = await call('GET', '/auth/me', pA.token.slice(0, -3) + 'abc');
  check('B2 firma alterada', r.status, 401);
  const noneTok = Buffer.from('{"alg":"none","typ":"JWT"}').toString('base64url') + '.' + Buffer.from(JSON.stringify({ userId: pA.id, typ: 'access' })).toString('base64url') + '.';
  r = await call('GET', '/auth/me', noneTok);
  check('B3 alg none', r.status, 401);
  r = await call('GET', '/auth/me', jwt.sign({ userId: pA.id, typ: 'access' }, process.env.JWT_SECRET, { expiresIn: -10 }));
  check('B4 token expirado', r.status, 401);
  r = await call('GET', '/auth/me', jwt.sign({ userId: '000000000000000000000000', typ: 'access' }, process.env.JWT_SECRET, { expiresIn: '1h' }));
  check('B5 token de usuario inexistente', r.status, 401);
  r = await call('GET', '/auth/me', jwt.sign({ userId: pA.id, typ: 'access' }, 'secreto-equivocado', { expiresIn: '1h' }));
  check('B6 token firmado con otro secreto', r.status, 401);
  r = await raw('GET', '/auth/me', { headers: { Authorization: 'Basic abc' } });
  check('B7 esquema Basic', r.status, 401);

  // ---------- C. acceso a datos ajenos ----------
  r = await call('GET', `/users/${pB.id}`, pA.token);
  const leak = r.body?.data || {};
  check('C1 perfil ajeno no expone correo/teléfono', `${!!leak.email}/${!!leak.phone}/${!!leak.refreshToken}/${!!leak.password}`, 'false/false/false/false', 'status ' + r.status);
  r = await call('PUT', `/users/${pB.id}`, pA.token, { name: 'Hackeado QA' });
  check('C2 editar perfil ajeno', r.status, 403);
  r = await call('PUT', `/users/${pA.id}`, pA.token, { type: 'admin', trustScore: 4, isActive: true, rating: 5, email: 'otro@intel.com' });
  const selfDoc = await db.collection('users').findOne({ _id: new mongoose.Types.ObjectId(pA.id) });
  check('C3 asignación masiva en perfil propio', `${selfDoc.type}/${selfDoc.email === pA.email}`, 'pasajero/true');
  r = await call('PUT', '/users/profile', pA.token, { type: 'admin', trustScore: 4, isActive: false, password: 'x' });
  const selfDoc2 = await db.collection('users').findOne({ _id: new mongoose.Types.ObjectId(pA.id) });
  check('C4 asignación masiva en /users/profile', `${selfDoc2.type}/${selfDoc2.isActive}`, 'pasajero/true');
  r = await call('GET', `/users/${pB.id}/trust/history`, pA.token);
  check('C5 historial de confianza ajeno', r.status, 403);
  r = await call('PATCH', `/users/${pB.id}/trust`, pA.token, { trustScore: 0 });
  check('C6 cambiar confianza ajena', r.status, 403);
  r = await call('GET', '/users', pA.token);
  check('C7 listar usuarios sin ser admin', r.status, 403);
  r = await call('DELETE', `/users/${pB.id}`, pA.token);
  check('C8 desactivar usuario ajeno', r.status, 403);
  r = await call('PATCH', `/users/${pB.id}/activate`, pA.token);
  check('C9 activar usuario ajeno', r.status, 403);
  r = await call('GET', `/users/${pB.id}/stats`, pA.token);
  check('C10 estadísticas ajenas', r.status, [200, 403], 'status ' + r.status);
  r = await call('POST', '/notifications', pA.token, { user_id: pB.id, message: 'spam', type: 'system' });
  check('C11 crear notificación sin ser admin', r.status, 403);
  r = await call('POST', '/rides', pA.token, rideBody(2));
  check('C12 pasajero publica viaje', r.status, 403);
  r = await call('POST', '/vehicles', pA.token, { brand: 'X', model: 'Y', license_plate: 'QAC001', color: 'Z', year: 2020, capacity: 4 });
  check('C13 pasajero crea vehículo', r.status, 403);
  r = await call('GET', '/vehicles', pA.token);
  check('C14 listar vehículos sin ser admin', r.status, 403);
  r = await call('PUT', `/vehicles/${vehicleA}`, dB.token, { color: 'Negro' });
  check('C15 editar vehículo ajeno', r.status, 403);
  r = await call('DELETE', `/vehicles/${vehicleA}`, dB.token);
  check('C16 borrar vehículo ajeno', r.status, 403);
  r = await call('DELETE', `/vehicles/${vehicleA}`, pA.token);
  check('C17 pasajero borra vehículo', r.status, 403);
  r = await call('PATCH', `/vehicles/${vehicleA}/status`, dB.token, { isActive: false });
  check('C18 cambiar estado de vehículo ajeno', r.status, 403);
  r = await call('PUT', `/rides/${rideA}`, dB.token, { available_seats: 1 });
  check('C19 editar viaje ajeno', r.status, 403);
  r = await call('PATCH', `/rides/${rideA}/start`, dB.token);
  check('C20 iniciar viaje ajeno', r.status, 403);
  r = await call('PATCH', `/rides/${rideA}/cancel`, dB.token);
  check('C21 cancelar viaje ajeno', r.status, 403);
  r = await call('PATCH', `/rides/${rideA}/complete`, dB.token);
  check('C22 completar viaje ajeno', r.status, [400, 403]);
  r = await call('GET', `/bookings/ride/${rideA}`, pA.token);
  check('C23 pasajero lista reservas del viaje', r.status, 403);
  r = await call('GET', `/bookings/passenger/${pB.id}`, pA.token);
  check('C24 reservas de otro pasajero', r.status, 403);
  r = await call('GET', `/bookings?userId=${pB.id}`, pA.token);
  check('C25 filtro userId ajeno en /bookings', (r.body?.data || []).every(b => String(b.passenger_id?._id || b.passenger_id) === pA.id) ? 'solo propias' : 'ajenas', 'solo propias');
  r = await call('POST', '/location/update', pA.token, { rideId: rideA, lat: 9.9, lng: -84.1 });
  check('C26 pasajero envía GPS de un viaje', r.status, [400, 403]);
  r = await call('POST', '/location/update', dB.token, { lat: 9.9, lng: -84.1, inTrip: true });
  check('C27 otro conductor envía GPS del viaje', r.status, [400, 403]);
  r = await call('GET', `/location/${rideA}/driver`, pB.token);
  check('C28 ubicación del conductor sin reserva', r.status, [403, 404, 400]);
  r = await call('GET', `/metrics/user/${pB.id}`, pA.token);
  check('C29 métricas de otro usuario', r.status, [200, 403], 'status ' + r.status);
  r = await call('POST', `/metrics/calculate/${pB.id}`, pA.token);
  check('C30 recalcular métricas sin ser admin', r.status, 403);
  r = await call('GET', '/metrics/global', pA.token);
  check('C31 métricas globales sin ser admin', r.status, 403);
  r = await call('POST', '/auth/reset-password', null, { email: pB.email, code: '123456', newPassword: 'Nueva!Pass1' });
  check('C32 reset con código incorrecto', r.status, [400, 401]);
  r = await call('POST', '/auth/verify-code', null, { email: pB.email, code: '999999' });
  check('C33 verificar código incorrecto', r.status, [400, 401]);
  r = await call('PUT', '/auth/password', pA.token, { currentPassword: 'Incorrecta1!', newPassword: 'Nueva!Pass1' });
  check('C34 cambiar contraseña con la actual incorrecta', r.status, [400, 401, 403]);

  // ---------- D. reglas de negocio ----------
  r = await call('POST', '/bookings', dA.token, { ride_id: rideA, seats_booked: 1 });
  check('D1 conductor reserva su propio viaje', r.status, [400, 403]);
  r = await call('POST', '/bookings', pA.token, { ride_id: rideA, seats_booked: 0 });
  check('D2 reserva con 0 asientos', r.status, 400);
  r = await call('POST', '/bookings', pA.token, { ride_id: rideA, seats_booked: 9 });
  check('D3 reserva con 9 asientos', r.status, 400);
  r = await call('POST', '/bookings', pA.token, { ride_id: rideA, seats_booked: 4 });
  check('D4 reserva más asientos de los disponibles', r.status, 400);
  r = await call('POST', '/bookings', pA.token, { ride_id: rideA, offered_amount: -50 });
  check('D5 monto negativo', r.status, 400);
  r = await call('POST', '/bookings', pA.token, { ride_id: rideA, offered_amount: 'cien' });
  check('D6 monto no numérico', r.status, 400);
  r = await call('POST', '/bookings', pA.token, { ride_id: rideA, seats_booked: 1, offered_amount: 1500, passenger_origin: '<script>alert(1)</script>' });
  check('D7 reserva válida del pasajero A', r.status, 201, r.text.slice(0, 120));
  const bookingA = r.body?.data?._id;
  r = await call('POST', '/bookings', pA.token, { ride_id: rideA, seats_booked: 1 });
  check('D8 reserva duplicada del mismo viaje', r.status, [400, 409]);
  r = await call('PATCH', `/bookings/${bookingA}/status`, pA.token, { status: 'confirmed' });
  check('D9 pasajero se autoconfirma', r.status, [400, 403]);
  r = await call('PATCH', `/bookings/${bookingA}/status`, dB.token, { status: 'confirmed' });
  check('D10 otro conductor confirma reserva', r.status, 403);
  r = await call('PATCH', `/bookings/${bookingA}/status`, dA.token, { status: 'paid' });
  check('D11 estado inválido', r.status, 400);
  r = await call('PATCH', `/bookings/${bookingA}/payment`, pA.token, { payment_status: 'paid' });
  check('D12 pasajero se marca como pagado', r.status, 403);
  r = await call('GET', `/bookings/${bookingA}`, pB.token);
  check('D13 reserva ajena por id', r.status, 403);
  r = await call('DELETE', `/bookings/${bookingA}`, pB.token);
  check('D14 cancelar reserva ajena', r.status, 403);
  r = await call('PATCH', `/bookings/${bookingA}/status`, dA.token, { status: 'confirmed' });
  check('D15 conductor confirma reserva', r.status, 200, r.text.slice(0, 100));
  const rideDoc = await db.collection('rides').findOne({ _id: new mongoose.Types.ObjectId(rideA) });
  check('D16 asientos descontados al confirmar', rideDoc.available_seats, 2);
  r = await call('PATCH', `/rides/${rideA}/complete`, dA.token);
  check('D17 completar viaje sin iniciarlo', r.status, [400, 200], 'status ' + r.status);
  r = await call('POST', '/reviews/direct-submit', pA.token, { ride_id: rideA, reviewee_id: dA.id, rating: 5, comment: 'antes de terminar' });
  check('D18 reseña antes de completar el viaje', r.status, [400, 403]);
  r = await call('POST', '/reviews/direct-submit', pA.token, { ride_id: rideA, reviewee_id: pA.id, rating: 5 });
  check('D19 reseña a uno mismo', r.status, [400, 403]);
  r = await call('POST', '/reviews/direct-submit', pB.token, { ride_id: rideA, reviewee_id: dA.id, rating: 5 });
  check('D20 reseña sin haber viajado', r.status, [400, 403]);
  r = await call('POST', '/reviews/direct-submit', pA.token, { ride_id: rideA, reviewee_id: dA.id, rating: 9 });
  check('D21 rating 9', r.status, 400);
  r = await call('POST', '/rides', dA.token, rideBody(2, now.minus({ hours: 1 }).toFormat('HH:mm')));
  check('D22 viaje con hora pasada', r.status, 400);
  r = await call('POST', '/rides', dA.token, { ...rideBody(2), fecha: now.plus({ days: 1 }).toFormat('yyyy-MM-dd') });
  check('D23 viaje para mañana', r.status, [201, 400], 'regla actual: solo hoy; status ' + r.status);
  r = await call('POST', '/rides', dA.token, rideBody(8));
  check('D24 viaje con 8 asientos', r.status, 400);
  r = await call('POST', '/rides', dA.token, { ...rideBody(2), origin: { name: 'X', coordinates: { lat: 999, lng: 0 } } });
  check('D25 coordenadas imposibles', r.status, 400);
  r = await call('POST', '/vehicles', dA.token, { brand: 'X', model: 'Y', license_plate: 'QAD001', color: 'Z', year: 1800, capacity: 4 });
  check('D26 vehículo año 1800', r.status, 400);
  r = await call('POST', '/vehicles', dA.token, { brand: 'X', model: 'Y', license_plate: 'abc-12', color: 'Z', year: 2020, capacity: 4 });
  check('D27 placa con formato inválido', r.status, 400);
  r = await call('POST', '/vehicles', dB.token, { brand: 'X', model: 'Y', license_plate: vA.body?.data?.license_plate, color: 'Z', year: 2020, capacity: 4 });
  check('D28 placa repetida', r.status, [400, 409]);
  r = await call('POST', '/vehicles', dA.token, { brand: 'X', model: 'Y', license_plate: 'QAD002', color: 'Z', year: 2020, capacity: 50 });
  check('D29 vehículo con 50 asientos', r.status, [400, 201], 'status ' + r.status);
  r = await call('PUT', '/users/profile', pA.token, { phone: '1234567' });
  check('D30 teléfono de 7 dígitos', r.status, 400);
  r = await call('PUT', '/users/profile', pA.token, { company: 'Empresa Falsa' });
  check('D31 empresa fuera de la lista en perfil', r.status, 400);
  r = await call('PUT', '/users/profile', pA.token, { name: 'A' });
  check('D32 nombre de 1 letra', r.status, 400);

  // ---------- D2. carrera por el último asiento ----------
  const rR = await call('POST', '/rides', dB.token, rideBody(1, inHours(3)));
  const rideRace = rR.body?.data?._id;
  const racers = [];
  for (let i = 0; i < 4; i++) racers.push(await register('pasajero', 'race' + i));
  const bks = await Promise.all(racers.map(p => call('POST', '/bookings', p.token, { ride_id: rideRace, seats_booked: 1 })));
  const confirms = await Promise.all(bks.map(b => call('PATCH', `/bookings/${b.body?.data?._id}/status`, dB.token, { status: 'confirmed' })));
  const confirmedCount = confirms.filter(c => c.status === 200).length;
  const raceDoc = await db.collection('rides').findOne({ _id: new mongoose.Types.ObjectId(rideRace) });
  check('D33 carrera: confirmaciones paralelas en viaje de 1 asiento', `${confirmedCount} confirmadas, asientos=${raceDoc.available_seats}`, '1 confirmadas, asientos=0');
  const seatsBurst = await Promise.all(racers.slice(1).map(p => call('POST', '/bookings', p.token, { ride_id: rideRace, seats_booked: 1 })));
  check('D34 reservar con el viaje lleno', seatsBurst.map(s => s.status).join(','), ['400,400,400', '409,409,409'], 'status ' + seatsBurst.map(s => s.status).join(','));

  // ---------- E. sesiones ----------
  r = await call('POST', '/auth/logout', pB.token);
  r = await call('POST', '/auth/refresh', null, { refreshToken: pB.refresh });
  check('E1 refresh después de logout', r.status, 401);
  r = await call('GET', '/auth/me', pB.token);
  check('E2 access token sigue válido tras logout (hasta expirar)', r.status, [200, 401], 'status ' + r.status + ' (JWT sin lista negra)');

  // ---------- F. cabeceras y superficie ----------
  r = await raw('GET', '/health', {});
  check('F1 x-powered-by oculto', r.headers.get('x-powered-by') === null ? 'oculto' : 'visible', 'oculto');
  check('F2 x-content-type-options', r.headers.get('x-content-type-options'), 'nosniff');
  r = await raw('GET', '/health', { headers: { Origin: 'https://malo.example' } });
  check('F3 CORS a origen desconocido (dev: *, prod: cerrado sin CORS_ORIGIN)', r.headers.get('access-control-allow-origin') || 'sin cabecera', process.env.NODE_ENV === 'production' ? ['sin cabecera'] : ['*', 'sin cabecera']);
  r = await raw('GET', '/no-existe', {});
  check('F4 ruta inexistente', r.status, 404);
  r = await call('GET', '/users/notanid', pA.token);
  check('F5 error sin stack en la respuesta', r.body && 'stack' in r.body ? 'con stack' : 'sin stack', 'sin stack', 'NODE_ENV=' + process.env.NODE_ENV);
  r = await fetch('http://localhost:8080/api-docs/');
  check('F6 swagger expuesto', r.status, [200, 404], 'status ' + r.status + ' (documentar: cerrar en producción)');
  r = await fetch('http://localhost:8080/api/v1/jobs/run/calculateMetrics', { method: 'POST' });
  check('F7 jobs/run solo existe en dev', r.status, process.env.NODE_ENV === 'production' ? [404] : [400, 404, 200]);

  // ---------- G. datos con XSS almacenado ----------
  const bDoc = await db.collection('bookings').findOne({ _id: new mongoose.Types.ObjectId(bookingA) });
  check('G1 texto con <script> almacenado tal cual', bDoc?.passenger_origin?.includes('<script>') ? 'almacenado' : 'limpio', ['limpio', 'almacenado'], 'RN no ejecuta HTML; el panel web sí renderiza texto: ' + (bDoc?.passenger_origin || ''));

  // ---------- limpieza ----------
  const emails = [pA, pB, dA, dB, ...racers].map(u => u.email).concat([`qa.mass.${tag}@intel.com`]);
  const users = await db.collection('users').find({ email: { $in: emails } }).toArray();
  const ids = users.map(u => u._id);
  await db.collection('bookings').deleteMany({ $or: [{ passenger_id: { $in: ids } }, { ride_id: { $in: [rideA, rideRace].filter(Boolean).map(x => new mongoose.Types.ObjectId(x)) } }] });
  await db.collection('rides').deleteMany({ driver_id: { $in: ids } });
  await db.collection('vehicles').deleteMany({ driver_id: { $in: ids } });
  await db.collection('reviews').deleteMany({ $or: [{ reviewer_id: { $in: ids } }, { reviewee_id: { $in: ids } }] });
  await db.collection('notifications').deleteMany({ user_id: { $in: ids } });
  await db.collection('users').deleteMany({ _id: { $in: ids } });

  // ---------- informe ----------
  const fails = results.filter(x => !x.ok);
  console.log(`\n${results.length} casos, ${results.length - fails.length} OK, ${fails.length} FALLOS\n`);
  for (const x of results) console.log(`${x.ok ? 'OK  ' : 'FAIL'} ${x.name} -> esperado ${x.expected}, obtenido ${x.got}${x.extra ? '  [' + x.extra + ']' : ''}`);
  await mongoose.disconnect();
})().catch(e => { console.error('ERROR', e); process.exit(1); });
