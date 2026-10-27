/**
 * seed.js — SafeRide Database Seeder
 *
 * Inyecta 10 registros realistas en cada colección de MongoDB.
 * Conecta directamente a la base de datos (NO toca el backend).
 *
 * Uso: node seed.js
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');

// ── Conexión ──────────────────────────────────────────────────
const MONGO_URI = process.env.COSMOS_CONNECTION_STRING || 'mongodb://127.0.0.1:27017';
const DB_NAME   = process.env.COSMOS_DATABASE          || 'SafeRide_Local_Dev';

// ── Schemas inline (para no depender de los archivos del backend) ──
const userSchema = new mongoose.Schema({
  name: String, username: String, email: String, phone: String,
  password: String, company: String, work_schedule: String,
  rating: Number, type: String, profileImage: String,
  isActive: Boolean, currentLocation: { lat: Number, lng: Number, updatedAt: Date },
}, { timestamps: true });

const vehicleSchema = new mongoose.Schema({
  driver_id: mongoose.Schema.Types.ObjectId,
  brand: String, model: String, license_plate: String,
  color: String, year: Number, capacity: Number, isActive: Boolean,
}, { timestamps: true });

const rideSchema = new mongoose.Schema({
  driver_id: mongoose.Schema.Types.ObjectId,
  origin: { name: String, coordinates: { lat: Number, lng: Number } },
  destination: { name: String, coordinates: { lat: Number, lng: Number } },
  fecha: String, hora: String, available_seats: Number,
  status: String, distance_km: Number, duration_minutes: Number, price: Number,
}, { timestamps: true });

const bookingSchema = new mongoose.Schema({
  ride_id: mongoose.Schema.Types.ObjectId,
  passenger_id: mongoose.Schema.Types.ObjectId,
  status: String, seats_booked: Number,
  distance_km: Number, payment_status: String, payment_type: String,
  passenger_origin: String, passenger_destination: String,
}, { timestamps: true });

const reviewSchema = new mongoose.Schema({
  ride_id: mongoose.Schema.Types.ObjectId,
  reviewer_id: mongoose.Schema.Types.ObjectId,
  reviewee_id: mongoose.Schema.Types.ObjectId,
  rating: Number, comment: String,
}, { timestamps: true });

const notificationSchema = new mongoose.Schema({
  user_id: mongoose.Schema.Types.ObjectId,
  message: String, type: String, status: String,
  relatedEntity: { entityType: String, entityId: mongoose.Schema.Types.ObjectId },
}, { timestamps: true });

// ── Modelos ───────────────────────────────────────────────────
const User         = mongoose.model('User',         userSchema);
const Vehicle      = mongoose.model('Vehicle',      vehicleSchema);
const Ride         = mongoose.model('Ride',         rideSchema);
const Booking      = mongoose.model('Booking',      bookingSchema);
const Review       = mongoose.model('Review',       reviewSchema);
const Notification = mongoose.model('Notification', notificationSchema);

// ── Datos de referencia ───────────────────────────────────────
const COMPANIES = [
  'Intel', 'Cargill', 'Deloitte', 'Citi', 'Experian',
  '3M', 'DHL', 'Bill Gosling Outsourcing (BGO)', 'Concentrix', 'Nestlé Costa Rica'
];

const SCHEDULES = ['06:00 - 14:00', '07:00 - 15:00', '08:00 - 16:00', '14:00 - 22:00', '22:00 - 06:00'];

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
];

const DESTINATIONS = [
  { name: 'Zona Franca Coyol',       lat: 9.9897,  lng: -84.2467 },
  { name: 'Parque Empresarial Forum', lat: 9.9136, lng: -84.1503 },
  { name: 'Intel CR - Belen',        lat: 9.9781,  lng: -84.1714 },
  { name: 'Deloitte - Escazú',       lat: 9.9185,  lng: -84.1423 },
  { name: 'Citi - Rohrmoser',        lat: 9.9399,  lng: -84.1086 },
  { name: 'Experian - Belen',        lat: 9.9736,  lng: -84.1689 },
  { name: 'DHL - La Uruca',          lat: 9.9449,  lng: -84.1223 },
  { name: 'Concentrix - Coyol',      lat: 9.9911,  lng: -84.2501 },
  { name: 'Nestle - Santa Ana',      lat: 9.9321,  lng: -84.1871 },
  { name: '3M - Cartago',            lat: 9.8659,  lng: -83.9242 },
];

const BOOKING_STATUSES = ['confirmed', 'pending', 'completed', 'cancelled'];
const PAYMENT_STATUSES = ['paid', 'pending', 'waived'];
const PAYMENT_TYPES    = ['normal', 'gifted', 'promo', 'admin_override'];
const NOTIF_TYPES      = ['booking_confirmed', 'booking_cancelled', 'booking_pending', 'ride_completed', 'review_request', 'system'];
const NOTIF_MESSAGES   = [
  'Tu reserva ha sido confirmada',
  'Tu viaje fue completado exitosamente',
  'Tienes una nueva solicitud de reserva',
  'Por favor califica tu viaje reciente',
  'Recordatorio: tienes un viaje en 30 minutos',
  'Tu cuenta ha sido verificada',
  'Nuevo pasajero se unió a tu viaje',
  'Tu reserva fue cancelada por el conductor',
  'Pago procesado correctamente',
  'Sistema: Mantenimiento programado esta noche',
];

const REVIEW_COMMENTS = [
  'Excelente conductor, muy puntual y amable.',
  'El viaje fue muy cómodo, lo recomiendo.',
  'Llegué a tiempo gracias a este servicio.',
  'Muy buen trato, auto limpio y seguro.',
  'Conductor profesional y responsable.',
  'Pasajero puntual y respetuoso.',
  'Muy buen servicio, sin contratiempos.',
  'El conductor conoce bien las rutas.',
  'Experiencia muy positiva, volvería a usar el servicio.',
  'Todo perfecto desde la salida hasta el destino.',
];

const CAR_BRANDS  = ['Toyota', 'Honda', 'Hyundai', 'Kia', 'Suzuki', 'Nissan', 'Mazda', 'Ford', 'Chevrolet', 'Volkswagen'];
const CAR_MODELS  = ['Corolla', 'Civic', 'Tucson', 'Sportage', 'Swift', 'Sentra', 'CX-5', 'Ranger', 'Tracker', 'Golf'];
const CAR_COLORS  = ['Blanco', 'Negro', 'Gris', 'Plateado', 'Azul', 'Rojo', 'Verde', 'Beige', 'Café', 'Champagne'];

// ── Helper ────────────────────────────────────────────────────
const pick = (arr, i) => arr[i % arr.length];
const rand  = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

function plateFor(i) {
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  return `${pick(letters, i)}${pick(letters, i+3)}${String(i + 1000).slice(-4)}`;
}

function todayDate() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function futureHour(offsetMinutes) {
  const d = new Date(Date.now() + offsetMinutes * 60 * 1000);
  return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}

// ── MAIN SEED ─────────────────────────────────────────────────
async function seed() {
  try {
    await mongoose.connect(`${MONGO_URI}/${DB_NAME}`);
    console.log('✅ Conectado a MongoDB:', DB_NAME);

    const password = await bcrypt.hash('SafeRide2024!', 10);

    // ─────────────────────────────────────────
    // 1. USUARIOS: 5 conductores + 15 pasajeros + 3 administradores
    // ─────────────────────────────────────────
    console.log('\n📦 Insertando Usuarios...');
    await User.deleteMany({});

    const conductores     = [];
    const pasajeros       = [];
    const Administrador   = [];
    const Soporte         = [];
    const Gerente         = [];

    for (let i = 0; i < 5; i++) {
      conductores.push({
        name:          `Conductor Seed ${i + 1}`,
        username:      `conductor_seed_${i + 1}`,
        email:         `conductor${i + 1}.seed@saferide.cr`,
        phone:         `8${String(i + 10000000).slice(-7)}`,
        password,
        company:       pick(COMPANIES, i),
        work_schedule: pick(SCHEDULES, i),
        rating:        parseFloat((4 + Math.random()).toFixed(1)),
        type:          'conductor',
        isActive:      true,
        currentLocation: { lat: ORIGINS[i].lat, lng: ORIGINS[i].lng, updatedAt: new Date() },
      });
    }

    for (let i = 0; i < 15; i++) {
      pasajeros.push({
        name:          `Pasajero Seed ${i + 1}`,
        username:      `pasajero_seed_${i + 1}`,
        email:         `pasajero${i + 1}.seed@saferide.cr`,
        phone:         `7${String(i + 10000000).slice(-7)}`,
        password,
        company:       pick(COMPANIES, i + 5),
        work_schedule: pick(SCHEDULES, i + 2),
        rating:        parseFloat((4 + Math.random()).toFixed(1)),
        type:          'pasajero',
        isActive:      true,
      });
    }

    Administrador.push({
      name:          'Naomy',
      username:      'naomy_admin',
      email:         'admin.seed@saferide.cr',
      phone:         '60000001',
      password,
      company:       pick(COMPANIES, 0),
      type:          'admin',
      isActive:      true,
    });

    Soporte.push({
      name:          'Keylor',
      username:      'keylor_soporte',
      email:         'soporte.seed@saferide.cr',
      phone:         '60000002',
      password,
      company:       pick(COMPANIES, 1),
      type:          'admin',
      isActive:      true,
    });

    Gerente.push({
      name:          'Chris',
      username:      'chris_gerente',
      email:         'gerencia.seed@saferide.cr',
      phone:         '60000003',
      password,
      company:       pick(COMPANIES, 2),
      type:          'admin',
      isActive:      true,
    });
    const savedConductores = await User.insertMany(conductores);
    const savedPasajeros   = await User.insertMany(pasajeros);
    const savedAdmins      = await User.insertMany([...Administrador, ...Soporte, ...Gerente]);
    console.log(`   ✔️ ${savedConductores.length} conductores, ${savedPasajeros.length} pasajeros y ${savedAdmins.length} administradores insertados`);

    // ─────────────────────────────────────────
    // 2. VEHÍCULOS (1 por conductor)
    // ─────────────────────────────────────────
    console.log('\n🚗 Insertando Vehículos...');
    await Vehicle.deleteMany({});

    const vehicles = savedConductores.map((c, i) => ({
      driver_id:     c._id,
      brand:         pick(CAR_BRANDS, i),
      model:         pick(CAR_MODELS, i),
      license_plate: plateFor(i),
      color:         pick(CAR_COLORS, i),
      year:          2018 + (i % 6),
      capacity:      pick([4, 5, 6, 7], i),
      isActive:      true,
    }));

    const savedVehicles = await Vehicle.insertMany(vehicles);
    console.log(`   ✔️ ${savedVehicles.length} vehículos insertados`);

    // ─────────────────────────────────────────
    // 3. VIAJES (2 por conductor = 10 total)
    // ─────────────────────────────────────────
    console.log('\n🗺️  Insertando Viajes...');
    await Ride.deleteMany({});

    const today = todayDate();
    const rides = [];

    for (let i = 0; i < savedConductores.length; i++) {
      // Viaje 1 del conductor i
      rides.push({
        driver_id:       savedConductores[i]._id,
        origin:          { name: ORIGINS[i].name,           coordinates: { lat: ORIGINS[i].lat,           lng: ORIGINS[i].lng } },
        destination:     { name: DESTINATIONS[i].name,      coordinates: { lat: DESTINATIONS[i].lat,      lng: DESTINATIONS[i].lng } },
        fecha:           today,
        hora:            futureHour(10 + i * 6),
        available_seats: rand(2, 6),
        status:          'scheduled',
        distance_km:     rand(5, 35),
        duration_minutes:rand(15, 60),
        price:           rand(500, 2500),
      });
      // Viaje 2 del conductor i
      rides.push({
        driver_id:       savedConductores[i]._id,
        origin:          { name: ORIGINS[i + 5].name,       coordinates: { lat: ORIGINS[i + 5].lat,       lng: ORIGINS[i + 5].lng } },
        destination:     { name: DESTINATIONS[i + 5].name,  coordinates: { lat: DESTINATIONS[i + 5].lat,  lng: DESTINATIONS[i + 5].lng } },
        fecha:           today,
        hora:            futureHour(40 + i * 8),
        available_seats: rand(1, 5),
        status:          'scheduled',
        distance_km:     rand(5, 30),
        duration_minutes:rand(15, 55),
        price:           rand(500, 2000),
      });
    }

    const savedRides = await Ride.insertMany(rides);
    console.log(`   ✔️ ${savedRides.length} viajes insertados`);

    // ─────────────────────────────────────────
    // 4. BOOKINGS (10 total)
    // ─────────────────────────────────────────
    console.log('\n📋 Insertando Reservas...');
    await Booking.deleteMany({});

    const bookings = savedPasajeros.map((p, i) => ({
      ride_id:              savedRides[i % savedRides.length]._id,
      passenger_id:         p._id,
      status:               pick(BOOKING_STATUSES, i),
      seats_booked:         rand(1, 2),
      distance_km:          rand(5, 30),
      payment_status:       pick(PAYMENT_STATUSES, i),
      payment_type:         pick(PAYMENT_TYPES, i),
      passenger_origin:     ORIGINS[i % ORIGINS.length].name,
      passenger_destination:DESTINATIONS[i % DESTINATIONS.length].name,
    }));

    // Añadir 5 reservas más con pasajeros distintos para llegar a 10
    for (let i = 0; i < 5; i++) {
      bookings.push({
        ride_id:              savedRides[(i + 5) % savedRides.length]._id,
        passenger_id:         savedPasajeros[i % savedPasajeros.length]._id,
        status:               pick(BOOKING_STATUSES, i + 3),
        seats_booked:         1,
        distance_km:          rand(3, 20),
        payment_status:       pick(PAYMENT_STATUSES, i + 1),
        payment_type:         'normal',
        passenger_origin:     ORIGINS[(i + 5) % ORIGINS.length].name,
        passenger_destination:DESTINATIONS[(i + 5) % DESTINATIONS.length].name,
      });
    }

    // Filtramos duplicados ride_id + passenger_id antes de insertar
    const uniqueBookings = [];
    const seen = new Set();
    for (const b of bookings) {
      const key = `${b.ride_id}-${b.passenger_id}`;
      if (!seen.has(key)) { seen.add(key); uniqueBookings.push(b); }
    }

    const savedBookings = await Booking.insertMany(uniqueBookings);
    console.log(`   ✔️ ${savedBookings.length} reservas insertadas`);

    // ─────────────────────────────────────────
    // 5. REVIEWS (10 total)
    // ─────────────────────────────────────────
    console.log('\n⭐ Insertando Reseñas...');
    await Review.deleteMany({});

    const reviews = [];
    for (let i = 0; i < 10; i++) {
      const pasajero  = savedPasajeros[i % savedPasajeros.length];
      const conductor = savedConductores[i % savedConductores.length];
      const ride      = savedRides[i % savedRides.length];
      reviews.push({
        ride_id:     ride._id,
        reviewer_id: pasajero._id,
        reviewee_id: conductor._id,
        rating:      rand(3, 5),
        comment:     pick(REVIEW_COMMENTS, i),
      });
    }

    // Filtramos duplicados ride_id + reviewer_id + reviewee_id
    const uniqueReviews = [];
    const seenR = new Set();
    for (const r of reviews) {
      const key = `${r.ride_id}-${r.reviewer_id}-${r.reviewee_id}`;
      if (!seenR.has(key)) { seenR.add(key); uniqueReviews.push(r); }
    }

    const savedReviews = await Review.insertMany(uniqueReviews);
    console.log(`   ✔️ ${savedReviews.length} reseñas insertadas`);

    // ─────────────────────────────────────────
    // 6. NOTIFICACIONES (10 total)
    // ─────────────────────────────────────────
    console.log('\n🔔 Insertando Notificaciones...');
    await Notification.deleteMany({});

    const allUsers = [...savedConductores, ...savedPasajeros, ...savedAdmins];
    const notifications = Array.from({ length: 10 }, (_, i) => ({
      user_id: allUsers[i % allUsers.length]._id,
      message: NOTIF_MESSAGES[i],
      type:    pick(NOTIF_TYPES, i),
      status:  i < 5 ? 'unread' : 'read',
      relatedEntity: {
        entityType: 'ride',
        entityId:   savedRides[i % savedRides.length]._id,
      },
    }));

    const savedNotifications = await Notification.insertMany(notifications);
    console.log(`   ✔️ ${savedNotifications.length} notificaciones insertadas`);

    // ─────────────────────────────────────────
    // RESUMEN
    // ─────────────────────────────────────────
    console.log('\n🎉 ¡Seed completado exitosamente!\n');
    console.log('═══════════════════════════════════════');
    console.log(`  👤 Usuarios:        ${savedConductores.length + savedPasajeros.length + savedAdmins.length}`);
    console.log(`  🚗 Vehículos:       ${savedVehicles.length}`);
    console.log(`  🗺️  Viajes:          ${savedRides.length}`);
    console.log(`  📋 Reservas:        ${savedBookings.length}`);
    console.log(`  ⭐ Reseñas:         ${savedReviews.length}`);
    console.log(`  🔔 Notificaciones:  ${savedNotifications.length}`);
    console.log('═══════════════════════════════════════');
    console.log('\n📧 Credenciales de prueba:');
    console.log('  Email:    admin.seed@saferide.cr');
    console.log('  Email:    soporte.seed@saferide.cr');
    console.log('  Email:    gerencia.seed@saferide.cr');
    console.log('  Password: SafeRide2024!');
    console.log('');

  } catch (err) {
    console.error('❌ Error durante el seed:', err.message || err);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Desconectado de MongoDB.');
    process.exit(0);
  }
}

seed();