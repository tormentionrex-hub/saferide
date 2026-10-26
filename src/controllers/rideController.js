const { Ride, Booking, User } = require('../models');
const tz = require('../utils/timeZone');
const { refreshMetricsForRide } = require('../services/metricsService');
const trustService = require('../services/trustService');
const { sendNotification } = require('../services/notificationService');

const toRadians = (degrees) => (degrees * Math.PI) / 180;

const haversineDistanceKm = (origin, destination) => {
  const originLat = Number(origin?.lat);
  const originLng = Number(origin?.lng);
  const destinationLat = Number(destination?.lat);
  const destinationLng = Number(destination?.lng);

  if (
    !Number.isFinite(originLat) ||
    !Number.isFinite(originLng) ||
    !Number.isFinite(destinationLat) ||
    !Number.isFinite(destinationLng)
  ) {
    throw new Error('Origin and destination coordinates are required to calculate booking distance');
  }

  const earthRadiusKm = 6371;
  const deltaLat = toRadians(destinationLat - originLat);
  const deltaLng = toRadians(destinationLng - originLng);
  const a = Math.sin(deltaLat / 2) ** 2 +
    Math.cos(toRadians(originLat)) *
      Math.cos(toRadians(destinationLat)) *
      Math.sin(deltaLng / 2) ** 2;

  return Number((earthRadiusKm * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)))).toFixed(1));
};

const resolveCompletedBookingDistanceKm = (ride) => {
  const rideDistanceKm = Number(ride.distance_km);

  if (Number.isFinite(rideDistanceKm) && rideDistanceKm > 0) {
    return Number(rideDistanceKm.toFixed(1));
  }

  return haversineDistanceKm(
    ride?.origin?.coordinates,
    ride?.destination?.coordinates
  );
};

// @desc    Create a new ride
// @route   POST /api/v1/rides
// @access  Private/Conductor
exports.createRide = async (req, res, next) => {
  try {
    const { origin, destination, fecha, hora, available_seats, distance_km, duration_minutes, suggested_price } = req.body;

    // Check if user is conductor
    if (req.user.type !== 'conductor') {
      return res.status(403).json({
        success: false,
        message: 'Only conductors can create rides',
      });
    }

    // Create ride
    const ride = await Ride.create({
      driver_id: req.user._id,
      origin,
      destination,
      fecha,
      hora,
      available_seats,
      distance_km,
      duration_minutes,
      suggested_price,
    });
    // Populate driver details
    await ride.populate('driver_id', 'name username rating profileImage');
    // Respond successfully
    res.status(201).json({
      success: true,
      message: 'Ride created successfully',
      data: ride,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all rides with filters
// @route   GET /api/v1/rides
// @access  Public

//Function to get all rides
exports.getAllRides = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 10,
      origin,
      destination,
      date,
      minSeats,
      status = 'scheduled',
    } = req.query;

    const query = { status };

    // Filter by origin (approximate location) - ~5km radius (0.045 degrees)
    if (origin) {
      const [lat, lng] = origin.split(',').map(Number);
      query['origin.coordinates.lat'] = { $gte: lat - 0.045, $lte: lat + 0.045 };
      query['origin.coordinates.lng'] = { $gte: lng - 0.045, $lte: lng + 0.045 };
    }

    // Filter by destination (approximate location) - ~5km radius (0.045 degrees)
    if (destination) {
      const [lat, lng] = destination.split(',').map(Number);
      query['destination.coordinates.lat'] = { $gte: lat - 0.045, $lte: lat + 0.045 };
      query['destination.coordinates.lng'] = { $gte: lng - 0.045, $lte: lng + 0.045 };
    }

    // Filter by date using plain string
    if (date) {
      query.fecha = date;
    }

    // Filter by minimum available seats
    if (minSeats) {
      query.available_seats = { $gte: parseInt(minSeats) };
    }
    // Fetch rides with pagination
    const rides = await Ride.find(query)
      .populate('driver_id', 'name username rating profileImage')
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort({ fecha: 1, hora: 1 });
    // Get total count for pagination
    const count = await Ride.countDocuments(query);

    res.status(200).json({
      success: true,
      data: rides,
      pagination: {
        total: count,
        page: parseInt(page),
        pages: Math.ceil(count / limit),
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get ride by ID
// @route   GET /api/v1/rides/:id
// @access  Public

//Function to get ride by ID
exports.getRideById = async (req, res, next) => {
  try {
    const ride = await Ride.findById(req.params.id)
      .populate('driver_id', 'name username rating profileImage phone')
      .populate({
        path: 'bookings',
        populate: {
          path: 'passenger_id',
          select: 'name username rating profileImage',
        },
      });
    // Validate ride existence
    if (!ride) {
      return res.status(404).json({
        success: false,
        message: 'Ride not found',
      });
    }
    // Respond successfully
    res.status(200).json({
      success: true,
      data: ride,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update ride
// @route   PUT /api/v1/rides/:id
// @access  Private/Conductor

//Function to update ride
exports.updateRide = async (req, res, next) => {
  try {
    const ride = await Ride.findById(req.params.id);
    // Validate ride existence
    if (!ride) {
      return res.status(404).json({
        success: false,
        message: 'Ride not found',
      });
    }

    // Check if user owns the ride
    if (ride.driver_id.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied',
      });
    }

    // Can only update if ride is still scheduled
    if (ride.status !== 'scheduled') {
      return res.status(400).json({
        success: false,
        message: 'Cannot update ride that is not scheduled',
      });
    }

    // Campos editables. 'status' no se acepta aquí: el ciclo del viaje se
    // mueve solo con start / complete / cancel, que disparan notificaciones,
    // métricas y TrustScore.
    const allowedUpdates = ['fecha', 'hora', 'available_seats'];
    const updates = {};
    allowedUpdates.forEach(field => {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    });
    const timeChanged = (updates.hora && updates.hora !== ride.hora)
      || (updates.fecha && updates.fecha !== ride.fecha);
    Object.assign(ride, updates);
    await ride.save();

    // Los pasajeros con reserva pendiente o confirmada se enteran si cambió
    // la hora de salida.
    if (timeChanged) {
      const bookings = await Booking.find({
        ride_id: ride._id,
        status: { $in: ['pending', 'confirmed'] },
      }).select('passenger_id');
      bookings.forEach((b) => {
        sendNotification(
          b.passenger_id.toString(),
          `El conductor cambió la hora de salida de tu viaje a las ${ride.hora}.`,
          'ride_reminder',
          { entityType: 'ride', entityId: ride._id }
        );
      });
    }

    res.status(200).json({
      success: true,
      message: 'Ride updated successfully',
      data: ride,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Cancel ride
// @route   DELETE /api/v1/rides/:id
// @access  Private/Conductor

//Function to cancel ride
exports.cancelRide = async (req, res, next) => {
  try {
    const ride = await Ride.findById(req.params.id);

    if (!ride) {
      return res.status(404).json({
        success: false,
        message: 'Ride not found',
      });
    }

    // Check if user owns the ride or is admin
    if (
      ride.driver_id.toString() !== req.user._id.toString() &&
      req.user.type !== 'admin'
    ) {
      return res.status(403).json({
        success: false,
        message: 'Access denied',
      });
    }
    // Snapshot del estado previo: necesario para decidir si aplica el
    // decremento de trustScore al conductor (solo si estaba in progress).
    const previousStatus = ride.status;
    const isDriverCancelling = ride.driver_id.toString() === req.user._id.toString();

    // Can only cancel if ride is still scheduled
    ride.status = 'cancelled';
    await ride.save({ validateModifiedOnly: true });

    // Cancel all pending/confirmed bookings for this ride.
    // Antes de la actualización capturamos los IDs de pasajeros afectados
    // para poder notificarles después de aplicar el cambio.
    const affectedBookings = await Booking.find(
      { ride_id: ride._id, status: { $in: ['pending', 'confirmed'] } },
      { passenger_id: 1 }
    );

    // payment_status: 'waived' refleja que la cancelación la inició el
    // conductor (o un admin): el pasajero no debe pagar penalización.
    // Mantener esto acá evita la condición de carrera con la auto-cancelación
    // del ride en bookingController cuando el frontend cancelaba booking a booking.
    await Booking.updateMany(
      { ride_id: ride._id, status: { $in: ['pending', 'confirmed'] } },
      { $set: { status: 'cancelled', payment_status: 'waived' } }
    );

    // Notificar a cada pasajero afectado (campana + push si tienen optIn).
    // No bloqueamos la respuesta: las notificaciones se procesan en background.
    affectedBookings.forEach((b) => {
      sendNotification(
        b.passenger_id.toString(),
        'El conductor canceló el viaje. Tu reserva fue cancelada automáticamente.',
        'booking_cancelled',
        { entityType: 'ride', entityId: ride._id }
      );
    });

    // Confirmación al conductor mismo si fue él quien canceló (no si fue admin).
    // Queda como entrada en su historial para auditoría visual.
    if (isDriverCancelling) {
      const affectedCount = affectedBookings.length;
      sendNotification(
        ride.driver_id.toString(),
        affectedCount > 0
          ? `Cancelaste el viaje. ${affectedCount} ${affectedCount === 1 ? 'pasajero fue notificado' : 'pasajeros fueron notificados'}.`
          : 'Cancelaste el viaje.',
        'ride_cancelled',
        { entityType: 'ride', entityId: ride._id }
      );
    }

    // ── TrustScore hook ──────────────────────────────────────────────
    // Si el conductor cancela un viaje que ya estaba in progress, le
    // decrementamos su trustScore. Excluimos admins (la lógica del
    // servicio también los excluye, pero filtramos antes para claridad).
    let trustInfo = null;
    if (
      previousStatus === 'in progress' &&
      isDriverCancelling &&
      req.user.type !== 'admin'
    ) {
      try {
        const result = await trustService.decrementTrust(req.user._id, {
          reason: 'cancel_in_progress_ride_driver',
          actorId: req.user._id,
          rideId: ride._id,
        });
        trustInfo = { newScore: result.newScore, decremented: result.changed };
      } catch (trustErr) {
        console.error('[TrustService] Error decrementing trust:', trustErr.message);
      }
    }

    // Si no hubo decremento (cancelación en 'scheduled', admin, etc.),
    // igual devolvemos el trustScore actual al conductor para que el
    // frontend pueda mostrarle cuántas oportunidades le quedan. Best-effort:
    // si falla la lectura, simplemente no incluimos trust en la respuesta.
    if (!trustInfo && isDriverCancelling && req.user.type !== 'admin') {
      try {
        const user = await User.findById(req.user._id).select('trustScore');
        if (user) {
          trustInfo = { newScore: user.trustScore, decremented: false };
        }
      } catch (trustErr) {
        console.error('[TrustService] Error reading trustScore:', trustErr.message);
      }
    }

    res.status(200).json({
      success: true,
      message: 'Ride cancelled successfully',
      ...(trustInfo ? { trust: trustInfo } : {}),
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get rides by driver
// @route   GET /api/v1/rides/driver/:driverId
// @access  Private

//Function to get rides by driver
exports.getRidesByDriver = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, status } = req.query;
    const query = { driver_id: req.params.driverId };
    // Optional status filter
    if (status) query.status = status;
    // Fetch rides with pagination
    const rides = await Ride.find(query)
      .populate('driver_id', 'name username rating')
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort({ fecha: -1, hora: -1 });
    // Get total count for pagination
    const count = await Ride.countDocuments(query);

    res.status(200).json({
      success: true,
      data: rides,
      pagination: {
        total: count,
        page: parseInt(page),
        pages: Math.ceil(count / limit),
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Start ride
// @route   PATCH /api/v1/rides/:id/start
// @access  Private/Conductor

//Function to start ride
exports.startRide = async (req, res, next) => {
  try {
    const ride = await Ride.findById(req.params.id);

    if (!ride) {
      return res.status(404).json({
        success: false,
        message: 'Ride not found',
      });
    }

    // Check if user owns the ride
    if (ride.driver_id.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied',
      });
    }
    // Can only start if ride is scheduled
    if (ride.status !== 'scheduled') {
      return res.status(400).json({
        success: false,
        message: 'Ride cannot be started',
      });
    }
    // Update status to in progress
    ride.status = 'in progress';
    await ride.save({ validateModifiedOnly: true });

    // ── Notificaciones de inicio de viaje ───────────────────────────
    // Capturamos los pasajeros confirmados al momento de iniciar.
    const confirmedBookings = await Booking.find(
      { ride_id: ride._id, status: 'confirmed' },
      { passenger_id: 1 }
    );
    const passengerCount = confirmedBookings.length;

    // Confirmación al conductor en su propia campana.
    // Si no hay pasajeros confirmados omitimos esta notificación: el
    // conductor inició un viaje vacío y el frontend ya lo redirige.
    if (passengerCount > 0) {
      sendNotification(
        ride.driver_id.toString(),
        `Has iniciado el viaje con ${passengerCount} ${passengerCount === 1 ? 'pasajero' : 'pasajeros'}.`,
        'ride_started',
        { entityType: 'ride', entityId: ride._id }
      );
    }

    // A cada pasajero le notificamos que el viaje arrancó (cubre el
    // RideStartedModal de WaitingForTheStart para usuarios que tengan
    // optIn=true; los que lo tengan en false igualmente lo verán en la
    // campana al volver a abrir la app).
    confirmedBookings.forEach((b) => {
      sendNotification(
        b.passenger_id.toString(),
        'El viaje ha iniciado. Tu conductor está en camino.',
        'ride_started',
        { entityType: 'ride', entityId: ride._id }
      );
    });

    res.status(200).json({
      success: true,
      message: 'Ride started successfully',
      data: ride,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Complete ride (PASO 1 del cierre — verificación pendiente)
// @route   PATCH /api/v1/rides/:id/complete
// @access  Private/Conductor
//
// NOTA: Antes este endpoint marcaba el ride como 'completed' y los bookings
// también. Ahora deja el ride en 'awaiting_payment_verification' y los
// bookings siguen en 'confirmed'. El cierre real (ride 'completed' + bookings
// 'completed' + métricas + notificación de "viaje finalizado") se hace en
// finalizePaymentVerification, cuando el conductor confirma los pagos en la
// pantalla PaymentVerification.
exports.completeRide = async (req, res, next) => {
  try {
    const ride = await Ride.findById(req.params.id);

    // Validate ride existence
    if (!ride) {
      return res.status(404).json({
        success: false,
        message: 'Ride not found',
      });
    }

    // Check if user owns the ride
    if (ride.driver_id.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied',
      });
    }

    // Idempotencia: si ya estaba en awaiting (re-tap del botón Finalizar
    // viaje desde CurrentTrip), devolvemos OK con los datos actuales.
    if (ride.status === 'awaiting_payment_verification') {
      return res.status(200).json({
        success: true,
        message: 'Ride already awaiting payment verification',
        data: ride,
      });
    }

    // Can only complete if ride is in progress
    if (ride.status !== 'in progress') {
      return res.status(400).json({
        success: false,
        message: 'Ride is not in progress',
      });
    }

    // Update status to awaiting_payment_verification (paso intermedio)
    ride.status = 'awaiting_payment_verification';
    await ride.save({ validateModifiedOnly: true });

    res.status(200).json({
      success: true,
      message: 'Ride awaiting payment verification',
      data: ride,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Finalize payment verification (PASO 2 del cierre — cierre real)
// @route   PATCH /api/v1/rides/:id/finalize-payment-verification
// @access  Private/Conductor
//
// Cuando el conductor toca "Continuar" en PaymentVerification, este endpoint
// hace el cierre real:
//   - Marca el ride como 'completed'.
//   - Marca los bookings 'confirmed' restantes como 'completed' (con
//     distance_km calculado).
//   - Dispara notificaciones de "viaje finalizado" a pasajeros y conductor.
//   - Encola el refresh de métricas.
//
// Es idempotente: si el ride ya está 'completed' devuelve OK sin re-disparar
// notificaciones ni métricas.
exports.finalizePaymentVerification = async (req, res, next) => {
  try {
    const ride = await Ride.findById(req.params.id);

    if (!ride) {
      return res.status(404).json({
        success: false,
        message: 'Ride not found',
      });
    }

    if (ride.driver_id.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied',
      });
    }

    // Idempotencia: el segundo tap a "Continuar" (o un reintento del cliente
    // tras un timeout) no debe disparar notificaciones ni métricas otra vez.
    // La primera llamada ya marcó payment_reviewed_at en todos los bookings.
    if (ride.status === 'completed') {
      return res.status(200).json({
        success: true,
        message: 'Ride already finalized',
        data: ride,
      });
    }

    const isCancelledRide = ride.status === 'cancelled';
    const isAwaiting = ride.status === 'awaiting_payment_verification';
    const isInProgress = ride.status === 'in progress';

    // Aceptamos cancelled (ride auto-cancelado o cancelado por conductor:
    // el frontend igual lo lleva a PaymentVerification para que confirme
    // penalizaciones), awaiting_payment_verification (flujo nuevo) y
    // 'in progress' (compat).
    if (!isCancelledRide && !isAwaiting && !isInProgress) {
      return res.status(400).json({
        success: false,
        message: 'Ride is not in a finalizable state',
      });
    }

    let finalizedBookings = [];
    // Indica si el ride terminó como cancelled (ya sea porque entró así
    // o porque al promover no había bookings 'confirmed' que completar).
    // Útil para decidir notificaciones/métricas y el mensaje de respuesta.
    let endedAsCancelled = isCancelledRide;

    // Solo intentamos promover ride y bookings si el ride NO está cancelled.
    // Cancelled es inmutable: ni el ride ni sus bookings cancelados pueden
    // volverse 'completed'. Acá solo registramos la revisión.
    if (!isCancelledRide) {
      // Resolve distance before saving so a coordinate error doesn't leave
      // the ride as 'completed' with bookings still in 'confirmed'.
      const distance_km = resolveCompletedBookingDistanceKm(ride);

      // Capturamos pasajeros confirmados antes de actualizar para poder
      // notificarles que el viaje fue finalizado.
      finalizedBookings = await Booking.find(
        { ride_id: ride._id, status: 'confirmed' },
        { passenger_id: 1 }
      );

      if (finalizedBookings.length === 0) {
        // No hay bookings 'confirmed' que promover — todos cancelaron y
        // el ride está sin pasajeros activos. No hubo viaje real que
        // completar: el ride debe terminar como 'cancelled', no 'completed'.
        // No disparamos notifs "viaje finalizado" ni métricas en este path.
        ride.status = 'cancelled';
        await ride.save({ validateModifiedOnly: true });
        endedAsCancelled = true;
      } else {
        ride.status = 'completed';
        await ride.save({ validateModifiedOnly: true });

        await Booking.updateMany(
          { ride_id: ride._id, status: 'confirmed' },
          { $set: { status: 'completed', distance_km } }
        );
      }
    }

    // Marcar TODOS los bookings del ride como revisados por el conductor.
    // Esta es la señal explícita que WaitingPaymentConfirmation del pasajero
    // usa para liberarlo, sin importar el veredicto Pagó/No pagó. Es
    // necesario porque en el caso "auto-cancel del ride + conductor marca
    // No pagó" ni ride.status ni booking.payment_status cambian, así que
    // sin este campo el pasajero quedaría esperando indefinidamente.
    const reviewedAt = new Date();
    await Booking.updateMany(
      { ride_id: ride._id },
      { $set: { payment_reviewed_at: reviewedAt } }
    );

    // Notificaciones y métricas solo aplican cuando realmente cerramos el
    // viaje con pasajeros que lo completaron. Si el ride entró cancelled
    // o terminó cancelled (porque no había confirmed que promover), no
    // disparamos nada: no hubo viaje real que celebrar ni métricas que
    // recalcular sobre bookings completed.
    if (!endedAsCancelled) {
      // Notificar a cada pasajero del viaje que ya finalizó (campana + push
      // si tienen optIn=true). El frontend del pasajero recibirá esto incluso
      // si su polling estaba en el límite del intervalo.
      finalizedBookings.forEach((b) => {
        sendNotification(
          b.passenger_id.toString(),
          'Tu viaje fue finalizado. ¡Esperamos que hayas tenido un buen trayecto!',
          'ride_completed',
          { entityType: 'ride', entityId: ride._id }
        );
      });

      // Confirmación al conductor en su propia campana — queda en el historial.
      const finalCount = finalizedBookings.length;
      sendNotification(
        ride.driver_id.toString(),
        finalCount > 0
          ? `Finalizaste el viaje con ${finalCount} ${finalCount === 1 ? 'pasajero' : 'pasajeros'}.`
          : 'Finalizaste el viaje.',
        'ride_completed',
        { entityType: 'ride', entityId: ride._id }
      );

      // Fire-and-forget metrics refresh (driver + every involved passenger).
      setImmediate(() => refreshMetricsForRide(ride._id));
    }

    res.status(200).json({
      success: true,
      message: endedAsCancelled
        ? 'Ride ended as cancelled (no confirmed bookings to complete)'
        : 'Ride completed successfully',
      data: ride,
    });
  } catch (error) {
    next(error);
  }
};
