const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
  ride_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Ride',
    required: [true, 'Ride ID is required'],
  },
  passenger_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Passenger ID is required'],
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
  status: {
    type: String,
    enum: {
      values: ['pending', 'confirmed', 'cancelled', 'canceled', 'completed', 'deny'],
      message: 'Invalid status',
    },
    default: 'pending',
  },
  seats_booked: {
    type: Number,
    default: 1,
    min: [1, 'Must book at least 1 seat'],
    max: [7, 'Cannot book more than 7 seats'],
  },
  distance_km: {
    type: Number,
    default: 0,
    min: [0, 'Distance cannot be negative'],
  },
  offered_amount: {
    type: Number,
    min: 0,
  },
  charged_amount: {
    type: Number,
    default: 0,
    min: [0, 'Charged amount cannot be negative'],
  },
  payment_status: {
    type: String,
    enum: ['pending', 'paid', 'waived'],
    default: 'pending',
  },
  payment_type: {
    type: String,
    enum: ['normal', 'gifted'],
    default: 'normal',
  },
  // Medio con el que se pagó. Los electrónicos (paypal, card, google_pay,
  // apple_pay) los fija la captura de PayPal; efectivo y SINPE los confirma
  // el conductor como siempre.
  payment_method: {
    type: String,
    enum: ['cash', 'sinpe', 'paypal', 'card', 'google_pay', 'apple_pay', null],
    default: null,
  },
  // ID de la orden de PayPal capturada, para conciliación.
  payment_reference: {
    type: String,
    default: null,
  },
  // Monto realmente cobrado en USD (PayPal no opera en colones).
  paid_amount_usd: {
    type: Number,
    default: null,
  },
  // Tope de largo en los textos libres (antes se guardaba 1 MB por reserva).
  passenger_origin: {
    type: String,
    default: null,
    maxlength: 300,
  },
  passenger_destination: {
    type: String,
    default: null,
    maxlength: 300,
  },
  // Timestamp en que el conductor confirmó su revisión del cobro en
  // PaymentVerification o PreviousTripsScreen. Se setea SIEMPRE que el
  // conductor decide, sin importar el veredicto (Pagó o No pagó). Es la
  // señal que WaitingPaymentConfirmation usa para liberar al pasajero —
  // no podemos usar payment_status por sí solo porque el caso "No pagó"
  // del auto-cancel (pending → pending) no produce ningún cambio detectable.
  payment_reviewed_at: {
    type: Date,
    default: null,
  },
}, {
  timestamps: true,
});

// Invariante del modelo (última capa, por si un controlador se equivoca): una
// reserva 'completed' no cambia de estado. Cancelarla después de terminar el
// viaje la sacaba de la regla de "cobro pendiente" y el pasajero no pagaba.
bookingSchema.post('init', function () {
  this.$locals.loadedStatus = this.status;
});
bookingSchema.pre('save', function () {
  if (this.$locals.loadedStatus === 'completed' && this.status !== 'completed') {
    const err = new Error('A completed booking cannot change its status');
    err.statusCode = 400;
    throw err;
  }
});

// Indexes
bookingSchema.index({ ride_id: 1 });
bookingSchema.index({ passenger_id: 1 });
bookingSchema.index({ status: 1 });

// Compound index to prevent duplicate bookings
bookingSchema.index({ ride_id: 1, passenger_id: 1 }, { unique: true });

const Booking = mongoose.model('Booking', bookingSchema);

module.exports = Booking;
