require('dotenv').config();

const mongoose = require('mongoose');
const { connectDB } = require('../config/database');
const { Complaint, Booking } = require('../models');

const BASE_URL = process.env.API_BASE_URL || 'http://127.0.0.1:8080/api/v1';

const TEMPLATES = [
  {
    category: 'Conducta',
    subject: 'Trato inadecuado durante el viaje',
    build: (t) => `El ${t.date}, en el viaje ${t.route}, el conductor mantuvo una actitud poco cordial y se negó a explicar un desvío de la ruta. Solicito revisión del servicio.`,
  },
  {
    category: 'Pagos',
    subject: 'Monto cobrado distinto al acordado',
    build: (t) => `En el viaje ${t.route} del ${t.date} se cobraron ₡${t.price}, un monto distinto al acordado al reservar. Adjunto el detalle de la reserva ${t.bookingId}.`,
  },
  {
    category: 'Seguridad',
    subject: 'Conducción rápida en la ruta',
    build: (t) => `Durante el viaje ${t.route} del ${t.date}, el conductor excedió la velocidad en varios tramos. Solicito revisar el registro del viaje ${t.rideId}.`,
  },
  {
    category: 'Soporte Técnico',
    subject: 'No se reflejó correctamente el pago',
    build: (t) => `El pago del viaje ${t.route} del ${t.date} aparece como ${t.paymentStatus} en la reserva ${t.bookingId}, aunque el viaje fue completado. Solicito revisión.`,
  },
];

const login = async () => {
  const response = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Client-Type': 'web-admin' },
    body: JSON.stringify({
      email: process.env.ADMIN_EMAIL,
      password: process.env.ADMIN_PASSWORD,
    }),
  });
  const body = await response.json();
  if (!response.ok) throw new Error(`No se pudo iniciar sesión: ${body.message}`);
  return body.data.accessToken;
};

const seedComplaints = async () => {
  await connectDB();

  const token = await login();
  const headers = {
    'Content-Type': 'application/json',
    'X-Client-Type': 'web-admin',
    Authorization: `Bearer ${token}`,
  };

  const removed = await Complaint.deleteMany({
    $or: [{ source: { $exists: false } }, { source: 'seed' }],
  });

  const bookings = await Booking.find({ status: 'completed' })
    .populate('passenger_id', 'name email')
    .populate({ path: 'ride_id', populate: { path: 'driver_id', select: 'name email' } })
    .sort({ timestamp: -1 });

  const elegibles = bookings.filter(
    (b) => b.ride_id?.status === 'completed' && b.passenger_id && b.ride_id?.driver_id
  );

  const vistos = new Set();
  const seleccionados = [];
  for (const booking of elegibles) {
    const rideId = String(booking.ride_id._id);
    if (vistos.has(rideId)) continue;
    vistos.add(rideId);
    seleccionados.push(booking);
    if (seleccionados.length === 12) break;
  }

  let creadas = 0;
  let omitidas = 0;
  for (let i = 0; i < seleccionados.length; i++) {
    const booking = seleccionados[i];
    const ride = booking.ride_id;
    const template = TEMPLATES[i % TEMPLATES.length];
    const subject = `${template.subject} · ${ride.origin?.name || 'Origen'} → ${ride.destination?.name || 'Destino'}`;
    const exists = await Complaint.exists({ booking_id: booking._id, subject });
    if (exists) {
      omitidas++;
      continue;
    }

    const trip = {
      route: `${ride.origin?.name || 'Origen'} → ${ride.destination?.name || 'Destino'}`,
      date: `${ride.fecha || ''} ${ride.hora || ''}`.trim(),
      price: booking.charged_amount || booking.offered_amount || ride.suggested_price || 0,
      paymentStatus: booking.payment_status || 'pending',
      rideId: String(ride._id),
      bookingId: String(booking._id),
    };

    const response = await fetch(`${BASE_URL}/complaints`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        subject,
        fullMessage: template.build(trip),
        category: template.category,
        rideId: trip.rideId,
        bookingId: trip.bookingId,
      }),
    });
    if (!response.ok) {
      const body = await response.json();
      throw new Error(`No se pudo crear queja ${trip.bookingId}: ${body.message}`);
    }
    creadas++;
  }

  console.log(`Quejas reales: ${creadas} creadas, ${omitidas} ya existentes, ${removed.deletedCount} demo eliminadas.`);
  await mongoose.disconnect();
};

seedComplaints().catch(async (error) => {
  console.error(`No se pudieron generar las quejas: ${error.message}`);
  try {
    await mongoose.disconnect();
  } catch (disconnectError) {
    console.error(disconnectError.message);
  }
  process.exitCode = 1;
});
