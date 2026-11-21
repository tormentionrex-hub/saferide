require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const tz = require('../utils/timeZone');
const { COMPANIES } = require('../config/companies');
const { connectDB } = require('../config/database');
const {
  User,
  Vehicle,
  Ride,
  Booking,
  Notification,
  Review,
  Metrics,
  VerificationCode,
  TrustHistory,
  Complaint,
  AuditLog,
  Document,
} = require('../models');

const SCHEDULES = ['06:00 - 14:00', '07:00 - 15:00', '08:00 - 16:00', '09:00 - 17:00', '14:00 - 22:00', '22:00 - 06:00'];
const ORIGINS = [
  { name: 'San José Centro', lat: 9.9281, lng: -84.0907 },
  { name: 'Escazú - Plaza Tempo', lat: 9.9182, lng: -84.1461 },
  { name: 'Santa Ana', lat: 9.9317, lng: -84.1828 },
  { name: 'Alajuela Centro', lat: 10.0162, lng: -84.2148 },
  { name: 'Heredia', lat: 9.9985, lng: -84.1172 },
  { name: 'Cartago', lat: 9.8641, lng: -83.9195 },
  { name: 'Desamparados', lat: 9.8978, lng: -84.0781 },
  { name: 'Moravia', lat: 9.9567, lng: -84.0447 },
  { name: 'La Sabana', lat: 9.9356, lng: -84.1024 },
  { name: 'San Pedro', lat: 9.9338, lng: -84.0517 },
  { name: 'Tibás', lat: 9.9619, lng: -84.0791 },
  { name: 'Curridabat', lat: 9.9183, lng: -84.0317 },
];
const DESTINATIONS = [
  { name: 'Zona Franca Coyol', lat: 9.9897, lng: -84.2467 },
  { name: 'Parque Empresarial Forum', lat: 9.9136, lng: -84.1503 },
  { name: 'Intel CR - Belén', lat: 9.9781, lng: -84.1714 },
  { name: 'Deloitte - Escazú', lat: 9.9185, lng: -84.1423 },
  { name: 'Citi - Rohrmoser', lat: 9.9399, lng: -84.1086 },
  { name: 'Experian - Belén', lat: 9.9736, lng: -84.1689 },
  { name: 'DHL - La Uruca', lat: 9.9449, lng: -84.1223 },
  { name: 'Concentrix - Coyol', lat: 9.9911, lng: -84.2501 },
  { name: 'Nestlé - Santa Ana', lat: 9.9321, lng: -84.1871 },
  { name: '3M - Cartago', lat: 9.8659, lng: -83.9242 },
  { name: 'BGO - Lindora', lat: 9.9434, lng: -84.1796 },
  { name: 'Cargill - Pavas', lat: 9.9438, lng: -84.1325 },
];
const CAR_BRANDS = ['Toyota', 'Honda', 'Hyundai', 'Kia', 'Suzuki', 'Nissan', 'Mazda', 'Ford', 'Chevrolet', 'Volkswagen', 'Subaru', 'Mitsubishi'];
const CAR_MODELS = ['Corolla', 'Civic', 'Tucson', 'Sportage', 'Swift', 'Sentra', 'CX-5', 'Ranger', 'Tracker', 'Golf', 'Forester', 'Outlander'];
const CAR_COLORS = ['Blanco', 'Negro', 'Gris', 'Plateado', 'Azul', 'Rojo', 'Verde', 'Beige', 'Café', 'Champagne', 'Vino', 'Celeste'];
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
];
const NOTIFICATION_TEMPLATES = [
  { type: 'booking_confirmed', message: 'Tu reserva ha sido confirmada', entity: 'booking' },
  { type: 'booking_cancelled', message: 'Tu reserva fue cancelada', entity: 'booking' },
  { type: 'booking_pending', message: 'Tienes una nueva solicitud de reserva', entity: 'booking' },
  { type: 'booking_denied', message: 'Tu reserva fue denegada por el conductor', entity: 'booking' },
  { type: 'ride_reminder', message: 'Recordatorio: tu viaje inicia pronto', entity: 'ride' },
  { type: 'ride_started', message: 'El conductor inició el viaje', entity: 'ride' },
  { type: 'ride_completed', message: 'Viaje finalizado, ¡gracias por usar SafeRide!', entity: 'ride' },
  { type: 'ride_cancelled', message: 'El conductor canceló el viaje', entity: 'ride' },
  { type: 'review_request', message: 'Por favor califica tu viaje reciente', entity: 'ride' },
  { type: 'system', message: 'Sistema: mantenimiento programado esta noche', entity: 'user' },
  { type: 'trust_score_updated', message: 'Tu puntaje de confianza fue actualizado', entity: 'user' },
];
const TRUST_REASONS = ['cancel_gifted_trip_passenger', 'cancel_in_progress_ride_driver', 'admin_increment', 'admin_decrement', 'admin_reset'];
const COMPLAINT_TEMPLATES = [
  { user: 'María Solís', email: 'pasajero3@saferide.cr', category: 'Pagos', subject: 'Cargo duplicado en reserva', fullMessage: 'Se me cobró dos veces la reserva del viaje de ayer. Adjunto el comprobante para revisión.', status: 'Pendiente' },
  { user: 'Andrés Vargas', email: 'pasajero7@saferide.cr', category: 'Conducta', subject: 'Conductor con conducta inadecuada', fullMessage: 'El conductor habló en voz alta durante todo el trayecto y se negó a apagar la música.', status: 'Pendiente' },
  { user: 'Laura Campos', email: 'pasajero11@saferide.cr', category: 'Seguridad', subject: 'Botón SOS activado por error', fullMessage: 'Activé el botón SOS por equivocación al buscar mi teléfono. Solicito confirmar que no se envió a emergencias.', status: 'Pendiente' },
  { user: 'Diego Mena', email: 'pasajero15@saferide.cr', category: 'Soporte Técnico', subject: 'No puedo subir mi cédula', fullMessage: 'La app cierra la cámara cuando intento tomar la foto de la cédula. Uso Android 14.', status: 'Pendiente' },
  { user: 'Sofía Rojas', email: 'pasajero21@saferide.cr', category: 'Pagos', subject: 'Reembolso pendiente', fullMessage: 'El viaje fue cancelado por el conductor pero el pago sigue apareciendo como pendiente.', status: 'Atendido' },
  { user: 'Carlos Quesada', email: 'pasajero28@saferide.cr', category: 'Seguridad', subject: 'Vehículo detenido en zona obscura', fullMessage: 'El conductor se detuvo en una zona sin iluminación antes de continuar. Quedo atenta al seguimiento.', status: 'Atendido' },
  { user: 'Yuliana Méndez', email: 'pasajero34@saferide.cr', category: 'Conducta', subject: 'Pasajero agresivo', fullMessage: 'Un pasajero levantó la voz contra el conductor. El conductor canceló el viaje de forma preventiva.', status: 'Atendido' },
  { user: 'José Alfaro', email: 'pasajero42@saferide.cr', category: 'Soporte Técnico', subject: 'Notificación duplicada', fullMessage: 'Recibí la misma notificación de reserva tres veces durante la mañana.', status: 'Atendido' },
];
const AUDIT_ACTIONS = [
  'LOGIN_SUCCESS',
  'LOGIN_FAILED',
  'DRIVER_APPROVED',
  'DRIVER_REJECTED',
  'VEHICLE_APPROVED',
  'VEHICLE_REJECTED',
  'COMPLAINT_RESOLVED',
  'TRIP_CANCELLED_MANUALLY',
];
const DOCUMENT_TYPES = ['cedula', 'licencia', 'poliza', 'marchamo', 'rtv', 'tarjeta_circulacion'];
const DOCUMENT_LABELS = {
  cedula: 'Cédula',
  licencia: 'Licencia',
  poliza: 'Póliza',
  marchamo: 'Marchamo',
  rtv: 'RTV (Dekra)',
  tarjeta_circulacion: 'T. circulación',
};

const pick = (arr, i) => arr[((i % arr.length) + arr.length) % arr.length];
const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const randFloat = (min, max, dec = 2) => parseFloat((Math.random() * (max - min) + min).toFixed(dec));

function plateFor(i) {
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const a = letters[i % letters.length];
  const b = letters[(i + 7) % letters.length];
  const c = letters[(i + 13) % letters.length];
  return `${a}${b}${c}${String(100 + (i % 900))}`;
}

function dateOffset(days) {
  return tz.now().minus({ days }).toFormat('yyyy-MM-dd');
}

function hourFromMinutes(totalMin) {
  const minutes = ((totalMin % 1440) + 1440) % 1440;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function futureSlot(offsetMin) {
  const dt = tz.now().plus({ minutes: offsetMin });
  return { fecha: dt.toFormat('yyyy-MM-dd'), hora: dt.toFormat('HH:mm') };
}

function pastSlot(days, totalMin) {
  return { fecha: dateOffset(days), hora: hourFromMinutes(totalMin) };
}

function documentFileUrl(label) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="360"><rect width="100%" height="100%" fill="#e2e8f0"/><rect x="24" y="24" width="552" height="312" rx="18" fill="#ffffff"/><text x="48" y="92" font-family="Arial" font-size="28" font-weight="700" fill="#0f172a">SafeRide · Documento demo</text><text x="48" y="142" font-family="Arial" font-size="22" fill="#334155">${label}</text><text x="48" y="198" font-family="Arial" font-size="16" fill="#64748b">Archivo de demostración almacenado en Mongo</text><text x="48" y="228" font-family="Arial" font-size="16" fill="#64748b">No contiene datos personales reales</text></svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
}

function extractedFor(type, driver, vehicle) {
  const idNumber = `1${String(10000000 + parseInt(driver.phone.slice(-6), 10) % 90000000)}`;
  const expiry = tz.now().plus({ days: rand(120, 900) }).toFormat('yyyy-MM-dd');
  const base = { fullName: driver.name, documentNumber: idNumber, expiryDate: expiry };

  if (type === 'licencia') {
    return { ...base, licenseNumber: `LIC-${idNumber}`, licenseClass: pick(['B1', 'B2', 'C1'], driver.phone.charCodeAt(0)) };
  }
  if (type === 'poliza') {
    return { policyHolder: driver.name, licensePlate: vehicle.license_plate, policyNumber: `POL-${idNumber}`, insurer: pick(['INS Seguros', 'Aseguradora del Valle', 'CRC Seguros'], idNumber.length), expiryDate: expiry };
  }
  if (type === 'marchamo') {
    return { licensePlate: vehicle.license_plate, vehicleBrand: vehicle.brand, vehicleModel: vehicle.model, vehicleYear: String(vehicle.year), marchamoYear: new Date().getFullYear(), expiryDate: expiry };
  }
  if (type === 'rtv') {
    return { licensePlate: vehicle.license_plate, vehicleBrand: vehicle.brand, vehicleModel: vehicle.model, rtvNumber: `RTV-${idNumber}`, expiryDate: expiry };
  }
  if (type === 'tarjeta_circulacion') {
    return { fullName: driver.name, licensePlate: vehicle.license_plate, vehicleBrand: vehicle.brand, vehicleModel: vehicle.model };
  }
  return base;
}

async function seedDemo() {
  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const demoPassword = process.env.DEMO_USER_PASSWORD;

  if (!adminEmail) throw new Error('Falta ADMIN_EMAIL en .env');
  if (!demoPassword) throw new Error('Falta DEMO_USER_PASSWORD en .env');
  if (demoPassword.length < 8) throw new Error('DEMO_USER_PASSWORD debe tener al menos 8 caracteres');

  await connectDB();

  const db = mongoose.connection.db;
  const collections = {
    users: db.collection(User.collection.name),
    vehicles: db.collection(Vehicle.collection.name),
    rides: db.collection(Ride.collection.name),
    bookings: db.collection(Booking.collection.name),
    reviews: db.collection(Review.collection.name),
    notifications: db.collection(Notification.collection.name),
    metrics: db.collection(Metrics.collection.name),
    verificationCodes: db.collection(VerificationCode.collection.name),
    trustHistory: db.collection(TrustHistory.collection.name),
    complaints: db.collection(Complaint.collection.name),
    auditLogs: db.collection(AuditLog.collection.name),
    documents: db.collection(Document.collection.name),
  };

  const admin = await collections.users.findOne({ email: adminEmail });
  if (!admin) {
    throw new Error(`No existe el admin ${adminEmail}. Ejecuta npm run db:seed:admin primero.`);
  }

  await Promise.all([
    collections.users.deleteMany({ type: { $ne: 'admin' } }),
    collections.vehicles.deleteMany({}),
    collections.rides.deleteMany({}),
    collections.bookings.deleteMany({}),
    collections.reviews.deleteMany({}),
    collections.notifications.deleteMany({}),
    collections.metrics.deleteMany({}),
    collections.verificationCodes.deleteMany({}),
    collections.trustHistory.deleteMany({}),
    collections.complaints.deleteMany({}),
    collections.auditLogs.deleteMany({}),
    collections.documents.deleteMany({}),
  ]);

  const passwordHash = await bcrypt.hash(demoPassword, 10);
  const now = new Date();
  const users = [];

  for (let i = 0; i < 20; i++) {
    const loc = pick(ORIGINS, i);
    const trustScore = i % 7 === 0 ? 2 : 4;
    users.push({
      _id: new mongoose.Types.ObjectId(),
      name: `Conductor ${i + 1} Mora`,
      username: `conductor_${String(i + 1).padStart(2, '0')}`,
      email: `conductor${i + 1}@saferide.cr`,
      phone: `8${String(1000000 + i).slice(-7)}`,
      password: passwordHash,
      company: pick(COMPANIES, i),
      work_schedule: pick(SCHEDULES, i),
      rating: randFloat(3.5, 5, 1),
      type: 'conductor',
      profileImage: null,
      isActive: trustScore > 0 && i % 11 !== 10,
      trustScore,
      currentLocation: { lat: loc.lat, lng: loc.lng, updatedAt: now },
      deletedAt: null,
      optIn: i % 4 !== 0,
      createdAt: now,
      updatedAt: now,
    });
  }

  for (let i = 0; i < 50; i++) {
    const trustScore = i % 13 === 0 ? 0 : (i % 5 === 0 ? 2 : 4);
    users.push({
      _id: new mongoose.Types.ObjectId(),
      name: `Pasajero ${i + 1} Vega`,
      username: `pasajero_${String(i + 1).padStart(2, '0')}`,
      email: `pasajero${i + 1}@saferide.cr`,
      phone: `7${String(2000000 + i).slice(-7)}`,
      password: passwordHash,
      company: pick(COMPANIES, i + 3),
      work_schedule: pick(SCHEDULES, i + 1),
      rating: randFloat(3.5, 5, 1),
      type: 'pasajero',
      profileImage: null,
      isActive: trustScore > 0 && i % 17 !== 16,
      trustScore,
      deletedAt: null,
      optIn: i % 3 !== 0,
      createdAt: now,
      updatedAt: now,
    });
  }

  await collections.users.insertMany(users);
  const conductores = users.filter((u) => u.type === 'conductor');
  const pasajeros = users.filter((u) => u.type === 'pasajero');

  const vehicles = conductores.map((c, i) => ({
    _id: new mongoose.Types.ObjectId(),
    driver_id: c._id,
    brand: pick(CAR_BRANDS, i),
    model: pick(CAR_MODELS, i),
    license_plate: plateFor(i),
    color: pick(CAR_COLORS, i),
    year: 2015 + (i % 10),
    vehicleImage: null,
    isActive: c.isActive,
    capacity: pick([4, 5, 5, 5, 6, 7], i),
    createdAt: now,
    updatedAt: now,
  }));
  await collections.vehicles.insertMany(vehicles);

  const rides = [];
  for (let i = 0; i < conductores.length; i++) {
    const driver = conductores[i];
    const scheduled = futureSlot(60 + i * 7);
    const inProgress = futureSlot(140 + i * 9);
    const o1 = pick(ORIGINS, i);
    const d1 = pick(DESTINATIONS, i);
    const o2 = pick(ORIGINS, i + 4);
    const d2 = pick(DESTINATIONS, i + 4);

    rides.push({
      _id: new mongoose.Types.ObjectId(),
      driver_id: driver._id,
      origin: { name: o1.name, coordinates: { lat: o1.lat, lng: o1.lng } },
      destination: { name: d1.name, coordinates: { lat: d1.lat, lng: d1.lng } },
      fecha: scheduled.fecha,
      hora: scheduled.hora,
      available_seats: rand(2, 6),
      status: 'scheduled',
      distance_km: rand(5, 35),
      duration_minutes: rand(15, 60),
      suggested_price: rand(500, 2500),
      createdAt: now,
      updatedAt: now,
    });

    rides.push({
      _id: new mongoose.Types.ObjectId(),
      driver_id: driver._id,
      origin: { name: o2.name, coordinates: { lat: o2.lat, lng: o2.lng } },
      destination: { name: d2.name, coordinates: { lat: d2.lat, lng: d2.lng } },
      fecha: inProgress.fecha,
      hora: inProgress.hora,
      available_seats: rand(0, 3),
      status: 'in progress',
      distance_km: rand(5, 30),
      duration_minutes: rand(15, 50),
      suggested_price: rand(500, 2200),
      createdAt: now,
      updatedAt: now,
    });

    for (let d = 1; d <= 3; d++) {
      const past = pastSlot(d * 2, 420 + i * 13 + d * 17);
      const op = pick(ORIGINS, i + d);
      const dp = pick(DESTINATIONS, i + d + 1);
      rides.push({
        _id: new mongoose.Types.ObjectId(),
        driver_id: driver._id,
        origin: { name: op.name, coordinates: { lat: op.lat, lng: op.lng } },
        destination: { name: dp.name, coordinates: { lat: dp.lat, lng: dp.lng } },
        fecha: past.fecha,
        hora: past.hora,
        available_seats: 1,
        status: 'completed',
        distance_km: rand(8, 40),
        duration_minutes: rand(20, 70),
        suggested_price: rand(700, 3000),
        createdAt: now,
        updatedAt: now,
      });
    }

    const cancelled = pastSlot(rand(4, 14), 540 + i * 11);
    const oc = pick(ORIGINS, i + 6);
    const dc = pick(DESTINATIONS, i + 7);
    rides.push({
      _id: new mongoose.Types.ObjectId(),
      driver_id: driver._id,
      origin: { name: oc.name, coordinates: { lat: oc.lat, lng: oc.lng } },
      destination: { name: dc.name, coordinates: { lat: dc.lat, lng: dc.lng } },
      fecha: cancelled.fecha,
      hora: cancelled.hora,
      available_seats: rand(1, 4),
      status: 'cancelled',
      distance_km: rand(5, 25),
      duration_minutes: rand(15, 45),
      suggested_price: rand(500, 2000),
      createdAt: now,
      updatedAt: now,
    });
  }
  await collections.rides.insertMany(rides);

  const bookings = [];
  const usedBooking = new Set();
  function addBooking(ride, passenger, overrides = {}) {
    const key = `${ride._id}-${passenger._id}`;
    if (usedBooking.has(key)) return;
    usedBooking.add(key);
    const seats = rand(1, 2);
    const distance = rand(3, 30);
    const offered = rand(500, 2500);
    const timestamp = new Date(Date.now() - rand(0, 14) * 86400000);
    bookings.push({
      _id: new mongoose.Types.ObjectId(),
      ride_id: ride._id,
      passenger_id: passenger._id,
      timestamp,
      status: 'confirmed',
      seats_booked: seats,
      distance_km: distance,
      offered_amount: offered,
      charged_amount: 0,
      payment_status: 'pending',
      payment_type: 'normal',
      payment_method: null,
      payment_reference: null,
      paid_amount_usd: null,
      passenger_origin: pick(ORIGINS, bookings.length).name,
      passenger_destination: pick(DESTINATIONS, bookings.length + 3).name,
      payment_reviewed_at: null,
      createdAt: timestamp,
      updatedAt: now,
      ...overrides,
    });
  }

  for (let i = 0; i < rides.length; i++) {
    const ride = rides[i];
    const total = rand(1, 4);
    for (let j = 0; j < total; j++) {
      const passenger = pick(pasajeros, i * 3 + j * 5);
      const paymentType = j % 5 === 0 ? 'gifted' : 'normal';
      let status = 'confirmed';
      let paymentStatus = 'pending';
      let chargedAmount = 0;
      let paymentReviewedAt = null;

      if (ride.status === 'completed') {
        status = 'completed';
        paymentStatus = paymentType === 'gifted' ? 'waived' : (j % 4 === 0 ? 'pending' : 'paid');
        chargedAmount = paymentType === 'gifted' ? 0 : rand(500, 2500);
        paymentReviewedAt = new Date(Date.now() - rand(1, 10) * 86400000);
      } else if (ride.status === 'cancelled') {
        status = j % 2 === 0 ? 'cancelled' : 'deny';
        paymentStatus = 'waived';
      } else if (ride.status === 'scheduled') {
        status = j % 3 === 0 ? 'pending' : 'confirmed';
      }

      addBooking(ride, passenger, {
        status,
        payment_status: paymentStatus,
        payment_type: paymentType,
        charged_amount: chargedAmount,
        payment_reviewed_at: paymentReviewedAt,
      });
    }
  }
  await collections.bookings.insertMany(bookings);

  const reviews = [];
  const usedReview = new Set();
  const rideById = new Map(rides.map((r) => [String(r._id), r]));
  for (const booking of bookings) {
    if (booking.status !== 'completed') continue;
    const ride = rideById.get(String(booking.ride_id));
    if (!ride) continue;
    const driverId = ride.driver_id;
    const passengerId = booking.passenger_id;
    const forwardKey = `${ride._id}-${passengerId}-${driverId}`;
    if (!usedReview.has(forwardKey)) {
      usedReview.add(forwardKey);
      reviews.push({
        _id: new mongoose.Types.ObjectId(),
        ride_id: ride._id,
        reviewer_id: passengerId,
        reviewee_id: driverId,
        rating: rand(3, 5),
        comment: pick(REVIEW_COMMENTS, reviews.length),
        date: new Date(Date.now() - rand(1, 10) * 86400000),
        createdAt: now,
        updatedAt: now,
      });
    }
    if (Math.random() < 0.6) {
      const reverseKey = `${ride._id}-${driverId}-${passengerId}`;
      if (!usedReview.has(reverseKey)) {
        usedReview.add(reverseKey);
        reviews.push({
          _id: new mongoose.Types.ObjectId(),
          ride_id: ride._id,
          reviewer_id: driverId,
          reviewee_id: passengerId,
          rating: rand(3, 5),
          comment: pick(REVIEW_COMMENTS, reviews.length + 4),
          date: new Date(Date.now() - rand(1, 10) * 86400000),
          createdAt: now,
          updatedAt: now,
        });
      }
    }
  }
  await collections.reviews.insertMany(reviews);

  const notifications = [];
  const targets = [...conductores, ...pasajeros];
  for (let i = 0; i < targets.length; i++) {
    for (let k = 0; k < 6; k++) {
      const template = pick(NOTIFICATION_TEMPLATES, i + k);
      const ride = pick(rides, i + k * 3);
      const entityId = template.entity === 'user' ? targets[i]._id : (template.entity === 'booking' ? pick(bookings, i + k)?._id || ride._id : ride._id);
      const date = new Date(Date.now() - rand(0, 14) * 86400000);
      notifications.push({
        _id: new mongoose.Types.ObjectId(),
        user_id: targets[i]._id,
        message: template.message,
        type: template.type,
        status: k < 2 ? 'unread' : (k < 5 ? 'read' : 'archived'),
        date,
        relatedEntity: { entityType: template.entity, entityId },
        createdAt: date,
        updatedAt: now,
      });
    }
  }
  await collections.notifications.insertMany(notifications);

  const metrics = [];
  for (const driver of conductores) {
    const km = rand(150, 2500);
    metrics.push({
      _id: new mongoose.Types.ObjectId(),
      user_id: driver._id,
      role: 'conductor',
      kilometers_driven: km,
      passenger_kilometers: km + rand(100, 1500),
      carbon_footprint: parseFloat((km * 0.21).toFixed(2)),
      total_rides: rand(10, 80),
      total_passengers: rand(20, 200),
      period: 'total',
      date: now,
      createdAt: now,
      updatedAt: now,
    });
    metrics.push({
      _id: new mongoose.Types.ObjectId(),
      user_id: driver._id,
      role: 'conductor',
      kilometers_driven: rand(30, 400),
      passenger_kilometers: rand(50, 600),
      carbon_footprint: randFloat(5, 80, 2),
      total_rides: rand(2, 20),
      total_passengers: rand(4, 40),
      period: 'monthly',
      date: now,
      createdAt: now,
      updatedAt: now,
    });
  }
  for (const passenger of pasajeros) {
    const km = rand(20, 800);
    metrics.push({
      _id: new mongoose.Types.ObjectId(),
      user_id: passenger._id,
      role: 'pasajero',
      kilometers_driven: km,
      passenger_kilometers: 0,
      carbon_footprint: parseFloat((km * 0.18).toFixed(2)),
      total_rides: rand(3, 50),
      total_passengers: 0,
      period: 'total',
      date: now,
      createdAt: now,
      updatedAt: now,
    });
    metrics.push({
      _id: new mongoose.Types.ObjectId(),
      user_id: passenger._id,
      role: 'pasajero',
      kilometers_driven: rand(5, 150),
      passenger_kilometers: 0,
      carbon_footprint: randFloat(1, 25, 2),
      total_rides: rand(1, 12),
      total_passengers: 0,
      period: 'monthly',
      date: now,
      createdAt: now,
      updatedAt: now,
    });
  }
  await collections.metrics.insertMany(metrics);

  const trustEntries = [];
  const trustUsers = [...conductores, ...pasajeros];
  for (let i = 0; i < 40; i++) {
    const user = pick(trustUsers, i * 3);
    const reason = pick(TRUST_REASONS, i);
    const previousScore = pick([4, 3, 2, 1], i);
    let delta = 0;
    let newScore = previousScore;
    if (reason === 'admin_increment') {
      delta = 1;
      newScore = Math.min(4, previousScore + 1);
    } else if (reason === 'admin_decrement') {
      delta = -1;
      newScore = Math.max(0, previousScore - 1);
    } else if (reason === 'admin_reset') {
      delta = 4 - previousScore;
      newScore = 4;
    } else {
      delta = -1;
      newScore = Math.max(0, previousScore - 1);
    }
    trustEntries.push({
      _id: new mongoose.Types.ObjectId(),
      user_id: user._id,
      previous_score: previousScore,
      new_score: newScore,
      delta,
      reason,
      actor_id: admin._id,
      booking_id: pick(bookings, i)?._id || null,
      ride_id: pick(rides, i)?._id || null,
      createdAt: new Date(Date.now() - rand(0, 30) * 86400000),
    });
  }
  await collections.trustHistory.insertMany(trustEntries);

  const complaints = COMPLAINT_TEMPLATES.map((template, i) => {
    const createdAt = new Date(Date.now() - rand(0, 20) * 86400000);
    return {
      _id: new mongoose.Types.ObjectId(),
      user: template.user,
      email: template.email,
      subject: template.subject,
      fullMessage: template.fullMessage,
      message: template.fullMessage,
      category: template.category,
      status: template.status,
      tripId: i % 3 === 0 ? String(pick(rides, i)?._id || 'N/A') : 'N/A',
      reply: template.status === 'Atendido' ? 'Gracias por reportarlo. Revisamos el caso y aplicamos la corrección correspondiente.' : '',
      resolvedAt: template.status === 'Atendido' ? new Date(createdAt.getTime() + 3600000) : null,
      createdAt,
      updatedAt: createdAt,
    };
  });
  await collections.complaints.insertMany(complaints);

  const auditLogs = AUDIT_ACTIONS.concat(AUDIT_ACTIONS).map((action, i) => ({
    _id: new mongoose.Types.ObjectId(),
    adminEmail: admin.email,
    ipAddress: `10.0.${rand(1, 20)}.${rand(2, 250)}`,
    action,
    targetType: pick(['user', 'vehicle', 'complaint', 'ride'], i),
    details: `Acción administrativa ${action} registrada durante la carga demo.`,
    userAgent: 'SafeRide Admin Panel / seed-demo',
    createdAt: new Date(Date.now() - rand(0, 30) * 86400000),
  }));
  await collections.auditLogs.insertMany(auditLogs);

  const documents = [];
  for (let i = 0; i < conductores.length; i++) {
    const driver = conductores[i];
    const vehicle = vehicles[i];
    for (let t = 0; t < DOCUMENT_TYPES.length; t++) {
      const type = DOCUMENT_TYPES[t];
      const roll = (i * 7 + t * 3) % 11;
      const status = roll === 0 ? 'rejected' : (roll === 1 ? 'needs_review' : (roll === 2 ? 'processing' : (roll === 3 ? 'pending' : 'approved')));
      const extracted = extractedFor(type, driver, vehicle);
      const createdAt = new Date(Date.now() - rand(1, 40) * 86400000);
      const failed = status === 'rejected' || status === 'needs_review';
      documents.push({
        _id: new mongoose.Types.ObjectId(),
        driver_id: driver._id,
        type,
        status,
        fileUrl: documentFileUrl(DOCUMENT_LABELS[type]),
        mimeType: 'image/svg+xml',
        extractedData: extracted,
        validation: {
          confidence: randFloat(0.72, 0.99, 2),
          matches: [
            { rule: 'Datos legibles', passed: true, reason: '' },
            { rule: 'Vigencia', passed: !failed, reason: failed ? 'Fecha próxima a vencer' : '' },
            { rule: 'Coincidencia con sistema', passed: !failed, reason: failed ? 'No coincide con el registro' : '' },
          ],
        },
        ocrText: `${DOCUMENT_LABELS[type]}\nTitular: ${extracted.fullName || extracted.policyHolder || 'N/A'}\nPlaca: ${extracted.licensePlate || 'N/A'}\nVencimiento: ${extracted.expiryDate || 'N/A'}`,
        rejectionReason: failed ? 'Documento ilegible o datos inconsistentes con el sistema.' : '',
        reviewedBy: status === 'pending' || status === 'processing' ? null : admin._id,
        reviewedAt: status === 'pending' || status === 'processing' ? null : new Date(createdAt.getTime() + 7200000),
        createdAt,
        updatedAt: createdAt,
      });
    }
  }
  await collections.documents.insertMany(documents);

  const codes = pasajeros.slice(0, 5).map((p) => ({
    _id: new mongoose.Types.ObjectId(),
    email: p.email,
    code: String(100000 + rand(1, 899999)),
    expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    createdAt: now,
    updatedAt: now,
  }));
  await collections.verificationCodes.insertMany(codes);

  console.log('Seed demo completado:');
  console.log(`  Usuarios demo:      ${users.length}`);
  console.log(`  Vehículos:          ${vehicles.length}`);
  console.log(`  Viajes:             ${rides.length}`);
  console.log(`  Reservas:           ${bookings.length}`);
  console.log(`  Reseñas:            ${reviews.length}`);
  console.log(`  Notificaciones:     ${notifications.length}`);
  console.log(`  Métricas:           ${metrics.length}`);
  console.log(`  Trust history:      ${trustEntries.length}`);
  console.log(`  Quejas:             ${complaints.length}`);
  console.log(`  Audit logs:         ${auditLogs.length}`);
  console.log(`  Documentos:         ${documents.length}`);
  console.log(`  Códigos verif.:     ${codes.length}`);
  await mongoose.disconnect();
}

seedDemo().catch(async (error) => {
  console.error(`No se pudo cargar el seed demo: ${error.message}`);
  try {
    await mongoose.disconnect();
  } catch (disconnectError) {
    console.error(disconnectError.message);
  }
  process.exitCode = 1;
});
