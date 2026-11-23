require('dotenv').config();

const mongoose = require('mongoose');
const { connectDB } = require('../config/database');
const {
  Notification,
  Complaint,
  Booking,
  Ride,
  Review,
  TrustHistory,
  Document,
  User,
} = require('../models');

const BASE_URL = process.env.API_BASE_URL || 'http://127.0.0.1:8080/api/v1';

const LIMITS = {
  bookingsByStatus: 12,
  ridesByStatus: 10,
  reviews: 8,
  trustHistories: 6,
  documents: 8,
};

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

const nameOf = (user, fallback = 'Usuario') => user?.name || user?.username || fallback;
const routeOf = (ride) => `${ride?.origin?.name || 'Origen'} → ${ride?.destination?.name || 'Destino'}`;
const whenOf = (ride) => `${ride?.fecha || ''} ${ride?.hora || ''}`.trim();

const seedNotifications = async () => {
  await connectDB();

  const token = await login();
  const headers = {
    'Content-Type': 'application/json',
    'X-Client-Type': 'web-admin',
    Authorization: `Bearer ${token}`,
  };

  const removed = await Notification.deleteMany({
    $or: [{ source: { $exists: false } }, { source: 'seed' }],
  });
  await Notification.deleteMany({ source: 'real', 'relatedEntity.entityType': 'complaint' });

  const admin = await User.findOne({ type: 'admin' }).select('_id name');
  if (!admin) throw new Error('No se encontró el usuario administrador');

  const items = [];
  const seen = new Set();

  const push = (item) => {
    if (!item.user_id || !item.message) return;
    const key = `${String(item.user_id)}|${item.type}|${item.message}|${item.relatedEntity?.entityId || ''}`;
    if (seen.has(key)) return;
    seen.add(key);
    items.push(item);
  };

  const complaints = await Complaint.find({
    ride_id: { $ne: null },
    source: { $in: ['real', 'api'] },
  })
    .populate('passenger_id', 'name email')
    .populate('driver_id', 'name email')
    .populate('ride_id')
    .sort({ createdAt: -1 });

  for (const complaint of complaints) {
    const route = complaint.tripOrigin && complaint.tripDestination
      ? `${complaint.tripOrigin} → ${complaint.tripDestination}`
      : routeOf(complaint.ride_id);
    const when = complaint.tripDate || whenOf(complaint.ride_id);
    const subjectWithRoute = complaint.subject.includes(route)
      ? complaint.subject
      : `${complaint.subject} · ${route}`;
    const relatedEntity = { entityType: 'complaint', entityId: complaint._id };

    push({
      user_id: admin._id,
      message: `Nueva queja pendiente: ${subjectWithRoute}${when ? ` · ${when}` : ''}`,
      type: 'system',
      relatedEntity,
      date: complaint.createdAt,
    });
    if (complaint.driver_id) {
      push({
        user_id: complaint.driver_id._id,
        message: `Queja recibida como conductor: ${subjectWithRoute}`,
        type: 'system',
        relatedEntity,
        date: complaint.createdAt,
      });
    }
    if (complaint.passenger_id) {
      push({
        user_id: complaint.passenger_id._id,
        message: `Registramos tu queja "${complaint.subject}". Te contactaremos pronto.`,
        type: 'system',
        relatedEntity,
        date: complaint.createdAt,
      });
    }
  }

  const bookings = await Booking.find()
    .populate('passenger_id', 'name email')
    .populate({ path: 'ride_id', populate: { path: 'driver_id', select: 'name email' } })
    .sort({ timestamp: -1 });

  const bookingsByStatus = { confirmed: [], pending: [], deny: [], cancelled: [] };
  const bookingsByRide = new Map();
  for (const booking of bookings) {
    if (bookingsByStatus[booking.status]) bookingsByStatus[booking.status].push(booking);
    const rideId = String(booking.ride_id?._id || booking.ride_id);
    if (!bookingsByRide.has(rideId)) bookingsByRide.set(rideId, []);
    bookingsByRide.get(rideId).push(booking);
  }

  for (const [status, list] of Object.entries(bookingsByStatus)) {
    for (const booking of list.slice(0, LIMITS.bookingsByStatus)) {
      const ride = booking.ride_id;
      const route = routeOf(ride);
      const when = whenOf(ride);
      const relatedEntity = { entityType: 'booking', entityId: booking._id };
      const date = booking.timestamp || booking.createdAt;

      if (status === 'confirmed' && booking.passenger_id) {
        push({
          user_id: booking.passenger_id._id,
          message: `Reserva confirmada: ${route}${when ? ` · ${when}` : ''}`,
          type: 'booking_confirmed',
          relatedEntity,
          date,
        });
      }
      if (status === 'pending' && ride?.driver_id) {
        push({
          user_id: ride.driver_id._id,
          message: `Solicitud pendiente de ${nameOf(booking.passenger_id)} para ${route}`,
          type: 'booking_pending',
          relatedEntity,
          date,
        });
      }
      if (status === 'deny' && booking.passenger_id) {
        push({
          user_id: booking.passenger_id._id,
          message: `El conductor rechazó tu solicitud: ${route}`,
          type: 'booking_denied',
          relatedEntity,
          date,
        });
      }
      if (status === 'cancelled' && booking.passenger_id) {
        push({
          user_id: booking.passenger_id._id,
          message: `Reserva cancelada: ${route}`,
          type: 'booking_cancelled',
          relatedEntity,
          date,
        });
      }
    }
  }

  const rideTemplates = {
    completed: (route, detail) => `Viaje completado: ${route}${detail ? ` · ${detail}` : ''}`,
    'in progress': (route) => `Viaje iniciado: ${route}`,
    scheduled: (route, detail) => `Recordatorio: tu viaje es hoy a las ${detail} · ${route}`,
    cancelled: (route) => `Viaje cancelado: ${route}`,
  };
  const rideTypes = {
    completed: 'ride_completed',
    'in progress': 'ride_started',
    scheduled: 'ride_reminder',
    cancelled: 'ride_cancelled',
  };

  const rides = await Ride.find({ status: { $in: Object.keys(rideTemplates) } })
    .populate('driver_id', 'name email')
    .sort({ createdAt: -1 });

  for (const [status, buildMessage] of Object.entries(rideTemplates)) {
    const group = rides.filter((ride) => ride.status === status).slice(0, LIMITS.ridesByStatus);
    for (const ride of group) {
      const route = routeOf(ride);
      const detail = status === 'completed'
        ? `₡${bookingsByRide.get(String(ride._id))?.[0]?.charged_amount || ride.suggested_price || 0}`
        : status === 'scheduled' ? ride.hora : '';
      const relatedEntity = { entityType: 'ride', entityId: ride._id };
      for (const booking of (bookingsByRide.get(String(ride._id)) || []).slice(0, 1)) {
        if (!booking.passenger_id) continue;
        push({
          user_id: booking.passenger_id._id,
          message: buildMessage(route, detail),
          type: rideTypes[status],
          relatedEntity,
          date: ride.updatedAt || ride.createdAt,
        });
      }
    }
  }

  const reviews = await Review.find()
    .populate('reviewee_id', 'name email')
    .sort({ date: -1 })
    .limit(LIMITS.reviews);
  for (const review of reviews) {
    if (!review.reviewee_id) continue;
    const comment = review.comment ? ` · "${String(review.comment).slice(0, 60)}"` : '';
    push({
      user_id: review.reviewee_id._id,
      message: `Nueva reseña recibida: ★${review.rating}${comment}`,
      type: 'system',
      relatedEntity: { entityType: 'review', entityId: review._id },
      date: review.date || review.createdAt,
    });
  }

  const trustHistories = await TrustHistory.find()
    .populate('user_id', 'name email')
    .sort({ createdAt: -1 })
    .limit(LIMITS.trustHistories);
  for (const history of trustHistories) {
    if (!history.user_id) continue;
    push({
      user_id: history.user_id._id,
      message: `Tu puntaje de confianza cambió de ${history.previous_score} a ${history.new_score} (${history.reason})`,
      type: 'trust_score_updated',
      relatedEntity: { entityType: 'user', entityId: history.user_id._id },
      date: history.createdAt,
    });
  }

  const documents = await Document.find({
    type: { $in: ['poliza', 'rtv', 'marchamo'] },
    status: { $in: ['needs_review', 'processing'] },
  })
    .populate('driver_id', 'name email')
    .sort({ createdAt: -1 })
    .limit(LIMITS.documents);
  const documentLabels = { poliza: 'Póliza de seguro', rtv: 'RTV', marchamo: 'Marchamo' };
  for (const document of documents) {
    if (!document.driver_id) continue;
    push({
      user_id: document.driver_id._id,
      message: `Revisión pendiente de ${documentLabels[document.type]}: ${nameOf(document.driver_id)}`,
      type: 'system',
      relatedEntity: { entityType: 'document', entityId: document._id },
      date: document.createdAt,
    });
  }

  let creadas = 0;
  let omitidas = 0;
  for (const item of items) {
    const exists = await Notification.exists({
      user_id: item.user_id,
      message: item.message,
      type: item.type,
      source: 'real',
    });
    if (exists) {
      omitidas++;
      continue;
    }

    const response = await fetch(`${BASE_URL}/notifications`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        ...item,
        user_id: String(item.user_id),
        relatedEntity: item.relatedEntity
          ? { ...item.relatedEntity, entityId: String(item.relatedEntity.entityId) }
          : undefined,
        date: new Date(item.date).toISOString(),
        source: 'real',
      }),
    });
    if (!response.ok) {
      const body = await response.json();
      throw new Error(`No se pudo crear notificación: ${body.message}`);
    }
    creadas++;
  }

  console.log(`Notificaciones reales: ${creadas} creadas, ${omitidas} ya existentes, ${removed.deletedCount} demo eliminadas.`);
  await mongoose.disconnect();
};

seedNotifications().catch(async (error) => {
  console.error(`No se pudieron generar las notificaciones: ${error.message}`);
  try {
    await mongoose.disconnect();
  } catch (disconnectError) {
    console.error(disconnectError.message);
  }
  process.exitCode = 1;
});
