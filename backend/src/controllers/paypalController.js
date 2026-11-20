const Booking = require('../models/Bookings');

// PayPal no opera en colones: el monto del viaje (CRC) se convierte a USD con
// la tasa de PAYPAL_CRC_PER_USD. El valor por defecto es solo de referencia
// para sandbox; en producción la tasa debe venir del entorno.
const DEFAULT_CRC_PER_USD = 510;
const ELECTRONIC_METHODS = ['paypal', 'card', 'google_pay', 'apple_pay'];
// Formato de los IDs de orden de PayPal (17 caracteres hoy; margen por si cambia).
const ORDER_ID = /^[A-Z0-9]{8,36}$/;

const getCrcPerUsd = () => {
  const rate = Number(process.env.PAYPAL_CRC_PER_USD);
  return Number.isFinite(rate) && rate > 0 ? rate : DEFAULT_CRC_PER_USD;
};

const toUsd = (amountCrc) => {
  const usd = amountCrc / getCrcPerUsd();
  // PayPal exige al menos 0.01 y dos decimales.
  return Math.max(0.01, Math.round(usd * 100) / 100);
};

// El monto que la app le muestra al pasajero es charged_amount; offered_amount
// queda como respaldo para reservas viejas que no lo tienen.
const getBookingAmountCrc = (booking) =>
  booking.charged_amount > 0 ? booking.charged_amount : booking.offered_amount || 0;

// Generate an OAuth 2.0 access token for PayPal
const generateAccessToken = async () => {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const appSecret = process.env.PAYPAL_SECRET;
  const baseUrl = process.env.PAYPAL_API_BASE;

  if (!clientId || !appSecret) {
    throw new Error('MISSING_API_CREDENTIALS');
  }

  const auth = Buffer.from(`${clientId}:${appSecret}`).toString('base64');

  const response = await fetch(`${baseUrl}/v1/oauth2/token`, {
    method: 'POST',
    body: 'grant_type=client_credentials',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
  });

  const data = await response.json();
  if (!response.ok) {
    console.error('PayPal Auth Error:', data);
    throw new Error('Failed to generate Access Token');
  }
  return data.access_token;
};

// @desc    Public PayPal config for the hosted checkout page
// @route   GET /api/v1/paypal/config
// @access  Public (el client-id de PayPal es público por diseño)
exports.getConfig = (req, res) => {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  if (!clientId) {
    return res.status(503).json({ success: false, message: 'PayPal is not configured' });
  }
  const baseUrl = process.env.PAYPAL_API_BASE || '';
  res.status(200).json({
    success: true,
    clientId,
    environment: baseUrl.includes('sandbox') ? 'sandbox' : 'live',
    crcPerUsd: getCrcPerUsd(),
  });
};

// @desc    Create a PayPal order for a booking
// @route   POST /api/v1/paypal/create-order
// @access  Private (Passenger)
exports.createOrder = async (req, res, next) => {
  try {
    const { bookingId } = req.body;

    if (!bookingId) {
      return res.status(400).json({ success: false, message: 'Booking ID is required' });
    }

    const booking = await Booking.findById(bookingId).populate('ride_id');
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    if (booking.passenger_id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized for this booking' });
    }

    if (booking.payment_status === 'paid') {
      return res.status(400).json({ success: false, message: 'Booking is already paid' });
    }

    const amountCrc = getBookingAmountCrc(booking);
    if (amountCrc <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid booking amount' });
    }
    const amountUsd = toUsd(amountCrc);

    const accessToken = await generateAccessToken();
    const baseUrl = process.env.PAYPAL_API_BASE;

    // La app intercepta estas URLs en el WebView para saber cómo terminó la
    // aprobación; nunca llegan a cargarse.
    const returnUrl = `https://saferide.app/paypal/success?bookingId=${bookingId}`;
    const cancelUrl = `https://saferide.app/paypal/cancel?bookingId=${bookingId}`;

    const orderPayload = {
      intent: 'CAPTURE',
      purchase_units: [
        {
          reference_id: bookingId.toString(),
          amount: {
            currency_code: 'USD',
            value: amountUsd.toFixed(2),
          },
          description: `SafeRide - viaje (₡${amountCrc})`,
        },
      ],
      application_context: {
        return_url: returnUrl,
        cancel_url: cancelUrl,
        shipping_preference: 'NO_SHIPPING',
        user_action: 'PAY_NOW',
        brand_name: 'SafeRide',
        locale: 'es-CR',
      },
    };

    const response = await fetch(`${baseUrl}/v2/checkout/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(orderPayload),
    });

    const data = await response.json();
    if (!response.ok) {
      console.error('PayPal Create Order Error:', data);
      return res.status(500).json({ success: false, message: 'Failed to create PayPal order' });
    }

    const approveLink = data.links.find(link => link.rel === 'approve');

    if (!approveLink) {
      return res.status(500).json({ success: false, message: 'No approve link found from PayPal' });
    }

    res.status(200).json({
      success: true,
      orderId: data.id,
      approvalUrl: approveLink.href,
      amountCrc,
      amountUsd,
      crcPerUsd: getCrcPerUsd(),
    });
  } catch (error) {
    console.error('createOrder Error:', error);
    next(error);
  }
};

// @desc    Capture an approved PayPal order and mark the booking as paid
// @route   POST /api/v1/paypal/capture-order
// @access  Private (Passenger)
exports.captureOrder = async (req, res, next) => {
  try {
    const { orderId, bookingId } = req.body;
    const method = ELECTRONIC_METHODS.includes(req.body.method) ? req.body.method : 'paypal';

    if (!orderId || !bookingId) {
      return res.status(400).json({ success: false, message: 'Order ID and Booking ID are required' });
    }

    // El orderId se pega en la URL de la API de PayPal, que se llama con el
    // token del comercio. Sin validarlo, un valor como
    // "../../payments/captures/X/refund" hacía que el servidor ejecutara otra
    // operación de PayPal (un reembolso) y, como esa respuesta también dice
    // COMPLETED, la reserva quedaba pagada. Los IDs de orden son alfanuméricos.
    if (typeof orderId !== 'string' || !ORDER_ID.test(orderId)) {
      return res.status(400).json({ success: false, message: 'Invalid order ID' });
    }

    const booking = await Booking.findById(bookingId);
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    if (booking.passenger_id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized for this booking' });
    }

    if (booking.payment_status === 'paid') {
      return res.status(200).json({ success: true, message: 'Booking already paid', data: booking });
    }

    const accessToken = await generateAccessToken();
    const baseUrl = process.env.PAYPAL_API_BASE;

    // encodeURIComponent: segunda barrera por si el formato del orderId se
    // relajara algún día; un "/" o ".." nunca llega a la ruta de PayPal.
    const response = await fetch(`${baseUrl}/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const data = await response.json();

    // La orden debe pertenecer a esta reserva: evita reutilizar el pago de
    // otra reserva más barata.
    // Es obligatorio: una respuesta sin purchase_units no es la captura de
    // una orden de esta reserva y no se acepta como pago.
    const unit = data.purchase_units?.[0];
    // Además, la respuesta debe ser de la misma orden que se pidió capturar.
    if (data.status === 'COMPLETED'
        && (data.id !== orderId || unit?.reference_id !== bookingId.toString())) {
      console.error('PayPal Capture Error: order/booking mismatch', { orderId, bookingId });
      return res.status(400).json({ success: false, message: 'Order does not match booking' });
    }

    if (data.status === 'COMPLETED') {
      const capture = unit?.payments?.captures?.[0];
      // El monto capturado debe cubrir el de la reserva. La orden también la
      // puede crear el cliente con el client-id público (lo hace el SDK de
      // PayPal), así que no basta con que el reference_id coincida: sin esto
      // se podía pagar 0.01 USD un viaje de ₡5000. Tolerancia de un centavo.
      const capturedUsd = Number(capture?.amount?.value);
      const expectedUsd = toUsd(getBookingAmountCrc(booking));
      // La captura misma debe estar COMPLETED: una orden puede quedar
      // COMPLETED con la captura en PENDING (fondos sin acreditar).
      if (capture?.status !== 'COMPLETED' || capture?.amount?.currency_code !== 'USD' || !Number.isFinite(capturedUsd)
          || capturedUsd + 0.01 < expectedUsd) {
        console.error('PayPal Capture Error: amount mismatch', { orderId, bookingId, capturedUsd, expectedUsd });
        return res.status(400).json({ success: false, message: 'Captured amount does not match booking' });
      }
      // Un pago electrónico capturado no necesita la revisión manual del
      // conductor: queda pagado y revisado, y el pasajero se libera de
      // WaitingPaymentConfirmation de inmediato.
      // Escritura condicional y atómica: solo la reserva de este pasajero y
      // solo si todavía no estaba pagada (dos capturas en paralelo no la
      // escriben dos veces).
      const paid = await Booking.findOneAndUpdate(
        { _id: booking._id, passenger_id: req.user._id, payment_status: { $ne: 'paid' } },
        { $set: {
          payment_status: 'paid',
          payment_method: method,
          payment_reference: orderId,
          paid_amount_usd: capturedUsd,
          payment_reviewed_at: new Date(),
        } },
        { new: true }
      );

      return res.status(200).json({
        success: true,
        message: paid ? 'Payment captured successfully' : 'Booking already paid',
        data: paid || await Booking.findById(booking._id),
      });
    }

    console.error('PayPal Capture Error:', data);
    return res.status(400).json({
      success: false,
      message: 'Payment not completed or failed',
      // Solo el estado: la respuesta completa de PayPal es interna (enlaces
      // de la API, datos del pagador) y no tiene por qué llegar al cliente.
      data: { status: data.status || null, name: data.name || null },
    });
  } catch (error) {
    console.error('captureOrder Error:', error);
    next(error);
  }
};
