const { Complaint, AuditLog, Ride, Booking } = require('../models');

const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const recordAudit = async (req, action, targetType, details) => {
  await AuditLog.create({
    adminEmail: req.user?.email || 'sistema',
    ipAddress: req.ip || req.socket?.remoteAddress || 'N/A',
    action,
    targetType,
    details,
    userAgent: req.get('user-agent') || 'N/A',
  });
};

exports.createComplaint = async (req, res, next) => {
  try {
    const { subject, fullMessage, category, rideId, bookingId } = req.body;

    const [ride, booking] = await Promise.all([
      Ride.findById(rideId).populate('driver_id', 'name email'),
      Booking.findById(bookingId).populate('passenger_id', 'name email'),
    ]);

    if (!ride || !booking) {
      return res.status(404).json({ success: false, message: 'Viaje o reserva no encontrada' });
    }
    if (String(booking.ride_id) !== String(ride._id)) {
      return res.status(400).json({ success: false, message: 'La reserva no pertenece al viaje indicado' });
    }

    const passenger = booking.passenger_id;
    const complaint = await Complaint.create({
      user: passenger?.name || 'Pasajero',
      email: passenger?.email || 'desconocido@saferide.cr',
      subject,
      fullMessage,
      message: fullMessage,
      category,
      tripId: String(ride._id),
      ride_id: ride._id,
      booking_id: booking._id,
      passenger_id: passenger?._id || booking.passenger_id || null,
      driver_id: ride.driver_id?._id || ride.driver_id || null,
      tripOrigin: ride.origin?.name || '',
      tripDestination: ride.destination?.name || '',
      tripDate: `${ride.fecha || ''} ${ride.hora || ''}`.trim(),
      tripPrice: Number(booking.charged_amount || booking.offered_amount || ride.suggested_price || 0),
      source: 'api',
    });

    await recordAudit(req, 'COMPLAINT_CREATED', 'complaint', `Registró la queja ${complaint._id} del viaje ${ride._id}`);

    res.status(201).json({ success: true, message: 'Queja registrada', data: complaint });
  } catch (error) {
    next(error);
  }
};

exports.getComplaints = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, status, category, search } = req.query;
    const query = {};

    if (status) query.status = status;
    if (category && category !== 'Todos') query.category = category;
    if (search) {
      const regex = new RegExp(escapeRegex(search), 'i');
      query.$or = [
        { user: regex },
        { email: regex },
        { subject: regex },
        { fullMessage: regex },
      ];
    }

    const [complaints, count] = await Promise.all([
      Complaint.find(query)
        .populate('ride_id', 'origin destination fecha hora suggested_price status')
        .populate('booking_id', 'charged_amount offered_amount payment_status status')
        .populate('passenger_id', 'name email')
        .populate('driver_id', 'name email')
        .sort({ createdAt: -1 })
        .limit(Number(limit))
        .skip((Number(page) - 1) * Number(limit)),
      Complaint.countDocuments(query),
    ]);

    res.status(200).json({
      success: true,
      data: complaints,
      pagination: {
        total: count,
        page: Number(page),
        pages: Math.ceil(count / Number(limit)),
      },
    });
  } catch (error) {
    next(error);
  }
};

exports.replyComplaint = async (req, res, next) => {
  try {
    const complaint = await Complaint.findById(req.params.id);
    if (!complaint) {
      return res.status(404).json({ success: false, message: 'Queja no encontrada' });
    }

    complaint.reply = req.body.message;
    complaint.status = 'Atendido';
    complaint.resolvedAt = new Date();
    await complaint.save();

    await recordAudit(req, 'COMPLAINT_RESOLVED', 'complaint', `Respondió la queja ${complaint._id}: ${complaint.subject}`);

    res.status(200).json({ success: true, message: 'Respuesta registrada', data: complaint });
  } catch (error) {
    next(error);
  }
};

exports.resolveComplaint = async (req, res, next) => {
  try {
    const complaint = await Complaint.findById(req.params.id);
    if (!complaint) {
      return res.status(404).json({ success: false, message: 'Queja no encontrada' });
    }

    complaint.status = 'Atendido';
    complaint.resolvedAt = new Date();
    await complaint.save();

    await recordAudit(req, 'COMPLAINT_RESOLVED', 'complaint', `Marcó como atendida la queja ${complaint._id}: ${complaint.subject}`);

    res.status(200).json({ success: true, message: 'Queja marcada como atendida', data: complaint });
  } catch (error) {
    next(error);
  }
};
