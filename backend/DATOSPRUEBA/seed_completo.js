/**
 * seed_completo.js — SafeRide Database Seeder (versión completa)
 *
 * Inserta datos abundantes en TODAS las colecciones de SafeRide_Local_Dev:
 *   • Users (3 admins + 20 conductores + 50 pasajeros)
 *   • Vehicles (1 activo por conductor)
 *   • Rides (mezcla de scheduled / in progress / completed / cancelled)
 *   • Bookings (mezcla de estados, pagos y tipos)
 *   • Reviews (calificaciones cruzadas conductor↔pasajero)
 *   • Notifications (todos los tipos)
 *   • Metrics (por usuario y rol)
 *   • TrustHistory (movimientos válidos de score)
 *   • VerificationCodes (códigos activos de ejemplo)
 *
 * Usa schemas INLINE para evitar validadores estrictos del modelo real
 * (p.ej. Ride.fecha == hoy) y poder generar histórico realista.
 *
 * Uso: node DATOSPRUEBA/seed_completo.js
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');

const MONGO_URI = process.env.COSMOS_CONNECTION_STRING || 'mongodb://127.0.0.1:27017';
const DB_NAME   = process.env.COSMOS_DATABASE          || 'SafeRide_Local_Dev';

// ── Schemas INLINE (laxos, para histórico) ─────────────────────
const userSchema = new mongoose.Schema({
  name: String, username: String, email: String, phone: String,
  password: String, company: String, work_schedule: String,
  rating: Number, type: String, profileImage: String,
  isActive: Boolean, trustScore: Number, optIn: Boolean,
  currentLocation: { lat: Number, lng: Number, updatedAt: Date },
}, { timestamps: true });

const vehicleSchema = new mongoose.Schema({
  driver_id: mongoose.Schema.Types.ObjectId,
  brand: String, model: String, license_plate: String,
  color: String, year: Number, capacity: Number,
  isActive: Boolean, vehicleImage: String,
}, { timestamps: true });

const rideSchema = new mongoose.Schema({
  driver_id: mongoose.Schema.Types.ObjectId,
  origin: { name: String, coordinates: { lat: Number, lng: Number } },
  destination: { name: String, coordinates: { lat: Number, lng: Number } },
  fecha: String, hora: String, available_seats: Number,
  status: String, distance_km: Number, duration_minutes: Number,
  suggested_price: Number,
}, { timestamps: true });

const bookingSchema = new mongoose.Schema({
  ride_id: mongoose.Schema.Types.ObjectId,
  passenger_id: mongoose.Schema.Types.ObjectId,
  status: String, seats_booked: Number, distance_km: Number,
  offered_amount: Number, charged_amount: Number,
  payment_status: String, payment_type: String,
  passenger_origin: String, passenger_destination: String,
  payment_reviewed_at: Date, timestamp: Date,
}, { timestamps: true });

const reviewSchema = new mongoose.Schema({
  ride_id: mongoose.Schema.Types.ObjectId,
  reviewer_id: mongoose.Schema.Types.ObjectId,
  reviewee_id: mongoose.Schema.Types.ObjectId,
  rating: Number, comment: String, date: Date,
}, { timestamps: true });

const notificationSchema = new mongoose.Schema({
  user_id: mongoose.Schema.Types.ObjectId,
  message: String, type: String, status: String, date: Date,
  relatedEntity: { entityType: String, entityId: mongoose.Schema.Types.ObjectId },
}, { timestamps: true });

const metricsSchema = new mongoose.Schema({
  user_id: mongoose.Schema.Types.ObjectId,
  role: String,
  kilometers_driven: Number, passenger_kilometers: Number,
  carbon_footprint: Number, total_rides: Number, total_passengers: Number,
  period: String, date: Date,
}, { timestamps: true });

const trustHistorySchema = new mongoose.Schema({
  user_id: mongoose.Schema.Types.ObjectId,
  previous_score: Number, new_score: Number, delta: Number,
  reason: String,
  actor_id: mongoose.Schema.Types.ObjectId,
  booking_id: mongoose.Schema.Types.ObjectId,
  ride_id: mongoose.Schema.Types.ObjectId,
}, { timestamps: { createdAt: true, updatedAt: false } });

const verificationCodeSchema = new mongoose.Schema({
  email: String, code: String, expiresAt: Date,
}, { timestamps: true });

const User             = mongoose.model('User',             userSchema);
const Vehicle          = mongoose.model('Vehicle',          vehicleSchema);
const Ride             = mongoose.model('Ride',             rideSchema);
const Booking          = mongoose.model('Booking',          bookingSchema);
const Review           = mongoose.model('Review',           reviewSchema);
const Notification     = mongoose.model('Notification',     notificationSchema);
const Metrics          = mongoose.model('Metrics',          metricsSchema);
const TrustHistory     = mongoose.model('TrustHistory',     trustHistorySchema);
const VerificationCode = mongoose.model('VerificationCode', verificationCodeSchema);

// ── Catálogos ──────────────────────────────────────────────────
const COMPANIES = [
  'Intel', 'Cargill', 'Deloitte', 'Citi', 'Experian',
  '3M', 'DHL', 'Bill Gosling Outsourcing (BGO)', 'WeWork Costa Rica',
  'Concentrix', 'Nestlé Costa Rica'
];

const SCHEDULES = [
  '06:00 - 14:00', '07:00 - 15:00', '08:00 - 16:00',
  '09:00 - 17:00', '14:00 - 22:00', '22:00 - 06:00'
];

const ORIGINS = [
  { name: 'San José Centro',         lat: 9.9281,  lng: -84.0907 },
  { name: 'Escazú - Plaza Tempo',    lat: 9.9182,  lng: -84.1461 },
  { name: 'Santa Ana',               lat: 9.9317,  lng: -84.1828 },
  { name: 'Alajuela Centro',         lat: 10.0162, lng: -84.2148 },
  { name: 'Heredia',                 lat: 9.9985,  lng: -84.1172 },
  { name: 'Cartago',                 lat: 9.8641,  lng: -83.9195 },
  { name: 'Desamparados',            lat: 9.8978,  lng: -84.0781 },
  { name: 'Moravia',                 lat: 9.9567,  lng: -84.0447 },
  { name: 'La Sabana',               lat: 9.9356,  lng: -84.1024 },
  { name: 'San Pedro',               lat: 9.9338,  lng: -84.0517 },
  { name: 'Tibás',                   lat: 9.9619,  lng: -84.0791 },
  { name: 'Curridabat',              lat: 9.9183,  lng: -84.0317 },
];

const DESTINATIONS = [
  { name: 'Zona Franca Coyol',        lat: 9.9897,  lng: -84.2467 },
  { name: 'Parque Empresarial Forum', lat: 9.9136,  lng: -84.1503 },
  { name: 'Intel CR - Belén',         lat: 9.9781,  lng: -84.1714 },
  { name: 'Deloitte - Escazú',        lat: 9.9185,  lng: -84.1423 },
  { name: 'Citi - Rohrmoser',         lat: 9.9399,  lng: -84.1086 },
  { name: 'Experian - Belén',         lat: 9.9736,  lng: -84.1689 },
  { name: 'DHL - La Uruca',           lat: 9.9449,  lng: -84.1223 },
  { name: 'Concentrix - Coyol',       lat: 9.9911,  lng: -84.2501 },
  { name: 'Nestlé - Santa Ana',       lat: 9.9321,  lng: -84.1871 },
  { name: '3M - Cartago',             lat: 9.8659,  lng: -83.9242 },
  { name: 'BGO - Lindora',            lat: 9.9434,  lng: -84.1796 },
  { name: 'Cargill - Pavas',          lat: 9.9438,  lng: -84.1325 },
];

const CAR_BRANDS = ['Toyota', 'Honda', 'Hyundai', 'Kia', 'Suzuki', 'Nissan', 'Mazda', 'Ford', 'Chevrolet', 'Volkswagen', 'Subaru', 'Mitsubishi'];
const CAR_MODELS = ['Corolla', 'Civic', 'Tucson', 'Sportage', 'Swift', 'Sentra', 'CX-5', 'Ranger', 'Tracker', 'Golf', 'Forester', 'Outlander'];
const CAR_COLORS = ['Blanco', 'Negro', 'Gris', 'Plateado', 'Azul', 'Rojo', 'Verde', 'Beige', 'Café', 'Champagne', 'Vino', 'Celeste'];

const RIDE_STATUSES    = ['scheduled', 'in progress', 'awaiting_payment_verification', 'completed', 'cancelled'];
const BOOKING_STATUSES = ['pending', 'confirmed', 'cancelled', 'completed', 'deny'];
const PAYMENT_STATUSES = ['pending', 'paid', 'waived'];
const PAYMENT_TYPES    = ['normal', 'gifted'];

const NOTIF_TYPES = [
  'booking_confirmed', 'booking_cancelled', 'booking_pending', 'booking_denied',
  'ride_reminder', 'ride_started', 'ride_completed', 'ride_cancelled',
  'review_request', 'system', 'trust_score_updated',
];
const NOTIF_MESSAGES = [
  'Tu reserva ha sido confirmada',
  'Tu viaje fue completado exitosamente',
  'Tienes una nueva solicitud de reserva',
  'Tu reserva fue denegada por el conductor',
  'Recordatorio: tu viaje inicia en 30 minutos',
  'El conductor inició el viaje',
  'Viaje finalizado, ¡gracias por usar SafeRide!',
  'El conductor canceló el viaje',
  'Por favor califica tu viaje reciente',
  'Sistema: Mantenimiento programado esta noche',
  'Tu puntaje de confianza fue actualizado',
];

const REVIEW_COMMENTS = [
  'Excelente conductor, muy puntual y amable.',
  'Viaje muy cómodo, lo recomiendo.',
  'Llegué a tiempo gracias al servicio.',
  'Muy buen trato, auto limpio y seguro.',
  'Conductor profesional y responsable.',
  'Pasajero puntual y respetuoso.',
  'Buen servicio, sin contratiempos.',
  'Conoce muy bien las rutas.',
  'Experiencia muy positiva, volvería a usar el servicio.',
  'Todo perfecto desde la salida hasta el destino.',
  'Música agradable y conversación amena.',
  'Auto en excelentes condiciones.',
];

const TRUST_REASONS = [
  'cancel_gifted_trip_passenger',
  'cancel_in_progress_ride_driver',
  'admin_increment',
  'admin_decrement',
  'admin_reset',
];

// ── Helpers ────────────────────────────────────────────────────
const pick = (arr, i) => arr[((i % arr.length) + arr.length) % arr.length];
const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const randFloat = (min, max, dec = 2) => parseFloat((Math.random() * (max - min) + min).toFixed(dec));

function plateFor(i) {
  // 6 chars: 3 letras + 3 dígitos
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  return `${pick(letters, i)}${pick(letters, i + 3)}${pick(letters, i + 7)}${String(100 + (i % 900)).padStart(3, '0')}`;
}

function todayDate(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function hourFromMinutes(totalMin) {
  const h = Math.floor(totalMin / 60) % 24;
  const m = totalMin % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function futureHour(offsetMin) {
  const d = new Date(Date.now() + offsetMin * 60000);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

// ── MAIN ───────────────────────────────────────────────────────
async function seed() {
  try {
    await mongoose.connect(`${MONGO_URI}/${DB_NAME}`);
    console.log(`✅ Conectado a MongoDB → ${DB_NAME}`);

    const password = await bcrypt.hash('SafeRide2024!', 10);

    // ── 0. Limpieza ──
    console.log('\n🧹 Limpiando colecciones...');
    await Promise.all([
      User.deleteMany({}),
      Vehicle.deleteMany({}),
      Ride.deleteMany({}),
      Booking.deleteMany({}),
      Review.deleteMany({}),
      Notification.deleteMany({}),
      Metrics.deleteMany({}),
      TrustHistory.deleteMany({}),
      VerificationCode.deleteMany({}),
    ]);

    // ── 1. ADMINISTRADORES (3) ──
    console.log('\n👑 Insertando 3 Administradores...');
    const admins = [
      { name: 'Naomy González',   username: 'naomy_admin',    email: 'naomy.admin@saferide.cr',    phone: '60000001', password, company: 'Intel',    type: 'admin', isActive: true, trustScore: 4, optIn: true },
      { name: 'Keylor Soporte',   username: 'keylor_soporte', email: 'keylor.soporte@saferide.cr', phone: '60000002', password, company: 'Cargill',  type: 'admin', isActive: true, trustScore: 4, optIn: true },
      { name: 'Chris Gerente',    username: 'chris_gerente',  email: 'chris.gerente@saferide.cr',  phone: '60000003', password, company: 'Deloitte', type: 'admin', isActive: true, trustScore: 4, optIn: true },
    ];
    const savedAdmins = await User.insertMany(admins);
    console.log(`   ✔️ ${savedAdmins.length} admins insertados`);

    // ── 2. CONDUCTORES (20) ──
    console.log('\n🚕 Insertando 20 Conductores...');
    const conductoresDocs = [];
    for (let i = 0; i < 20; i++) {
      const loc = ORIGINS[i % ORIGINS.length];
      conductoresDocs.push({
        name: `Conductor ${i + 1} Mora`,
        username: `conductor_${String(i + 1).padStart(2, '0')}`,
        email: `conductor${i + 1}@saferide.cr`,
        phone: `8${String(10000000 + i).slice(-7)}`,
        password,
        company: pick(COMPANIES, i),
        work_schedule: pick(SCHEDULES, i),
        rating: randFloat(3.5, 5.0, 1),
        type: 'conductor',
        isActive: i % 11 !== 10, // 1 inactivo de muestra
        trustScore: i % 7 === 0 ? 2 : 4, // algunos con score bajo
        optIn: i % 4 !== 0,
        currentLocation: { lat: loc.lat, lng: loc.lng, updatedAt: new Date() },
      });
    }
    const savedConductores = await User.insertMany(conductoresDocs);
    console.log(`   ✔️ ${savedConductores.length} conductores insertados`);

    // ── 3. PASAJEROS (50) ──
    console.log('\n🧍 Insertando 50 Pasajeros...');
    const pasajerosDocs = [];
    for (let i = 0; i < 50; i++) {
      pasajerosDocs.push({
        name: `Pasajero ${i + 1} Vega`,
        username: `pasajero_${String(i + 1).padStart(2, '0')}`,
        email: `pasajero${i + 1}@saferide.cr`,
        phone: `7${String(20000000 + i).slice(-7)}`,
        password,
        company: pick(COMPANIES, i + 3),
        work_schedule: pick(SCHEDULES, i + 1),
        rating: randFloat(3.5, 5.0, 1),
        type: 'pasajero',
        isActive: i % 17 !== 16,
        trustScore: i % 13 === 0 ? 0 : (i % 5 === 0 ? 2 : 4),
        optIn: i % 3 !== 0,
      });
    }
    const savedPasajeros = await User.insertMany(pasajerosDocs);
    console.log(`   ✔️ ${savedPasajeros.length} pasajeros insertados`);

    const allUsers = [...savedAdmins, ...savedConductores, ...savedPasajeros];

    // ── 4. VEHÍCULOS (1 por conductor) ──
    console.log('\n🚗 Insertando Vehículos...');
    const vehicles = savedConductores.map((c, i) => ({
      driver_id: c._id,
      brand: pick(CAR_BRANDS, i),
      model: pick(CAR_MODELS, i),
      license_plate: plateFor(i),
      color: pick(CAR_COLORS, i),
      year: 2015 + (i % 10),
      capacity: pick([4, 5, 5, 5, 6, 7], i),
      isActive: true,
    }));
    const savedVehicles = await Vehicle.insertMany(vehicles);
    console.log(`   ✔️ ${savedVehicles.length} vehículos insertados`);

    // ── 5. RIDES ──
    // Para cada conductor activo, generamos varios viajes:
    //  - 1 'scheduled' hoy (cumple validación del modelo real)
    //  - 1 'in progress' hoy
    //  - 3 'completed' en los días previos
    //  - 1 'cancelled' en el pasado
    console.log('\n🗺️  Insertando Viajes...');
    const today = todayDate(0);
    const rides = [];
    let minuteCursor = new Map(); // por conductor, para evitar conflicto < 5min

    function nextHourFor(driverIdx, baseMinFromMidnight) {
      const cur = minuteCursor.get(driverIdx) || baseMinFromMidnight;
      const next = cur + 30; // 30 min de separación
      minuteCursor.set(driverIdx, next);
      return hourFromMinutes(next);
    }

    for (let i = 0; i < savedConductores.length; i++) {
      const drv = savedConductores[i];
      const o1 = pick(ORIGINS, i);
      const d1 = pick(DESTINATIONS, i);
      const o2 = pick(ORIGINS, i + 4);
      const d2 = pick(DESTINATIONS, i + 4);

      // Scheduled hoy (futuro inmediato)
      rides.push({
        driver_id: drv._id,
        origin: { name: o1.name, coordinates: { lat: o1.lat, lng: o1.lng } },
        destination: { name: d1.name, coordinates: { lat: d1.lat, lng: d1.lng } },
        fecha: today,
        hora: futureHour(60 + i * 7), // separación >5min entre conductores distintos no aplica, solo intra-conductor
        available_seats: rand(2, 6),
        status: 'scheduled',
        distance_km: rand(5, 35),
        duration_minutes: rand(15, 60),
        suggested_price: rand(500, 2500),
      });

      // In progress hoy
      rides.push({
        driver_id: drv._id,
        origin: { name: o2.name, coordinates: { lat: o2.lat, lng: o2.lng } },
        destination: { name: d2.name, coordinates: { lat: d2.lat, lng: d2.lng } },
        fecha: today,
        hora: futureHour(140 + i * 9),
        available_seats: rand(0, 3),
        status: 'in progress',
        distance_km: rand(5, 30),
        duration_minutes: rand(15, 50),
        suggested_price: rand(500, 2200),
      });

      // 3 completed pasados
      for (let d = 1; d <= 3; d++) {
        const oP = pick(ORIGINS, i + d);
        const dP = pick(DESTINATIONS, i + d + 1);
        rides.push({
          driver_id: drv._id,
          origin: { name: oP.name, coordinates: { lat: oP.lat, lng: oP.lng } },
          destination: { name: dP.name, coordinates: { lat: dP.lat, lng: dP.lng } },
          fecha: todayDate(-d * 2),
          hora: hourFromMinutes(420 + i * 13 + d * 17), // ~07:00 onward
          available_seats: 0,
          status: 'completed',
          distance_km: rand(8, 40),
          duration_minutes: rand(20, 70),
          suggested_price: rand(700, 3000),
        });
      }

      // 1 cancelled pasado
      const oC = pick(ORIGINS, i + 6);
      const dC = pick(DESTINATIONS, i + 7);
      rides.push({
        driver_id: drv._id,
        origin: { name: oC.name, coordinates: { lat: oC.lat, lng: oC.lng } },
        destination: { name: dC.name, coordinates: { lat: dC.lat, lng: dC.lng } },
        fecha: todayDate(-rand(4, 14)),
        hora: hourFromMinutes(540 + i * 11),
        available_seats: rand(1, 4),
        status: 'cancelled',
        distance_km: rand(5, 25),
        duration_minutes: rand(15, 45),
        suggested_price: rand(500, 2000),
      });
    }

    const savedRides = await Ride.insertMany(rides);
    console.log(`   ✔️ ${savedRides.length} viajes insertados`);

    // ── 6. BOOKINGS ──
    // Cada ride completed/in progress recibe entre 1-4 bookings reales.
    // Pendings y deny también muestreados.
    console.log('\n📋 Insertando Reservas...');
    const bookings = [];
    const used = new Set(); // ride_id-passenger_id

    function addBooking(ride, passenger, overrides = {}) {
      const key = `${ride._id}-${passenger._id}`;
      if (used.has(key)) return;
      used.add(key);
      const oTxt = pick(ORIGINS, bookings.length).name;
      const dTxt = pick(DESTINATIONS, bookings.length + 3).name;
      const seats = rand(1, 2);
      const dist = rand(3, 30);
      const offered = rand(500, 2500);
      bookings.push({
        ride_id: ride._id,
        passenger_id: passenger._id,
        status: 'confirmed',
        seats_booked: seats,
        distance_km: dist,
        offered_amount: offered,
        charged_amount: 0,
        payment_status: 'pending',
        payment_type: 'normal',
        passenger_origin: oTxt,
        passenger_destination: dTxt,
        timestamp: new Date(),
        ...overrides,
      });
    }

    for (let i = 0; i < savedRides.length; i++) {
      const ride = savedRides[i];
      const n = rand(1, 4);
      for (let j = 0; j < n; j++) {
        const p = savedPasajeros[(i * 3 + j * 5) % savedPasajeros.length];
        let status = ride.status;
        let payStatus = 'pending';
        let payType = j % 5 === 0 ? 'gifted' : 'normal';
        let charged = 0;
        let reviewed = null;

        if (ride.status === 'completed') {
          status = 'completed';
          payStatus = payType === 'gifted' ? 'waived' : (j % 4 === 0 ? 'pending' : 'paid');
          charged = payType === 'gifted' ? 0 : rand(500, 2500);
          reviewed = new Date(Date.now() - rand(1, 10) * 86400000);
        } else if (ride.status === 'in progress') {
          status = 'confirmed';
        } else if (ride.status === 'cancelled') {
          status = j % 2 === 0 ? 'cancelled' : 'deny';
        } else if (ride.status === 'scheduled') {
          status = j % 3 === 0 ? 'pending' : 'confirmed';
        }

        addBooking(ride, p, {
          status,
          payment_status: payStatus,
          payment_type: payType,
          charged_amount: charged,
          payment_reviewed_at: reviewed,
        });
      }
    }

    const savedBookings = await Booking.insertMany(bookings);
    console.log(`   ✔️ ${savedBookings.length} reservas insertadas`);

    // ── 7. REVIEWS ──
    // Solo sobre rides 'completed' y bookings 'completed'. Cruzadas en ambos sentidos.
    console.log('\n⭐ Insertando Reseñas...');
    const reviews = [];
    const seenReview = new Set();
    const ridesById = new Map(savedRides.map(r => [String(r._id), r]));

    for (const b of savedBookings) {
      if (b.status !== 'completed') continue;
      const ride = ridesById.get(String(b.ride_id));
      if (!ride) continue;
      const driverId = ride.driver_id;
      const passengerId = b.passenger_id;

      // Pasajero → Conductor
      const k1 = `${ride._id}-${passengerId}-${driverId}`;
      if (!seenReview.has(k1)) {
        seenReview.add(k1);
        reviews.push({
          ride_id: ride._id,
          reviewer_id: passengerId,
          reviewee_id: driverId,
          rating: rand(3, 5),
          comment: pick(REVIEW_COMMENTS, reviews.length),
          date: new Date(Date.now() - rand(1, 10) * 86400000),
        });
      }
      // Conductor → Pasajero (60% de los casos)
      if (Math.random() < 0.6) {
        const k2 = `${ride._id}-${driverId}-${passengerId}`;
        if (!seenReview.has(k2)) {
          seenReview.add(k2);
          reviews.push({
            ride_id: ride._id,
            reviewer_id: driverId,
            reviewee_id: passengerId,
            rating: rand(3, 5),
            comment: pick(REVIEW_COMMENTS, reviews.length + 4),
            date: new Date(Date.now() - rand(1, 10) * 86400000),
          });
        }
      }
    }
    const savedReviews = await Review.insertMany(reviews);
    console.log(`   ✔️ ${savedReviews.length} reseñas insertadas`);

    // ── 8. NOTIFICATIONS ──
    console.log('\n🔔 Insertando Notificaciones...');
    const notifications = [];
    // ~6 notificaciones por usuario no-admin
    const targets = [...savedConductores, ...savedPasajeros];
    for (let i = 0; i < targets.length; i++) {
      const u = targets[i];
      for (let k = 0; k < 6; k++) {
        const type = pick(NOTIF_TYPES, i + k);
        const ride = savedRides[(i + k * 3) % savedRides.length];
        notifications.push({
          user_id: u._id,
          message: pick(NOTIF_MESSAGES, NOTIF_TYPES.indexOf(type)),
          type,
          status: k < 2 ? 'unread' : (k < 5 ? 'read' : 'archived'),
          date: new Date(Date.now() - rand(0, 14) * 86400000),
          relatedEntity: {
            entityType: ['booking_confirmed','booking_cancelled','booking_pending','booking_denied'].includes(type) ? 'booking'
                       : (type === 'system' || type === 'trust_score_updated' ? 'user' : 'ride'),
            entityId: type === 'system' || type === 'trust_score_updated' ? u._id : ride._id,
          },
        });
      }
    }
    const savedNotifications = await Notification.insertMany(notifications);
    console.log(`   ✔️ ${savedNotifications.length} notificaciones insertadas`);

    // ── 9. METRICS ──
    // Para cada conductor y pasajero: métrica 'total' + 'monthly'
    console.log('\n📊 Insertando Métricas...');
    const metrics = [];
    for (const c of savedConductores) {
      const km = rand(150, 2500);
      const passKm = km + rand(100, 1500);
      const rides_n = rand(10, 80);
      const passengers_n = rand(20, 200);
      metrics.push({
        user_id: c._id, role: 'conductor',
        kilometers_driven: km,
        passenger_kilometers: passKm,
        carbon_footprint: parseFloat((km * 0.21).toFixed(2)),
        total_rides: rides_n,
        total_passengers: passengers_n,
        period: 'total',
        date: new Date(),
      });
      metrics.push({
        user_id: c._id, role: 'conductor',
        kilometers_driven: rand(30, 400),
        passenger_kilometers: rand(50, 600),
        carbon_footprint: randFloat(5, 80, 2),
        total_rides: rand(2, 20),
        total_passengers: rand(4, 40),
        period: 'monthly',
        date: new Date(),
      });
    }
    for (const p of savedPasajeros) {
      const km = rand(20, 800);
      metrics.push({
        user_id: p._id, role: 'pasajero',
        kilometers_driven: km,
        passenger_kilometers: 0,
        carbon_footprint: parseFloat((km * 0.18).toFixed(2)),
        total_rides: rand(3, 50),
        total_passengers: 0,
        period: 'total',
        date: new Date(),
      });
      metrics.push({
        user_id: p._id, role: 'pasajero',
        kilometers_driven: rand(5, 150),
        passenger_kilometers: 0,
        carbon_footprint: randFloat(1, 25, 2),
        total_rides: rand(1, 12),
        total_passengers: 0,
        period: 'monthly',
        date: new Date(),
      });
    }
    const savedMetrics = await Metrics.insertMany(metrics);
    console.log(`   ✔️ ${savedMetrics.length} métricas insertadas`);

    // ── 10. TRUST HISTORY ──
    console.log('\n🛡️  Insertando historial de Trust Score...');
    const trustEntries = [];
    const admin0 = savedAdmins[0];
    for (let i = 0; i < 40; i++) {
      const u = pick([...savedConductores, ...savedPasajeros], i * 3);
      const prev = pick([4, 3, 2, 1], i);
      const reason = pick(TRUST_REASONS, i);
      let delta = 0;
      let newScore = prev;
      if (reason === 'admin_increment') { delta = 1; newScore = Math.min(4, prev + 1); }
      else if (reason === 'admin_decrement') { delta = -1; newScore = Math.max(0, prev - 1); }
      else if (reason === 'admin_reset') { delta = 4 - prev; newScore = 4; }
      else { delta = -1; newScore = Math.max(0, prev - 1); }

      trustEntries.push({
        user_id: u._id,
        previous_score: prev,
        new_score: newScore,
        delta,
        reason,
        actor_id: admin0._id,
        booking_id: savedBookings[i % savedBookings.length]?._id || null,
        ride_id: savedRides[i % savedRides.length]?._id || null,
      });
    }
    const savedTrust = await TrustHistory.insertMany(trustEntries);
    console.log(`   ✔️ ${savedTrust.length} entradas de trust history insertadas`);

    // ── 11. VERIFICATION CODES ──
    console.log('\n🔑 Insertando códigos de verificación de muestra...');
    const codes = savedPasajeros.slice(0, 5).map((p, i) => ({
      email: p.email,
      code: String(100000 + rand(1, 899999)),
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    }));
    const savedCodes = await VerificationCode.insertMany(codes);
    console.log(`   ✔️ ${savedCodes.length} códigos insertados`);

    // ── RESUMEN ──
    console.log('\n🎉 ¡Seed completado exitosamente!\n');
    console.log('═══════════════════════════════════════════════');
    console.log(`  👑 Administradores:    ${savedAdmins.length}`);
    console.log(`  🚕 Conductores:        ${savedConductores.length}`);
    console.log(`  🧍 Pasajeros:          ${savedPasajeros.length}`);
    console.log(`  🚗 Vehículos:          ${savedVehicles.length}`);
    console.log(`  🗺️  Viajes:             ${savedRides.length}`);
    console.log(`  📋 Reservas:           ${savedBookings.length}`);
    console.log(`  ⭐ Reseñas:            ${savedReviews.length}`);
    console.log(`  🔔 Notificaciones:     ${savedNotifications.length}`);
    console.log(`  📊 Métricas:           ${savedMetrics.length}`);
    console.log(`  🛡️  Trust History:     ${savedTrust.length}`);
    console.log(`  🔑 Códigos verif.:     ${savedCodes.length}`);
    console.log('═══════════════════════════════════════════════');
    console.log('\n📧 Credenciales de los 3 administradores:');
    console.log('   • naomy.admin@saferide.cr    (Naomy González)');
    console.log('   • keylor.soporte@saferide.cr (Keylor Soporte)');
    console.log('   • chris.gerente@saferide.cr  (Chris Gerente)');
    console.log('   Password (todos):  SafeRide2024!');
    console.log('');
  } catch (err) {
    console.error('❌ Error durante el seed:', err);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Desconectado de MongoDB.');
    process.exit(0);
  }
}

seed();
