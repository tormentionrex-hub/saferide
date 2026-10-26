const { Booking, Ride, Notification } = require('../models');
// IMPORTANTE: usamos el servicio real (services/notificationService), no el worker.
// El servicio crea el registro en BD Y dispara el push del SO respetando user.optIn.
// El worker antiguo solo guardaba en BD sin push, y antes se llamaba además de un
// Notification.create() directo → duplicaba el registro. Bug arreglado aquí.
const { sendNotification } = require('../services/notificationService');
const { refreshMetricsForBooking } = require('../services/metricsService');
const trustService = require('../services/trustService');

const PREFERRED_PAYMENT_METHODS = ['cash', 'sinpe', 'card', 'paypal'];

// @desc    Create a booking
// @route   POST /api/v1/bookings
// @access  Private/Pasajero

//Function to create a booking
exports.createBooking = async (req, res, next) => {
  try {
    const { ride_id, seats_booked = 1, passenger_origin = null, passenger_destination = null, offered_amount } = req.body;
    // Método con el que el pasajero piensa pagar. La captura de PayPal lo
    // reemplaza por el método real cuando el pago se hace en línea.
    const payment_method = PREFERRED_PAYMENT_METHODS.includes(req.body.payment_method)
      ? req.body.payment_method
      : null;

    // Find the ride
    const ride = await Ride.findById(ride_id);

    if (!ride) {
      return res.status(404).json({
        success: false,
        message: 'Ride not found',
      });
      }

    // Check if ride is available for booking
    if (ride.status !== 'scheduled') {
      return res.status(400).json({
        success: false,
        message: 'This ride is not available for booking',
      });
    }

    // Check if user is trying to book their own ride
    if (ride.driver_id.toString() === req.user._id.toString()) {
      return res.status(400).json({
        success: false,
        message: 'Cannot book your own ride',
      });
    }

    // Check if user already has an active booking for this ride
    const existingBooking = await Booking.findOne({
      ride_id,
      passenger_id: req.user._id,
    });

    if (existingBooking) {
      // If already pending or confirmed, block
      if (['pending', 'confirmed'].includes(existingBooking.status)) {
        return res.status(409).json({
          success: false,
          message: 'You already have a booking for this ride',
        });
      }
      // If denied or cancelled, reset to pending so the passenger can retry
      existingBooking.status = 'pending';
      if (offered_amount !== undefined) {
        existingBooking.offered_amount = offered_amount;
        existingBooking.charged_amount = Number(offered_amount) || 0;
      }
      if (passenger_origin) existingBooking.passenger_origin = passenger_origin.trim();
      if (passenger_destination) existingBooking.passenger_destination = passenger_destination.trim();
      if (payment_method) existingBooking.payment_method = payment_method;

      await existingBooking.save();
      const booking = existingBooking;

      // sendNotification (services/notificationService) ya hace Notification.create()
      // y dispara el push del SO respetando user.optIn. No duplicar con un
      // Notification.create() directo aquí (era el bug que generaba registros dobles).
      sendNotification(
        ride.driver_id.toString(),
        `${req.user.name} quiere unirse a tu viaje (${seats_booked} asiento(s)). Acepta o rechaza la solicitud.`,
        'booking_pending',
        { entityType: 'booking', entityId: booking._id }
      );

      await booking.populate('ride_id passenger_id');
      return res.status(200).json({
        success: true,
        message: 'Booking re-submitted successfully',
        data: booking,
      });
    }

    // Check if enough seats are available
    if (ride.available_seats < seats_booked) {
      return res.status(400).json({
        success: false,
        message: `Only ${ride.available_seats} seat(s) available`,
      });
    }

    // Create booking
    const booking = await Booking.create({
      ride_id,
      passenger_id: req.user._id,
      payment_method,
      seats_booked,
      status: 'pending',
      passenger_origin: passenger_origin?.trim() || null,
      passenger_destination: passenger_destination?.trim() || null,
      offered_amount,
      charged_amount: Number(offered_amount) || 0,
    });

    // Notificar al conductor (1 registro + push si el conductor tiene optIn=true)
    sendNotification(
      ride.driver_id.toString(),
      `${req.user.name} quiere unirse a tu viaje (${seats_booked} asiento(s)). Acepta o rechaza la solicitud.`,
      'booking_pending',
      {
        entityType: 'booking',
        entityId: booking._id,
      }
    );

    await booking.populate('ride_id passenger_id');

    res.status(201).json({
      success: true,
      message: 'Booking created successfully',
      data: booking,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all bookings (Admin or filtered by user)
// @route   GET /api/v1/bookings
// @access  Private

//Function to get all bookings
exports.getAllBookings = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, status, userId } = req.query;
    const query = {};

    if (status) query.status = status;

    // If not admin, only show user's own bookings
    if (req.user.type !== 'admin') {
      query.passenger_id = req.user._id;
    } else if (userId) {
      query.passenger_id = userId;
    }
    // Fetch bookings with pagination
    const bookings = await Booking.find(query)
      .populate('ride_id')
      .populate('passenger_id', 'name username rating profileImage')
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort({ createdAt: -1 });

    const count = await Booking.countDocuments(query);
    // Return paginated results
    res.status(200).json({
      success: true,
      data: bookings,
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

// @desc    Get booking by ID
// @route   GET /api/v1/bookings/:id
// @access  Private

//Function to get booking by ID
exports.getBookingById = async (req, res, next) => {
  try {
    const booking = await Booking.findById(req.params.id)
      .populate({
        path: 'ride_id',
        populate: {
          path: 'driver_id',
          select: 'name username rating profileImage phone',
        },
      })
      .populate('passenger_id', 'name username rating profileImage phone');

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found',
      });
    }

    // Check if user has access to this booking
    if (
      booking.passenger_id._id.toString() !== req.user._id.toString() &&
      booking.ride_id.driver_id._id.toString() !== req.user._id.toString() &&
      req.user.type !== 'admin'
    ) {
      return res.status(403).json({
        success: false,
        message: 'Access denied',
      });
    }
    // Return booking details
    res.status(200).json({
      success: true,
      data: booking,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get bookings by passenger
// @route   GET /api/v1/bookings/passenger/:passengerId
// @access  Private

//Function to get bookings by passenger
exports.getBookingsByPassenger = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, status } = req.query;
    const passengerId = req.params.passengerId;

    // Check if user has access
    if (
      passengerId !== req.user._id.toString() &&
      req.user.type !== 'admin'
    ) {
      return res.status(403).json({
        success: false,
        message: 'Access denied',
      });
    }
    // Build query
    const query = { passenger_id: passengerId };
    if (status) query.status = status;
    // Fetch bookings with pagination
    const bookings = await Booking.find(query)
      .populate({
        path: 'ride_id',
        populate: {
          path: 'driver_id',
          select: 'name username rating profileImage',
        },
      })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort({ createdAt: -1 });
      // Return paginated results
    const count = await Booking.countDocuments(query);

    res.status(200).json({
      success: true,
      data: bookings,
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

// @desc    Get bookings by ride
// @route   GET /api/v1/bookings/ride/:rideId
// @access  Private


// @desc    Reservas de todos los viajes del conductor autenticado
// @route   GET /api/v1/bookings/driver/me?rideStatus=completed
// @access  Private/Conductor
//
// Reemplaza el patrón de pedir /bookings/ride/:id una vez por viaje: con 100
// viajes eran 101 llamadas desde la pantalla de métricas.
exports.getMyDriverBookings = async (req, res, next) => {
  try {
    const rideQuery = { driver_id: req.user._id };
    if (req.query.rideStatus) rideQuery.status = req.query.rideStatus;
    const rideIds = await Ride.find(rideQuery).distinct('_id');

    const bookings = await Booking.find({ ride_id: { $in: rideIds } })
      .select('ride_id passenger_id status charged_amount offered_amount payment_status payment_type createdAt')
      .lean();

    res.status(200).json({ success: true, data: bookings });
  } catch (error) {
    next(error);
  }
};

//Function to get bookings by ride
exports.getBookingsByRide = async (req, res, next) => {
  try {
    const ride = await Ride.findById(req.params.rideId);

    if (!ride) {
      return res.status(404).json({
        success: false,
        message: 'Ride not found',
      });
    }

    // Check if user is the driver
    if (
      ride.driver_id.toString() !== req.user._id.toString() &&
      req.user.type !== 'admin'
    ) {
      return res.status(403).json({
        success: false,
        message: 'Access denied',
      });
    }
    // Fetch bookings for the ride
    const bookings = await Booking.find({ ride_id: req.params.rideId })
      .populate('passenger_id', 'name username rating profileImage phone')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: bookings,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Cancel booking
// @route   DELETE /api/v1/bookings/:id
// @access  Private

//Function to cancel a booking
exports.cancelBooking = async (req, res, next) => {
  try {
    const booking = await Booking.findById(req.params.id).populate('ride_id');

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found',
      });
    }

    // Check if user owns the booking
    if (booking.passenger_id.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied',
      });
    }

    // Check if booking can be cancelled
    if (booking.status === 'cancelled' || booking.status === 'completed') {
      return res.status(400).json({
        success: false,
        message: 'This booking cannot be cancelled',
      });
    }

    // Capturamos el status previo del booking ANTES de mutarlo:
    // solo restauramos asientos si el booking estaba 'confirmed'
    // (un 'pending' nunca había descontado del available_seats, así
    // que sumarle ahora sería un over-credit / asientos fantasma).
    const wasConfirmed = booking.status === 'confirmed';
    const ride = booking.ride_id;

    // Update booking status
    booking.status = 'cancelled';
    booking.payment_status = 'waived';
    await booking.save();

    // Solo devolvemos los asientos al inventario si:
    //   1. El booking estaba 'confirmed' (había descontado seats).
    //   2. El ride está 'scheduled' (todavía no arrancó). Una vez que
    //      el ride pasa a 'in progress' o más allá, los asientos no
    //      se tocan — quedan "perdidos" para reflejar que el cupo
    //      físico ya estaba comprometido al iniciar el viaje.
    if (wasConfirmed && ride.status === 'scheduled') {
      ride.available_seats += booking.seats_booked;
      await ride.save();
    }

    // Notificar al conductor (sin duplicar Notification.create)
    sendNotification(
      ride.driver_id.toString(),
      `${req.user.name} ha cancelado su reserva`,
      'booking_cancelled',
      {
        entityType: 'booking',
        entityId: booking._id,
      }
    );

    // Confirmación al pasajero mismo — entrada en su historial.
    sendNotification(
      req.user._id.toString(),
      'Has cancelado tu reserva.',
      'booking_cancelled',
      { entityType: 'booking', entityId: booking._id }
    );

    res.status(200).json({
      success: true,
      message: 'Booking cancelled successfully',
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Cancel a confirmed booking by the conductor (single-l canceled)
// @route   PATCH /api/v1/bookings/:id/canceled
// @access  Private/Conductor/Admin

//Function to cancel a confirmed booking by conductor
exports.canceledBooking = async (req, res, next) => {
  try {
    const booking = await Booking.findById(req.params.id).populate('ride_id');

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found',
      });
    }

    // Only the passenger who owns the booking can use this endpoint
    if (booking.passenger_id.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied',
      });
    }

    // Can only cancel a confirmed booking
    if (booking.status !== 'confirmed') {
      return res.status(400).json({
        success: false,
        message: 'Only confirmed bookings can be canceled this way',
      });
    }

    const ride = booking.ride_id;

    // Update booking status
    booking.status = 'canceled';
    await booking.save();

    // Solo devolvemos los asientos si el ride todavía no arrancó.
    // Una vez 'in progress' (o más allá), el cupo físico ya quedó
    // comprometido al iniciar el viaje y no tiene sentido reabrirlo.
    if (ride.status === 'scheduled') {
      ride.available_seats += booking.seats_booked;
      await ride.save();
    }

    // Notificar al conductor (sin duplicar Notification.create)
    sendNotification(
      ride.driver_id.toString(),
      `${req.user.name} ha cancelado su reserva confirmada.`,
      'booking_cancelled',
      {
        entityType: 'booking',
        entityId: booking._id,
      }
    );

    // Confirmación al pasajero mismo — entrada en su historial.
    sendNotification(
      req.user._id.toString(),
      'Has cancelado tu reserva.',
      'booking_cancelled',
      { entityType: 'booking', entityId: booking._id }
    );

    res.status(200).json({
      success: true,
      message: 'Booking canceled successfully',
      data: booking,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update booking status (Admin/Driver only)
// @route   PATCH /api/v1/bookings/:id/status
// @access  Private

//Function to update booking status
exports.updateBookingStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    const booking = await Booking.findById(req.params.id).populate('ride_id');

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found',
      });
    }

    // Check if user is driver, admin, or passenger owner of this booking
    const isDriver = booking.ride_id.driver_id.toString() === req.user._id.toString();
    const isPassengerOwner = booking.passenger_id.toString() === req.user._id.toString();
    const isAdmin = req.user.type === 'admin';

    if (!isDriver && !isPassengerOwner && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Access denied',
      });
    }

    // Passengers can ONLY cancel their own booking — no other status changes allowed
    const passengerOnly = isPassengerOwner && !isDriver && !isAdmin;
    if (passengerOnly && status !== 'cancelled') {
      return res.status(403).json({
        success: false,
        message: 'Solo puedes cancelar tu propia reserva.',
      });
    }
    const ride = booking.ride_id;

    // When driver confirms: discount seats (use updateOne to avoid ride validators)
    if (status === 'confirmed' && booking.status === 'pending') {
      if (ride.available_seats < booking.seats_booked) {
        return res.status(400).json({
          success: false,
          message: `Only ${ride.available_seats} seat(s) available`,
        });
      }
      await Ride.updateOne(
        { _id: ride._id },
        { $inc: { available_seats: -booking.seats_booked } }
      );
    }

    // Restauración simétrica al descuento de arriba: si el booking pasa
    // de 'confirmed' a un estado inactivo ANTES de que el ride arranque,
    // devolvemos los asientos al inventario. Después de que el ride entra
    // a 'in progress', el cupo queda fijo (el conductor ya salió con
    // ese cupo comprometido; un asiento "liberado" después de iniciar
    // el viaje no se puede revender porque el carro ya está en ruta).
    const cancelStates = ['cancelled', 'canceled', 'deny'];
    if (
      booking.status === 'confirmed' &&
      cancelStates.includes(status) &&
      ride.status === 'scheduled'
    ) {
      await Ride.updateOne(
        { _id: ride._id },
        { $inc: { available_seats: booking.seats_booked } }
      );
    }

    // When driver denies: notify passenger (sin duplicar Notification.create)
    if (status === 'deny' && booking.status === 'pending') {
      sendNotification(
        booking.passenger_id.toString(),
        'El conductor rechazó tu solicitud de viaje.',
        'booking_denied',
        {
          entityType: 'booking',
          entityId: booking._id,
        }
      );
    }

    const previousStatus = booking.status;
    booking.status = status;

    // Optionally update payment fields if provided
    const { payment_status, payment_type, apply_penalty } = req.body;

    // Handle penalty logic (apply_penalty is a transient trigger, NOT saved to DB)
    if (apply_penalty === true) {
      // Prevent double penalty: only allow if charged_amount still equals offered_amount
      if (booking.charged_amount !== booking.offered_amount) {
        return res.status(400).json({
          success: false,
          message: 'Penalty already applied',
        });
      }
      booking.charged_amount = Math.round((booking.offered_amount / 2) * 100) / 100;
    }

    // Only drivers and admins can override payment fields — passengers cannot manipulate these
    if (!passengerOnly) {
      if (payment_status && ['pending', 'paid', 'waived'].includes(payment_status)) {
        booking.payment_status = payment_status;
      }
      if (payment_type && ['normal', 'gifted'].includes(payment_type)) {
        booking.payment_type = payment_type;
      }
    }

    await booking.save();

    // Notificar al pasajero cuando el conductor acepta su solicitud.
    // Guard `previousStatus === 'pending'` asegura idempotencia ante
    // reintentos del PATCH (no dispara dos veces si el conductor toca
    // "Aceptar" varias veces).
    if (status === 'confirmed' && previousStatus === 'pending') {
      sendNotification(
        booking.passenger_id.toString(),
        'Tu solicitud de viaje fue aceptada. ¡Prepárate para el viaje!',
        'booking_confirmed',
        { entityType: 'booking', entityId: booking._id }
      );
    }

    // Fire-and-forget metrics refresh when a booking transitions to completed.
    // The ride was already populated above, so booking.ride_id has driver_id available.
    // setImmediate defers the aggregations to the next event loop tick.
    if (booking.status === 'completed' && previousStatus !== 'completed') {
      setImmediate(() => refreshMetricsForBooking(booking));
    }

    // ── TrustScore hook ──────────────────────────────────────────────
    // Si el pasajero cancela su propia reserva GIFTED mientras el viaje
    // está in progress, decrementamos su trustScore. El guard previousStatus
    // !== 'cancelled' asegura idempotencia ante reintentos del cliente.
    let trustInfo = null;
    const justTransitionedToCancelled =
      previousStatus !== 'cancelled' && booking.status === 'cancelled';

    // Notificaciones cuando el pasajero cancela su propia reserva via PATCH
    // (TripInProgress con apply_penalty, WaitingForTheStart, etc.). El driver
    // necesita saberlo aunque su polling tardara unos segundos en detectarlo.
    if (justTransitionedToCancelled && passengerOnly) {
      sendNotification(
        ride.driver_id.toString(),
        `${req.user.name} ha cancelado su reserva.`,
        'booking_cancelled',
        { entityType: 'booking', entityId: booking._id }
      );
      sendNotification(
        req.user._id.toString(),
        'Has cancelado tu reserva.',
        'booking_cancelled',
        { entityType: 'booking', entityId: booking._id }
      );
    }

    if (
      justTransitionedToCancelled &&
      passengerOnly &&
      booking.payment_type === 'gifted' &&
      booking.payment_status === 'waived' &&
      ride.status === 'in progress'
    ) {
      try {
        const result = await trustService.decrementTrust(req.user._id, {
          reason: 'cancel_gifted_trip_passenger',
          actorId: req.user._id,
          bookingId: booking._id,
          rideId: ride._id,
        });
        trustInfo = { newScore: result.newScore, decremented: result.changed };
      } catch (trustErr) {
        // No bloqueamos la respuesta de la cancelación si el decremento falla;
        // solo lo logueamos. El usuario ya canceló exitosamente.
        console.error('[TrustService] Error decrementing trust:', trustErr.message);
      }
    }

    // ── Auto-cancel del ride cuando se queda sin pasajeros activos ──
    // Si un booking 'confirmed' acaba de pasar a 'cancelled' durante un
    // ride 'in progress' y NO quedan otros 'confirmed', el viaje pierde
    // sentido (no hay a quién llevar). Auto-cancelamos el ride desde el
    // backend para garantizar consistencia incluso si el conductor no
    // tenía CurrentTrip abierto para detectarlo. NO decrementamos el
    // trustScore del conductor: la cancelación no fue iniciada por él.
    //
    // Importante: este bloque corre DESPUÉS del trust decrement del
    // pasajero gifted (línea de arriba) — ambos chequean ride.status ===
    // 'in progress' y deben ver el valor original antes de la mutación.
    const justBookingConfirmedToCancelled =
      previousStatus === 'confirmed' &&
      (status === 'cancelled' || status === 'canceled');

    if (justBookingConfirmedToCancelled && ride.status === 'in progress') {
      const remainingConfirmed = await Booking.countDocuments({
        ride_id: ride._id,
        _id: { $ne: booking._id },
        status: 'confirmed',
      });
      if (remainingConfirmed === 0) {
        // Usamos updateOne para evitar gatillar el pre-save de Ride (valida
        // fecha/hora; fallaría sobre un ride que ya arrancó).
        await Ride.updateOne(
          { _id: ride._id },
          { $set: { status: 'cancelled' } }
        );
        // Notificación al conductor — útil si la app estaba cerrada y no
        // pudo detectar el cancel desde el polling de CurrentTrip.
        sendNotification(
          ride.driver_id.toString(),
          'Tu viaje fue cancelado porque el último pasajero canceló.',
          'ride_cancelled',
          { entityType: 'ride', entityId: ride._id }
        );
      }
    }

    res.status(200).json({
      success: true,
      message: 'Booking status updated successfully',
      data: booking,
      ...(trustInfo ? { trust: trustInfo } : {}),
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update booking payment status (Conductor only)
// @route   PATCH /api/v1/bookings/:id/payment
// @access  Private
exports.updatePaymentStatus = async (req, res, next) => {
  try {
    const { payment_status } = req.body;
    const booking = await Booking.findById(req.params.id).populate('ride_id');

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found',
      });
    }

    // Check if user is driver or admin
    if (
      booking.ride_id.driver_id.toString() !== req.user._id.toString() &&
      req.user.type !== 'admin'
    ) {
      return res.status(403).json({
        success: false,
        message: 'Access denied',
      });
    }

    if (!['pending', 'paid', 'waived'].includes(payment_status)) {
       return res.status(400).json({
        success: false,
        message: 'Invalid payment status',
      });
    }

    // Prevent reverting a payment that is already marked as 'paid'
    if (booking.payment_status === 'paid' && payment_status !== 'paid') {
      return res.status(400).json({
        success: false,
        message: 'No se puede revertir un pago ya confirmado',
      });
    }

    booking.payment_status = payment_status;
    // Marcar el momento de la revisión por el conductor — señal que el
    // pasajero usa en WaitingPaymentConfirmation. Se setea incluso cuando
    // el conductor marca "No pagó" (payment_status sigue 'pending'), porque
    // sin este campo el caso "auto-cancel + No pagó" no genera ningún
    // cambio detectable por el polling.
    booking.payment_reviewed_at = new Date();
    await booking.save();

    res.status(200).json({
      success: true,
      message: 'Payment status updated successfully',
      data: booking,
    });
  } catch (error) {
    next(error);
  }
};
