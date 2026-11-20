// QA 1: ataques y robustez del backend de SafeRide (contra la base de prueba).
// Uso: BE=<ruta backend> node qa1-ataques.js
const path = require('path');
const BE = process.env.BE || path.resolve(__dirname, '..', '..');
require(BE + '/node_modules/dotenv').config({ path: BE + '/.env', quiet: true });
const jwt = require(BE + '/node_modules/jsonwebtoken');
const { DateTime } = require(BE + '/node_modules/luxon');
const mongoose = require(BE + '/node_modules/mongoose');

// Destino parametrizable para correr contra otra instancia: QA_ORIGIN (por
// defecto el backend local en 8080) y QA_DB (por defecto SafeRide-Prueba).
const ORIGIN = process.env.QA_ORIGIN || 'http://localhost:8080';
const DB = process.env.QA_DB || 'SafeRide-Prueba';
const base = ORIGIN + '/api/v1';
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

// El registro exige un correo verificado (send-verification-code ->
// verify-code -> register, igual que la app). El código se lee de la base de
// prueba, así que no depende del código maestro de desarrollo.
let dbRef = null;
async function verifyEmail(email) {
  await call('POST', '/auth/send-verification-code', null, { email });
  const v = await dbRef.collection('verificationcodes').findOne({ email: email.toLowerCase(), verifiedAt: null, code: { $ne: '000000' } });
  const r = await call('POST', '/auth/verify-code', null, { email, code: v?.code || 'x' });
  if (r.status !== 200) throw new Error('verify-code ' + email + ': ' + r.status);
}
async function register(type, suffix) {
  const email = `qa.${type}.${suffix}.${tag}@intel.com`;
  await verifyEmail(email);
  const r = await call('POST', '/auth/register', null, {
    name: `(QA) ${type} ${suffix}`, username: `qa_${type}_${suffix}_${tag}`, email, phone: '88880000',
    password: PW, company: 'Intel', work_schedule: '8-5', type,
  });
  if (r.status !== 201) throw new Error('register ' + type + ' ' + suffix + ': ' + r.status + ' ' + r.text.slice(0, 200));
  return { id: r.body.data.user._id || r.body.data.user.id, token: r.body.data.accessToken, refresh: r.body.data.refreshToken, email };
}

(async () => {
  await mongoose.connect('mongodb://127.0.0.1:27017/' + DB);
  const db = mongoose.connection.db;
  dbRef = db;

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
  await verifyEmail(`qa.mass.${tag}@intel.com`);
  r = await call('POST', '/auth/register', null, { name: '(QA) Mass', username: 'qa_mass_' + tag, email: `qa.mass.${tag}@intel.com`, phone: '88880001', password: PW, company: 'Intel', type: 'pasajero', trustScore: 0, isActive: false, rating: 1 });
  const massUser = await db.collection('users').findOne({ email: `qa.mass.${tag}@intel.com` });
  check('A12 registro ignora trustScore/isActive/rating', `${massUser?.trustScore}/${massUser?.isActive}/${massUser?.rating}`, '4/true/5');
  r = await call('POST', '/auth/register', null, { name: '(QA) Gmail', username: 'qa_gmail_' + tag, email: `qa.gmail.${tag}@gmail.com`, phone: '88880002', password: PW, company: 'Intel' });
  check('A13 registro con correo personal (gmail)', r.status, [400, 403], 'la app lo bloquea; backend: ' + r.status);
  r = await call('POST', '/auth/register', null, { name: '(QA) Dup', username: 'qa_dup_' + tag, email: pA.email, phone: '88880003', password: PW, company: 'Intel' });
  check('A14 registro con correo repetido', r.status, [400, 409]);
  await verifyEmail(`qa.comp.${tag}@intel.com`);
  r = await call('POST', '/auth/register', null, { name: '(QA) Comp', username: 'qa_comp_' + tag, email: `qa.comp.${tag}@intel.com`, phone: '88880004', password: PW, company: 'Empresa Falsa' });
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
  r = await fetch(ORIGIN + '/api-docs/');
  check('F6 swagger expuesto', r.status, [200, 404], 'status ' + r.status + ' (documentar: cerrar en producción)');
  r = await fetch(ORIGIN + '/api/v1/jobs/run/calculateMetrics', { method: 'POST' });
  check('F7 jobs/run solo existe en dev', r.status, process.env.NODE_ENV === 'production' ? [404] : [400, 404, 200]);

  // ---------- G. datos con XSS almacenado ----------
  const bDoc = await db.collection('bookings').findOne({ _id: new mongoose.Types.ObjectId(bookingA) });
  check('G1 texto con <script> almacenado tal cual', bDoc?.passenger_origin?.includes('<script>') ? 'almacenado' : 'limpio', ['limpio', 'almacenado'], 'RN no ejecuta HTML; el panel web sí renderiza texto: ' + (bDoc?.passenger_origin || ''));

  // ---------- H. hallazgos de Centinela (2026-11-20): ataque original + variantes ----------
  // Cada hallazgo se ataca con su petición original y con variantes (otro tipo
  // de dato, otro operador, otro rol, otro endpoint que llega al mismo dato).
  const extra = [];
  const hReg = async (type, s) => { const u = await register(type, s); extra.push(u); return u; };
  const hp1 = await hReg('pasajero', 'h1');
  const hp2 = await hReg('pasajero', 'h2');
  const hp3 = await hReg('pasajero', 'h3');
  const hd1 = await hReg('conductor', 'h1');
  const oid = (x) => new mongoose.Types.ObjectId(x);
  const plate = 'QH' + tag.slice(-4).toUpperCase().replace(/[^A-Z0-9]/g, '0');
  const vH = (await call('POST', '/vehicles', hd1.token, { brand: 'Kia', model: 'Rio', license_plate: plate, color: 'Gris', year: 2021, capacity: 4 })).body?.data?._id;
  const rideH = (await call('POST', '/rides', hd1.token, rideBody(3, inHours(4)))).body?.data?._id;
  const bH1 = (await call('POST', '/bookings', hp1.token, { ride_id: rideH, seats_booked: 1, offered_amount: 2000 })).body?.data?._id;
  const bH2 = (await call('POST', '/bookings', hp2.token, { ride_id: rideH, seats_booked: 1, offered_amount: 3000 })).body?.data?._id;
  await call('PATCH', `/bookings/${bH1}/status`, hd1.token, { status: 'confirmed', payment_status: 'pending' });
  await call('PATCH', `/bookings/${bH2}/status`, hd1.token, { status: 'confirmed', payment_status: 'pending' });
  check('H0 preparación del bloque H', `${!!vH}/${!!rideH}/${!!bH1}/${!!bH2}`, 'true/true/true/true');

  // H1 PayPal: el orderId se pegaba en la URL de la API de PayPal (con el token
  // del comercio). "../../payments/captures/X/refund" ejecutaba un reembolso y
  // la respuesta COMPLETED marcaba la reserva como pagada.
  const cap = (token, body) => call('POST', '/paypal/capture-order', token, body);
  r = await cap(hp1.token, { orderId: '../../payments/captures/CAPTURA/refund?x=', bookingId: bH1 });
  check('H1a captura con ../ en orderId (ataque original)', r.status, 400);
  r = await cap(hp1.token, { orderId: '%2E%2E%2F%2E%2E%2Fpayments%2Fcaptures%2FX%2Frefund', bookingId: bH1 });
  check('H1b orderId con ../ codificado en URL', r.status, 400);
  r = await cap(hp1.token, { orderId: 'ABCDEFGH12/../../x', bookingId: bH1 });
  check('H1c orderId válido seguido de /..', r.status, 400);
  r = await cap(hp1.token, { orderId: 'abcdefgh1234', bookingId: bH1 });
  check('H1d orderId en minúsculas', r.status, 400);
  r = await cap(hp1.token, { orderId: 'ABCDEFGH1234\n', bookingId: bH1 });
  check('H1e orderId con salto de línea', r.status, 400);
  r = await cap(hp1.token, { orderId: ['ABCDEFGH1234'], bookingId: bH1 });
  check('H1f orderId como array', r.status, 400);
  r = await cap(hp1.token, { orderId: { $ne: '' }, bookingId: bH1 });
  check('H1g orderId como objeto con operador', r.status, 400);
  r = await cap(hp1.token, { orderId: 1234567890, bookingId: bH1 });
  check('H1h orderId numérico', r.status, 400);
  r = await cap(hp1.token, { orderId: 'ABCDEFGH1234', bookingId: { $ne: null } });
  check('H1i bookingId con operador', r.status, 400);
  r = await call('POST', '/paypal/create-order', hp1.token, { bookingId: 'x/../../y' });
  check('H1j create-order con bookingId no válido', r.status, 400);
  r = await cap(hp2.token, { orderId: 'GOOD' + bH1.toUpperCase(), bookingId: bH1 });
  check('H1k capturar la reserva de otro pasajero', r.status, 403);
  if (process.env.QA_PAYPAL_MOCK === '1') {
    // El backend de prueba debe apuntar PAYPAL_API_BASE al mock (scripts/qa/mock-paypal.js).
    const paid = async (id) => (await db.collection('bookings').findOne({ _id: oid(id) }))?.payment_status;
    r = await cap(hp1.token, { orderId: 'NOREF' + bH1.toUpperCase(), bookingId: bH1 });
    check('H1l respuesta COMPLETED sin purchase_units (reembolso) no paga', `${r.status}/${await paid(bH1)}`, '400/pending');
    r = await cap(hp1.token, { orderId: 'OTHER' + bH1.toUpperCase(), bookingId: bH1 });
    check('H1m orden de otra reserva no paga', `${r.status}/${await paid(bH1)}`, '400/pending');
    r = await cap(hp1.token, { orderId: 'CHEAP' + bH1.toUpperCase(), bookingId: bH1 });
    check('H1n orden propia de 0.01 USD no paga', `${r.status}/${await paid(bH1)}`, '400/pending');
    r = await cap(hp1.token, { orderId: 'WRONG' + bH1.toUpperCase(), bookingId: bH1 });
    check('H1o respuesta de otra orden no paga', `${r.status}/${await paid(bH1)}`, '400/pending');
    r = await cap(hp1.token, { orderId: 'CRC' + bH1.toUpperCase(), bookingId: bH1 });
    check('H1p monto en colones no paga', `${r.status}/${await paid(bH1)}`, '400/pending');
    r = await cap(hp1.token, { orderId: 'PEND' + bH1.toUpperCase(), bookingId: bH1 });
    check('H1s orden COMPLETED con la captura PENDING no paga', `${r.status}/${await paid(bH1)}`, '400/pending');
    const twice = await Promise.all([1, 2, 3].map(() => cap(hp1.token, { orderId: 'GOOD' + bH1.toUpperCase(), bookingId: bH1 })));
    check('H1q captura válida en paralelo x3: paga una vez', `${twice.map(t => t.status).join(',')}/${await paid(bH1)}`, '200,200,200/paid');
    const hits = await (await fetch('http://127.0.0.1:8099/__hits')).json();
    check('H1r el backend nunca llamó una ruta de PayPal que no sea captura', hits.filter(h => !h.startsWith('GET /__hits') && !/^POST \/(v1\/oauth2\/token|v2\/checkout\/orders\/[A-Z0-9]+\/capture)$/.test(h)).length, 0);
    await db.collection('bookings').updateOne({ _id: oid(bH1) }, { $set: { payment_status: 'pending', payment_method: null, payment_reference: null, paid_amount_usd: null } });
  }

  // H2 Pasajero "cancelaba" su reserva completada con cobro pendiente y
  // volvía a reservar sin pagar (las reglas de deuda buscan status completed).
  await db.collection('bookings').updateOne({ _id: oid(bH2) }, { $set: { status: 'completed', payment_status: 'pending' } });
  const rideH2 = (await call('POST', '/rides', dA.token, rideBody(2, inHours(5)))).body?.data?._id;
  r = await call('POST', '/bookings', hp2.token, { ride_id: rideH2 });
  check('H2a con cobro pendiente no puede reservar', r.status, 403);
  r = await call('PATCH', `/bookings/${bH2}/status`, hp2.token, { status: 'cancelled' });
  check('H2b cancelar reserva completada por PATCH status (ataque original)', r.status, 400);
  r = await call('PATCH', `/bookings/${bH2}/status`, hp2.token, { status: 'canceled' });
  check('H2c variante "canceled"', r.status, [400, 403]);
  r = await call('PATCH', `/bookings/${bH2}/status`, hp2.token, { status: ['cancelled'] });
  check('H2d status como array', r.status, 400);
  r = await call('PATCH', `/bookings/${bH2}/status`, hp2.token, { status: 'Cancelled ' });
  check('H2e status con mayúscula y espacio', r.status, 400);
  r = await call('DELETE', `/bookings/${bH2}`, hp2.token);
  check('H2f DELETE de la reserva completada', r.status, 400);
  r = await call('PATCH', `/bookings/${bH2}/canceled`, hp2.token);
  check('H2g PATCH canceled de la reserva completada', r.status, 400);
  r = await call('PATCH', `/bookings/${bH2}/status`, hd1.token, { status: 'cancelled' });
  check('H2h el conductor tampoco cambia una completada (invariante del modelo)', r.status, 400);
  r = await call('PATCH', `/bookings/${bH2}/status`, admin.token, { status: 'deny' });
  check('H2i ni el admin', r.status, 400);
  const bH2doc = await db.collection('bookings').findOne({ _id: oid(bH2) });
  r = await call('POST', '/bookings', hp2.token, { ride_id: rideH2 });
  check('H2j la reserva sigue completada y la deuda sigue bloqueando', `${bH2doc.status}/${bH2doc.payment_status}/${r.status}`, 'completed/pending/403');
  // Variantes del conductor sobre el mismo flujo
  const bH3 = (await call('POST', '/bookings', hp3.token, { ride_id: rideH, seats_booked: 1 })).body?.data?._id;
  await call('PATCH', `/bookings/${bH3}/status`, hp3.token, { status: 'cancelled' });
  const seatsBefore = (await db.collection('rides').findOne({ _id: oid(rideH) })).available_seats;
  r = await call('PATCH', `/bookings/${bH3}/status`, hd1.token, { status: 'confirmed' });
  const seatsAfter = (await db.collection('rides').findOne({ _id: oid(rideH) })).available_seats;
  check('H2k conductor no confirma una reserva cancelada (sin descontar asiento)', `${r.status}/${seatsBefore === seatsAfter}`, '400/true');
  await db.collection('bookings').updateOne({ _id: oid(bH1) }, { $set: { payment_status: 'paid' } });
  r = await call('PATCH', `/bookings/${bH1}/status`, hd1.token, { status: 'confirmed', payment_status: 'pending' });
  const bH1pay = (await db.collection('bookings').findOne({ _id: oid(bH1) })).payment_status;
  check('H2l conductor no revierte un pago por PATCH status', bH1pay, 'paid');
  r = await call('PATCH', `/bookings/${bH1}/payment`, hd1.token, { payment_status: 'pending' });
  check('H2m ni por PATCH payment', r.status, 400);
  await db.collection('bookings').updateOne({ _id: oid(bH1) }, { $set: { payment_status: 'pending' } });
  r = await call('PATCH', `/bookings/${bH1}/status`, hp1.token, { status: 'cancelled', apply_penalty: 'true' });
  check('H2n apply_penalty como texto', r.status, 400);

  // H3 Correo y teléfono del conductor por GET /vehicles/:id.
  const contact = (b) => `${!!b?.data?.driver_id?.email}/${!!b?.data?.driver_id?.phone}`;
  r = await call('GET', `/vehicles/${vH}`, pA.token);
  check('H3a pasajero ajeno lee el vehículo (ataque original)', `${r.status}/${contact(r.body)}`, '200/false/false');
  r = await call('GET', `/vehicles/${vH}`, dA.token);
  check('H3b otro conductor lee el vehículo', `${r.status}/${contact(r.body)}`, '200/false/false');
  r = await call('GET', `/vehicles/${vH}`, null);
  check('H3c sin sesión', r.status, 401);
  r = await call('GET', `/vehicles/driver/${hd1.id}`, pA.token);
  check('H3d por /vehicles/driver/:id', `${r.status}/${JSON.stringify(r.body?.data || {}).includes(hd1.email)}`, '200/false');
  r = await call('GET', `/users/${hd1.id}`, pA.token);
  check('H3e por /users/:id', `${!!r.body?.data?.email}/${!!r.body?.data?.phone}`, 'false/false');
  r = await call('GET', `/vehicles/${vH}`, hd1.token);
  check('H3f el dueño sí ve su contacto', contact(r.body), 'true/true');
  r = await call('GET', `/vehicles/${vH}`, admin.token);
  check('H3g el admin sí lo ve (panel)', contact(r.body), 'true/true');

  // H4 Teléfono del conductor en GET /rides/:id (ruta pública).
  const ph = (b) => !!b?.data?.driver_id?.phone;
  r = await call('GET', `/rides/${rideH}`, null);
  check('H4a sin sesión (ataque original)', `${r.status}/${ph(r.body)}`, '200/false');
  r = await call('GET', `/rides/${rideH}`, jwt.sign({ userId: hp1.id, typ: 'access' }, 'otro-secreto', { expiresIn: '1h' }));
  check('H4b con token firmado con otro secreto', ph(r.body), false);
  r = await call('GET', `/rides/${rideH}`, pA.token);
  check('H4c pasajero sin reserva en el viaje', ph(r.body), false);
  r = await call('GET', `/rides/${rideH}`, dA.token);
  check('H4d otro conductor', ph(r.body), false);
  r = await call('GET', `/rides/${rideH}`, hp3.token);
  check('H4e pasajero con la reserva cancelada', ph(r.body), false);
  r = await call('GET', `/rides?status=scheduled&limit=50`, null);
  check('H4f listado público de viajes sin teléfono', JSON.stringify(r.body?.data || []).includes('"phone"'), false);
  r = await call('GET', `/rides/${rideH}`, hp1.token);
  check('H4g pasajero con reserva sí lo ve', ph(r.body), true);
  r = await call('GET', `/rides/${rideH}`, hd1.token);
  check('H4h el conductor sí lo ve', ph(r.body), true);
  r = await call('GET', `/rides/${rideH}`, admin.token);
  check('H4i el admin sí lo ve', ph(r.body), true);

  // H5 Inyección NoSQL en send-verification-code / verify-code: con
  // { email: { $ne: null } } se borraban los códigos de TODOS y con
  // { code: { $ne: 'x' } } cualquier código se daba por bueno.
  const vcs = db.collection('verificationcodes');
  await vcs.insertOne({ email: hp1.email, code: '482913', attempts: 0, expiresAt: new Date(Date.now() + 600000) });
  const codesBefore = await vcs.countDocuments();
  r = await call('POST', '/auth/send-verification-code', null, { email: { $ne: null } });
  check('H5a send-code con { $ne: null } (ataque original)', `${r.status}/${(await vcs.countDocuments()) === codesBefore}`, '400/true');
  r = await call('POST', '/auth/verify-code', null, { email: hp1.email, code: { $ne: 'x' } });
  check('H5b verify-code con { $ne }', r.status, 400);
  r = await call('POST', '/auth/verify-code', null, { email: hp1.email, code: { $gt: '' } });
  check('H5c verify-code con { $gt }', r.status, 400);
  r = await call('POST', '/auth/verify-code', null, { email: { $regex: '.*' }, code: '482913' });
  check('H5d email con { $regex }', r.status, 400);
  r = await call('POST', '/auth/verify-code', null, { email: hp1.email, code: ['482913'] });
  check('H5e código como array', r.status, 400);
  r = await call('POST', '/auth/verify-code', null, { email: hp1.email, code: 482913 });
  check('H5f código numérico', r.status, 400);
  r = await call('POST', '/auth/send-verification-code', null, { email: [hp1.email, pA.email] });
  check('H5g send-code con array de correos', r.status, 400);
  r = await raw('POST', '/auth/verify-code', { rawBody: `email=${encodeURIComponent(hp1.email)}&code[$ne]=x`, headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
  check('H5h operador por form-urlencoded', r.status, 400);
  r = await call('POST', '/auth/reset-password', null, { email: hp1.email, code: { $ne: 'x' }, newPassword: 'Nueva!Pass1' });
  check('H5i reset-password con operador', r.status, 400);
  r = await call('PUT', '/users/profile', hp1.token, { name: { $gt: '' } });
  check('H5j operador en otro endpoint (perfil)', r.status, 400);
  r = await call('POST', '/bookings', hp1.token, { ride_id: rideH, 'passenger_origin.x': 'y' });
  check('H5k clave con punto', r.status, 400);
  r = await call('POST', '/auth/verify-code', null, { email: hp1.email.toUpperCase() + ' ', code: '482913' });
  check('H5l correo con espacio al final se rechaza (no se busca un correo distinto)', r.status, 400);
  await vcs.deleteMany({ email: hp1.email });

  // H6 Fuerza bruta del código de 6 dígitos: los intentos fallidos no
  // gastaban el código (solo frenaba el rate limit por IP, apagado en dev).
  const tryReset = (code) => call('POST', '/auth/reset-password', null, { email: hp1.email, code, newPassword: 'Nueva!Pass1' });
  await vcs.insertOne({ email: hp1.email, code: '731942', attempts: 0, expiresAt: new Date(Date.now() + 600000) });
  for (let i = 0; i < 5; i++) await tryReset(String(100000 + i));
  r = await tryReset('731942');
  check('H6a 5 fallos y luego el código correcto (ataque original)', r.status, 400);
  await vcs.deleteMany({ email: hp1.email });
  await vcs.insertOne({ email: hp1.email, code: '731943', attempts: 0, expiresAt: new Date(Date.now() + 600000) });
  await Promise.all(Array.from({ length: 20 }, (_, i) => tryReset(String(200000 + i))));
  r = await tryReset('731943');
  check('H6b ráfaga de 20 en paralelo y luego el correcto', r.status, 400);
  await vcs.deleteMany({ email: hp1.email });
  await vcs.insertOne({ email: hp1.email, code: '731944', attempts: 0, expiresAt: new Date(Date.now() + 600000) });
  for (let i = 0; i < 5; i++) await call('POST', '/auth/verify-code', null, { email: hp1.email, code: String(300000 + i) });
  r = await call('POST', '/auth/verify-code', null, { email: hp1.email, code: '731944' });
  check('H6c misma fuerza bruta por verify-code', r.status, 400);
  await vcs.deleteMany({ email: hp1.email });
  await vcs.insertOne({ email: hp1.email, code: '731945', expiresAt: new Date(Date.now() + 600000) });
  for (let i = 0; i < 5; i++) await tryReset(String(400000 + i));
  r = await tryReset('731945');
  check('H6d código sin campo attempts (creado antes del cambio) también se agota', r.status, 400);
  await vcs.deleteMany({ email: hp1.email });

  // H7 Restablecer la contraseña no cerraba las sesiones abiertas.
  const oldSession = { access: hp1.token, refresh: hp1.refresh };
  await vcs.insertOne({ email: hp1.email, code: '731946', attempts: 0, expiresAt: new Date(Date.now() + 600000) });
  await tryReset('111111');
  r = await tryReset('731946');
  check('H7a dos intentos fallidos no gastan el código (sigue sirviendo)', r.status, 200);
  r = await call('POST', '/auth/refresh', null, { refreshToken: oldSession.refresh });
  check('H7b refresh anterior al reset (ataque original)', r.status, 401);
  r = await call('GET', '/auth/me', oldSession.access);
  check('H7c access token anterior al reset', r.status, 401);
  r = await call('GET', `/rides/${rideH}`, oldSession.access);
  check('H7d access viejo en ruta con auth opcional no da datos privados', ph(r.body), false);
  const relog = await call('POST', '/auth/login', null, { email: hp1.email, password: 'Nueva!Pass1' });
  r = await call('GET', '/auth/me', relog.body?.data?.accessToken);
  check('H7e login con la nueva contraseña funciona', `${relog.status}/${r.status}`, '200/200');
  hp1.token = relog.body?.data?.accessToken;
  r = await call('POST', '/auth/refresh', null, { refreshToken: relog.body?.data?.refreshToken });
  const r2 = await call('POST', '/auth/refresh', null, { refreshToken: relog.body?.data?.refreshToken });
  check('H7f el mismo refresh usado dos veces', `${r.status}/${r2.status}`, '200/401');
  hp1.token = r.body?.data?.accessToken || hp1.token;
  r = await call('GET', '/auth/me', relog.body?.data?.refreshToken);
  check('H7g refresh token usado como access', r.status, 401);
  r = await call('POST', '/auth/refresh', null, { refreshToken: hp1.token });
  check('H7h access token usado como refresh', r.status, 401);
  r = await call('POST', '/auth/refresh', null, { refreshToken: { $ne: null } });
  check('H7i refresh con operador', r.status, 400);
  const tvDoc = await db.collection('users').findOne({ _id: oid(hp1.id) });
  r = await call('GET', '/auth/me', jwt.sign({ userId: hp1.id, typ: 'access', tv: (tvDoc.tokenVersion || 0) - 1 }, process.env.JWT_SECRET, { expiresIn: '1h' }));
  check('H7j token con versión de sesión vieja', r.status, 401);
  r = await call('GET', '/auth/me', hp1.token);
  check('H7k ninguna respuesta expone tokenVersion', r.body?.data && 'tokenVersion' in r.body.data, false);

  // H8 Subida de imágenes: el filtro aceptaba cualquier image/*, incluido SVG
  // (XML con scripts que el blob público sirve con ese content-type).
  const upload = async (p, token, type, name) => {
    const fd = new FormData();
    fd.append('image', new Blob(['<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"/>'], { type }), name);
    const res = await fetch(base + p, { method: 'POST', headers: { Authorization: 'Bearer ' + token }, body: fd });
    return res.status;
  };
  check('H8a perfil: SVG (ataque original)', await upload(`/users/${hp2.id}/image`, hp2.token, 'image/svg+xml', 'a.svg'), 400);
  check('H8b perfil: SVG en mayúsculas', await upload(`/users/${hp2.id}/image`, hp2.token, 'IMAGE/SVG+XML', 'a.svg'), 400);
  check('H8c perfil: SVG con charset', await upload(`/users/${hp2.id}/image`, hp2.token, 'image/svg+xml;charset=utf-8', 'a.png'), 400);
  check('H8d perfil: text/html', await upload(`/users/${hp2.id}/image`, hp2.token, 'text/html', 'a.html'), 400);
  check('H8e vehículo: SVG', await upload(`/vehicles/${vH}/image`, hd1.token, 'image/svg+xml', 'a.svg'), 400);
  check('H8f vehículo ajeno', await upload(`/vehicles/${vH}/image`, dA.token, 'image/png', 'a.png'), 403);
  check('H8g foto de perfil ajena', await upload(`/users/${hp1.id}/image`, hp2.token, 'image/png', 'a.png'), 403);
  r = await call('POST', `/vehicles/${vH}/image`, hd1.token, {});
  check('H8h subir imagen de vehículo sin archivo', r.status, 400);

  // H9 Valores límite y tipos inesperados.
  const big = 'x'.repeat(1024 * 1024);
  r = await call('PUT', '/users/profile', hp2.token, { name: big });
  check('H9a nombre de 1 MB', r.status, 400);
  r = await call('POST', '/bookings', hp3.token, { ride_id: rideH2, passenger_origin: big });
  check('H9b origen de reserva de 1 MB', r.status, 400);
  r = await call('POST', '/reviews', hp2.token, { ride_id: rideH, reviewee_id: hd1.id, rating: 5, comment: big });
  check('H9c comentario de 1 MB', r.status, 400);
  r = await call('POST', '/bookings', hp3.token, { ride_id: rideH2, seats_booked: -1 });
  check('H9d asientos negativos', r.status, 400);
  r = await call('POST', '/bookings', hp3.token, { ride_id: rideH2, seats_booked: 1e9 });
  check('H9e asientos enormes', r.status, 400);
  r = await call('POST', '/bookings', hp3.token, { ride_id: rideH2, passenger_origin: { a: 1 } });
  check('H9f origen como objeto', r.status, 400);
  r = await call('POST', '/bookings', hp3.token, { ride_id: [rideH2] });
  check('H9g ride_id como array', r.status, 400);
  r = await call('PUT', `/rides/${rideH}`, hd1.token, { available_seats: 0 });
  check('H9h viaje con 0 asientos', r.status, 400);
  r = await call('POST', '/location/update', hd1.token, { lat: '9.9', lng: -84 });
  check('H9i GPS con latitud en texto', r.status, 400);
  r = await call('PATCH', '/auth/notification-preferences', hp2.token, { optIn: 'true' });
  check('H9j optIn como texto', r.status, 400);
  r = await call('POST', '/auth/push-token', hp2.token, { pushToken: { $ne: null } });
  check('H9k pushToken con operador', r.status, 400);

  // H10 Carreras con peticiones en paralelo.
  const rideR = (await call('POST', '/rides', dB.token, rideBody(3, inHours(6)))).body?.data?._id;
  const dupB = await Promise.all([1, 2, 3, 4].map(() => call('POST', '/bookings', hp3.token, { ride_id: rideR, seats_booked: 1 })));
  const dupCount = await db.collection('bookings').countDocuments({ ride_id: oid(rideR), passenger_id: oid(hp3.id) });
  check('H10a misma reserva x4 en paralelo: una sola', dupCount, 1, dupB.map(x => x.status).join(','));
  const bR = (await db.collection('bookings').findOne({ ride_id: oid(rideR), passenger_id: oid(hp3.id) }))._id.toString();
  await call('PATCH', `/bookings/${bR}/status`, dB.token, { status: 'confirmed' });
  const cancels = await Promise.all([1, 2, 3].map(() => call('DELETE', `/bookings/${bR}`, hp3.token)));
  const seatsR = (await db.collection('rides').findOne({ _id: oid(rideR) })).available_seats;
  check('H10b cancelar x3 en paralelo: un asiento devuelto', `${cancels.filter(c => c.status === 200).length}/${seatsR}`, '1/3');
  await db.collection('rides').updateOne({ _id: oid(rideH) }, { $set: { status: 'completed' } });
  await db.collection('bookings').updateOne({ _id: oid(bH1) }, { $set: { status: 'completed' } });
  const revs = await Promise.all([1, 2, 3].map(() => call('POST', '/reviews', hp1.token, { ride_id: rideH, reviewee_id: hd1.id, rating: 1 })));
  const revCount = await db.collection('reviews').countDocuments({ ride_id: oid(rideH), reviewer_id: oid(hp1.id) });
  check('H10c calificar x3 en paralelo: una reseña', revCount, 1, revs.map(x => x.status).join(','));

  // H11 Superficie y limitador.
  r = await raw('GET', '/rides', { headers: { Authorization: 'Bearer ' + jwt.sign({ userId: '0123456789abcdef01234567', typ: 'access' }, 'otro-secreto') } });
  check('H11a token con firma ajena en ruta pública: se ignora', r.status, 200);
  r = await fetch(ORIGIN + '/api-docs.json');
  check('H11b spec JSON solo fuera de producción', r.status, process.env.NODE_ENV === 'production' ? 404 : 200);

  // H12 Cobertura: todo endpoint rechaza operadores de Mongo en el cuerpo
  // (capa global) y los privados exigen sesión.
  const X = '000000000000000000000000';
  const endpoints = [
    // [archivo, método, ruta, público]
    ['auth', 'POST', '/auth/register', 1], ['auth', 'POST', '/auth/login', 1], ['auth', 'POST', '/auth/refresh', 1],
    ['auth', 'POST', '/auth/logout', 0], ['auth', 'GET', '/auth/me', 0], ['auth', 'POST', '/auth/send-verification-code', 1],
    ['auth', 'POST', '/auth/verify-code', 1], ['auth', 'POST', '/auth/reset-password', 1], ['auth', 'POST', '/auth/push-token', 0],
    ['auth', 'PATCH', '/auth/notification-preferences', 0], ['auth', 'PUT', '/auth/password', 0],
    ['users', 'GET', '/users/companies', 1], ['users', 'GET', '/users', 0], ['users', 'GET', '/users/profile', 0], ['users', 'PUT', '/users/profile', 0],
    ['users', 'GET', '/users/me/trust/history', 0], ['users', 'DELETE', '/users/me', 0], ['users', 'GET', `/users/${X}`, 0], ['users', 'PUT', `/users/${X}`, 0],
    ['users', 'POST', `/users/${X}/image`, 0], ['users', 'DELETE', `/users/${X}`, 0], ['users', 'PATCH', `/users/${X}/activate`, 0],
    ['users', 'PATCH', `/users/${X}/trust`, 0], ['users', 'GET', `/users/${X}/trust/history`, 0], ['users', 'GET', `/users/${X}/stats`, 0],
    ['rides', 'GET', '/rides', 1], ['rides', 'GET', '/rides/in-progress', 0], ['rides', 'GET', `/rides/${X}`, 1], ['rides', 'POST', '/rides', 0], ['rides', 'PUT', `/rides/${X}`, 0],
    ['rides', 'PATCH', `/rides/${X}/cancel`, 0], ['rides', 'GET', `/rides/driver/${X}`, 0], ['rides', 'PATCH', `/rides/${X}/start`, 0],
    ['rides', 'PATCH', `/rides/${X}/complete`, 0], ['rides', 'PATCH', `/rides/${X}/finalize-payment-verification`, 0],
    ['bookings', 'POST', '/bookings', 0], ['bookings', 'GET', '/bookings', 0], ['bookings', 'GET', `/bookings/${X}`, 0],
    ['bookings', 'GET', `/bookings/passenger/${X}`, 0], ['bookings', 'GET', `/bookings/ride/${X}`, 0], ['bookings', 'GET', '/bookings/driver/me', 0],
    ['bookings', 'DELETE', `/bookings/${X}`, 0], ['bookings', 'PATCH', `/bookings/${X}/canceled`, 0], ['bookings', 'PATCH', `/bookings/${X}/status`, 0],
    ['bookings', 'PATCH', `/bookings/${X}/payment`, 0],
    ['reviews', 'GET', `/reviews/user/${X}`, 1], ['reviews', 'POST', '/reviews', 0], ['reviews', 'POST', '/reviews/direct-submit', 0],
    ['reviews', 'GET', `/reviews/ride/${X}`, 0], ['reviews', 'DELETE', `/reviews/${X}`, 0],
    ['vehicles', 'POST', '/vehicles', 0], ['vehicles', 'GET', `/vehicles/driver/${X}`, 0], ['vehicles', 'GET', `/vehicles/${X}`, 0],
    ['vehicles', 'PUT', `/vehicles/${X}`, 0], ['vehicles', 'POST', `/vehicles/${X}/image`, 0], ['vehicles', 'DELETE', `/vehicles/${X}`, 0],
    ['vehicles', 'GET', '/vehicles', 0], ['vehicles', 'PATCH', `/vehicles/${X}/status`, 0],
    ['location', 'POST', '/location/update', 0], ['location', 'GET', `/location/${X}/driver`, 0],
    ['notifications', 'GET', '/notifications', 0], ['notifications', 'PATCH', `/notifications/${X}/read`, 0],
    ['notifications', 'PATCH', '/notifications/read-all', 0], ['notifications', 'DELETE', `/notifications/${X}`, 0], ['notifications', 'POST', '/notifications', 0],
    ['metrics', 'GET', '/metrics/leaderboard', 1], ['metrics', 'GET', `/metrics/passenger/${X}`, 0], ['metrics', 'GET', `/metrics/user/${X}`, 0],
    ['metrics', 'POST', `/metrics/calculate/${X}`, 0], ['metrics', 'GET', '/metrics/global', 0],
    ['maps', 'GET', '/maps/directions', 0], ['maps', 'GET', '/maps/place/autocomplete/json', 0], ['maps', 'GET', '/maps/place/details/json', 0], ['maps', 'GET', '/maps/geocode/json', 0],
    ['paypal', 'GET', '/paypal/config', 1], ['paypal', 'POST', '/paypal/create-order', 0], ['paypal', 'POST', '/paypal/capture-order', 0],
    ['admin-agente', 'GET', '/admin/agent-jobs/stats', 0], ['admin-agente', 'GET', '/admin/agent-jobs', 0], ['admin-agente', 'GET', `/admin/agent-jobs/${X}`, 0],
    ['admin-agente', 'POST', `/admin/agent-jobs/${X}/retry`, 0], ['admin-agente', 'POST', '/admin/agent-jobs/enqueue', 0], ['admin-agente', 'DELETE', `/admin/agent-jobs/${X}`, 0],
    ['safescore', 'GET', `/safescore/reviews/user/${X}`, 0],
    ['auth', 'PATCH', '/auth/change-password', 0], ['auth', 'POST', '/auth/logout-all', 0], ['users', 'DELETE', `/users/${X}/hard`, 0],
    ['vehicles', 'POST', `/vehicles/${X}/documents`, 0], ['vehicles', 'DELETE', `/vehicles/${X}/documents/poliza`, 0],
    ['documents', 'GET', '/documents/admin/pending', 0], ['documents', 'GET', `/documents/driver/${X}`, 0], ['documents', 'PATCH', `/documents/${X}/review`, 0], ['documents', 'POST', `/documents/${X}/reprocess`, 0],
    ['audit', 'GET', '/audit-logs', 0],
  ];
  const noAuth = []; const opLeak = []; const adminLeak = [];
  for (const [, m, p, pub] of endpoints) {
    if (!pub) {
      const a = await call(m, p, null, m === 'GET' ? undefined : {});
      if (a.status !== 401 && a.status !== 404) noAuth.push(`${m} ${p}:${a.status}`);
    }
    if (m === 'GET') continue;
    const inj = await call(m, p, pA.token, { email: { $ne: null }, status: { $gt: '' }, nested: { deep: { $where: '1' } } });
    if (inj.status !== 400) opLeak.push(`${m} ${p}:${inj.status}`);
  }
  for (const [, m, p] of endpoints.filter(e => e[0] === 'admin-agente')) {
    const a = await call(m, p, pA.token, m === 'GET' ? undefined : {});
    if (a.status !== 403 && a.status !== 404) adminLeak.push(`${m} ${p}:${a.status}`);
  }
  check('H12a privados sin token -> 401 (' + endpoints.filter(e => !e[3]).length + ' endpoints)', noAuth.join(' ') || 'todos 401', 'todos 401');
  check('H12b cuerpo con operadores -> 400 (' + endpoints.filter(e => e[1] !== 'GET').length + ' endpoints)', opLeak.join(' ') || 'todos 400', 'todos 400');
  check('H12c rutas admin del agente con pasajero -> 403', adminLeak.join(' ') || 'todos 403', 'todos 403');
  const perFile = {};
  endpoints.forEach(([f]) => { perFile[f] = (perFile[f] || 0) + 1; });
  console.log('Cobertura H12 por archivo de rutas:', JSON.stringify(perFile));
  await db.collection('verificationcodes').deleteMany({ email: { $in: extra.map(u => u.email) } });


  // H13 Limitadores (se prueba el módulo, no el servidor: en desarrollo los
  // limitadores están apagados). Se carga middleware/rateLimiter como en un
  // entorno no-dev, con topes bajos, sobre una mini app en un puerto libre.
  {
    const express = require(BE + '/node_modules/express');
    const limPath = require.resolve(BE + '/src/middleware/rateLimiter');
    const freshLimiter = () => {
      const prevEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'staging'; process.env.RATE_LIMIT_MAX_REQUESTS = '5';
      delete require.cache[limPath];
      const lim = require(limPath);
      process.env.NODE_ENV = prevEnv; delete process.env.RATE_LIMIT_MAX_REQUESTS;
      delete require.cache[limPath];
      return lim;
    };
    const withApp = async (setup, fn) => {
      const app = express(); app.use(express.json()); setup(app);
      const srv = app.listen(0); try { return await fn(srv.address().port); } finally { srv.close(); }
    };
    const forge = [
      ['H13a token con firma inventada y userId distinto cada vez (ataque original)', (i) => jwt.sign({ userId: 'u' + i + tag }, 'firma-inventada')],
      ['H13b token alg none con userId distinto', (i) => Buffer.from('{"alg":"none","typ":"JWT"}').toString('base64url') + '.' + Buffer.from(JSON.stringify({ userId: 'n' + i + tag })).toString('base64url') + '.'],
      ['H13c token bien firmado pero vencido', (i) => jwt.sign({ userId: 'e' + i + tag }, process.env.JWT_SECRET, { expiresIn: -10 })],
      ['H13d cabecera Bearer basura', (i) => 'basura' + i],
    ];
    for (const [name, mk] of forge) {
      const lim = freshLimiter();
      const n429 = await withApp((app) => app.get('/x', lim.apiLimiter, (q, s) => s.json({ ok: 1 })), async (port) => {
        let c = 0; for (let i = 0; i < 12; i++) { const res = await fetch(`http://127.0.0.1:${port}/x`, { headers: { Authorization: 'Bearer ' + mk(i) } }); if (res.status === 429) c++; } return c;
      });
      check(name + ': 12 peticiones con tope 5', n429, 7);
    }
    const sendBurst = async (emails) => {
      const lim = freshLimiter();
      return withApp((app) => app.post('/send', lim.sendCodeIpLimiter, lim.sendCodeEmailLimiter, (q, s) => s.json({ ok: 1 })), async (port) => {
        let c = 0; for (const email of emails) { const res = await fetch(`http://127.0.0.1:${port}/send`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) }); if (res.status === 429) c++; } return c;
      });
    };
    check('H13e envío de código al mismo correo x7 (los exitosos también cuentan)', await sendBurst(Array(7).fill('victima.qa@intel.com')), 2);
    check('H13f mismo correo con mayúsculas y espacios x7', await sendBurst(['victima.qa@intel.com', 'VICTIMA.QA@intel.com', ' victima.qa@intel.com', 'Victima.Qa@Intel.com ', 'victima.qa@INTEL.COM', 'victima.qa@intel.com', 'VICTIMA.qa@intel.com']), 2);
    check('H13g envío de códigos a 12 correos distintos desde una IP', await sendBurst(Array.from({ length: 12 }, (_, i) => `otro${i}.qa@intel.com`)), 2);
  }

  // H14 Tokens de un usuario que borró su cuenta.
  const hz = await hReg('pasajero', 'hz');
  r = await call('DELETE', '/users/me', hz.token, { password: PW });
  check('H14a borrar la cuenta propia', r.status, 200);
  r = await call('GET', '/auth/me', hz.token);
  check('H14b access token de cuenta borrada', r.status, 401);
  r = await call('POST', '/auth/refresh', null, { refreshToken: hz.refresh });
  check('H14c refresh token de cuenta borrada', r.status, 401);
  r = await call('POST', '/auth/login', null, { email: hz.email, password: PW });
  check('H14d login con el correo de la cuenta borrada', r.status, 401);
  r = await call('GET', `/rides/${rideH}`, hz.token);
  check('H14e token de cuenta borrada en ruta pública no da datos privados', ph(r.body), false);

  // H15 Propiedad en endpoints que H12 solo prueba sin token.
  const myNotif = await db.collection('notifications').findOne({ user_id: oid(hd1.id) });
  if (myNotif) {
    r = await call('PATCH', `/notifications/${myNotif._id}/read`, pA.token);
    check('H15a marcar como leída una notificación ajena', r.status, 403);
    r = await call('DELETE', `/notifications/${myNotif._id}`, pA.token);
    check('H15b borrar una notificación ajena', r.status, 403);
  }
  r = await call('PATCH', `/rides/${rideH}/finalize-payment-verification`, dA.token);
  check('H15c cerrar pagos de un viaje ajeno', r.status, 403);
  r = await call('GET', '/admin/agent-jobs/stats', dA.token);
  check('H15d rutas admin del agente con conductor', r.status, [403, 404]);
  const anyReview = await db.collection('reviews').findOne({ ride_id: oid(rideH) });
  r = await call('DELETE', `/reviews/${anyReview?._id || X}`, hp1.token);
  check('H15e el autor no borra su reseña (solo admin)', r.status, 403);
  r = await call('GET', `/bookings/ride/${rideH}`, hp1.token);
  check('H15f pasajero lista las reservas del viaje (teléfonos)', r.status, 403);
  r = await call('GET', `/metrics/passenger/${hp1.id}`, hp2.token);
  check('H15g métricas de otro pasajero', r.status, 403);
  r = await call('POST', '/paypal/create-order', hp2.token, { bookingId: bH1 });
  check('H15h crear orden de PayPal para reserva ajena', r.status, 403);

  // H16 Tipos inesperados en cada campo de los endpoints de escritura: nunca 500.
  const weird = [['arr', (v) => [v]], ['obj', () => ({ a: 1 })], ['num', () => 123], ['bool', () => true], ['null', () => null]];
  const writes = [
    ['POST', '/auth/register', null, { name: '(QA) Tipo', username: 'qa_tipo_' + tag, email: `qa.tipo.${tag}@intel.com`, phone: '88880009', password: 'Qa!Tipo123', company: 'Intel' }],
    ['POST', '/auth/login', null, { email: hp2.email, password: PW }],
    ['POST', '/auth/refresh', null, { refreshToken: 'x' }],
    ['POST', '/auth/send-verification-code', null, { email: `qa.tipo2.${tag}@intel.com` }],
    ['POST', '/auth/verify-code', null, { email: hp2.email, code: '123456' }],
    ['POST', '/auth/reset-password', null, { email: hp2.email, code: '123456', newPassword: 'Nueva!Pass1' }],
    ['POST', '/auth/push-token', hp2.token, { pushToken: 'ExponentPushToken[qa]' }],
    ['PATCH', '/auth/notification-preferences', hp2.token, { optIn: true }],
    ['PUT', '/auth/password', hp2.token, { currentPassword: 'Incorrecta1!', newPassword: 'Nueva!Pass1' }],
    ['PUT', '/users/profile', hp2.token, { name: '(QA) Nombre', phone: '88887777', company: 'Intel', work_schedule: '8-5', profileImage: 'https://x/y.png' }],
    ['DELETE', '/users/me', hp2.token, { password: 'Incorrecta1!' }],
    ['PATCH', `/users/${hp2.id}/trust`, admin.token, { action: 'increment' }],
    ['POST', '/vehicles', hd1.token, { brand: 'Kia', model: 'Rio', license_plate: 'QT' + tag.slice(-4).toUpperCase().replace(/[^A-Z0-9]/g, '1'), color: 'Gris', year: 2020, capacity: 4 }],
    ['PUT', `/vehicles/${vH}`, hd1.token, { brand: 'Kia', model: 'Rio', color: 'Gris', year: 2020, capacity: 4, license_plate: plate }],
    ['PATCH', `/vehicles/${vH}/status`, hd1.token, { isActive: false }],
    ['POST', '/rides', hd1.token, rideBody(2, inHours(7))],
    ['PUT', `/rides/${rideH2}`, dA.token, { available_seats: 2, hora: inHours(5) }],
    ['POST', '/bookings', hp3.token, { ride_id: rideH2, seats_booked: 1, offered_amount: 100, passenger_origin: 'a', passenger_destination: 'b', payment_method: 'cash' }],
    ['PATCH', `/bookings/${bR}/status`, dB.token, { status: 'deny', payment_status: 'waived', payment_type: 'normal', apply_penalty: false }],
    ['PATCH', `/bookings/${bR}/payment`, dB.token, { payment_status: 'waived' }],
    ['POST', '/reviews', hp1.token, { ride_id: rideH, reviewee_id: hd1.id, rating: 4, comment: 'ok' }],
    ['POST', '/notifications', admin.token, { user_id: hp2.id, message: 'qa', type: 'system' }],
    ['POST', '/location/update', hd1.token, { lat: 9.9, lng: -84.1, inTrip: true }],
    ['POST', '/paypal/create-order', hp1.token, { bookingId: bH1 }],
    ['POST', '/paypal/capture-order', hp1.token, { orderId: 'ABCDEFGH1234', bookingId: bH1 }],
  ];
  // Las rutas de PayPal llaman a PayPal: solo con el mock.
  const writesRun = process.env.QA_PAYPAL_MOCK === '1' ? writes : writes.filter(w => !w[1].startsWith('/paypal'));
  const crashes = []; let sent = 0;
  for (const [m, p, tok, good] of writesRun) {
    for (const field of Object.keys(good)) {
      for (const [wname, mk] of weird) {
        const res = await call(m, p, tok, { ...good, [field]: mk(good[field]) });
        sent++;
        if (res.status >= 500) crashes.push(`${m} ${p} ${field}=${wname}:${res.status}`);
      }
    }
  }
  // Las variantes que crearon algo se limpian con el resto (mismos dueños).
  check(`H16 tipos inesperados en ${writesRun.length} endpoints de escritura (${sent} peticiones): sin 500`, crashes.join(' | ') || 'ninguno', 'ninguno');
  await db.collection('users').deleteMany({ email: { $regex: `^qa\\.tipo\\.${tag}@` } });
  await db.collection('verificationcodes').deleteMany({ email: { $regex: `^qa\\.tipo` } });


  // H17 Registro sin correo verificado: cualquiera registraba una dirección
  // corporativa ajena o inventada. Ahora register exige un código verificado,
  // vigente y del mismo correo, y lo consume una sola vez.
  {
    const vcs17 = db.collection('verificationcodes');
    const regBody = (email, s) => ({ name: '(QA) Reg ' + s, username: `qa_reg_${s}_${tag}`, email, phone: '88880010', password: PW, company: 'Intel', type: 'pasajero' });
    const regEmail = (s) => `qa.reg${s}.${tag}@intel.com`;
    const regUsers = [];
    const reg = async (email, s, token) => { const res = await call('POST', '/auth/register', token || null, regBody(email, s)); if (res.status === 201) regUsers.push(email.trim().toLowerCase()); return res; };
    r = await reg(regEmail('a'), 'a');
    check('H17a registrar sin pedir código (ataque original)', r.status, 403);
    await call('POST', '/auth/send-verification-code', null, { email: regEmail('b') });
    r = await reg(regEmail('b'), 'b');
    check('H17b código pedido pero no verificado', r.status, 403);
    await verifyEmail(regEmail('c'));
    r = await reg(regEmail('d'), 'd');
    check('H17c código verificado de otro correo', r.status, 403);
    r = await reg(regEmail('c'), 'c');
    check('H17d registro con su código verificado', r.status, 201);
    await db.collection('users').deleteOne({ email: regEmail('c') });
    r = await reg(regEmail('c'), 'c2');
    check('H17e reusar el mismo código (cuenta borrada y vuelta a registrar)', r.status, 403);
    await verifyEmail(regEmail('e'));
    r = await reg(regEmail('e').toUpperCase(), 'e');
    check('H17f correo en MAYÚSCULAS con el código del mismo correo', r.status, 201);
    await verifyEmail(regEmail('f').toUpperCase());
    r = await reg(regEmail('f'), 'f');
    check('H17g verificado en MAYÚSCULAS, registrado en minúsculas', r.status, 201);
    r = await reg(' ' + regEmail('g') + ' ', 'g');
    check('H17h correo con espacios', r.status, [400, 403]);
    await verifyEmail(regEmail('h'));
    const par = await Promise.all([1, 2, 3].map((i) => call('POST', '/auth/register', null, regBody(regEmail('h'), 'h' + i))));
    const parCount = await db.collection('users').countDocuments({ email: regEmail('h') });
    if (parCount) regUsers.push(regEmail('h'));
    check('H17i tres registros simultáneos con el mismo código: uno solo', `${par.filter(p => p.status === 201).length}/${parCount}`, '1/1', par.map(p => p.status).join(','));
    await verifyEmail(regEmail('i'));
    await vcs17.updateOne({ email: regEmail('i') }, { $set: { expiresAt: new Date(Date.now() - 1000) } });
    r = await reg(regEmail('i'), 'i');
    check('H17j código verificado pero vencido', r.status, 403);
    await verifyEmail(regEmail('j'));
    r = await call('POST', '/auth/register', null, { ...regBody(regEmail('j'), 'j'), company: 'Empresa Falsa' });
    const r2 = await reg(regEmail('j'), 'j');
    check('H17k un registro fallido no gasta el código', `${r.status}/${r2.status}`, '400/201');
    await call('POST', '/auth/send-verification-code', null, { email: hp2.email });
    const resetCode = await vcs17.findOne({ email: hp2.email, verifiedAt: null });
    await call('POST', '/auth/verify-code', null, { email: hp2.email, code: resetCode?.code });
    r = await call('POST', '/auth/reset-password', null, { email: hp2.email, code: resetCode?.code, newPassword: 'Nueva!Pass1' });
    check('H17l un código ya verificado no sirve para restablecer la contraseña', r.status, 400);
    r = await call('POST', '/auth/verify-code', null, { email: hp2.email, code: resetCode?.code });
    check('H17m ni para verificar otra vez', r.status, 400);
    r = await reg(regEmail('k'), 'k', pA.token);
    check('H17n con token de pasajero tampoco se salta el código', r.status, 403);
    r = await reg(regEmail('l'), 'l', jwt.sign({ userId: '000000000000000000000000', typ: 'access' }, 'otro-secreto'));
    check('H17o con token de admin falsificado', r.status, 403);
    r = await reg(regEmail('m'), 'm', admin.token);
    check('H17p el admin del panel registra sin código', r.status, 201);
    await db.collection('users').deleteMany({ email: { $in: regUsers } });
    await vcs17.deleteMany({ email: { $regex: `\\.${tag}@` } });
  }


  // H18 Ronda 3 (hallazgos de Arquitecto desde la interfaz).
  {
    // 1. HTML y caracteres de control en campos de identidad.
    const evil = ['<img src=x onerror=alert(1)>', 'Ana <b>', 'Ana > Bea', 'Ana\u0000Bea', 'Ana\nBea', 'Ana\u007fBea'];
    let pass = [];
    for (const v of evil) { const x = await call('PUT', '/users/profile', hp3.token, { name: v }); if (x.status !== 400) pass.push(JSON.stringify(v) + ':' + x.status); }
    check('H18a nombre con HTML o control en el perfil (ataque original + 5 variantes)', pass.join(' ') || 'todos 400', 'todos 400');
    r = await call('PUT', `/users/${hp3.id}`, hp3.token, { name: '<svg/onload=alert(1)>' });
    check('H18b mismo ataque por PUT /users/:id', r.status, 400);
    r = await call('PUT', `/users/${hp3.id}`, admin.token, { name: '<script>x</script>' });
    check('H18c ni el admin guarda un nombre con HTML', r.status, 400);
    r = await call('PUT', '/users/profile', hp3.token, { work_schedule: '8-5<script>' });
    check('H18d horario con HTML', r.status, 400);
    r = await call('PUT', '/users/profile', hp3.token, { phone: '8888<888' });
    check('H18e teléfono con <', r.status, 400);
    await verifyEmail(`qa.xss.${tag}@intel.com`);
    r = await call('POST', '/auth/register', null, { name: '<img src=x>', username: 'qa_xss_' + tag, email: `qa.xss.${tag}@intel.com`, phone: '88880011', password: PW, company: 'Intel' });
    check('H18f registro con nombre HTML', r.status, 400);
    r = await call('POST', '/auth/register', null, { name: '(QA) Xss', username: 'qa<xss>' + tag, email: `qa.xss.${tag}@intel.com`, phone: '88880011', password: PW, company: 'Intel' });
    check('H18g registro con username HTML', r.status, 400);
    pass = [];
    for (const [f, v] of [['brand', '<b>Kia'], ['model', 'Rio\u0007'], ['color', 'Gris>']]) {
      const x = await call('PUT', `/vehicles/${vH}`, hd1.token, { [f]: v });
      if (x.status !== 400) pass.push(f + ':' + x.status);
      const y = await call('POST', '/vehicles', hd1.token, { brand: 'Kia', model: 'Rio', license_plate: 'QX' + tag.slice(-4).toUpperCase().replace(/[^A-Z0-9]/g, '2'), color: 'Gris', year: 2020, capacity: 4, [f]: v });
      if (y.status !== 400) pass.push('POST ' + f + ':' + y.status);
    }
    check('H18h marca/modelo/color con HTML o control (POST y PUT)', pass.join(' ') || 'todos 400', 'todos 400');
    const keep = await db.collection('users').findOne({ _id: oid(hp3.id) });
    check('H18i el nombre guardado sigue limpio', /[<>]/.test(keep.name), false);
    r = await call('PUT', '/users/profile', hp3.token, { name: 'José Ñandú-O\'Neil' });
    check('H18j nombre con tildes, ñ, guion y apóstrofo sí se acepta', r.status, 200);
    // Textos libres: se guardan tal cual con tope de largo (decisión documentada).
    r = await call('POST', '/bookings', hp3.token, { ride_id: rideR, seats_booked: 1, passenger_origin: 'Calle 5 <frente al parque>' });
    check('H18k origen de reserva (texto libre) con < > se acepta con tope', r.status, [201, 200]);
    r = await call('POST', '/bookings', hp3.token, { ride_id: rideR, passenger_destination: 'x'.repeat(301) });
    check('H18l texto libre de más de 300 caracteres', r.status, 400);

    // 2. Errores sin stack y JSON inválido = 400 limpio.
    const noStack = [];
    for (const [m, p, body, ct] of [
      ['POST', '/auth/logout', 'null', 'application/json'],
      ['POST', '/auth/login', '{"email":', 'application/json'],
      ['POST', '/auth/login', '{"email": "a@b.com",}', 'application/json'],
      ['POST', '/bookings', '[1,2', 'application/json'],
      ['PUT', '/users/profile', "{'name':'x'}", 'application/json'],
    ]) {
      const x = await raw(m, p, { token: hp3.token, rawBody: body, headers: { 'Content-Type': ct } });
      if (x.status !== 400 || /stack|at \w+ \(|\\\\|node_modules/.test(x.text)) noStack.push(`${p} ${JSON.stringify(body)}:${x.status}`);
    }
    check('H18m JSON inválido -> 400 sin stack (ataque original + 4 variantes)', noStack.join(' ') || 'todos 400 limpios', 'todos 400 limpios');
    r = await call('GET', '/users/notanid', hp3.token);
    check('H18n error de servidor sin stack', 'stack' in (r.body || {}), false);

    // 3. CORS: nunca '*' con credenciales.
    const corsBad = [];
    for (const o of ['https://malo.example', 'http://localhost:19006', 'http://localhost:5173', 'null']) {
      const x = await raw('GET', '/health', { headers: { Origin: o } });
      const pre = await raw('OPTIONS', '/auth/login', { headers: { Origin: o, 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'content-type,authorization,x-client-type' } });
      for (const h of [x.headers, pre.headers]) {
        const allow = h.get('access-control-allow-origin'); const cred = h.get('access-control-allow-credentials');
        if (allow === '*' && cred === 'true') corsBad.push(o + ': * con credenciales');
        if (allow && allow !== '*' && allow !== o) corsBad.push(o + ': refleja ' + allow);
      }
    }
    check('H18o CORS: sin "*" + credenciales, ni otro origen reflejado (4 orígenes, GET y preflight)', corsBad.join(' ') || 'ok', 'ok');
    const pre5173 = await raw('OPTIONS', '/users', { headers: { Origin: 'http://localhost:5173', 'Access-Control-Request-Method': 'GET', 'Access-Control-Request-Headers': 'authorization,x-client-type' } });
    check('H18p panel (5173) y app web siguen pudiendo llamar en desarrollo', `${pre5173.status}/${pre5173.headers.get('access-control-allow-origin')}`, process.env.CORS_ORIGIN ? `200/http://localhost:5173` : '200/*');

    // 4. Viajes con ruta absurda.
    const rb = (o) => ({ ...rideBody(2, inHours(1.5)), ...o });
    const same = { origin: { name: 'A', coordinates: { lat: 9.9325, lng: -84.0796 } }, destination: { name: 'A', coordinates: { lat: 9.9325, lng: -84.0796 } } };
    const bad = [
      ['origen = destino, distancia 0, precio 0 (ataque original)', rb({ ...same, distance_km: 0, suggested_price: 0 })],
      ['origen = destino con distancia inventada', rb({ ...same, distance_km: 5 })],
      ['distancia 0.4 km', rb({ distance_km: 0.4 })],
      ['distancia 5000 km', rb({ distance_km: 5000 })],
      ['distancia negativa', rb({ distance_km: -3 })],
      ['distancia menor que la línea recta', rb({ distance_km: 1 })],
      ['duración 0', rb({ duration_minutes: 0 })],
      ['duración 10 000 min', rb({ duration_minutes: 10000 })],
      ['sin distancia ni duración', (() => { const b = rb({}); delete b.distance_km; delete b.duration_minutes; return b; })()],
      ['precio negativo', rb({ suggested_price: -1 })],
      ['precio enorme', rb({ suggested_price: 1e9 })],
      ['distancia en texto', rb({ distance_km: 'quince' })],
      ['coordenadas en texto', rb({ origin: { name: 'A', coordinates: { lat: 'x', lng: -84 } } })],
    ];
    pass = [];
    for (const [n, b] of bad) { const x = await call('POST', '/rides', hd1.token, b); if (x.status !== 400) pass.push(n + ':' + x.status); }
    check(`H18q viajes con ruta inválida (${bad.length} variantes)`, pass.join(' | ') || 'todos 400', 'todos 400');
    r = await call('POST', '/rides', hd1.token, rb({ suggested_price: 4050 }));
    check('H18r viaje válido sigue publicándose', r.status, 201, r.text.slice(0, 120));

    // 5. /rides/in-progress solo admin y con la forma que usa el panel.
    await db.collection('rides').updateOne({ _id: oid(rideR) }, { $set: { status: 'in progress' } });
    await db.collection('users').updateOne({ _id: oid(dB.id) }, { $set: { currentLocation: { lat: 9.95, lng: -84.1, updatedAt: new Date() } } });
    r = await call('GET', '/rides/in-progress', admin.token);
    const ip = (r.body?.data || []).find((x) => x._id === rideR);
    check('H18s admin ve los viajes en curso con la forma del panel', `${r.status}/${!!ip}/${ip && ['driver', 'vehicle', 'origin', 'destination', 'last_location', 'started_at', 'passenger_count'].every((k) => k in ip)}/${ip?.last_location?.lat}`, '200/true/true/9.95');
    check('H18t sin correo ni teléfono en el monitoreo', /"(email|phone|password|refreshToken)"/.test(r.text), false);
    pass = [];
    for (const [who, tok] of [['pasajero', hp3.token], ['conductor', dB.token], ['sin token', null], ['firma ajena', jwt.sign({ userId: admin.id || X, typ: 'access' }, 'otro-secreto')]]) {
      const x = await call('GET', '/rides/in-progress', tok); if (![401, 403].includes(x.status)) pass.push(who + ':' + x.status);
    }
    check('H18u /rides/in-progress para no-admin (4 variantes)', pass.join(' ') || 'todos 401/403', 'todos 401/403');
    await db.collection('rides').updateOne({ _id: oid(rideR) }, { $set: { status: 'scheduled' } });

    // 6. /documents no existe; 8. /vehicles/driver/:id sin vehículo no filtra.
    r = await call('GET', '/documents/x', admin.token);
    const r6b = await call('POST', `/vehicles/${vH}/documents`, admin.token, {});
    // Desde la ronda 4 /vehicles/:id/documents existe (solo el conductor dueño): el admin recibe 403.
    check('H18v ruta /documents inexistente 404; subir documento como admin 403', `${r.status}/${r6b.status}`, '404/403');
    r = await call('GET', `/vehicles/driver/${hp3.id}`, pA.token);
    check('H18w /vehicles/driver/:id sin vehículo: 404 sin datos', `${r.status}/${Object.keys(r.body || {}).sort().join(',')}`, '404/message,success');

    // 7. DELETE /users/me: límite de intentos (módulo, en desarrollo está apagado).
    const express = require(BE + '/node_modules/express');
    const limPath = require.resolve(BE + '/src/middleware/rateLimiter');
    const prevEnv = process.env.NODE_ENV; process.env.NODE_ENV = 'staging';
    delete require.cache[limPath]; const lim = require(limPath);
    process.env.NODE_ENV = prevEnv; delete require.cache[limPath];
    const app = express();
    app.use((q, s, n) => { q.user = { _id: q.headers['x-user'] }; n(); });
    app.delete('/me', lim.deleteAccountIpLimiter, lim.deleteAccountUserLimiter, (q, s) => s.status(q.headers['x-ok'] ? 200 : 403).json({}));
    const srv = app.listen(0); const port = srv.address().port;
    const del = async (user, ok) => (await fetch(`http://127.0.0.1:${port}/me`, { method: 'DELETE', headers: { 'x-user': user, ...(ok ? { 'x-ok': '1' } : {}) } })).status;
    let n429 = 0; for (let i = 0; i < 8; i++) if ((await del('u1')) === 429) n429++;
    check('H18x 8 contraseñas incorrectas del mismo usuario: tope 5', n429, 3);
    n429 = 0; for (let i = 0; i < 4; i++) if ((await del('u2', true)) === 429) n429++;
    check('H18y los intentos correctos no cuentan', n429, 0);
    n429 = 0; for (let i = 0; i < 20; i++) if ((await del('u' + (10 + i))) === 429) n429++;
    check('H18z muchos usuarios desde la misma IP: tope 20 fallidos', n429 >= 5, true);
    srv.close();
  }


  // H19 Ronda 4: rutas del panel de administración.
  {
    let pass;
    const adminDoc = await db.collection('users').findOne({ email: 'naomy.admin@saferide.cr' });
    const otherAdmin = await db.collection('users').findOne({ type: 'admin', _id: { $ne: adminDoc._id } });
    const notFound = '0123456789abcdef01234567';
    const auditHas = async (action, targetId) => !!(await db.collection('auditlogs').findOne({ action, targetId: oid(targetId) }));

    // --- PATCH /auth/change-password (mismo controlador que PUT /auth/password)
    const hc = await hReg('pasajero', 'hc');
    r = await call('PATCH', '/auth/change-password', hc.token, { currentPassword: 'Incorrecta1!', newPassword: 'Nueva!Pass1' });
    check('H19a change-password con la actual incorrecta: 403 (no 401, que cierra la sesión)', `${r.status}/${r.body?.code}`, '403/WRONG_PASSWORD');
    pass = [];
    for (const b of [{ currentPassword: { $ne: '' }, newPassword: 'Nueva!Pass1' }, { currentPassword: ['x'], newPassword: 'Nueva!Pass1' }, { currentPassword: PW, newPassword: 'corta' }, { currentPassword: PW, newPassword: 12345678 }]) {
      const x = await call('PATCH', '/auth/change-password', hc.token, b); if (x.status !== 400) pass.push(JSON.stringify(b).slice(0, 40) + ':' + x.status);
    }
    check('H19b change-password con tipos u operadores (4 variantes)', pass.join(' ') || 'todos 400', 'todos 400');
    r = await call('PATCH', '/auth/change-password', null, { currentPassword: PW, newPassword: 'Nueva!Pass1' });
    check('H19c change-password sin sesión', r.status, 401);
    r = await call('PATCH', '/auth/change-password', hc.token, { currentPassword: PW, newPassword: 'Nueva!Pass1' });
    const relogC = await call('POST', '/auth/login', null, { email: hc.email, password: 'Nueva!Pass1' });
    check('H19d change-password correcto y login con la nueva', `${r.status}/${relogC.status}`, '200/200');

    // --- POST /auth/logout-all
    const s2 = relogC.body?.data;
    r = await call('POST', '/auth/logout-all', null);
    check('H19e logout-all sin sesión', r.status, 401);
    r = await call('POST', '/auth/logout-all', s2.refreshToken);
    check('H19f logout-all con refresh token como access', r.status, 401);
    r = await call('POST', '/auth/logout-all', hc.token);
    const a1 = await call('GET', '/auth/me', hc.token);
    const a2 = await call('GET', '/auth/me', s2.accessToken);
    const rf = await call('POST', '/auth/refresh', null, { refreshToken: s2.refreshToken });
    check('H19g logout-all cierra todas las sesiones (2 access + refresh)', `${r.status}/${a1.status}/${a2.status}/${rf.status}`, '200/401/401/401');
    const relog2 = await call('POST', '/auth/login', null, { email: hc.email, password: 'Nueva!Pass1' });
    r = await call('GET', '/auth/me', relog2.body?.data?.accessToken);
    check('H19h después de logout-all se puede volver a entrar', `${relog2.status}/${r.status}`, '200/200');
    hc.token = relog2.body?.data?.accessToken;

    // --- DELETE /users/:id/hard
    const hx = await hReg('pasajero', 'hx');
    pass = [];
    for (const [who, tok] of [['pasajero', hp2.token], ['conductor', dA.token], ['sin token', null], ['firma ajena', jwt.sign({ userId: adminDoc._id.toString(), typ: 'access' }, 'otro-secreto')]]) {
      const x = await call('DELETE', `/users/${hx.id}/hard`, tok); if (![401, 403].includes(x.status)) pass.push(who + ':' + x.status);
    }
    check('H19i borrado definitivo por no-admin (4 variantes)', pass.join(' ') || 'todos 401/403', 'todos 401/403');
    r = await call('DELETE', `/users/${adminDoc._id}/hard`, admin.token);
    check('H19j el admin no se borra a sí mismo', `${r.status}/${r.body?.code}`, '400/SELF_DELETE');
    r = await call('DELETE', `/users/${otherAdmin?._id}/hard`, admin.token);
    check('H19k el admin no borra a otro admin', `${r.status}/${r.body?.code}`, '403/ADMIN_TARGET');
    pass = [];
    for (const id of ['abc', '%7B%22%24ne%22%3A1%7D', '123', notFound + 'ff']) {
      const x = await call('DELETE', `/users/${id}/hard`, admin.token); if (x.status !== 400) pass.push(id + ':' + x.status);
    }
    check('H19l IDs inválidos u operadores en el path (4 variantes)', pass.join(' ') || 'todos 400', 'todos 400');
    r = await call('DELETE', `/users/${notFound}/hard`, admin.token);
    check('H19m usuario inexistente', r.status, 404);
    r = await call('DELETE', `/users/${hp1.id}/hard`, admin.token);
    check('H19n bloqueado con cobro pendiente', `${r.status}/${r.body?.code}`, '409/PENDING_PAYMENTS');
    r = await call('DELETE', `/users/${hp3.id}/hard`, admin.token);
    check('H19o bloqueado con reserva activa', `${r.status}/${r.body?.code}`, '409/ACTIVE_TRIPS');
    r = await call('DELETE', `/users/${hx.id}/hard`, admin.token);
    const hxDoc = await db.collection('users').findOne({ _id: oid(hx.id) });
    check('H19p usuario sin historial: se borra del todo', `${r.status}/${r.body?.data?.mode}/${!!hxDoc}`, '200/deleted/false');
    check('H19q queda en la auditoría', await auditHas('USER_HARD_DELETED', hx.id), true);
    const hy = await hReg('pasajero', 'hy');
    await db.collection('reviews').insertOne({ ride_id: oid(rideH), reviewer_id: oid(hy.id), reviewee_id: oid(hd1.id), rating: 4, date: new Date() });
    r = await call('DELETE', `/users/${hy.id}/hard`, admin.token);
    const hyDoc = await db.collection('users').findOne({ _id: oid(hy.id) });
    check('H19r con historial ajeno: se anonimiza (sin correo ni nombre)', `${r.status}/${r.body?.data?.mode}/${hyDoc?.name}/${hyDoc?.email?.endsWith('@saferide.invalid')}`, '200/anonymized/Usuario eliminado/true');
    r = await call('GET', '/auth/me', hy.token);
    check('H19s el token del usuario borrado ya no sirve', r.status, 401);

    // --- GET /audit-logs
    r = await call('GET', '/audit-logs?limit=100', admin.token);
    check('H19t auditoría para admin con la forma del panel', `${r.status}/${Array.isArray(r.body?.data)}/${['_id', 'action', 'adminEmail', 'details', 'targetType', 'createdAt'].every(k => k in (r.body?.data?.[0] || {}))}`, '200/true/true');
    check('H19u la auditoría no expone contraseñas ni tokens', /password|refreshToken|eyJ[\w-]+\./i.test(r.text), false);
    await call('PATCH', `/users/${hp2.id}/trust`, admin.token, { action: 'decrement' });
    check('H19v cambio de trust registrado en la auditoría', await auditHas('USER_TRUST_CHANGED', hp2.id), true);
    pass = [];
    for (const [who, tok] of [['pasajero', hp2.token], ['conductor', dA.token], ['sin token', null]]) {
      const x = await call('GET', '/audit-logs', tok); if (![401, 403].includes(x.status)) pass.push(who + ':' + x.status);
    }
    check('H19w auditoría para no-admin', pass.join(' ') || 'todos 401/403', 'todos 401/403');
    pass = [];
    for (const q of ['action=NO_EXISTE', 'action=USER_ACTIVATED&action=USER_DEACTIVATED', 'adminId=abc', 'limit=1000', 'from=ayer', 'targetType=Ride']) {
      const x = await call('GET', '/audit-logs?' + q, admin.token); if (x.status !== 400) pass.push(q + ':' + x.status);
    }
    check('H19x filtros inválidos de auditoría (6 variantes)', pass.join(' ') || 'todos 400', 'todos 400');
    r = await call('GET', '/audit-logs?action=USER_HARD_DELETED&limit=5', admin.token);
    check('H19y filtro por acción', (r.body?.data || []).every(l => l.action === 'USER_HARD_DELETED') && r.body.data.length > 0, true);

    // --- Documentos: alta desde el registro de la app (URL de Cloudinary)
    const hdd = await hReg('conductor', 'hdd');
    const vbody = (o) => ({ brand: 'Kia', model: 'Rio', license_plate: 'QD' + tag.slice(-4).toUpperCase().replace(/[^A-Z0-9]/g, '3'), color: 'Gris', year: 2021, capacity: 4, policy_number: 'POL-123', insurance_expiry: '2027-05-01T00:00:00.000Z', ...o });
    pass = [];
    for (const u of ['http://res.cloudinary.com/demo/image/upload/v1/c.jpg', 'https://evil.example/c.jpg', 'https://res.cloudinary.com.evil.example/demo/image/upload/c.jpg', 'javascript:alert(1)', 'https://res.cloudinary.com/demo/image/upload/../../x', { $ne: null }]) {
      const x = await call('POST', '/vehicles', hdd.token, vbody({ insurance_certificate: u })); if (x.status !== 400) pass.push(JSON.stringify(u).slice(0, 50) + ':' + x.status);
    }
    check('H19z certificado de póliza fuera de Cloudinary https (6 variantes)', pass.join(' | ') || 'todos 400', 'todos 400');
    r = await call('POST', '/vehicles', hdd.token, vbody({ insurance_certificate: 'https://res.cloudinary.com/demo/image/upload/v1700000000/insurance_cert_1.jpg' }));
    const vD = r.body?.data?._id;
    const docD = await db.collection('vehicledocuments').findOne({ vehicle_id: oid(vD) });
    check('H19A el registro con certificado crea la póliza pendiente', `${r.status}/${docD?.type}/${docD?.status}/${docD?.extractedData?.policyNumber}`, '201/poliza/pending/POL-123');
    const docId = docD?._id?.toString() || notFound;

    // --- GET /documents/driver/:id y /documents/admin/pending
    r = await call('GET', `/documents/driver/${hdd.id}`, hdd.token);
    check('H19B el conductor ve sus documentos', `${r.status}/${r.body?.data?.length}`, '200/1');
    pass = [];
    for (const [who, tok] of [['otro pasajero', hp2.token], ['otro conductor', dA.token], ['sin token', null]]) {
      const x = await call('GET', `/documents/driver/${hdd.id}`, tok); if (![401, 403].includes(x.status)) pass.push(who + ':' + x.status);
    }
    check('H19C documentos de otro conductor', pass.join(' ') || 'todos 401/403', 'todos 401/403');
    r = await call('GET', '/documents/driver/abc', admin.token);
    check('H19D id inválido', r.status, 400);
    r = await call('GET', '/documents/admin/pending?limit=200', admin.token);
    check('H19E pendientes para admin incluyen la póliza', `${r.status}/${(r.body?.data || []).some(d => d._id === docId)}/${'pagination' in (r.body || {})}`, '200/true/true');
    check('H19F los documentos no exponen quién revisó por correo ni datos del usuario', /"email"|"phone"|password/.test(r.text), false);
    pass = [];
    for (const [q, tok] of [['', hp2.token], ['', hdd.token], ['?limit=1000', admin.token], ['?page=0', admin.token]]) {
      const x = await call('GET', '/documents/admin/pending' + q, tok); if (![400, 403].includes(x.status)) pass.push((q || 'rol') + ':' + x.status);
    }
    check('H19G pendientes: rol y paginación inválidos (4 variantes)', pass.join(' ') || 'todos 400/403', 'todos 400/403');

    // --- PATCH /documents/:id/review
    pass = [];
    for (const [b, tok, want] of [
      [{ action: 'approve' }, hp2.token, 403], [{ action: 'approve' }, hdd.token, 403],
      [{ action: 'delete' }, admin.token, 400], [{ action: ['approve'] }, admin.token, 400],
      [{ action: { $ne: '' } }, admin.token, 400], [{ action: 'reject' }, admin.token, 400],
      [{ action: 'reject', reason: 'a\u0000b c' }, admin.token, 400], [{ action: 'request_resend', reason: { a: 1 } }, admin.token, 400],
      [{ action: 'reject', reason: 'x'.repeat(301) }, admin.token, 400],
    ]) {
      const x = await call('PATCH', `/documents/${docId}/review`, tok, b); if (x.status !== want) pass.push(JSON.stringify(b).slice(0, 40) + ':' + x.status);
    }
    check('H19H revisión: roles, acciones y motivos inválidos (9 variantes)', pass.join(' | ') || 'ok', 'ok');
    r = await call('PATCH', '/documents/abc/review', admin.token, { action: 'approve' });
    const r404 = await call('PATCH', `/documents/${notFound}/review`, admin.token, { action: 'approve' });
    check('H19I revisión con id inválido / inexistente', `${r.status}/${r404.status}`, '400/404');
    r = await call('PATCH', `/documents/${docId}/review`, admin.token, { action: 'request_resend', reason: 'La foto está borrosa' });
    check('H19J pedir reenvío', `${r.status}/${r.body?.data?.status}/${r.body?.data?.resendRequested}`, '200/rejected/true');
    r = await call('PATCH', `/documents/${docId}/review`, admin.token, { action: 'approve' });
    check('H19K aprobar', `${r.status}/${r.body?.data?.status}/${r.body?.data?.rejectionReason}`, '200/approved/null');
    check('H19L revisión registrada en la auditoría', `${await auditHas('DOCUMENT_RESEND_REQUESTED', docId)}/${await auditHas('DOCUMENT_APPROVED', docId)}`, 'true/true');

    // --- POST /documents/:id/reprocess
    r = await call('POST', `/documents/${docId}/reprocess`, admin.token);
    check('H19M reprocesar sin servicio de análisis: 503 con código estable', `${r.status}/${r.body?.code}`, '503/ANALYSIS_NOT_CONFIGURED');
    const rp = await call('POST', `/documents/${docId}/reprocess`, hdd.token);
    const rn = await call('POST', `/documents/${notFound}/reprocess`, admin.token);
    const ri = await call('POST', '/documents/abc/reprocess', admin.token);
    check('H19N reprocesar: conductor / inexistente / id inválido', `${rp.status}/${rn.status}/${ri.status}`, '403/404/400');

    // --- POST /vehicles/:id/documents (multipart)
    const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(64, 1)]);
    const PDF = Buffer.from('%PDF-1.4\n%qa\n');
    const up = async (vid, tok, { type = 'licencia', buf = PNG, mime = 'image/png', name = 'doc.png', field = 'file' } = {}) => {
      const fd = new FormData();
      if (type !== undefined) fd.append('type', type);
      if (buf) fd.append(field, new Blob([buf], { type: mime }), name);
      const res = await fetch(`${base}/vehicles/${vid}/documents`, { method: 'POST', headers: tok ? { Authorization: 'Bearer ' + tok } : {}, body: fd });
      let j = null; try { j = await res.json(); } catch {}
      return { status: res.status, body: j };
    };
    pass = [];
    for (const [n, o, want] of [
      ['SVG', { buf: Buffer.from('<svg onload=alert(1)>'), mime: 'image/svg+xml', name: 'a.svg' }, [400]],
      ['HTML', { buf: Buffer.from('<html>'), mime: 'text/html', name: 'a.html' }, [400]],
      ['PNG falso (contenido HTML)', { buf: Buffer.from('<html><script>x</script>'), mime: 'image/png' }, [400]],
      ['PDF falso', { buf: Buffer.from('MZ\x90\x00'), mime: 'application/pdf', name: 'a.pdf' }, [400]],
      ['sin archivo', { buf: null }, [400]],
      ['tipo inválido', { type: 'pasaporte' }, [400]],
      ['tipo vacío', { type: '' }, [400]],
      ['archivo de 6 MB', { buf: Buffer.concat([PNG, Buffer.alloc(6 * 1024 * 1024)]) }, [413]],
      ['dos archivos / otro campo', { field: 'otro' }, [400]],
    ]) {
      const x = await up(vD, hdd.token, o); if (!want.includes(x.status)) pass.push(n + ':' + x.status);
    }
    check('H19O subida: archivos y tipos inválidos (9 variantes)', pass.join(' | ') || 'ok', 'ok');
    pass = [];
    for (const [who, tok] of [['otro conductor', dA.token], ['admin', admin.token], ['pasajero', hp2.token], ['sin token', null]]) {
      const x = await up(vD, tok); if (![401, 403].includes(x.status)) pass.push(who + ':' + x.status);
    }
    check('H19P subir a un vehículo ajeno o sin rol (4 variantes)', pass.join(' ') || 'todos 401/403', 'todos 401/403');
    r = await up('abc', hdd.token);
    check('H19Q subir con id de vehículo inválido', r.status, 400);
    r = await up(vD, hdd.token, { type: 'rtv', buf: PDF, mime: 'application/pdf', name: 'rtv.pdf' });
    check('H19R PDF válido del dueño: se guarda o 503 claro si no hay almacenamiento', `${r.status}/${r.status === 503 ? r.body?.code : 'ok'}`, ['201/ok', '503/STORAGE_NOT_CONFIGURED']);

    // --- DELETE /vehicles/:id/documents/:docId
    r = await call('DELETE', `/vehicles/${vD}/documents/${docId}`, dA.token);
    check('H19S borrar documento de un vehículo ajeno', r.status, 403);
    r = await call('DELETE', `/vehicles/${vD}/documents/poliza`, hdd.token);
    check('H19T el dueño no borra un documento ya aprobado (por tipo)', `${r.status}/${r.body?.code}`, '409/DOCUMENT_APPROVED');
    pass = [];
    for (const d of ['abc', 'pasaporte', '%24ne', notFound + '0']) {
      const x = await call('DELETE', `/vehicles/${vD}/documents/${d}`, hdd.token); if (x.status !== 400) pass.push(d + ':' + x.status);
    }
    check('H19U borrar con docId inválido (4 variantes)', pass.join(' ') || 'todos 400', 'todos 400');
    const pend = await db.collection('vehicledocuments').insertOne({ driver_id: oid(hdd.id), vehicle_id: oid(vD), type: 'marchamo', fileUrl: 'https://res.cloudinary.com/demo/image/upload/m.jpg', source: 'app_registration', status: 'pending', createdAt: new Date(), updatedAt: new Date() });
    r = await call('DELETE', `/vehicles/${vD}/documents/${pend.insertedId}`, hdd.token);
    check('H19V el dueño borra un documento pendiente', `${r.status}/${!!(await db.collection('vehicledocuments').findOne({ _id: pend.insertedId }))}`, '200/false');
  }


  // H20 Ronda 5: listado global de reservas, resumen de pagos, cuentas
  // eliminadas en los listados y tope de offered_amount.
  {
    let pass;
    // --- GET /bookings (pasajero: solo las suyas, forma de siempre)
    r = await call('GET', '/bookings?limit=50', hp1.token);
    check('H20a pasajero: solo sus reservas y ride_id completo (forma de la app)', `${r.status}/${(r.body?.data || []).every(b => String(b.passenger_id?._id || b.passenger_id) === hp1.id)}/${'available_seats' in (r.body?.data?.[0]?.ride_id || {})}`, '200/true/true');
    pass = [];
    for (const q of [`userId=${hp2.id}`, 'payment_status=pending', `search=${encodeURIComponent(hp2.email)}`, 'limit=1000']) {
      const x = await call('GET', '/bookings?' + q, hp1.token);
      if (x.status !== 200 || !(x.body?.data || []).every(b => String(b.passenger_id?._id || b.passenger_id) === hp1.id)) pass.push(q + ':' + x.status);
    }
    check('H20b pasajero no ve reservas ajenas con filtros de admin (4 variantes)', pass.join(' ') || 'solo las suyas', 'solo las suyas');
    r = await call('GET', '/bookings?limit=500', hp1.token);
    check('H20c tope de 100 para la app', (r.body?.data || []).length <= 100 && r.body?.pagination?.pages >= 1, true);

    // --- GET /bookings (admin)
    pass = [];
    for (const q of ['status=XX', 'payment_status=pending&payment_status=paid', 'limit=5000', 'from=ayer', 'search=' + 'x'.repeat(61), 'sort=up', 'userId=abc', 'payment_method=bitcoin', 'payment_type=free', 'page=0']) {
      const x = await call('GET', '/bookings?' + q, admin.token); if (x.status !== 400) pass.push(q.slice(0, 30) + ':' + x.status);
    }
    check('H20d filtros inválidos del listado (10 variantes)', pass.join(' | ') || 'todos 400', 'todos 400');
    const total = (await call('GET', '/bookings?limit=1', admin.token)).body?.pagination?.total;
    pass = [];
    for (const s of ['.*', '(a+)+$', '^', '[a-z]', '\\', '|']) {
      const t0 = Date.now();
      const x = await call('GET', '/bookings?limit=5&search=' + encodeURIComponent(s), admin.token);
      if (x.status !== 200 || x.body?.pagination?.total === total || Date.now() - t0 > 3000) pass.push(JSON.stringify(s) + ':' + x.status + '/' + x.body?.pagination?.total);
    }
    check('H20e búsqueda con metacaracteres de regex: se busca literal (6 variantes)', pass.join(' ') || 'literal', 'literal');
    r = await call('GET', '/bookings?limit=50&search=' + encodeURIComponent('(QA) pasajero h1'), admin.token);
    check('H20f búsqueda por nombre del pasajero (con paréntesis)', (r.body?.data || []).some(b => b._id === bH1), true);
    r = await call('GET', '/bookings?limit=50&search=' + encodeURIComponent(hd1.email.toUpperCase()), admin.token);
    check('H20g búsqueda por correo del conductor (mayúsculas)', (r.body?.data || []).some(b => b._id === bH1), true);
    r = await call('GET', '/bookings?limit=200', admin.token);
    check('H20h listado del panel sin teléfonos, contraseñas ni tokens', /"phone"|password|refreshToken|tokenVersion|expoPushToken|currentLocation/.test(r.text), false);
    const b0 = (r.body?.data || []).find(b => b._id === bH1);
    check('H20i reserva con pasajero, conductor y viaje poblados (campos de tabla)', `${!!b0?.passenger_id?.name}/${!!b0?.passenger_id?.email}/${!!b0?.ride_id?.driver_id?.name}/${!!b0?.ride_id?.origin?.name}`, 'true/true/true/true');
    r = await call('GET', '/bookings?limit=200&payment_status=pending&status=completed', admin.token);
    check('H20j filtros combinados', (r.body?.data || []).every(b => b.payment_status === 'pending' && b.status === 'completed') && r.body.data.length > 0, true);
    r = await call('GET', '/bookings?limit=50&sort=asc', admin.token);
    const ds = (r.body?.data || []).map(b => new Date(b.createdAt).getTime());
    check('H20k orden por fecha ascendente', ds.every((d, i) => i === 0 || d >= ds[i - 1]), true);

    // --- GET /bookings/admin/summary
    r = await call('GET', '/bookings/admin/summary', admin.token);
    const sm = r.body?.data || {};
    const sumStatus = Object.values(sm.byStatus || {}).reduce((a, b) => a + b, 0);
    check('H20l resumen: forma y conteos consistentes', `${r.status}/${['charged', 'paid', 'pending', 'waived', 'paidUsd'].every(k => typeof sm.amounts?.[k] === 'number')}/${sumStatus === sm.totalBookings}`, '200/true/true');
    const dbPending = await db.collection('bookings').aggregate([{ $match: { status: 'completed', payment_status: 'pending', payment_type: { $ne: 'gifted' } } }, { $group: { _id: null, s: { $sum: '$charged_amount' } } }]).toArray();
    check('H20m monto pendiente = suma real en la base', sm.amounts?.pending, Math.round((dbPending[0]?.s || 0) * 100) / 100);
    pass = [];
    for (const [who, tok] of [['pasajero', hp1.token], ['conductor', dA.token], ['sin token', null], ['firma ajena', jwt.sign({ userId: X, typ: 'access' }, 'otro-secreto')]]) {
      const x = await call('GET', '/bookings/admin/summary', tok); if (![401, 403].includes(x.status)) pass.push(who + ':' + x.status);
    }
    check('H20n resumen para no-admin (4 variantes)', pass.join(' ') || 'todos 401/403', 'todos 401/403');
    r = await call('GET', '/bookings/admin/summary?from=ayer', admin.token);
    check('H20o resumen con fecha inválida', r.status, 400);

    // --- GET /users sin cuentas eliminadas por defecto
    const hidden = await db.collection('users').findOne({ deletedAt: { $ne: null } });
    r = await call('GET', '/users?limit=10000', admin.token);
    check('H20p listado de usuarios oculta las cuentas eliminadas', (r.body?.data || []).some(u => u.deletedAt), false);
    r = await call('GET', '/users?limit=10000&includeDeleted=true', admin.token);
    check('H20q con includeDeleted=true sí aparecen', !hidden || (r.body?.data || []).some(u => u._id === String(hidden._id)), true);
    pass = [];
    for (const q of ['includeDeleted=yes', 'includeDeleted=true&includeDeleted=true', 'type=root', 'limit=20000', 'initial=abc']) {
      const x = await call('GET', '/users?' + q, admin.token); if (x.status !== 400) pass.push(q + ':' + x.status);
    }
    check('H20r filtros inválidos de /users (5 variantes)', pass.join(' ') || 'todos 400', 'todos 400');
    pass = [];
    for (const q of ['search=.*', 'search=(a%2B)%2B%24', 'initial=(', 'initial=[', 'search=%5C']) {
      const x = await call('GET', '/users?limit=5&' + q, admin.token); if (x.status !== 200 || (q === 'search=.*' && x.body?.pagination?.total > 0)) pass.push(q + ':' + x.status + '/' + x.body?.pagination?.total);
    }
    check('H20s búsqueda e inicial con metacaracteres: literal y sin 500 (5 variantes)', pass.join(' ') || 'ok', 'ok');
    r = await call('GET', '/users?includeDeleted=true', hp1.token);
    check('H20t pasajero no lista usuarios', r.status, 403);
    r = await call('GET', '/users?search=&initial=&limit=9', admin.token);
    check('H20u filtros vacíos del panel siguen funcionando', r.status, 200);

    // --- offered_amount con tope (ruta + modelo)
    const hpo = await hReg('pasajero', 'hpo');
    pass = [];
    for (const v of [250001, 1e9, '250000.5', 1e308]) {
      const x = await call('POST', '/bookings', hpo.token, { ride_id: rideR, seats_booked: 1, offered_amount: v }); if (x.status !== 400) pass.push(v + ':' + x.status);
    }
    check('H20v offered_amount por encima de ₡250 000 (4 variantes)', pass.join(' ') || 'todos 400', 'todos 400');
    r = await call('POST', '/bookings', hpo.token, { ride_id: rideR, seats_booked: 1, offered_amount: 250000 });
    check('H20w ₡250 000 exactos sí', r.status, 201);
    await call('DELETE', `/bookings/${r.body?.data?._id}`, hpo.token);
    r = await call('POST', '/bookings', hpo.token, { ride_id: rideR, seats_booked: 1, offered_amount: 300000 });
    check('H20x al volver a solicitar tras cancelar, tampoco', r.status, 400);
    const BookingModel = require(BE + '/src/models/Bookings');
    let modelErr = null;
    try { await new BookingModel({ ride_id: oid(rideR), passenger_id: oid(hpo.id), offered_amount: 300000, charged_amount: 300000 }).validate(); } catch (e) { modelErr = Object.keys(e.errors || {}).sort().join(','); }
    check('H20y el modelo también lo rechaza', modelErr, 'charged_amount,offered_amount');
  }

  // ---------- limpieza ----------
  await db.collection('verificationcodes').deleteMany({ email: { $regex: `.${tag}@` } });
  const emails = [pA, pB, dA, dB, ...racers, ...extra].map(u => u.email).concat([`qa.mass.${tag}@intel.com`]);
  const users = await db.collection('users').find({ email: { $in: emails } }).toArray();
  const ids = users.map(u => u._id);
  // También por id: las cuentas borradas o anonimizadas ya no tienen su correo.
  for (const u of [pA, pB, dA, dB, ...racers, ...extra]) if (u.id && !ids.some(i => String(i) === String(u.id))) ids.push(new mongoose.Types.ObjectId(u.id));
  const qaVehicles = await db.collection('vehicles').find({ driver_id: { $in: ids } }).project({ _id: 1 }).toArray();
  const qaDocs = await db.collection('vehicledocuments').find({ driver_id: { $in: ids } }).project({ _id: 1 }).toArray();
  await db.collection('auditlogs').deleteMany({ targetId: { $in: [...ids, ...qaVehicles.map(v => v._id), ...qaDocs.map(d => d._id)] } });
  await db.collection('vehicledocuments').deleteMany({ driver_id: { $in: ids } });
  await db.collection('trusthistories').deleteMany({ user_id: { $in: ids } });
  await db.collection('metrics').deleteMany({ user_id: { $in: ids } });
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
